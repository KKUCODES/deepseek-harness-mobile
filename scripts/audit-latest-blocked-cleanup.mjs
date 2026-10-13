// 两种真实入口验收后移除诊断启动配置；只核对原会话，不发送消息。
import assert from 'node:assert/strict';
import { access, readFile, writeFile, unlink } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { openLatestLiveAndroid } from '../tests/support/latest-live-context.mjs';

const live = await openLatestLiveAndroid(undefined, { openRecorded: true });
const { state, runtime, main, page, readSession, device, capture } = live;
const recovering = process.argv[2] === '--recover';
assert.ok(process.argv.length === 2 || process.argv.length === 3 && recovering);
const reportPath = resolve(runtime, 'latest-live-blocked-cleanup' + (recovering ? '-recovered' : '') + '.json');
const report = { at: new Date().toISOString(), passed: false, errors: [], hostPid: state.hostPid };
page.on('pageerror', error => report.errors.push(error.message.split('\n')[0]));
try {
  await assert.rejects(access(reportPath), { code: 'ENOENT' });
  if (recovering) {
    const failed = JSON.parse(await readFile(resolve(runtime, 'latest-live-blocked-cleanup.json'), 'utf8'));
    assert.equal(failed.passed, false); assert.equal(failed.hostPid, state.hostPid);
    assert.equal(failed.failure.code, 'ERR_ASSERTION'); assert.ok(failed.failure.message.includes('^latest-live-[a-z0-9-]+$'));
    report.previousCaptureFailurePreserved = true;
  }
  assert.equal(state.executionMode, 'release'); assert.equal(state.command, 'node dsh/lib/bin.js web');
  assert.equal(state.blockedDiagnostic, false); assert.equal(state.outputDiagnostic, false);
  const seeds = [];
  for (const prefix of ['latest-live-blocked-notice', 'latest-live-source-blocked-notice']) {
    const seed = JSON.parse(await readFile(resolve(runtime, prefix + '-seed.json'), 'utf8'));
    const audit = JSON.parse(await readFile(resolve(runtime, prefix + '-android-audit.json'), 'utf8'));
    assert.equal(seed.home, state.home); assert.equal(seed.sessionId, live.session.sessionId);
    assert.equal(seed.cleaned, true); assert.equal(audit.passed, true); seeds.push(seed);
  }
  for (const name of ['latest-blocked-control.json', 'latest-blocked-host.json']) await assert.rejects(access(resolve(state.home, name)), { code: 'ENOENT' });
  const original = await readSession(); assert.equal(original.row.running, false);
  assert.equal(original.projections.values.permissions.currentValue, seeds[0].permission);
  for (const seed of seeds) {
    const ends = original.records.filter(item => item.event.seq === seed.blockedSeq);
    assert.equal(ends.length, 1); assert.equal(ends[0].event.type, 'turn/end');
    assert.equal(ends[0].event.data.reason.kind, 'blocked');
  }
  const notices = (await device.shell('cmd notification list')).toString().split('\n')
    .filter(line => line.includes('|dev.dshmobile.validation.latesttest|') && line.includes('dshm.remote.notice.'));
  assert.equal(notices.length, 0);
  assert.deepEqual(await main.locator('[data-turn-blocked]').allInnerTexts(), seeds.map(() => '本轮任务受阻，未继续执行。'));
  assert.equal((await main.getByRole('textbox', { name: '消息', exact: true }).innerText()).trim(), '');
  assert.equal(await page.locator('iframe').count(), 0); assert.deepEqual(report.errors, []);
  const overlay = resolve(state.home, 'blocked-diagnostic.patch.json');
  if (!recovering) {
    assert.deepEqual(JSON.parse(await readFile(overlay, 'utf8')), [{ insert: [
    { id: 'dsh-mobile', name: pathToFileURL(resolve(runtime, 'candidate/dist/index.js')).href },
    { id: 'latest-blocked-diagnostic', name: pathToFileURL(resolve(import.meta.dirname, '../../backend/tests/support/latest-blocked-diagnostic/index.mjs')).href },
    ] }]);
    await unlink(overlay);
  }
  await assert.rejects(access(overlay), { code: 'ENOENT' });
  await capture('latest-live-blocked-restored');
  report.passed = true; report.diagnosticRemoved = true; report.originalBlockedSeqs = seeds.map(seed => seed.blockedSeq);
  report.currentSeq = original.projections.asOfSeq; report.originalPermission = original.projections.values.permissions.currentValue;
  report.pid = (await device.shell('pidof dev.dshmobile.validation.latesttest')).toString().trim();
} catch (error) { report.failure = { name: error.name, code: error.code, message: error.message.split('\n')[0] }; process.exitCode = 1; }
finally { await writeFile(reportPath, JSON.stringify(report, null, 2), { flag: 'wx' }); console.log(JSON.stringify(report)); await device.close(); }
setTimeout(() => process.exit(process.exitCode ?? 0), 200);
