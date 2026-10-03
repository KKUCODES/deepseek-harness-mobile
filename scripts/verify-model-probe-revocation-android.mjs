import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { writeFile } from 'node:fs/promises';
import { _android } from 'playwright';
import { androidAppWebView } from './android-app-webview.mjs';
import { localDesktopManagement } from './local-desktop-management.mjs';

// 经正式 App/Host 请求本机端点，收回同一已授权测试设备的管理能力；不保存提供方或凭据。
assert.equal(process.env.DSHM_RUN_LIVE, '1');
const report = { at: new Date().toISOString(), requests: [], errors: [] };
const artifact = 'artifacts/model-probe-revocation-android.json';
const button = (root, name) => root.getByRole('button', { name, exact: true });
let device, page, panel, chat, originalDraft, api, identity, managementTouched = false;
let hold = true, heldResponse, receivedAt, closedAt;
const server = createServer((req, res) => {
  report.requests.push({ path: req.url, authenticated: !!req.headers.authorization || !!req.headers['x-api-key'] });
  if (hold) {
    heldResponse = res; receivedAt = Date.now();
    res.on('close', () => { closedAt = Date.now(); });
  } else res.setHeader('content-type', 'application/json').end(JSON.stringify({ data: [{ id: 'dshm-revocation-retry' }] }));
});
async function until(check, timeout = 10000) {
  const end = Date.now() + timeout;
  do { if (await check()) return; await new Promise(resolve => setTimeout(resolve, 100)); } while (Date.now() < end);
  throw Error('condition_deadline');
}
async function management(enabled) {
  managementTouched = true;
  await api({ action: 'management', deviceId: identity.id, enabled });
  const actual = (await api()).devices.find(row => row.id === identity.id);
  assert.equal(actual?.management, enabled); assert.equal(actual?.status, 'active');
}
async function openCreation(main) {
  if (!await panel.isVisible()) {
    await button(main, 'Remote 选项').click(); await button(main, '电脑设置').click();
  }
  const directory = panel.getByRole('region', { name: '其他模型提供方', exact: true });
  await button(directory, '其他模型提供方').click();
  const creation = directory.getByRole('region', { name: '新增模型提供方', exact: true });
  await button(creation, '新增模型提供方').click();
  await creation.getByRole('combobox', { name: '提供方来源', exact: true }).selectOption('custom');
  await creation.getByLabel('服务地址', { exact: true }).fill(`http://127.0.0.1:${server.address().port}/v1`);
  await creation.getByRole('combobox', { name: '服务协议', exact: true }).selectOption('openai-completions');
  return creation;
}
async function reconnect() {
  await button(page, '重新连接').waitFor({ timeout: 15000 });
  await button(page, '重新连接').click();
  const main = page.getByTestId('remote-workspace'); await main.waitFor({ timeout: 45000 });
  const welcome = page.getByRole('dialog', { name: '内测声明', exact: true });
  if (await welcome.isVisible()) await button(welcome, '继续').click();
  if (await main.locator('.remote-heading strong').innerText() === 'Remote') {
    await main.locator('.connection-dot.online').waitFor({ timeout: 45000 });
    await main.locator('button.remote-session-row').filter({ has: page.getByText('DSHM Remote 联调提示', { exact: true }) }).click();
  }
  await main.getByRole('textbox', { name: '消息', exact: true }).waitFor();
}
try {
  api = await localDesktopManagement();
  const matches = (await api()).devices.filter(row => row.fingerprint === 'EYvtQJ2f8cICRebQxcWaUTtmkPQ01XcdfKG_V2tE-lE');
  assert.equal(matches.length, 1); identity = matches[0];
  assert.equal(identity.name, 'DSHM Android'); assert.equal(identity.status, 'active'); assert.equal(identity.management, false);
  device = (await _android.devices({ omitDriverInstall: true })).find(row => row.serial() === '127.0.0.1:16384');
  assert.ok(device); device.setDefaultTimeout(15000);
  await device.shell('am start -n dev.dshmobile.validation/.ValidationActivity');
  await until(async () => !!(await device.shell('pidof dev.dshmobile.validation')).toString().trim());
  const root = await (await androidAppWebView(device)).page();
  page = root.context().pages().find(row => row.url().startsWith('https://remote.dshm.invalid/'));
  if (!page) {
    const ordinary = root.context().pages().find(row => row.url().startsWith('https://appassets.androidplatform.net/'));
    assert.ok(ordinary);
    await button(ordinary, '打开侧边抽屉').click(); await button(ordinary, 'Remote').click();
    await until(() => !!(page = root.context().pages().find(row => row.url().startsWith('https://remote.dshm.invalid/'))), 20000);
  }
  assert.ok(page); page.setDefaultTimeout(15000); page.on('pageerror', () => report.errors.push('page-error'));
  if (await button(page, '重新连接').isVisible()) await reconnect();
  const main = page.getByTestId('remote-workspace'); await main.waitFor();
  if (await main.locator('.remote-heading strong').innerText() === 'Remote') {
    await main.locator('.connection-dot.online').waitFor({ timeout: 45000 });
    await main.locator('button.remote-session-row').filter({ has: page.getByText('DSHM Remote 联调提示', { exact: true }) }).click();
  }
  assert.equal(await main.locator('.remote-heading strong').innerText(), 'DSHM Remote 联调提示');
  chat = main.getByRole('textbox', { name: '消息', exact: true }); originalDraft = await chat.innerHTML();
  panel = page.getByRole('dialog', { name: '电脑设置', exact: true });
  assert.equal(await page.getByRole('dialog').count(), 0);
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  await management(true); await reconnect();
  let creation = await openCreation(main);
  let probe = creation.getByRole('region', { name: '从当前地址获取模型', exact: true });
  await button(probe, '从当前地址获取模型').click();
  await button(probe, '确认获取模型').click();
  await until(() => !!heldResponse);
  assert.deepEqual(report.requests, [{ path: '/v1/models', authenticated: false }]);
  const revokedAt = Date.now(); await management(false);
  await until(() => closedAt !== undefined, 5000);
  report.cancelAfterRevocationMs = closedAt - revokedAt;
  report.requestLifetimeMs = closedAt - receivedAt;
  assert.ok(report.requestLifetimeMs < 15000, 'Cancellation must occur before the Host 20-second discovery timeout');
  report.pendingRequestCancelled = true;
  await page.getByText('电脑已调整这台手机的权限，请重新连接。', { exact: true }).waitFor();
  report.managementFormRemoved = await page.getByRole('region', { name: '新增模型提供方', exact: true }).count() === 0;
  assert.equal(report.managementFormRemoved, true);
  heldResponse.end(JSON.stringify({ data: [{ id: 'late-result-must-not-appear' }] })); hold = false;
  await page.screenshot({ path: 'artifacts/model-probe-revoked-android.png' });
  // 旧连接已失效；先以保留的聊天权限重连，确认管理入口明确拒绝。
  await reconnect();
  await button(main, 'Remote 选项').click(); await button(main, '电脑设置').click();
  await page.getByText('请先在电脑端授予此设备管理权限，再查看或修改电脑设置。', { exact: true }).waitFor();
  report.managementDeniedAfterReconnect = true;
  await button(panel, '关闭窗口').click();
  await management(true); await reconnect();
  creation = await openCreation(main);
  probe = creation.getByRole('region', { name: '从当前地址获取模型', exact: true });
  assert.equal(await creation.getByLabel('模型 ID 1', { exact: true }).inputValue(), '');
  assert.equal(await page.getByText('late-result-must-not-appear', { exact: true }).count(), 0);
  await button(probe, '从当前地址获取模型').click(); await button(probe, '确认获取模型').click();
  await probe.getByRole('checkbox').check(); await button(probe, '加入编辑草稿').click();
  assert.equal(await creation.getByLabel('模型 ID 1', { exact: true }).inputValue(), 'dshm-revocation-retry');
  assert.equal(report.requests.length, 2);
  report.retryAfterRestore = true; report.lateResultAbsent = true;
  await button(creation, '取消').click(); await button(panel, '关闭窗口').click();
  assert.deepEqual(report.errors, []);
} catch (error) {
  report.failure = error.message; process.exitCode = 1;
  if (page) await page.screenshot({ path: 'artifacts/model-probe-revocation-failure.png' }).catch(() => {});
} finally {
  heldResponse?.destroy();
  try {
    if (managementTouched) {
      await management(false);
      report.managementWithdrawn = true;
      await reconnect();
    }
    if (panel && await panel.isVisible()) await button(panel, '关闭窗口').click();
    if (chat && originalDraft !== undefined) {
      report.chatDraftPreserved = await chat.innerHTML() === originalDraft;
      assert.equal(report.chatDraftPreserved, true);
    }
    if (page) {
      report.alerts = await page.getByRole('alert').allTextContents();
      assert.deepEqual(report.alerts, []);
    }
  } catch (error) { report.cleanupFailure = error.message; process.exitCode = 1; }
  server.closeAllConnections();
  if (server.listening) await new Promise(resolve => server.close(resolve));
  await writeFile(artifact, JSON.stringify(report, null, 2)); console.log(JSON.stringify(report));
  if (device) await Promise.race([device.close(), new Promise(resolve => setTimeout(resolve, 2000))]);
  process.exit(process.exitCode ?? 0);
}
