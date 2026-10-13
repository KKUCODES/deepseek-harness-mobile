// SDK 实测后返回原发布 Host；已接收的消息保持，旧失败轮次只清理精确未发送草稿。
import assert from 'node:assert/strict';
import { access, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { openLatestLiveAndroid } from '../tests/support/latest-live-context.mjs';

assert.ok(process.argv.length === 2 || process.argv.length === 3 && ['--attempt-2', '--attempt-8', '--attempt-8-read-repair', '--attempt-9', '--attempt-9-audit-settled'].includes(process.argv[2]));
const second = process.argv[2] === '--attempt-2';
const readRepair = process.argv[2] === '--attempt-8-read-repair';
const eighth = process.argv[2]?.startsWith('--attempt-8') ?? false;
const ninth = process.argv[2]?.startsWith('--attempt-9') ?? false, acceptedChat = eighth || ninth;
const auditSettled = process.argv[2] === '--attempt-9-audit-settled';
const attemptNumber = ninth ? 9 : eighth ? 8 : 7;
const runtime = resolve(import.meta.dirname, '../../plugin/artifacts/latest-runtime-check');
const file = resolve(runtime, 'latest-sdk-sea-android-restored-attempt-' + attemptNumber + (second ? '-attempt-2' : readRepair ? '-read-repair' : auditSettled ? '-audit-settled' : '') + '.json');
await assert.rejects(access(file), { code: 'ENOENT' });
if (second) {
  const failed = JSON.parse(await readFile(resolve(runtime, 'latest-sdk-sea-android-restored-attempt-7.json')));
  assert.equal(failed.passed, false); assert.equal(failed.failure.name, 'TypeError');
  assert.equal(failed.failure.message, "Cannot read properties of undefined (reading 'length')");
}
if (readRepair) {
  const failed = JSON.parse(await readFile(resolve(runtime, 'latest-sdk-sea-android-restored-attempt-8.json')));
  assert.equal(failed.passed, false); assert.equal(failed.failure.code, 'ERR_ASSERTION');
  assert.match(failed.failure.location, /restore-latest-sdk-android\.mjs:27:12/);
  assert.match(failed.failure.message, /undefined/);
}
const report = { at: new Date().toISOString(), passed: false };
let live;
try {
  const attempt = JSON.parse(await readFile(resolve(runtime, `latest-sdk-sea-message-attempt-${attemptNumber}.json`)));
  const result = JSON.parse(await readFile(resolve(runtime, acceptedChat
    ? `latest-sdk-sea-android-attempt-${attemptNumber}.json` : 'latest-sdk-sea-native-failure-attempt-7.json')));
  if (acceptedChat) {
    assert.equal(result.passed, true); assert.equal(result.inferenceVerified, true);
    assert.equal(result.hostPid, attempt.hostPid); assert.equal(result.sessionId, attempt.sessionId);
    assert.equal(result.marker, attempt.marker);
  } else {
    assert.equal(result.sdkChatAccepted, false); assert.equal(result.addedEvents, 0);
  }
  live = await openLatestLiveAndroid(undefined, { openRecorded: true, reconnectRecorded: true });
  const { state, session, main, page, device, readSession, capture } = live;
  assert.equal(state.executionMode, 'release'); assert.equal(state.reviewCandidate, undefined);
  assert.equal(state.home, attempt.home); assert.equal(session.sessionId, attempt.sessionId);
  if (auditSettled) {
    const failed = JSON.parse(await readFile(resolve(runtime, 'latest-sdk-sea-android-restored-attempt-9.json')));
    assert.equal(failed.passed, false); assert.equal(failed.failure.code, 'ERR_ASSERTION');
    assert.match(failed.failure.location, /restore-latest-sdk-android\.mjs:71:10/);
    const initial = JSON.parse(await readFile(resolve(runtime, 'latest-live-child-retention-sdk-attempt-9-after-restore-audited.json')));
    assert.equal(initial.passed, true); assert.equal(initial.hostPid, state.hostPid); assert.equal(initial.home, state.home);
    const root = initial.identity.sessions.find(row => row.id === session.sessionId); assert.ok(root);
    assert.ok(failed.failure.message.includes(`${root.seq + 1} !== ${root.seq}`));
    report.originalFailedReadRetained = true;
  }
  const audit = JSON.parse(await readFile(resolve(runtime, ninth
    ? 'latest-live-child-retention-sdk-attempt-9-after-restore-audited' + (auditSettled ? '-phone-settled' : '') + '.json' : eighth
    ? 'latest-live-child-retention-sdk-attempt-8-restarted-after-restore-audited.json'
    : 'latest-live-child-retention-sdk-attempt-7-after-restore-audited.json')));
  assert.equal(audit.passed, true); assert.equal(audit.hostPid, state.hostPid);
  assert.equal(audit.sessionCount, 26);
  if (ninth) {
    const before = JSON.parse(await readFile(resolve(runtime, 'latest-live-child-retention-sdk-attempt-9-before-restore.json')));
    assert.equal(before.passed, true); assert.equal(before.hostPid, result.hostPid);
    assert.equal(before.home, state.home);
    assert.equal(audit.eventCount, before.eventCount + audit.addedResumeMarkers.length);
  } else assert.equal(audit.eventCount, eighth ? 3697 : 3665);
  assert.equal(audit.identity.sessions.length, 26);
  const active = audit.identity.devices.filter(row => row.status === 'active');
  assert.equal(active.length, 1); assert.equal(active[0].management, false);
  assert.equal(active[0].fingerprint, 'yuaLZjiGeko3q55kqUC5ZxGuX-vc2GpTvYsoL1FJAco');
  const apk = (await device.shell('pm path dev.dshmobile.validation.latesttest')).toString().trim();
  assert.match(apk, /^package:\/data\/app\/[A-Za-z0-9_~.=/+-]+\/base\.apk$/);
  const sha256 = (await device.shell('sha256sum ' + apk.slice('package:'.length))).toString().trim().split(/\s+/)[0];
  assert.equal(sha256, '58921967f03c2a2d8e6b2c9dfdfc623052dbb7ddbfb291684013d2863111114b');
  const input = main.getByRole('textbox', { name: '消息', exact: true });
  const draft = (await input.innerText()).trim();
  const expected = `这是 DSHM 官方 SDK 载体联调。请只回复 ${attempt.marker}，不要调用任何工具。`;
  assert.ok(draft === '' || !acceptedChat && draft === expected, 'refuse_to_clear_unrelated_draft');
  if (!acceptedChat && draft === expected) await input.fill('');
  const original = await readSession({ allRecords: true });
  assert.equal(original.row.running, false);
  assert.equal(original.projections.asOfSeq, acceptedChat
    ? audit.identity.sessions.find(row => row.id === session.sessionId).seq : result.throughSeq);
  if (acceptedChat) {
    assert.ok(original.projections.asOfSeq >= result.assistantSeq);
    assert.equal(Number((await device.shell('pidof dev.dshmobile.validation.latesttest')).toString().trim()), result.appPid);
  }
  assert.equal(original.projections.values.permissions.currentValue, 'workspace-write');
  assert.equal((await input.innerText()).trim(), ''); assert.equal(await page.locator('iframe').count(), 0);
  const activity = (await device.shell('dumpsys activity activities')).toString();
  assert.match(activity, /topResumedActivity=.*dev\.dshmobile\.validation\.latesttest\/dev\.dshmobile\.validation\.RemoteActivity/);
  report.appPid = Number((await device.shell('pidof dev.dshmobile.validation.latesttest')).toString().trim());
  assert.ok(Number.isSafeInteger(report.appPid) && report.appPid > 0);
  await capture(`latest-live-sdk-sea-restored-attempt-${attemptNumber}`);
  Object.assign(report, { hostPid: state.hostPid, home: state.home, sessionId: session.sessionId,
    throughSeq: original.projections.asOfSeq, apkSha256: sha256, management: false,
    exactUnsentDraftCleared: draft === expected, alreadyEmptyDraftPreserved: draft === '',
    originalAppReinstalled: false, keyRead: false, pairingReplaced: false,
    realAndroidForegroundRemote: true, passed: true });
} catch (error) {
  report.failure = { name: error.name, code: error.code, message: error.message,
    location: error.stack?.split('\n').find(line => line.includes('restore-latest-sdk-android.mjs:'))?.trim() };
  process.exitCode = 1;
} finally {
  await writeFile(file, JSON.stringify(report, null, 2), { flag: 'wx' });
  if (live) await live.device.close();
  console.log(JSON.stringify({ passed: report.passed, hostPid: report.hostPid, appPid: report.appPid, failure: report.failure }));
}
process.exit(process.exitCode ?? 0);
