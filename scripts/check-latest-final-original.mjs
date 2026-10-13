import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { latestFinalScope } from './latest-final-test-scope.mjs';
import { openLatestLiveAndroid } from '../tests/support/latest-live-context.mjs';

const root = resolve(import.meta.dirname, '..'), scope = latestFinalScope(); assert.ok(scope);
assert.ok(process.argv.length === 2 || process.argv.length === 3 && ['--after-guard','--after-failed-electron','--after-failed-electron-reopened'].includes(process.argv[2]));
const reopened = process.argv[2] === '--after-failed-electron-reopened';
const afterFailedElectron = reopened || process.argv[2] === '--after-failed-electron';
const suffix = reopened ? '-after-failed-electron-reopened' : afterFailedElectron ? '-after-failed-electron' : process.argv[2] ? '-after-guard' : '';
const evidence = resolve(root, 'artifacts/latest-mobile-runtime', scope.reportName);
const installed = JSON.parse(await readFile(resolve(evidence, 'apk-installed.json'), 'utf8'));
const runtime = resolve(root, '../plugin/artifacts/latest-runtime-check');
const completed = JSON.parse(await readFile(resolve(runtime, scope.reportName + '-test.json'), 'utf8'));
const cleanup = JSON.parse(await readFile(resolve(runtime, scope.reportName + '-cleanup.json'), 'utf8'));
assert.equal(installed.run, scope.run); assert.equal(installed.passed, true);
if (afterFailedElectron) {
  assert.equal(scope.mode,'electron'); assert.equal(completed.passed,false);
  assert.match(completed.error,/^unknown tag !<tag:yaml.org,2002:js>/);
  const restored = JSON.parse(await readFile(resolve(runtime,'latest-final-electron-run-' + scope.run + '.json'),'utf8'));
  assert.equal(restored.passed,false); assert.equal(restored.restoredOriginalBytes,true);
  for (const stage of ['restored-build','restored-build-check'])
    assert.equal(restored.stages.find(row=>row.name===stage)?.code,0);
  assert.equal(completed.android.passed,true);
} else assert.equal(completed.passed,true);
assert.equal(completed.finalAndroidRun, scope.run); assert.equal(completed.android.authorityRevoked, true);
assert.equal(completed.android.nativeRevocationObserved, true); assert.equal(cleanup.cleanupCompleted, true);
for (const pid of [...cleanup.ownedHostPids,...(cleanup.ownedDesktopHostPids ?? [])]) {
  assert.throws(() => process.kill(pid, 0), error => error.code === 'ESRCH');
}
let live;
const report = { at: new Date().toISOString(), run: scope.run, afterGuardCheck: suffix === '-after-guard',
  afterFailedElectron, originalCombinedTestPassed: completed.passed, passed: false };
try {
  live = await openLatestLiveAndroid(undefined, { openRecorded: true, reconnectRecorded: true });
  const { state, session, device, page, main } = live;
  assert.equal(state.executionMode, 'release'); assert.equal(state.reviewCandidate, undefined);
  assert.notEqual(state.home, completed.home); process.kill(state.hostPid, 0);
  const originalPackage = installed.protectedPackage;
  const appPid = (await device.shell('pidof ' + originalPackage)).toString().trim();
  if (reopened) {
    const prior = JSON.parse(await readFile(resolve(evidence,'original-app-restored-after-failed-electron.json'),'utf8'));
    assert.equal(prior.passed,false); assert.equal(prior.failure.code,'ERR_ASSERTION');
    assert.ok(prior.failure.message.includes(installed.before.pid));
    assert.match(appPid,/^[1-9]\d*$/); assert.notEqual(appPid,installed.before.pid);
  } else assert.equal(appPid, installed.before.pid);
  assert.equal((await device.shell('pidof ' + scope.packageName)).toString().trim(), '');
  const path = (await device.shell('pm path ' + originalPackage)).toString().trim();
  assert.equal(path, installed.before.path);
  const sha256 = (await device.shell('sha256sum ' + path.slice(8))).toString().trim().split(/\s+/)[0];
  assert.equal(sha256, installed.before.sha256);
  const marker = 'DSHM_ELECTRON_e4656e6c69994a10';
  await main.getByRole('article', { name: '模型回复', exact: true }).filter({ hasText: marker }).waitFor();
  const snapshot = await live.readSession({ allRecords: true });
  if (reopened) {
    assert.equal(snapshot.records.length,1837);
    assert.equal(createHash('sha256').update(JSON.stringify(snapshot.records)).digest('hex'),
      'f8efee5a70f0d21c39fa4e93824b3abcd84e5b287efd6717ddd3d6cb7cb60e7f');
  }
  assert.equal(snapshot.row.running, false);
  assert.equal(snapshot.projections.values.permissions.currentValue, 'workspace-write');
  assert.equal((await main.getByRole('textbox', { name: '消息', exact: true }).innerText()).trim(), '');
  const { loginURL } = JSON.parse(await readFile(resolve(state.home, 'private-entry.json'), 'utf8'));
  const login = await fetch(loginURL, { redirect: 'manual', signal: AbortSignal.timeout(10000) });
  assert.equal(login.status, 303); const cookie = login.headers.get('set-cookie')?.split(';')[0]; assert.ok(cookie);
  const status = await fetch(new URL('/api/dsh-mobile', loginURL), { headers: { cookie }, signal: AbortSignal.timeout(10000) });
  assert.equal(status.status, 200);
  const devices = (await status.json()).devices.filter(row => row.status === 'active');
  assert.equal(devices.length, 1); assert.equal(devices[0].management, false);
  assert.equal(devices[0].fingerprint, 'yuaLZjiGeko3q55kqUC5ZxGuX-vc2GpTvYsoL1FJAco');
  assert.equal(await page.locator('iframe').count(), 0);
  const foreground = (await device.shell('dumpsys activity activities')).toString();
  assert.match(foreground, /topResumedActivity=.*dev\.dshmobile\.validation\.latesttest\/dev\.dshmobile\.validation\.RemoteActivity/);
  await writeFile(resolve(evidence, 'original-app' + suffix + '.png'), await device.screenshot(), { flag: 'wx' });
  Object.assign(report, { passed: true, hostPid: state.hostPid, appPid: Number(appPid),
    originalAppPid: Number(installed.before.pid), appPidPreserved: appPid === installed.before.pid,
    originalApkSha256: sha256, sessionId: session.sessionId, title: session.title, realReplyVisible: marker,
    historyRecords: snapshot.records.length, historySha256: createHash('sha256').update(JSON.stringify(snapshot.records)).digest('hex'),
    originalManagement: false, originalFingerprint: devices[0].fingerprint, originalForeground: true,
    iframeCount: 0, keyRead: false, appReinstalled: false, pairingReplaced: false,
    testHostPidsStopped: cleanup.ownedHostPids, testUidStopped: true });
} catch (error) {
  report.failure = { name: error.name, code: error.code, message: error.message }; process.exitCode = 1;
} finally {
  await writeFile(resolve(evidence, 'original-app-restored' + suffix + '.json'), JSON.stringify(report, null, 2) + '\n', { flag: 'wx' });
  if (live) await live.device.close(); console.log(JSON.stringify(report));
}
process.exit(process.exitCode ?? 0);
