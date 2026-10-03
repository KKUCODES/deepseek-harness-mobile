import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { _android } from 'playwright';
import { androidAppWebView } from './android-app-webview.mjs';

const report = { at: new Date().toISOString(), errors: [] };
const host = async () => {
  for (let i = 0; i < 30; i++) {
    try { return JSON.parse(await readFile('artifacts/preset-policy-host.json', 'utf8')); }
    catch (error) { if (!(error instanceof SyntaxError)) throw error; await new Promise(resolve => setTimeout(resolve, 50)); }
  }
  throw Error('Host report unavailable');
};
async function waitHost(predicate) {
  for (let i = 0; i < 100; i++) { const value = await host(); if (predicate(value)) return value; await new Promise(resolve => setTimeout(resolve, 100)); }
  throw Error('Host observation did not converge');
}
assert.notEqual((await host()).command, 'disposed');
const device = (await _android.devices({ omitDriverInstall: true })).find(item => item.serial() === '127.0.0.1:16384');
assert.ok(device); device.setDefaultTimeout(20000);
const button = (root, name) => root.getByRole('button', { name, exact: true });
let page;
try {
  const context = (await (await androidAppWebView(device)).page()).context();
  page = context.pages().find(item => item.url().includes('/remote.html')); assert.ok(page);
  page.on('pageerror', () => report.errors.push('page-error'));
  if (await button(page, '重新连接').isVisible()) await button(page, '重新连接').click();
  const main = page.getByTestId('remote-workspace'); await main.waitFor({ timeout: 60000 });
  const welcome = page.getByRole('dialog', { name: '内测声明', exact: true });
  if (await welcome.isVisible()) await button(welcome, '继续').click();
  if (await main.locator('.remote-heading strong').innerText() === 'Remote') await main.locator('button.remote-session-row').filter({ has: page.getByText('DSHM Remote 联调提示', { exact: true }) }).click();
  const input = main.getByRole('textbox', { name: '消息', exact: true }); await input.waitFor();
  const draft = await input.textContent();
  const menu = async name => { await button(main, 'Remote 选项').click(); await button(main, name).click(); };
  // Host 定时观察晚于页面：先确认原聊天已加载，避免把它误计为新建会话。
  const loaded = await waitHost(value => value.sessions.some(session => session.id === 'session-d4ec40ee-a27c-41fc-a860-b3974434e637'));
  const before = new Set(loaded.sessions.map(session => session.id));
  report.before = [...before];
  await menu('新建聊天');
  const picker = page.getByRole('dialog', { name: '选择工作区', exact: true });
  await button(picker, 'DSH-TEST').click(); await picker.waitFor({ state: 'detached' });
  const created = (await waitHost(value => value.sessions.some(session => !before.has(session.id)))).sessions.filter(session => !before.has(session.id));
  report.observedNew = created;
  assert.equal(created.length, 1); report.createdSession = created[0].id;
  await writeFile('artifacts/preset-creator-android.json', JSON.stringify(report, null, 2));
  await menu('电脑设置');
  const settings = page.getByRole('dialog', { name: '电脑设置', exact: true });
  await settings.getByRole('combobox', { name: '设置页面', exact: true }).selectOption('agent-presets');
  await button(settings, '用「创造模式」创作自定义预设').click();
  await settings.waitFor({ state: 'detached' }); report.settingsClosed = true;
  await waitHost(value => value.sessions.find(session => session.id === report.createdSession)?.preset === 'cordis');
  report.hostPreset = 'cordis';
  await menu('Agent 模式');
  const modes = page.getByRole('dialog', { name: 'Agent 模式', exact: true });
  report.phonePreset = await modes.locator('[aria-pressed="true"]').getAttribute('aria-label');
  assert.equal(report.phonePreset, '创造模式');
  await button(modes, '关闭窗口').click();
  await menu('归档聊天'); await main.locator('.remote-heading strong').getByText('Remote', { exact: true }).waitFor();
  report.archived = true;
  await main.locator('button.remote-session-row').filter({ has: page.getByText('DSHM Remote 联调提示', { exact: true }) }).click();
  await input.waitFor(); assert.equal(await input.textContent(), draft); report.draftPreserved = true;
  assert.deepEqual(report.errors, []);
} catch (error) { report.failure = error.message; process.exitCode = 1; }
finally { await writeFile('artifacts/preset-creator-android.json', JSON.stringify(report, null, 2)); await device.close(); }
console.log(JSON.stringify(report));
