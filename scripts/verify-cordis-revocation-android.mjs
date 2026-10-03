import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { _android } from 'playwright';
import { androidAppWebView } from './android-app-webview.mjs';
import { localDesktopManagement } from './local-desktop-management.mjs';

// 独立UID和新配对隔离撤销；日常设备仅核对状态，绝不作为撤销目标。
assert.equal(process.env.DSHM_RUN_LIVE, '1');
const pkg = 'dev.dshmobile.validation.pairingtest';
const twoClients = process.argv.includes('--two-clients');
const inflight = process.argv.includes('--inflight');
const approvalOverlap = process.argv.includes('--approval-overlap');
const approvalRace = process.argv.includes('--approval-race') || approvalOverlap;
assert.ok([twoClients, inflight, approvalRace].filter(Boolean).length <= 1, 'Run independent scenarios separately');
const artifact = approvalOverlap ? 'cordis-approval-overlap' : approvalRace ? 'cordis-approval-race' : inflight ? 'cordis-inflight' : twoClients ? 'cordis-two-clients' : 'cordis-revocation';
const name = approvalOverlap ? 'DSHM 启动并发审批验收 038' : approvalRace ? 'DSHM 双端审批验收 037' : inflight ? 'DSHM 动态调用在途验收 036' : twoClients ? 'DSHM 双客户端同步验收 035' : 'DSHM 动态插件撤销验收 034';
const dailyFingerprint = 'EYvtQJ2f8cICRebQxcWaUTtmkPQ01XcdfKG_V2tE-lE';
const report = { at: new Date().toISOString(), package: pkg, errors: [], resources: [] };
const api = await localDesktopManagement();
const before = await api();
const daily = before.devices.find(item => item.fingerprint === dailyFingerprint);
assert.equal(daily?.status, 'active'); assert.equal(daily.management, false);
const oldIds = new Set(before.devices.map(item => item.id));
const seed = JSON.parse(await readFile('artifacts/cordis-live-host.json', 'utf8'));
let sequence = 0, testDevice, device, page, held = false;
const proxy = async action => {
  const response = await fetch(`http://127.0.0.1:18794/${action}`, {
    method: action === 'stats' ? 'GET' : 'POST', signal: AbortSignal.timeout(3000),
  });
  assert.ok(response.ok); return response.json();
};
const host = async (action, version) => {
  const id = `cordis-approval-${Date.now()}-${++sequence}`;
  await writeFile('artifacts/cordis-approval-control.json', JSON.stringify({ id, runId: seed.runId, action, version }));
  const deadline = Date.now() + 10000;
  while (Date.now() < deadline) {
    let result;
    try { result = JSON.parse(await readFile('artifacts/cordis-approval-host.json', 'utf8')); }
    catch (error) { if (error.code !== 'ENOENT' && !(error instanceof SyntaxError)) throw error; }
    if (result?.id === id) { assert.equal(result.error, undefined); return result; }
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  throw Error(`Fixture control timed out: ${action}`);
};
const pairing = (phase, input = '') => new Promise((resolve, reject) => {
  const child = spawn(process.execPath, ['scripts/verify-remote-pair-valid-android.mjs', phase], {
    cwd: process.cwd(), windowsHide: true, stdio: ['pipe', 'ignore', 'ignore'],
    env: { ...process.env, DSHM_PAIR_CASE: artifact },
  });
  child.on('error', () => reject(Error('Pairing driver could not start')));
  child.on('exit', code => code === 0 ? resolve() : reject(Error(`Pairing phase failed: ${phase}; inspect its scoped report`)));
  child.stdin.end(input);
});
try {
  const pair = new URL((await api({ action: 'pair' })).link);
  assert.equal(pair.origin, 'http://127.0.0.1:8787'); assert.equal(pair.pathname, '/pair');
  await pairing('claim', `dshm://pair?server=${encodeURIComponent(pair.origin)}${pair.hash}`);
  const claim = JSON.parse(await readFile(`artifacts/${artifact}-pair-claim-android.json`, 'utf8'));
  assert.equal(claim.pendingWithoutSessionAccess, true);
  const candidates = (await api()).devices.filter(item => !oldIds.has(item.id) && item.name === name && item.fingerprint === claim.fingerprint);
  assert.equal(candidates.length, 1); testDevice = candidates[0];
  assert.notEqual(testDevice.fingerprint, dailyFingerprint); assert.equal(testDevice.status, 'pending');
  await api({ action: 'approve', deviceId: testDevice.id });
  report.fingerprint = testDevice.fingerprint;
  await pairing('connected');
  device = (await _android.devices({ omitDriverInstall: true })).find(item => item.serial() === process.env.DSHM_ANDROID_SERIAL);
  assert.ok(device);
  const context = (await (await androidAppWebView(device, pkg)).page()).context();
  page = context.pages().find(item => item.url().startsWith('https://remote.dshm.invalid/'));
  assert.ok(page); page.setDefaultTimeout(25000);
  page.on('pageerror', error => report.errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') report.errors.push(message.text()); });
  page.on('response', response => { if (response.status() >= 400) report.resources.push({ path: new URL(response.url()).pathname, status: response.status() }); });
  const main = page.getByTestId('remote-workspace');
  await main.locator('.remote-heading').getByText('DSHM Remote 联调提示', { exact: true }).waitFor();
  await host('hold'); held = true;
  await main.getByRole('button', { name: 'Remote 选项', exact: true }).click();
  await main.getByRole('button', { name: '插件面板', exact: true }).click();
  const panel = page.getByRole('region', { name: '插件面板', exact: true });
  await panel.locator('[data-cordis-badge]').click();
  const row = panel.locator(`[data-cordis-row="${seed.pluginId}"]`);
  await row.locator('[data-cordis-switch="run"]').click();
  await page.waitForFunction(id => document.querySelector(`[data-cordis-row="${id}"]`)?.dataset.cordisStatus === 'running', seed.pluginId);
  await panel.locator('[data-cordis-badge]').click();
  await panel.getByRole('button', { name: '返回聊天', exact: true }).click();
  const echo = main.getByTestId('cordis-live-echo');
  await echo.click(); await echo.getByText('DSHM_CORDIS_ECHO', { exact: true }).waitFor();
  assert.equal(await echo.getAttribute('data-host-calls'), '1');
  const running = (await host('inspect')).inventory[0];
  assert.ok(running.activeRun); report.beforeRevoke = running;
  await page.screenshot({ path: `artifacts/${artifact}-running-android.png` });
  if (approvalRace) {
    // 先隔离用于识别测试连接的固定回声，之后双端驱动会正常重新打开日常App。
    await device.shell('am force-stop dev.dshmobile.validation');
    assert.equal((await device.shell('pidof dev.dshmobile.validation')).toString().trim(), '');
    await proxy('pause'); await echo.click();
    const deadline = Date.now() + 10000;
    while ((await proxy('stats')).heldCordisEchoResults !== 1) {
      assert.ok(Date.now() < deadline, 'Could not identify the isolated main connection');
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    assert.equal((await proxy('pin-cordis')).selectedDevices, 1);
    await proxy('resume');
    await page.waitForFunction(() => document.querySelector('[data-testid="cordis-live-echo"]')?.dataset.hostCalls === '2');
  }
  if (twoClients || approvalRace) {
    const { checkCordisTwoClients } = await import('./check-cordis-two-clients.mjs');
    report.twoClients = await checkCordisTwoClients(device, page, seed, host, { approvals: approvalRace, overlap: approvalOverlap, proxy });
  }
  if (inflight) {
    const before = await proxy('stats');
    assert.ok(before.devices >= 1 && before.devices <= 2, 'Only the isolated App and its notification connection may use this proxy');
    assert.equal(before.heldBytes, 0);
    assert.equal((await device.shell('pidof dev.dshmobile.validation')).toString().trim(), '', 'Daily App must not use the fault proxy');
    await proxy('pause'); await echo.click();
    const deadline = Date.now() + 10000;
    while (true) {
      const stats = await proxy('stats');
      if (stats.heldCordisEchoResults === 1) { report.inflightHeld = stats; break; }
      assert.ok(Date.now() < deadline, 'No genuine second Host echo response was observed');
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    assert.equal(await echo.getAttribute('data-host-calls'), '1', 'The second response must not have reached the Client');
    await page.screenshot({ path: 'artifacts/cordis-inflight-held-android.png' });
  }
  await api({ action: 'revoke', deviceId: testDevice.id });
  await page.getByText('电脑已撤销这台手机，请重新配对。', { exact: true }).waitFor();
  await main.waitFor({ state: 'detached' }); await echo.waitFor({ state: 'detached' });
  report.revokedUiRemoved = true;
  if (inflight) {
    const stats = await proxy('stats');
    assert.equal(stats.heldBytes, 0); assert.equal(stats.heldCordisEchoResults, 0);
    assert.ok(stats.droppedBytes >= report.inflightHeld.heldBytes);
    assert.ok(stats.closedDevices > report.inflightHeld.closedDevices);
    report.inflightRevoked = stats;
    await proxy('resume');
  }
  if (!twoClients && !approvalRace) {
    const remaining = (await host('inspect')).inventory[0];
    assert.deepEqual(remaining.activeRun, running.activeRun);
    report.sharedHostRunPreserved = true;
  }
  assert.deepEqual(report.errors, []);
  await page.getByRole('button', { name: '重新连接', exact: true }).click();
  await page.getByRole('alert').filter({ hasText: '连接授权已失效，请移除本机绑定后重新配对。' }).waitFor();
  assert.equal(await main.count(), 0); assert.equal(await echo.count(), 0);
  report.reconnectRejected = true;
  await page.screenshot({ path: `artifacts/${artifact}-rejected-android.png` });
  // RemoteApp.report 对被拒绝的显式重连记录这一条诊断；撤销前和其他错误仍要求为空。
  assert.deepEqual(report.errors, ['[Remote] http_401']);
  report.expectedReconnectErrors = report.errors.splice(0);
  assert.deepEqual(report.resources, []);
  report.ok = true;
} catch (error) { report.failure = error.message; process.exitCode = 1; }
finally {
  try {
    if (inflight || approvalRace) await proxy('resume');
    if (testDevice) {
      const current = (await api()).devices.find(item => item.id === testDevice.id);
      if (current?.status !== 'revoked') await api({ action: 'revoke', deviceId: testDevice.id });
      assert.equal((await api()).devices.find(item => item.id === testDevice.id)?.status, 'revoked');
      report.testDeviceRevoked = true;
    }
    if (held) {
      const cleanup = await host('cleanup'); report.maintenance = cleanup.audit;
      assert.deepEqual(cleanup.inventory, []);
      assert.equal(cleanup.audit.newTurns, 0); assert.equal(cleanup.audit.existingMessagesPreserved, true);
    }
    const after = (await api()).devices.find(item => item.id === daily.id);
    assert.equal(after.status, 'active'); assert.equal(after.management, daily.management);
    report.dailyAuthorizationPreserved = true;
  } catch (error) { report.cleanupFailure = error.message; report.ok = false; process.exitCode = 1; }
  await device?.close();
  await writeFile(`artifacts/${artifact}-android.json`, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report));
}
