import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { _android } from 'playwright';
import { androidAppWebView } from './android-app-webview.mjs';

const cleanup = process.argv.includes('--cleanup');
const seed = JSON.parse(await readFile('artifacts/remote-nested-recovery-20260925-prepare.json', 'utf8'));
const device = (await _android.devices({ omitDriverInstall: true })).find(item => item.serial() === process.env.DSHM_ANDROID_SERIAL);
assert.ok(device); device.setDefaultTimeout(20000);
const report = { at: new Date().toISOString(), cleanup, created: [], errors: [], resources: [] };
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
  const main = page.getByTestId('remote-workspace'); await main.waitFor({ timeout: 40000 });
  const heading = main.locator('.remote-heading strong'), input = main.getByRole('textbox', { name: '消息', exact: true });
  const menu = async (scope, name) => {
    await scope.getByRole('button', { name: 'Remote 选项', exact: true }).click();
    await scope.getByRole('button', { name, exact: true }).click();
  };
  const existingPanel = page.getByRole('region', { name: '插件面板', exact: true });
  if (await existingPanel.isVisible()) await existingPanel.getByRole('button', { name: '返回聊天', exact: true }).click();
  if (await heading.innerText() === seed.chat) await main.getByRole('button', { name: '返回', exact: true }).click();
  if (!await main.getByRole('region', { name: '聊天内容', exact: true }).count()) {
    await menu(main, '查看最近聊天');
    await main.getByRole('button', { name: /^DSHM Remote 联调提示/ }).click();
  }
  assert.equal(await heading.innerText(), seed.original); await input.waitFor(); report.draft = await input.innerText();
  if (cleanup) {
    await main.getByTestId('live-navigation').waitFor({ state: 'detached' });
    assert.equal(report.draft, JSON.parse(await readFile('artifacts/workspace-navigation-live-android.json', 'utf8')).draft);
    report.unloaded = true;
  } else {
    await main.getByRole('button', { name: '返回', exact: true }).click(); await menu(main, '查看已归档聊天');
    await main.locator('button.remote-session-row').filter({ has: page.getByText(seed.chat, { exact: true }) }).click(); await input.waitFor();
    const parentDraft = await input.innerText(), probe = main.getByTestId('live-navigation'); await probe.waitFor();
    const state = async () => {
      const value = JSON.parse(await probe.getAttribute('data-state'));
      report.created = [...new Set([...report.created, ...value.created])]; return value;
    };
    const click = async name => {
      await probe.getByRole('button', { name, exact: true }).click();
      await page.waitForFunction(name => [...document.querySelectorAll('[data-testid="live-navigation"]')]
        .some(node => JSON.parse(node.dataset.state).status === name || JSON.parse(node.dataset.state).status.startsWith('error:')), name);
      const value = await state(); assert.equal(value.status, name); return value;
    };
    await click('检查目录限制'); report.directoryRejected = true;
    const prepared = await click('准备测试聊天');
    assert.equal(await probe.getAttribute('data-session'), prepared.source); report.connectDidNotNavigate = true;
    await click('打开测试工作区');
    await page.waitForFunction(() => {
      const node = document.querySelector('[data-testid="remote-workspace"] [data-testid="live-navigation"]');
      return node && node.dataset.session === JSON.parse(node.dataset.state).opened;
    });
    const opened = await state(); report.opened = opened.opened;
    assert.equal(opened.opened, prepared.prepared); report.blankReused = true;
    await click('返回测试来源'); await heading.getByText(seed.chat, { exact: true }).waitFor();
    await click('开始工作区聊天');
    await page.waitForFunction(id => document.querySelector('[data-testid="remote-workspace"] [data-testid="live-navigation"]')?.dataset.session === id, prepared.prepared);
    report.startSession = true;
    await click('返回测试来源'); await heading.getByText(seed.chat, { exact: true }).waitFor();
    const forked = await click('分支测试来源'); report.forked = forked.forked;
    assert.equal(await probe.getAttribute('data-session'), forked.forked);
    // 归档当前会话会返回列表，插件状态由生命周期保留；先从列表重新打开测试来源。
    await probe.getByRole('button', { name: '归档测试分支', exact: true }).click();
    await heading.getByText('Remote', { exact: true }).waitFor();
    await main.locator('button.remote-session-row').filter({ has: page.getByText(seed.chat, { exact: true }) }).click(); await input.waitFor();
    assert.equal((await state()).status, '归档测试分支'); report.archiveClearedMain = true;
    await click('恢复测试分支'); report.unarchive = true;
    assert.equal(await input.innerText(), parentDraft);
    await menu(main, '子会话');
    await main.getByRole('dialog', { name: '子会话', exact: true }).getByRole('group', { name: /DSHM 恢复子会话/ })
      .getByRole('button', { name: '在旁栏打开', exact: true }).click();
    const panel = page.getByRole('region', { name: '插件面板', exact: true });
    const aside = page.getByTestId('remote-sidebar-conversation').filter({ visible: true });
    await aside.getByTestId('live-navigation').getByRole('button', { name: '返回测试来源', exact: true }).click();
    await panel.waitFor({ state: 'hidden' }); await input.waitFor();
    assert.equal(await heading.innerText(), seed.chat); report.sidebarOpensMain = true;
    await menu(main, '插件面板');
    await panel.getByRole('navigation', { name: '已打开的面板', exact: true })
      .getByRole('button', { name: 'DSHM 恢复子会话', exact: true }).click();
    await panel.getByRole('button', { name: '面板操作', exact: true }).click();
    await page.getByRole('menuitem', { name: '关闭当前面板', exact: true }).click();
    if (await panel.isVisible()) await panel.getByRole('button', { name: '返回聊天', exact: true }).click();
    await main.getByRole('button', { name: '返回', exact: true }).click(); await menu(main, '查看最近聊天');
    await main.getByRole('button', { name: /^DSHM Remote 联调提示/ }).click(); await input.waitFor();
    assert.equal(await input.innerText(), report.draft); report.originalRestored = true;
    await main.getByRole('article', { name: '模型回复', exact: true }).first().waitFor();
    await page.screenshot({ path: 'artifacts/workspace-navigation-restored-android.png' });
  }
  assert.deepEqual(report.errors, []); assert.deepEqual(report.resources, []);
} catch (error) {
  report.failure = error.stack ?? error.message; process.exitCode = 1;
  await page?.screenshot({ path: 'artifacts/workspace-navigation-failure-android.png' }).catch(() => {});
} finally {
  if (page && !cleanup) {
    const more = await page.getByTestId('live-navigation').first().getAttribute('data-state', { timeout: 1000 }).catch(() => null);
    if (more) report.created = [...new Set([...report.created, ...JSON.parse(more).created])];
    report.archived = await page.evaluate(async ids => {
      const results = [];
      for (const sessionId of ids) {
        const result = await window.__DSH_TRANSPORT__.rpc.call('/api', 'workspace/archiveSession', { args: { request: { sessionId } } }, new AbortController().signal);
        results.push({ sessionId, archived: result.ok && result.value.archivedSessionIds.includes(sessionId) });
      }
      return results;
    }, report.created).catch(error => ({ failure: error.message }));
    if (!Array.isArray(report.archived) || report.archived.some(value => !value.archived)) process.exitCode = 1;
  }
  await writeFile(`artifacts/workspace-navigation-${cleanup ? 'cleanup' : 'live'}-android.json`, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report)); await device.close();
}
