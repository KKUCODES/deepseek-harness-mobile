import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { openLatestLiveAndroid } from '../tests/support/latest-live-context.mjs';

// 仅恢复已通过的独立专项之后的原 App，不安装、清数据、读取 Key 或发送消息。
const [mode, run, ...options] = process.argv.slice(2);
assert.ok(options.every(option => ['--metadata', '--reopened'].includes(option)));
assert.equal(new Set(options).size, options.length);
const metadata = options.includes('--metadata'), recovery = options.includes('--reopened');
assert.ok(['npm', 'source'].includes(mode));
assert.match(run, /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/);
assert.equal(process.env.DSHM_ANDROID_SERIAL, '127.0.0.1:16384');
assert.ok(process.env.DSHM_ADB_PATH);
const root = resolve(import.meta.dirname, '..');
const runtime = resolve(root, '../plugin/artifacts/latest-runtime-check');
const prefix = `latest-${mode === 'source' ? 'source-' : ''}office-${metadata ? 'metadata' : 'engine'}-${run}`;
const completed = JSON.parse(await readFile(resolve(runtime, prefix + '-test.json'), 'utf8'));
const cleanup = JSON.parse(await readFile(resolve(runtime, prefix + '-cleanup.json'), 'utf8'));
assert.equal(completed.passed, true); assert.equal(completed.executionMode, mode);
assert.ok([...(metadata ? ['office-same-size-mtime-and-version-cache'] : []), 'office-native-engine-network-recovery', 'office-native-engine-service-and-revocation',
  'office-native-engine-shared-service-and-revocation'].includes(completed.android.scope));
assert.equal(completed.android.authorityRevoked, true); assert.equal(completed.android.nativeRevocationObserved, true);
assert.equal(cleanup.cleanupCompleted, true);
let helpers;
if (metadata) {
  assert.equal(completed.android.scope, 'office-same-size-mtime-and-version-cache');
  const cache = completed.android.fileRefresh.officeCache.sameSizeAndMtime;
  assert.equal(cache.changedAndRestoredPdfTextVerified, true);
  assert.equal(cache.unchangedVersionReusedWithoutConversion, true);
  helpers = [];
} else if (completed.android.scope === 'office-native-engine-network-recovery') {
  const network = completed.android.fileRefresh.officeCache.engineNetworkRecovery;
  assert.equal(network.originalRetryOpenedFreshConversionCanvasAndText, true);
  helpers = network.reopened.helpers;
} else {
  const service = completed.android.fileRefresh.officeCache.engineServiceLifecycle;
  assert.equal(service.unloadedHelperAndOldCacheReleased, true);
  assert.equal(service.retryUsedNewServiceActualPdfCanvasAndText, true);
  const revocation = completed.android.officeEngineRevocation;
  if (completed.android.scope === 'office-native-engine-shared-service-and-revocation') {
    assert.equal(service.joined.singleConversionSharedByTwoReaders, true);
    assert.equal(service.otherReader.otherReaderFailedWithoutPdfAtOriginalServiceUnload, true);
    assert.equal(revocation.remaining.unaffectedApprovedReaderKeptOriginalHelperAlive, true);
    assert.equal(revocation.stopped.unaffectedApprovedReaderReceivedCompleteActualPdf, true);
    assert.equal(revocation.stopped.completedHelperAndQueueReleased, true);
    assert.equal(revocation.revokedPhoneReaderReleasedOnlyOwnRequest, true);
    assert.equal(revocation.otherApprovedReaderCompletedOriginalPdf, true);
  } else assert.equal(revocation.revokedHelperAndQueueReleased, true);
  assert.equal(revocation.oldPreviewRemovedWithoutResultOrResend, true);
  assert.equal(revocation.revokedReconnectDenied, true);
  helpers = revocation.stopped.helpers;
  assert.equal(helpers.length, 3); assert.ok(helpers.every(helper => helper.closed));
}
const stoppedPids = [...cleanup.ownedHostPids, ...helpers.map(helper => helper.pid)];
for (const pid of stoppedPids) assert.throws(() => process.kill(pid, 0), error => error.code === 'ESRCH');
const packageName = 'dev.dshmobile.validation.latesttest';
const shell = args => {
  try {
    return execFileSync(process.env.DSHM_ADB_PATH, ['-s', process.env.DSHM_ANDROID_SERIAL, 'shell', ...args],
      { cwd: root, encoding: 'utf8', windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
  } catch (error) {
    if (args[0] === 'pidof' && error.status === 1 && !error.stdout?.trim() && !error.stderr?.trim()) return '';
    throw error;
  }
};
let originalAppPid = '16722';
if (mode === 'source' || metadata) {
  // SOURCE 前以已通过的发布轮恢复报告冻结基线，不采纳运行后的新 PID。
  const baseline = JSON.parse(await readFile(resolve(runtime,
    metadata ? 'latest-source-office-engine-db704158-2757-4f36-871a-228fca85706e-original-85279e8c-25d1-4011-b1ae-0e40b0da9cb2.json'
      : 'latest-office-engine-1c585d00-8850-4f3f-9438-c9e5597b519c-original-070bfb56-2937-45a7-a393-9a32dff97825.json'), 'utf8'));
  assert.equal(baseline.passed, true); assert.equal(baseline.appPid, 23468);
  assert.equal(baseline.apkSha256, '58921967f03c2a2d8e6b2c9dfdfc623052dbb7ddbfb291684013d2863111114b');
  assert.equal(baseline.historySha256, 'f8efee5a70f0d21c39fa4e93824b3abcd84e5b287efd6717ddd3d6cb7cb60e7f');
  assert.ok(Date.parse(baseline.at) <= Date.parse(completed.at));
  originalAppPid = String(baseline.appPid);
}
const observedAppPid = shell(['pidof', packageName]).trim();
const pidGuardFile = resolve(runtime, prefix + '-original-pid-change.json');
if (recovery) {
  const guard = JSON.parse(await readFile(pidGuardFile, 'utf8'));
  assert.equal(guard.passed, false); assert.equal(guard.expectedAppPid, originalAppPid);
  assert.equal(guard.observedAppPid, observedAppPid); assert.notEqual(observedAppPid, originalAppPid);
  assert.match(observedAppPid, /^[1-9][0-9]*$/);
} else if (observedAppPid !== originalAppPid) {
  await writeFile(pidGuardFile, JSON.stringify({ at: new Date().toISOString(), passed: false, mode, run,
    expectedAppPid: originalAppPid, observedAppPid, causeConfirmed: false }, null, 2) + '\n', { flag: 'wx' });
  assert.equal(observedAppPid, originalAppPid);
}
const apkPath = shell(['pm', 'path', packageName]).trim().replace(/^package:/, '');
assert.match(apkPath, /^\/data\/app\/[^\s]+\/base\.apk$/);
const apkSha256 = shell(['sha256sum', apkPath]).trim().split(/\s+/)[0];
assert.equal(apkSha256, '58921967f03c2a2d8e6b2c9dfdfc623052dbb7ddbfb291684013d2863111114b');
assert.equal(shell(['pidof', 'dev.dshmobile.validation.latestofficetest']).trim(), '');
// 测试 UID 停止后 Android 回到桌面；原 Launcher 只恢复已有 Activity/数据。
shell(['am', 'start', '-n', packageName + '/dev.dshmobile.validation.ValidationActivity']);
let live;
const report = { at: new Date().toISOString(), mode, run, passed: false, keyRead: false,
  appReinstalled: false, pairingReplaced: false, messageSent: false, windowsForegroundVerified: false };
try {
  live = await openLatestLiveAndroid(undefined, { openRecorded: true, reconnectRecorded: true });
  const { state, session, page, main, device } = live;
  assert.equal(state.executionMode, 'release'); assert.equal(state.reviewCandidate, undefined);
  assert.equal(state.hostPid, 29132); process.kill(state.hostPid, 0);
  const marker = 'DSHM_ELECTRON_e4656e6c69994a10';
  const reply = main.getByRole('article', { name: '模型回复', exact: true }).filter({ hasText: marker });
  await reply.waitFor(); await reply.scrollIntoViewIfNeeded();
  assert.equal((await main.getByRole('textbox', { name: '消息', exact: true }).innerText()).trim(), '');
  const snapshot = await live.readSession({ allRecords: true });
  assert.equal(snapshot.row.running, false);
  assert.equal(snapshot.projections.values.permissions.currentValue, 'workspace-write');
  const sha256 = createHash('sha256').update(JSON.stringify(snapshot.records)).digest('hex');
  assert.equal(snapshot.records.length, 1837);
  assert.equal(sha256, 'f8efee5a70f0d21c39fa4e93824b3abcd84e5b287efd6717ddd3d6cb7cb60e7f');
  const { loginURL } = JSON.parse(await readFile(resolve(state.home, 'private-entry.json'), 'utf8'));
  const login = await fetch(loginURL, { redirect: 'manual', signal: AbortSignal.timeout(10000) });
  assert.equal(login.status, 303); const cookie = login.headers.get('set-cookie')?.split(';')[0]; assert.ok(cookie);
  const status = await fetch(new URL('/api/dsh-mobile', loginURL), { headers: { cookie }, signal: AbortSignal.timeout(10000) });
  assert.equal(status.status, 200);
  const active = (await status.json()).devices.filter(row => row.status === 'active');
  assert.equal(active.length, 1); assert.equal(active[0].management, false);
  assert.equal(active[0].fingerprint, 'yuaLZjiGeko3q55kqUC5ZxGuX-vc2GpTvYsoL1FJAco');
  assert.equal(await page.locator('iframe').count(), 0);
  assert.match((await device.shell('dumpsys activity activities')).toString(),
    /topResumedActivity=.*dev\.dshmobile\.validation\.latesttest\/dev\.dshmobile\.validation\.RemoteActivity/);
  const evidence = `${prefix}-original-${randomUUID()}`;
  await writeFile(resolve(runtime, evidence + '.png'), await device.screenshot(), { flag: 'wx' });
  Object.assign(report, { passed: true, hostPid: state.hostPid, appPid: Number(observedAppPid),
    expectedAppPid: Number(originalAppPid), appPidPreserved: observedAppPid === originalAppPid,
    ...(recovery ? { pidGuardFile, processChangeCauseConfirmed: false } : {}), apkSha256, sessionId: session.sessionId,
    realReplyVisible: marker, historyRecords: snapshot.records.length, historySha256: sha256,
    management: false, androidForegroundRemote: true, testHostAndHelperPidsStopped: stoppedPids, evidence });
} catch (error) { report.failure = { name: error.name, message: error.message }; process.exitCode = 1; }
finally {
  await writeFile(resolve(runtime, `${prefix}-original-${randomUUID()}.json`), JSON.stringify(report, null, 2) + '\n', { flag: 'wx' });
  if (live) await live.device.close(); console.log(JSON.stringify(report));
}
process.exit(process.exitCode ?? 0);
