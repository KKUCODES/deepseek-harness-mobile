import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { _android } from 'playwright';
import { androidAppWebView } from './android-app-webview.mjs';
import { localDesktopManagement } from './local-desktop-management.mjs';

assert.equal(process.env.DSHM_RUN_LIVE, '1');
const report = { at: new Date().toISOString(), errors: [] };
const button = (root, name) => root.getByRole('button', { name, exact: true });
let device, page, panel, api, identity, touched = false, originalDraft;
async function until(check, timeout = 15000) {
  const end = Date.now() + timeout;
  do { if (await check()) return; await new Promise(resolve => setTimeout(resolve, 100)); } while (Date.now() < end);
  throw Error('condition_deadline');
}
async function chatReady() {
  const main = page.getByTestId('remote-workspace'); await main.waitFor({ timeout: 45000 });
  const welcome = page.getByRole('dialog', { name: '内测声明', exact: true });
  if (await welcome.isVisible()) await button(welcome, '继续').click();
  if (await main.locator('.remote-heading strong').innerText() === 'Remote') {
    await main.locator('.connection-dot.online').waitFor({ timeout: 45000 });
    await main.locator('button.remote-session-row').filter({ has: page.getByText('DSHM Remote 联调提示', { exact: true }) }).click();
  }
  assert.equal(await main.locator('.remote-heading strong').innerText(), 'DSHM Remote 联调提示');
  return main;
}
async function reconnect() {
  await button(page, '重新连接').waitFor(); await button(page, '重新连接').click(); return chatReady();
}
try {
  api = await localDesktopManagement();
  const matches = (await api()).devices.filter(row => row.fingerprint === 'EYvtQJ2f8cICRebQxcWaUTtmkPQ01XcdfKG_V2tE-lE');
  assert.equal(matches.length, 1); identity = matches[0];
  assert.equal(identity.status, 'active'); assert.equal(identity.management, false);
  device = (await _android.devices({ omitDriverInstall: true })).find(row => row.serial() === '127.0.0.1:16384'); assert.ok(device);
  await device.shell('am start -n dev.dshmobile.validation/.ValidationActivity');
  await until(async () => !!(await device.shell('pidof dev.dshmobile.validation')).toString().trim());
  const root = await (await androidAppWebView(device)).page();
  page = root.context().pages().find(row => row.url().startsWith('https://remote.dshm.invalid/'));
  if (!page) {
    const ordinary = root.context().pages().find(row => row.url().startsWith('https://appassets.androidplatform.net/'));
    assert.ok(ordinary);
    await button(ordinary, '打开侧边抽屉').click(); await button(ordinary, 'Remote').click();
    await until(() => !!(page = root.context().pages().find(row => row.url().startsWith('https://remote.dshm.invalid/'))));
  }
  page.setDefaultTimeout(15000); page.on('pageerror', () => report.errors.push('page-error'));
  if (await button(page, '重新连接').isVisible()) await reconnect();
  let main = await chatReady();
  originalDraft = await main.getByRole('textbox', { name: '消息', exact: true }).innerHTML();
  touched = true; await api({ action: 'management', deviceId: identity.id, enabled: true });
  main = await reconnect();
  await button(main, 'Remote 选项').click(); await button(main, '电脑设置').click();
  panel = page.getByRole('dialog', { name: '电脑设置', exact: true });
  const field = panel.getByRole('spinbutton', { name: '等待输出超时（毫秒）', exact: true }); await field.waitFor();
  const original = Number(await field.inputValue());
  const edited = String(original < 2147482647 ? original + 1000 : original - 1000);
  await field.fill(edited);
  const endpoint = panel.getByRole('region', { name: '电脑模型服务地址', exact: true });
  const address = endpoint.getByRole('textbox', { name: '新的完整服务地址', exact: true });
  await address.fill('https://unsaved.example/api');
  await button(endpoint, '核对新地址').click();
  console.log('SETTINGS_READY_TO_STOP_GATEWAY');
  await main.getByTestId('remote-offline-status').waitFor({ timeout: 60000 });
  await panel.getByText(/^(正在连接电脑…|电脑连接已断开，重新连接后可继续操作。)$/).waitFor();
  assert.equal(await field.inputValue(), edited); assert.equal(await field.isDisabled(), true);
  await endpoint.getByRole('group', { name: '确认服务地址', exact: true }).getByText('https://unsaved.example/api', { exact: true }).waitFor();
  assert.equal(await button(endpoint, '确认更改服务地址').isDisabled(), true);
  report.offlineDraftPreserved = true;
  await page.screenshot({ path: 'artifacts/settings-disconnect-offline.png' });
  console.log('SETTINGS_READY_TO_START_GATEWAY');
  await main.getByTestId('remote-offline-status').waitFor({ state: 'detached', timeout: 90000 });
  await panel.waitFor(); await until(async () => !await field.isDisabled());
  assert.equal(await field.inputValue(), edited);
  await endpoint.getByRole('group', { name: '确认服务地址', exact: true }).getByText('https://unsaved.example/api', { exact: true }).waitFor();
  report.recoveredDraftPreserved = true;
  await button(endpoint, '取消更改地址').click();
  assert.equal(await address.inputValue(), 'https://unsaved.example/api');
  // 丢弃本次未提交草稿，再读电脑权威值；整个测试不点击任何保存按钮。
  await button(panel.locator('.remote-computer-settings'), '重新读取设置').click();
  await until(async () => await field.inputValue() === String(original));
  report.computerValueUnchanged = true;
  await page.screenshot({ path: 'artifacts/settings-disconnect-restored.png' });
  await button(panel, '关闭窗口').click();
  assert.deepEqual(report.errors, []);
} catch (error) {
  report.failure = error.message; process.exitCode = 1;
  if (page) await page.screenshot({ path: 'artifacts/settings-disconnect-failure.png' }).catch(() => {});
} finally {
  try {
    if (panel && await panel.isVisible()) await button(panel, '关闭窗口').click();
    if (touched) {
      await api({ action: 'management', deviceId: identity.id, enabled: false });
      const actual = (await api()).devices.find(row => row.id === identity.id);
      assert.equal(actual?.management, false); assert.equal(actual?.status, 'active');
      report.managementWithdrawn = true;
      const main = await reconnect();
      assert.equal(await main.getByRole('textbox', { name: '消息', exact: true }).innerHTML(), originalDraft);
      report.chatDraftPreserved = true;
    }
  } catch (error) { report.cleanupFailure = error.message; process.exitCode = 1; }
  await writeFile('artifacts/settings-disconnect-android.json', JSON.stringify(report, null, 2)); console.log(JSON.stringify(report));
  if (device) await Promise.race([device.close(), new Promise(resolve => setTimeout(resolve, 2000))]);
  process.exit(process.exitCode ?? 0);
}
