// 官方SDK打包成功后的真实Android续聊；仅使用原测试会话，不读取Key或重建配对。
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { access, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { openLatestLiveAndroid } from '../tests/support/latest-live-context.mjs';
import { readLatestSdkCarrier } from '../../backend/scripts/latest-sdk-carrier.mjs';

assert.ok(process.argv.length === 2 || process.argv.length === 3 && ['--attempt-8', '--attempt-9'].includes(process.argv[2]));
const attemptNumber = process.argv[2] ? Number(process.argv[2].slice('--attempt-'.length)) : 7;
const runtime = resolve(import.meta.dirname, '../../plugin/artifacts/latest-runtime-check');
const reportPath = resolve(runtime, `latest-sdk-sea-android-attempt-${attemptNumber}.json`);
const attemptPath = resolve(runtime, `latest-sdk-sea-message-attempt-${attemptNumber}.json`);
await assert.rejects(access(reportPath), { code: 'ENOENT' });
await assert.rejects(access(attemptPath), { code: 'ENOENT' });
const report = { at: new Date().toISOString(), passed: false, inferenceVerified: false };
let live;
try {
  live = await openLatestLiveAndroid(undefined, { openRecorded: true, reconnectRecorded: true });
  const { state, session, main, page, device, readSession, capture } = live;
  assert.equal(state.executionMode, 'sdk-sea');
  assert.equal(state.command, 'SDK executable web');
  assert.equal(state.reviewCandidate, 'candidate-package-check-1xqe3A');
  const carrier = await readLatestSdkCarrier(runtime);
  assert.equal(state.sdkProduct.executable, carrier.executable);
  assert.equal(state.sdkProduct.sha256, carrier.productSha256);
  assert.equal(carrier.buildReport, resolve(runtime, `latest-sdk-sea-build-attempt-${attemptNumber}.json`));
  const historyScope = attemptNumber === 8 ? 'sdk-attempt-8-restarted' : 'sdk-attempt-' + attemptNumber;
  const prior = JSON.parse(await readFile(resolve(runtime, `latest-live-child-retention-${historyScope}-after-review-audited.json`)));
  assert.equal(prior.passed, true); assert.equal(prior.hostPid, state.hostPid);
  assert.equal(prior.executionMode, 'sdk-sea'); assert.equal(prior.home, state.home);
  const active = prior.identity.devices.filter(row => row.status === 'active');
  assert.equal(active.length, 1); assert.equal(active[0].management, false);
  assert.equal(active[0].fingerprint, 'yuaLZjiGeko3q55kqUC5ZxGuX-vc2GpTvYsoL1FJAco');
  const appPid = Number((await device.shell('pidof dev.dshmobile.validation.latesttest')).toString().trim());
  const expectedPid = attemptNumber === 7 ? 32632 : JSON.parse(await readFile(resolve(runtime,
    attemptNumber === 8 ? 'latest-sdk-sea-android-restored-attempt-7-attempt-2.json'
      : 'latest-sdk-sea-android-restored-attempt-8-read-repair.json'))).appPid;
  assert.equal(appPid, expectedPid);
  const apk = (await device.shell('pm path dev.dshmobile.validation.latesttest')).toString().trim();
  assert.match(apk, /^package:\/data\/app\/[A-Za-z0-9_~.=/+-]+\/base\.apk$/);
  const apkSha256 = (await device.shell('sha256sum ' + apk.slice('package:'.length))).toString().trim().split(/\s+/)[0];
  assert.equal(apkSha256, '58921967f03c2a2d8e6b2c9dfdfc623052dbb7ddbfb291684013d2863111114b');
  const before = await readSession({ allRecords: true });
  assert.equal(before.row.running, false);
  assert.equal(before.projections.values.permissions.currentValue, 'workspace-write');
  const input = main.getByRole('textbox', { name: '消息', exact: true });
  assert.equal((await input.innerText()).trim(), '');
  const marker = 'DSHM_SDK_SEA_' + randomUUID().replaceAll('-', '').slice(0, 16);
  const attempt = { at: new Date().toISOString(), hostPid: state.hostPid, home: state.home,
    sessionId: session.sessionId, marker, throughSeq: before.projections.asOfSeq };
  // 先排他记录唯一发送；不提供自动重发，以免失败观察造成重复模型请求。
  await writeFile(attemptPath, JSON.stringify(attempt, null, 2), { flag: 'wx' });
  report.hostPid = state.hostPid; report.sessionId = session.sessionId; report.marker = marker;
  report.productSha256 = carrier.productSha256; report.appPid = appPid; report.apkSha256 = apkSha256;
  await input.fill(`这是 DSHM 官方 SDK 载体联调。请只回复 ${marker}，不要调用任何工具。`);
  await main.getByRole('button', { name: '发送消息', exact: true }).click();
  console.log(JSON.stringify({ stage: 'sdk-android-model-wait', hostPid: state.hostPid }));
  await main.getByRole('article', { name: '模型回复', exact: true }).filter({ hasText: marker })
    .waitFor({ timeout: 240000 });
  await main.getByRole('button', { name: '停止生成', exact: true }).waitFor({ state: 'hidden', timeout: 240000 });
  const after = await readSession({ allRecords: true });
  assert.equal(after.row.running, false);
  assert.deepEqual(after.records.slice(0, before.records.length), before.records);
  const added = after.records.slice(before.records.length).map(row => row.event);
  const text = event => (event.data.message?.content ?? event.data.content ?? [])
    .filter(part => part.type === 'text').map(part => part.text).join('\n');
  const users = added.filter(event => event.type === 'user/message' && text(event).includes(marker));
  const replies = added.filter(event => event.type === 'assistant/message' && text(event).trim() === marker);
  assert.equal(users.length, 1); assert.equal(replies.length, 1);
  assert.equal(added.filter(event => event.type === 'tool/call').length, 0);
  assert.equal(after.projections.values.permissions.currentValue, 'workspace-write');
  assert.deepEqual(after.projections.values.modelSelection, before.projections.values.modelSelection);
  assert.equal((await input.innerText()).trim(), '');
  assert.equal(await page.locator('iframe').count(), 0);
  await capture(`latest-live-sdk-sea-attempt-${attemptNumber}`);
  report.userSeq = users[0].seq; report.assistantSeq = replies[0].seq;
  report.originalHistoryPrefixPreserved = true; report.originalAndroidComposerAndReply = true;
  report.noTools = true; report.noDesktopIframe = true;
  report.inferenceVerified = true; report.passed = true;
} catch (error) {
  report.failure = { name: error.name, code: error.code ?? 'validation_failed',
    location: error.stack?.split('\n').find(line => line.includes('verify-latest-sdk-android.mjs:'))?.trim() };
  process.exitCode = 1;
} finally {
  await writeFile(reportPath, JSON.stringify(report, null, 2), { flag: 'wx' });
  console.log(JSON.stringify({ passed: report.passed, inferenceVerified: report.inferenceVerified, failure: report.failure }));
  if (live) await live.device.close();
}
process.exit(process.exitCode ?? 0);
