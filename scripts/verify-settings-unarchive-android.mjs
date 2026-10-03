import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { _android } from 'playwright';
import { androidAppWebView } from './android-app-webview.mjs';

const seed = JSON.parse(await readFile('artifacts/preset-creator-android.json', 'utf8'));
assert.equal(seed.archived, true); assert.equal(seed.hostPreset, 'cordis');
assert.ok(seed.observedNew.some(session => session.id === seed.createdSession));
const sessionId = seed.createdSession, title = `DSHM 设置归档验收 ${sessionId.slice(-8)}`;
const report = { at: new Date().toISOString(), sessionId, errors: [] };
const device = (await _android.devices({ omitDriverInstall: true })).find(item => item.serial() === '127.0.0.1:16384');
assert.ok(device); device.setDefaultTimeout(20000);
const button = (root, name) => root.getByRole('button', { name, exact: true });
let page, settings;
const rpc = (endpoint, request) => page.evaluate(async ({ endpoint, request }) =>
  window.__DSH_TRANSPORT__.rpc.call('/api', endpoint, { args: { request } }, new AbortController().signal), { endpoint, request });
try {
  const context = (await (await androidAppWebView(device)).page()).context();
  page = context.pages().find(item => item.url().includes('/remote.html')); assert.ok(page);
  page.on('pageerror', () => report.errors.push('page-error'));
  // 仅为前一项验收明确新建的已归档空会话设置唯一标题，不改用户会话。
  const renamed = await rpc('session/rename', { sessionId, title }); assert.equal(renamed.ok, true);
  const main = page.getByTestId('remote-workspace');
  const input = main.getByRole('textbox', { name: '消息', exact: true }); const draft = await input.textContent();
  await button(main, 'Remote 选项').click(); await button(main, '电脑设置').click();
  settings = page.getByRole('dialog', { name: '电脑设置', exact: true });
  await settings.getByRole('combobox', { name: '设置页面', exact: true }).selectOption('archived-sessions');
  await settings.getByRole('searchbox', { name: '搜索已归档会话', exact: true }).fill(title);
  const restore = button(settings, `取消归档 ${title}`); await restore.waitFor();
  await restore.click(); await restore.waitFor({ state: 'detached' });
  await settings.getByText('没有匹配的会话。', { exact: true }).waitFor(); report.restoredFromSettings = true;
  report.alerts = await settings.getByRole('alert').allTextContents(); assert.deepEqual(report.alerts, []);
  await button(settings, '关闭窗口').click(); assert.equal(await input.textContent(), draft); report.draftPreserved = true;
  assert.deepEqual(report.errors, []);
} catch (error) { report.failure = error.message; process.exitCode = 1; }
finally {
  if (page) {
    // 清理仍走真实手机认证通道，回执必须包含本次会话。
    try {
      const result = await rpc('workspace/archiveSession', { sessionId });
      assert.equal(result.ok, true); assert.ok(result.value.archivedSessionIds.includes(sessionId));
      report.rearchived = true;
      if (await settings?.isVisible()) await button(settings, '关闭窗口').click();
    } catch (error) { report.cleanupFailure = error.message; process.exitCode = 1; }
  }
  await writeFile('artifacts/settings-unarchive-android.json', JSON.stringify(report, null, 2)); await device.close();
}
console.log(JSON.stringify(report));
