import assert from 'node:assert/strict';
import { readFile, writeFile, unlink } from 'node:fs/promises';
import { _android } from 'playwright';
import { androidAppWebView } from './android-app-webview.mjs';
import { verifyInteractionTimeout } from './verify-interaction-timeout.mjs';

const cleanup = process.argv.includes('--cleanup');
const timeout = process.argv.includes('--timeout');
const device = (await _android.devices({ omitDriverInstall: true })).find(item => item.serial() === process.env.DSHM_ANDROID_SERIAL);
assert.ok(device); device.setDefaultTimeout(20000);
const report = { at: new Date().toISOString(), cleanup, errors: [], resources: [], modelRequests: 0 };
let page;
const readDraft = input => input.evaluate(node => node.textContent === '' ? '' : node.innerText);
try {
  await device.shell('am start -f 0x20020000 -n dev.dshmobile.validation/.ValidationActivity');
  const started = Date.now() + 15000;
  while (!(await device.shell('pidof dev.dshmobile.validation')).toString().trim() && Date.now() < started) await new Promise(resolve => setTimeout(resolve, 100));
  const context = (await (await androidAppWebView(device)).page()).context();
  const ordinary = context.pages().find(item => item.url().startsWith('https://appassets.androidplatform.net/'));
  await ordinary.getByRole('button', { name: '打开侧边抽屉', exact: true }).click();
  await ordinary.getByRole('button', { name: 'Remote', exact: true }).click();
  const deadline = Date.now() + 20000;
  while (!page && Date.now() < deadline) {
    page = context.pages().find(item => item.url().startsWith('https://remote.dshm.invalid/'));
    if (!page) await new Promise(resolve => setTimeout(resolve, 100));
  }
  assert.ok(page); page.setDefaultTimeout(25000);
  page.on('pageerror', error => report.errors.push(error.message));
  page.on('console', item => { if (item.type() === 'error') report.errors.push(item.text()); });
  page.on('response', response => { if (response.status() >= 400) report.resources.push({ path: new URL(response.url()).pathname, status: response.status() }); });
  const main = page.getByTestId('remote-workspace'); await main.waitFor({ timeout: 40000 });
  const panel = page.getByRole('region', { name: '插件面板', exact: true });
  if (await panel.isVisible()) await panel.getByRole('button', { name: '返回聊天', exact: true }).click();
  const title = main.locator('.remote-heading strong');
  if (timeout) {
    if (await title.innerText() !== 'Remote') await main.getByRole('button', { name: '返回', exact: true }).click();
    await main.locator('.connection-dot.online').waitFor();
  }
  if (await title.innerText() === 'Remote') await main.locator('button.remote-session-row').filter({ has: page.getByText('DSHM Remote 联调提示', { exact: true }) }).click();
  await title.getByText('DSHM Remote 联调提示', { exact: true }).waitFor();
  const input = main.getByRole('textbox', { name: '消息', exact: true });
  await input.waitFor(); report.draft = await readDraft(input);
  const probe = page.getByTestId('live-interactions');
  if (cleanup) {
    await probe.waitFor({ state: 'detached' });
    assert.equal(report.draft, '');
    await main.getByRole('button', { name: 'Remote 选项', exact: true }).click();
    await main.getByRole('button', { name: '插件面板', exact: true }).click();
    for (let count = 0; count < 2; count++) {
      const tab = panel.getByRole('button', { name: 'DSHM 原计划验证', exact: true });
      if (!await tab.count()) break;
      await tab.last().click();
      await panel.getByRole('button', { name: '面板操作', exact: true }).click();
      await page.getByRole('menuitem', { name: '关闭当前面板', exact: true }).click();
    }
    assert.equal(await panel.getByRole('button', { name: 'DSHM 原计划验证', exact: true }).count(), 0);
    if (await panel.isVisible()) await panel.getByRole('button', { name: '返回聊天', exact: true }).click();
    await input.waitFor();
    report.unloadedAndRestored = true;
  } else if (timeout) {
    await probe.waitFor();
    await verifyInteractionTimeout(page, report);
  } else {
    await probe.waitFor();
    const marker = `${report.draft}DSHM_ORIGINAL_INTERACTION_DRAFT`;
    await input.fill(marker);
    const editor = await input.elementHandle();
    let requestId;
    const begin = async kind => {
      requestId = `${Date.now()}-${kind}`;
      await writeFile('artifacts/original-interactions-host-control.json', JSON.stringify({ id: requestId, kind, sessionId: await probe.getAttribute('data-session') }));
    };
    const completed = async () => {
      const until = Date.now() + 15000;
      while (Date.now() < until) {
        const result = await readFile('artifacts/original-interactions-host-result.json', 'utf8').then(JSON.parse).catch(() => ({}));
        if (result.id === requestId) return result;
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      throw new Error('Host result did not arrive');
    };
    await begin('question');
    const question = page.locator('[data-question-key]');
    await question.getByRole('checkbox', { name: '草稿保留', exact: true }).click();
    await question.getByRole('checkbox', { name: '电脑同步', exact: true }).click();
    await question.getByPlaceholder('输入你的答案').fill('DSHM_LIVE_ORIGINAL_OK');
    assert.equal(await editor.evaluate(node => node.isConnected), true);
    await page.screenshot({ path: 'artifacts/original-interactions-question-android.png' });
    await question.getByRole('button', { name: '提交', exact: true }).click();
    report.questionResult = await completed();
    assert.ok(JSON.stringify(report.questionResult).includes('DSHM_LIVE_ORIGINAL_OK'));
    await input.waitFor(); assert.equal(await readDraft(input), marker);
    for (const decision of ['同意执行', '要求修改']) {
      await begin('plan');
      await panel.getByText('不执行文件或命令操作', { exact: true }).filter({ visible: true }).waitFor();
      await page.screenshot({ path: `artifacts/original-interactions-plan-${decision === '同意执行' ? 'approve' : 'discuss'}-android.png` });
      await panel.getByRole('button', { name: '返回聊天', exact: true }).click();
      await page.locator('[data-plan-review-key]').getByRole('button', { name: decision, exact: true }).click();
      report[decision] = await completed();
      assert.ok(JSON.stringify(report[decision]).includes(decision === '同意执行' ? '验证通过' : 'ASK_CANCELLED'));
      await input.waitFor(); assert.equal(await readDraft(input), marker);
    }
    await input.press('ControlOrMeta+A'); await input.press('Backspace');
    if (report.draft) await input.fill(report.draft);
    assert.equal(await readDraft(input), report.draft); report.draftRestored = true;
    report.sameEditor = await input.evaluate((node, before) => node === before, editor);
    assert.equal(report.sameEditor, true);
    report.viewport = await page.evaluate(() => ({ width: innerWidth, scrollWidth: document.documentElement.scrollWidth }));
    assert.equal(report.viewport.width, report.viewport.scrollWidth);
    await editor.dispose();
  }
  assert.deepEqual(report.errors, []); assert.deepEqual(report.resources, []);
} catch (error) {
  report.failure = error.stack ?? error.message; process.exitCode = 1;
  report.hostResult = await readFile('artifacts/original-interactions-host-result.json', 'utf8').then(JSON.parse).catch(() => null);
  await page?.screenshot({ path: 'artifacts/original-interactions-failure-android.png' }).catch(() => {});
} finally {
  await unlink('artifacts/original-interactions-host-control.json').catch(error => { if (error.code !== 'ENOENT') throw error; });
  await writeFile(`artifacts/original-interactions-${cleanup ? 'cleanup' : timeout ? 'timeout' : 'live'}-android.json`, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report)); await device.close();
}
