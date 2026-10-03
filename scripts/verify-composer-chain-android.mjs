import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { _android } from 'playwright';
import { androidAppWebView } from './android-app-webview.mjs';

// 独立电脑插件的本地交互验证；只读专用会话，不提交模型消息或改写草稿。
const cleanup = process.argv.includes('--cleanup');
const seed = JSON.parse(await readFile('artifacts/remote-nested-recovery-20260925-prepare.json', 'utf8'));
const device = (await _android.devices({ omitDriverInstall: true })).find(item => item.serial() === process.env.DSHM_ANDROID_SERIAL);
assert.ok(device); device.setDefaultTimeout(20000);
const report = { at: new Date().toISOString(), cleanup, errors: [], resources: [] };
let page;
try {
  await device.shell('am start -f 0x20020000 -n dev.dshmobile.validation/.ValidationActivity');
  const startedBy = Date.now() + 15000;
  while (!(await device.shell('pidof dev.dshmobile.validation')).toString().trim() && Date.now() < startedBy) await new Promise(resolve => setTimeout(resolve, 100));
  const context = (await (await androidAppWebView(device)).page()).context();
  const ordinary = context.pages().find(item => item.url().startsWith('https://appassets.androidplatform.net/'));
  assert.ok(ordinary);
  await ordinary.getByRole('button', { name: '打开侧边抽屉', exact: true }).click();
  await ordinary.getByRole('button', { name: 'Remote', exact: true }).click();
  const until = Date.now() + 20000;
  while (!page && Date.now() < until) {
    page = context.pages().find(item => item.url().startsWith('https://remote.dshm.invalid/'));
    if (!page) await new Promise(resolve => setTimeout(resolve, 100));
  }
  assert.ok(page); page.setDefaultTimeout(20000);
  page.on('pageerror', error => report.errors.push(error.message));
  page.on('response', response => { if (response.status() >= 400) report.resources.push({ path: new URL(response.url()).pathname, status: response.status() }); });
  const main = page.getByTestId('remote-workspace');
  await page.waitForFunction(() => document.querySelector('[data-testid="remote-workspace"]')
    || [...document.querySelectorAll('button')].some(node => node.textContent === '重新连接' && !node.disabled));
  const reconnect = page.getByRole('button', { name: '重新连接', exact: true });
  if (await reconnect.isVisible()) await reconnect.click();
  await main.waitFor({ timeout: 40000 });
  if (!await main.getByRole('region', { name: '聊天内容', exact: true }).count()) await main.getByRole('button', { name: /^DSHM Remote 联调提示/ }).click();
  assert.equal(await main.locator('.remote-heading strong').innerText(), seed.original);
  const input = main.getByRole('textbox', { name: '消息', exact: true });
  const takeover = main.getByTestId('live-composer-panel');
  if (cleanup) {
    await page.getByTestId('live-composer-start').waitFor({ state: 'detached' });
    await takeover.waitFor({ state: 'detached' }); await input.waitFor();
    const previous = JSON.parse(await readFile('artifacts/composer-chain-live-android.json', 'utf8'));
    assert.equal(await input.innerText(), previous.draft);
    report.unloadedAndRestored = true;
  } else {
    const trigger = main.getByTestId('live-composer-start'); await trigger.waitFor();
    if (await takeover.isVisible()) await takeover.getByRole('button', { name: '完成插件输入' }).click();
    await input.waitFor(); report.draft = await input.innerText();
    const original = await input.elementHandle();
    const rootId = await trigger.getAttribute('data-session');
    await trigger.click(); await takeover.waitFor();
    assert.equal(await takeover.getAttribute('data-session'), rootId);
    assert.equal((await takeover.getByTestId('live-composer-draft').innerText()).trim(), report.draft.trim());
    assert.equal(await input.count(), 0); report.retainedAfterTakeover = await original.evaluate(node => node.isConnected);
    assert.equal(report.retainedAfterTakeover, true, '接管后默认编辑器应保留');
    report.geometry = await takeover.evaluate(node => ({ original: node.offsetWidth, displayed: node.getBoundingClientRect().width,
      viewport: innerWidth, scrollWidth: document.documentElement.scrollWidth, clientWidth: document.documentElement.clientWidth }));
    // WebView 的缩放矩阵可能产生亚像素浮点误差；实际页面仍不得横向溢出。
    assert.equal(report.geometry.original, 600); assert.ok(report.geometry.displayed <= report.geometry.viewport + 0.01);
    assert.equal(report.geometry.scrollWidth, report.geometry.clientWidth);
    await takeover.getByRole('button', { name: '完成插件输入' }).click(); await input.waitFor();
    assert.equal(await input.evaluate((node, saved) => node === saved, original), true); await original.dispose();
    assert.equal(await input.innerText(), report.draft); report.retainedEditor = true;
    await trigger.click(); await takeover.waitFor();
    await main.getByRole('button', { name: '返回', exact: true }).click();
    const menu = async name => { await main.getByRole('button', { name: 'Remote 选项', exact: true }).click(); await main.getByRole('button', { name, exact: true }).click(); };
    await menu('查看已归档聊天');
    await main.getByRole('button', { name: new RegExp(`^${seed.chat}`) }).click();
    await input.waitFor(); assert.equal(await takeover.count(), 0);
    await menu('子会话');
    await main.getByRole('dialog', { name: '子会话', exact: true }).getByRole('group', { name: /DSHM 恢复子会话/ })
      .getByRole('button', { name: '在旁栏打开', exact: true }).click();
    const aside = page.getByTestId('remote-sidebar-conversation').filter({ visible: true });
    const sideInput = aside.getByRole('textbox', { name: '消息', exact: true }); await sideInput.waitFor();
    const sideDraft = await sideInput.innerText();
    await aside.getByTestId('live-composer-start').click();
    const sidePanel = aside.getByTestId('live-composer-panel'); await sidePanel.waitFor();
    assert.notEqual(await sidePanel.getAttribute('data-session'), rootId);
    assert.equal(await sideInput.count(), 0);
    await page.screenshot({ path: 'artifacts/composer-chain-sidebar-android.png' });
    await sidePanel.getByRole('button', { name: '完成插件输入' }).click();
    await sideInput.waitFor(); assert.equal(await sideInput.innerText(), sideDraft);
    const panel = page.getByRole('region', { name: '插件面板', exact: true });
    await panel.getByRole('button', { name: '面板操作', exact: true }).click();
    await page.getByRole('menuitem', { name: '关闭当前面板', exact: true }).click();
    if (await panel.isVisible()) await panel.getByRole('button', { name: '返回聊天', exact: true }).click();
    await main.getByRole('button', { name: '返回', exact: true }).click();
    await menu('查看最近聊天');
    await main.getByRole('button', { name: /^DSHM Remote 联调提示/ }).click();
    await takeover.waitFor(); assert.equal(await takeover.getAttribute('data-session'), rootId);
    report.sidebarIsolation = true; report.originalRestored = true;
    await page.screenshot({ path: 'artifacts/composer-chain-live-android.png' });
    // 保留这一本地交互，下一步通过实际卸载验证默认编辑器恢复。
  }
  assert.deepEqual(report.errors, []); assert.deepEqual(report.resources, []);
} catch (error) {
  report.failure = error.stack ?? error.message;
  if (page) await page.screenshot({ path: 'artifacts/composer-chain-failure-android.png' }).catch(() => {});
  process.exitCode = 1;
} finally {
  await writeFile(`artifacts/composer-chain-${cleanup ? 'cleanup' : 'live'}-android.json`, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report)); await device.close();
}
