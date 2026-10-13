// 恢复原安装包后核对同一原页面、绑定和专用会话；不读取Key，不重放消息。
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { access, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { openLatestLiveAndroid } from '../tests/support/latest-live-context.mjs';

const live = await openLatestLiveAndroid(undefined, { openRecorded: true, reconnectRecorded: true });
const { state, runtime, session, main, page, device, readSession, readChild, capture } = live;
const reportPath = resolve(runtime, 'latest-live-child-notice-main-restored.json');
await assert.rejects(access(reportPath), { code: 'ENOENT' });
const report = { at: new Date().toISOString(), home: state.home, passed: false };
const pkg = 'dev.dshmobile.validation.latesttest';
const root = resolve(import.meta.dirname, '..');
const digest = event => createHash('sha256').update(JSON.stringify(event)).digest('hex');
try {
  assert.equal(state.executionMode, 'release'); assert.equal(state.reviewCandidate, undefined);
  assert.equal(state.autoReviewDiagnostic, false);
  const restored = JSON.parse(await readFile(resolve(root, 'artifacts/latest-child-notice-main-apk-restore.json'), 'utf8'));
  assert.equal(restored.passed, true); assert.equal(restored.webAssetsUnchanged, 165);
  const path = (await device.shell(`pm path ${pkg}`)).toString().trim();
  assert.match(path, /^package:\/data\/app\/[A-Za-z0-9_~.=/+-]+\/base\.apk$/);
  assert.equal((await device.shell(`sha256sum ${path.slice(8)}`)).toString().split(/\s+/)[0], restored.originalSha256);
  const current = await readSession({ allRecords: true }); assert.equal(current.row.running, false);
  assert.equal(current.projections.values.permissions.currentValue, 'workspace-write');
  assert.equal((await main.getByRole('textbox', { name: '消息', exact: true }).innerText()).trim(), '');
  const notices = (await device.shell('cmd notification list')).toString().split('\n')
    .filter(line => line.includes(`|${pkg}|`) && line.includes('dshm.remote.notice.'));
  assert.deepEqual(notices, []); report.children = [];
  for (const mode of ['release', 'source']) {
    const prefix = `latest-live-${mode}-child-notice-fixed`;
    const seed = JSON.parse(await readFile(resolve(runtime, prefix + '-seed.json'), 'utf8'));
    const cleanup = JSON.parse(await readFile(resolve(runtime, prefix + '-android-cleanup.json'), 'utf8'));
    assert.equal(cleanup.passed, true); assert.equal(seed.cleaned, true);
    assert.equal(seed.home, state.home); assert.equal(seed.parentId, session.sessionId);
    for (const original of seed.parentHashes) {
      const event = current.records.find(row => row.event.seq === original.seq)?.event;
      assert.ok(event); assert.equal(digest(event), original.hash);
    }
    const child = await readChild(seed.childId);
    assert.equal(child.projections.asOfSeq, seed.childSeq);
    assert.deepEqual(child.records.map(({ event }) => ({ seq: event.seq, type: event.type, hash: digest(event) })), seed.childHashes);
    report.children.push({ executionMode: mode, id: seed.childId, seq: seed.childSeq, originalHistoryUnchanged: true });
  }
  report.hostPid = state.hostPid; report.pid = (await device.shell(`pidof ${pkg}`)).toString().trim();
  assert.match(report.pid, /^[1-9]\d*$/);
  report.originalApkRestored = true; report.emptyDraft = true; report.permissionUnchanged = true;
  report.parentRecords = current.records.length;
  assert.equal(await page.locator('iframe').count(), 0);
  await capture('latest-live-child-notice-main-restored'); report.passed = true;
} catch (error) { report.failure = { name: error.name, message: error.message?.split('\n')[0] }; process.exitCode = 1; }
finally { await writeFile(reportPath, JSON.stringify(report, null, 2), { flag: 'wx' }); console.log(JSON.stringify(report)); await device.close(); }
