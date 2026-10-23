import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { setTimeout as wait } from 'node:timers/promises';
import { _android } from 'playwright';
import { androidAppWebView } from './android-app-webview.mjs';

// 只使用本轮测试UID与隔离中转；配对链接仅在进程内传递，不输出凭据。
const output = resolve('artifacts/rc21'), control = resolve('../backend/artifacts/rc21-host');
async function readJson(file) {
  for (let attempt = 0; attempt < 10; attempt++) {
    try { return JSON.parse(await readFile(file, 'utf8')); }
    catch (error) { if (!(error instanceof SyntaxError)) throw error; await wait(50); }
  }
  throw Error('test_state_incomplete');
}
const state = await readJson(resolve(control, 'state.json'));
assert.equal(state.stage, 'ready');
const pkg = process.env.DSHM_CHECK_APP ?? 'dev.dshmobile.validation.rc21test';
assert.ok(['dev.dshmobile.validation.rc21test', 'dev.dshmobile.validation.compatibilitytest'].includes(pkg));
const device = (await _android.devices({ omitDriverInstall: true })).find(d => d.serial() === '127.0.0.1:16384');
assert.ok(device); device.setDefaultTimeout(20000);
const report = { version: state.version, package: pkg, errors: [], inference: false };
async function command(action, fields = {}) {
  const id = randomUUID();
  await writeFile(resolve(control, 'command.json'), JSON.stringify({ id, run: state.run, action, ...fields }));
  for (const deadline = Date.now() + 20000; Date.now() < deadline;) {
    const current = await readJson(resolve(control, 'state.json'));
    if (current.command?.id === id) { assert.equal(current.command.completed, true, current.command.error); return; }
    await wait(100);
  }
  throw Error('test_control_timeout');
}
try {
  // 新建专用UID，仅清理本脚本的测试数据，绝不触碰已发布App。
  assert.equal((await device.shell(`pm clear ${pkg}`)).toString().trim(), 'Success');
  await device.shell(`am start -W -n ${pkg}/dev.dshmobile.validation.ValidationActivity`);
  const ordinary = await (await androidAppWebView(device, pkg)).page();
  ordinary.on('pageerror', error => report.errors.push(error.message));
  await ordinary.getByRole('button', { name: '打开侧边抽屉', exact: true }).waitFor();
  report.ordinaryReady = true;
  await ordinary.getByRole('button', { name: '打开侧边抽屉', exact: true }).click();
  await ordinary.getByRole('button', { name: '设置', exact: true }).click();
  await ordinary.getByRole('button', { name: /外观与语言/ }).click();
  for (const [label, scheme] of [['浅色', 'light'], ['深色', 'dark'], ['跟随系统', 'system']]) {
    await ordinary.getByRole('button', { name: /^主题/ }).click();
    await ordinary.getByRole('button', { name: label, exact: true }).click();
    await ordinary.waitForFunction(value => document.documentElement.getAttribute('data-ds-theme-source') === value, scheme);
  }
  report.themeSwitch = true;
  await ordinary.getByRole('button', { name: '返回设置首页', exact: true }).click();
  await ordinary.getByRole('button', { name: '退出设置', exact: true }).click();
  await ordinary.getByRole('button', { name: '打开侧边抽屉', exact: true }).click();
  const opening = ordinary.context().waitForEvent('page', { predicate: p => p.url().startsWith('https://remote.dshm.invalid/') });
  await ordinary.getByRole('button', { name: 'Remote', exact: true }).click();
  const page = await opening;
  page.on('pageerror', error => report.errors.push(error.message));
  page.on('console', message => {
    if (['error', 'warning'].includes(message.type())) (report.pluginLogs ??= []).push(message.text().slice(0, 800));
  });
  page.setDefaultTimeout(30000);
  await command('pair');
  const pairing = JSON.parse(await readFile(resolve(control, 'pair.private.json'), 'utf8'));
  assert.equal(pairing.run, state.run);
  await page.getByRole('textbox', { name: '一次性配对链接', exact: true }).fill(pairing.link);
  const name = `DSHM rc21 ${randomUUID().slice(0, 8)}`;
  await page.getByLabel('设备名称', { exact: true }).fill(name);
  await page.getByRole('button', { name: '继续配对', exact: true }).click();
  await page.getByRole('heading', { name: '等待电脑批准', exact: true }).waitFor();
  const fingerprint = await page.getByTestId('remote-fingerprint').innerText();
  await command('approve', { name, fingerprint });
  await page.getByRole('button', { name: '我已在电脑批准', exact: true }).click();
  await page.getByTestId('remote-workspace').waitFor({ timeout: 60000 });
  report.remoteReady = true;
  report.ownPage = (await page.locator('iframe').count()) === 0;
  await page.getByRole('button', { name: '在已有工作区新建聊天', exact: true }).click();
  await page.getByLabel('选择工作区', { exact: true }).getByRole('button', { name: 'rc21-check-project', exact: true }).click();
  await page.locator('[data-composer-input]').waitFor();
  report.workspaceAndComposer = true;
  await page.reload();
  await page.getByTestId('remote-workspace').waitFor({ timeout: 60000 });
  await page.getByRole('button', { name: 'rc21-check-project', exact: true }).waitFor();
  await page.getByRole('button', { name: '在已有工作区新建聊天', exact: true }).click();
  await page.getByLabel('选择工作区', { exact: true }).getByRole('button', { name: 'rc21-check-project', exact: true }).click();
  await page.locator('[data-composer-input]').waitFor();
  report.reconnect = true;
  await page.getByRole('button', { name: 'Remote 选项', exact: true }).click();
  await page.getByRole('button', { name: '电脑插件', exact: true }).click();
  const list = page.getByTestId('remote-plugin-list'); await list.waitFor();
  report.plugins = await list.locator('[data-plugin-id]').evaluateAll(rows => rows.map(row => ({ id: row.dataset.pluginId, state: row.dataset.pluginState })));
  assert.ok(report.plugins.some(row => row.state === 'active'), 'no_active_remote_plugins');
  assert.equal(report.plugins.find(row => row.id === '@deepseek-ai/dsh-client-ui-theme')?.state, 'active', 'remote_theme_inactive');
  report.failedPlugins = report.plugins.filter(row => row.state === 'failed').map(row => row.id);
  if (pkg.endsWith('.rc21test')) assert.deepEqual(report.failedPlugins, [], 'current_sdk_plugin_activation_failed');
  await page.getByRole('button', { name: '关闭窗口', exact: true }).click();
  const pid = (await device.shell(`pidof ${pkg}`)).toString().trim(); assert.match(pid, /^\d+$/);
  for (const deadline = Date.now() + 15000; Date.now() < deadline;) {
    const log = (await device.shell(`logcat --pid=${pid} -d -s DSHMNoticeConnection:D`)).toString();
    if (/DSHMNoticeConnection: listening/.test(log)) { report.nativeNotificationsListening = true; break; }
    await wait(200);
  }
  assert.equal(report.nativeNotificationsListening, true, 'native_notice_subscription_missing');
  await writeFile(resolve(output, `android-${state.version}-${pkg.split('.').at(-1)}.png`), await device.screenshot());
  report.visible = (await page.locator('body').innerText()).slice(0, 2000);
  assert.deepEqual(report.errors, []);
} catch (error) {
  report.failure = error.message.replace(/[A-Za-z0-9_-]{43}/g, '[redacted]'); process.exitCode = 1;
  await writeFile(resolve(output, 'android-failure.png'), await device.screenshot());
} finally {
  await command('revoke').catch(() => {});
  const bytes = JSON.stringify(report, null, 2);
  await writeFile(resolve(output, `android-${state.version}-${pkg.split('.').at(-1)}.json`), bytes);
  await writeFile(resolve(output, `android-run-${Date.now()}.json`), bytes);
  const { plugins, ...summary } = report;
  console.log(JSON.stringify({ ...summary, pluginCounts: plugins?.reduce((counts, row) => ({ ...counts, [row.state]: (counts[row.state] ?? 0) + 1 }), {}) }));
  await device.close();
}
