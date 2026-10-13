// 临时候选验收后的原 App/Host恢复检查；不修改 Key、绑定或历史。
import assert from 'node:assert/strict';
import { access, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { openLatestLiveAndroid } from '../tests/support/latest-live-context.mjs';

assert.ok(process.argv.length === 2 || process.argv.length === 3);
const scope = process.argv[2] ?? ''; assert.ok(scope === '' || /^[a-z][a-z0-9-]{0,40}$/.test(scope));
const live = await openLatestLiveAndroid(undefined, { openRecorded: true, reconnectRecorded: true });
const { runtime, state, session, device, main, page, readSession, capture } = live;
const prefix = 'latest-live-child-retention-' + (scope ? scope + '-' : '') + 'main-restored';
const file = resolve(runtime, prefix + '.json');
await assert.rejects(access(file), { code: 'ENOENT' });
const report = { at: new Date().toISOString(), scope, hostPid: state.hostPid, passed: false };
try {
  assert.equal(state.executionMode, 'release'); assert.equal(state.reviewCandidate, undefined);
  const current = await readSession(); assert.equal(current.row.running, false);
  assert.equal(current.projections.values.permissions.currentValue, 'workspace-write');
  assert.equal((await main.getByRole('textbox', { name: '消息', exact: true }).innerText()).trim(), '');
  assert.equal(await main.getByRole('button', { name: '停止生成', exact: true }).count(), 0);
  assert.equal(await page.locator('iframe').count(), 0);
  const packageName = 'dev.dshmobile.validation.latesttest';
  const pid = Number((await device.shell('pidof ' + packageName)).toString().trim());
  assert.equal(pid, 12296);
  const apk = (await device.shell('pm path ' + packageName)).toString().trim();
  assert.match(apk, /^package:\/data\/app\/[A-Za-z0-9_~.=/+-]+\/base\.apk$/);
  const sha256 = (await device.shell('sha256sum ' + apk.slice('package:'.length))).toString().trim().split(/\s+/)[0];
  assert.equal(sha256, '58921967f03c2a2d8e6b2c9dfdfc623052dbb7ddbfb291684013d2863111114b');
  report.appPid = pid; report.apkSha256 = sha256; report.parentId = session.sessionId;
  report.originalRuntimeRestored = true; report.emptyDraft = true; report.permissionsRestored = true;
  await capture(prefix); report.passed = true;
} catch (error) { report.failure = error.stack; process.exitCode = 1; }
finally { await writeFile(file, JSON.stringify(report, null, 2), { flag: 'wx' });
  console.log(JSON.stringify(report)); await device.close(); }
setTimeout(() => process.exit(process.exitCode ?? 0), 200);
