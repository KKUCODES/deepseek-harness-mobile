import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { _android } from 'playwright';
import { androidAppWebView } from './android-app-webview.mjs';
async function host() {
  for (let i = 0; i < 30; i++) {
    try { return JSON.parse(await readFile('artifacts/preset-policy-host.json', 'utf8')); }
    catch (error) { if (!(error instanceof SyntaxError)) throw error; await new Promise(r => setTimeout(r, 50)); }
  }
  throw Error('Host report unavailable');
}
async function waitHost(predicate) {
  for (let i = 0; i < 100; i++) { const value = await host(); if (predicate(value)) return value; await new Promise(r => setTimeout(r, 100)); }
  throw Error('Host state did not converge');
}
const original = await host(), report = { at: new Date().toISOString(), errors: [] };
assert.notEqual(original.command, 'disposed', '需要当前正在运行的独立 Host 观察器');
const selectionDisabled = process.argv.includes('--selection-disabled');
const newSession = selectionDisabled || process.argv.includes('--new-session');
const device = (await _android.devices({ omitDriverInstall: true })).find(d => d.serial() === '127.0.0.1:16384');
assert.ok(device); device.setDefaultTimeout(30000);
const button = (root, name) => root.getByRole('button', { name, exact: true });
let page, settings;
try {
  const context = (await (await androidAppWebView(device)).page()).context();
  page = context.pages().find(p => p.url().includes('/remote.html')); assert.ok(page);
  page.on('pageerror', () => report.errors.push('page-error'));
  if (await button(page, '重新连接').isVisible()) await button(page, '重新连接').click();
  const main = page.getByTestId('remote-workspace'); await main.waitFor({ timeout: 60000 });
  const welcome = page.getByRole('dialog', { name: '内测声明', exact: true });
  if (await welcome.isVisible()) await button(welcome, '继续').click();
  if (await main.locator('.remote-heading strong').innerText() === 'Remote') await main.locator('button.remote-session-row').filter({ has: page.getByText('DSHM Remote 联调提示', { exact: true }) }).click();
  const input = main.getByRole('textbox', { name: '消息', exact: true }); await input.waitFor(); const draft = await input.textContent();
  const existingId = 'session-d4ec40ee-a27c-41fc-a860-b3974434e637';
  const loaded = await waitHost(value => value.sessions.some(session => session.id === existingId));
  const existingPreset = loaded.sessions.find(session => session.id === existingId).preset;
  await button(main, 'Remote 选项').click(); await button(main, '电脑设置').click();
  settings = page.getByRole('dialog', { name: '电脑设置', exact: true });
  await settings.getByRole('combobox', { name: '设置页面', exact: true }).selectOption('agent-presets');
  const toggle = settings.getByRole('switch', { name: '允许切换agent模式', exact: true }); await toggle.waitFor();
  await toggle.click();
  await waitHost(value => value.current.modeSelectionEnabled === !original.original.modeSelectionEnabled);
  report.togglePersisted = true;
  if (original.original.modeSelectionEnabled) { await toggle.click(); await waitHost(value => value.current.modeSelectionEnabled === true); }
  const target = original.target === 'minimal' ? '极简模式' : '标准模式';
  await button(settings, `设为默认: ${target}`).click();
  await waitHost(value => value.current.default === original.target);
  await button(settings, `新任务默认: ${target}`).waitFor(); report.defaultPersisted = true;
  if (selectionDisabled) {
    await toggle.click(); await waitHost(value => value.current.modeSelectionEnabled === false);
    assert.equal(await button(settings, '用「创造模式」创作自定义预设').isDisabled(), true);
    report.creatorDisabled = true;
  }
  report.alerts = await settings.getByRole('alert').allTextContents(); assert.deepEqual(report.alerts, []);
  await button(settings, '关闭窗口').click(); assert.equal(await input.textContent(), draft); report.draftPreserved = true;
  if (newSession) {
    const roster = await page.evaluate(() => window.__DSH_TRANSPORT__.rpc.call('/api', 'agentPresets/list', { args: {} }, new AbortController().signal));
    assert.equal(roster.ok, true);
    const effective = roster.value.presets.find(preset => preset.isDefault)?.id;
    assert.ok(['minimal', 'standard'].includes(effective));
    if (!selectionDisabled) assert.equal(effective, original.target);
    const effectiveLabel = effective === 'minimal' ? '极简模式' : '标准模式';
    report.effectiveDefault = effective;
    const before = new Set((await host()).sessions.map(session => session.id));
    await button(main, 'Remote 选项').click(); await button(main, '新建聊天').click();
    const picker = page.getByRole('dialog', { name: '选择工作区', exact: true });
    await button(picker, 'DSH-TEST').click(); await picker.waitFor({ state: 'detached' });
    const created = (await waitHost(value => value.sessions.some(session => !before.has(session.id)))).sessions.filter(session => !before.has(session.id));
    assert.equal(created.length, 1, '只处理本次新建的唯一会话');
    report.createdSession = created[0].id;
    assert.equal(created[0].preset, effective);
    await button(main, 'Remote 选项').click(); await button(main, 'Agent 模式').click();
    const modes = page.getByRole('dialog', { name: 'Agent 模式', exact: true });
    await modes.getByRole('button', { name: effectiveLabel, exact: true }).and(modes.locator('[aria-pressed="true"]')).waitFor();
    report.newSessionDefault = { host: created[0].preset, phone: effectiveLabel };
    if (selectionDisabled) {
      await modes.getByText('电脑未开启模式选择。', { exact: true }).waitFor();
      assert.ok((await modes.locator('button[aria-pressed]').evaluateAll(nodes => nodes.map(node => node.disabled))).every(Boolean));
      report.selectionDisabled = true;
      assert.equal((await host()).sessions.find(session => session.id === existingId)?.preset, existingPreset);
      report.existingPresetPreserved = true;
    }
    await button(modes, '关闭窗口').click();
    await button(main, 'Remote 选项').click(); await button(main, '归档聊天').click();
    await main.locator('.remote-heading strong').getByText('Remote', { exact: true }).waitFor();
    report.archived = true;
    await main.locator('button.remote-session-row').filter({ has: page.getByText('DSHM Remote 联调提示', { exact: true }) }).click();
    await input.waitFor(); assert.equal(await input.textContent(), draft);
    report.returnedWithDraft = true;
  }
  assert.deepEqual(report.errors, []);
} catch (error) { report.failure = error.message; process.exitCode = 1; }
finally {
  const sequence = randomUUID();
  await writeFile('artifacts/preset-policy-command.json', JSON.stringify({ id: original.id, action: 'restore', sequence }));
  try { report.restored = (await waitHost(value => value.id === original.id && value.command === sequence && value.restored)).restored; }
  finally { await writeFile(`artifacts/${selectionDisabled ? 'preset-selection-disabled' : newSession ? 'preset-default-new-session' : 'preset-policy'}-android.json`, JSON.stringify(report, null, 2)); await device.close(); }
}
console.log(JSON.stringify(report));
