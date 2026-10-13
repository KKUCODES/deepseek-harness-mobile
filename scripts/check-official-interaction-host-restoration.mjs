import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { readFile, writeFile } from 'node:fs/promises';

const execute = promisify(execFile), adb = 'C:/Users/KKirin/AppData/Local/Android/Sdk/platform-tools/adb.exe';
const serial = '127.0.0.1:16384', original = 'dev.dshmobile.validation.latesttest';
const own = 'dev.dshmobile.validation.officialtest', args = process.argv.slice(2);
const race = args[0] === '--race', sending = args[0] === '--sending';
const runs = race || sending ? args.slice(1) : args;
const evidenceName = sending ? 'interaction-sending' : race ? 'interaction-race' : 'interaction-host';
assert.ok(runs.length > 0 && runs.length <= (race || sending ? 3 : 2));
const checks = [];
for (const run of runs) {
  assert.match(run, /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/);
  const check = JSON.parse(await readFile('../backend/artifacts/official-plugin-only/official-android-' + run + '.json', 'utf8'));
  assert.match(check.scope, sending ? /^(?:(legacy|plan)-interaction-phone-answer-before-forward-and-receipt-loss|approval-answer-before-forward-and-receipt-loss)$/
    : race ? /^(legacy|plan|continued)-interaction-two-real-connections-opposite-concurrent-decisions$/
    : /^(legacy|plan)-interaction-host-interruption-explicit-retry-and-settled-restart$/);
  assert.equal(check.run, run); assert.equal(check.passed, true);
  assert.equal(sending ? (check.scope.startsWith('approval-') ? check.approvalSendingVerified : check.interactionSendingVerified)
    : race ? check.interactionRaceVerified : check.interactionHostVerified, true);
  assert.equal(check.cleanupCompleted, true); assert.deepEqual(check.cleanupFailures, []);
  assert.equal(check.testDevicesRevoked, true); assert.equal(check.gatewayClosed, true);
  assert.equal(check.android.authorityRevoked, true);
  assert.equal(sending ? (check.scope.startsWith('approval-') ? check.android.approvalSending.completed
    : check.android.interactionSending.completed) : race ? (check.scope.startsWith('continued-') ? check.android.timedRace.completed
    : check.android.interactionRace.completed) : check.android.interactionHost.completed, true);
  if (check.scope.startsWith('continued-')) {
    assert.equal(check.testTimedPresetCleanup.standardUnchanged, true);
    assert.equal(check.testTimedPresetCleanup.originalPresetDefaultsUnchanged, true);
    assert.equal(check.testTimedPresetCleanup.bundleRemoved, true);
    assert.equal(check.testTimedPresetCleanup.testPresetRemoved, true);
  }
  if (check.scope.startsWith('plan-')) assert.equal(check.testPlanModeRestored, true);
  if (sending) assert.equal(check.externalProxyClosed, true);
  checks.push(check);
}
const shell = async command => (await execute(adb, ['-s', serial, 'shell', command], { windowsHide: true })).stdout.trim();
const path = await shell('pm path ' + original), pid = await shell('pidof ' + original);
const sha256 = (await shell('sha256sum ' + path.slice(8))).split(/\s+/)[0];
assert.equal(pid, '4249');
assert.equal(sha256, '58921967f03c2a2d8e6b2c9dfdfc623052dbb7ddbfb291684013d2863111114b');
for (const check of checks) {
  assert.equal(path, check.android.before.path); assert.equal(pid, check.android.before.pid);
  assert.equal(path, check.android.after.path); assert.equal(pid, check.android.after.pid);
}
// 只接受pidof的正常无进程结果；ADB连接错误不代表清理成功。
await assert.rejects(shell('pidof ' + own), error => error.code === 1 && error.stdout === '' && error.stderr === '');
assert.equal(await shell('run-as ' + own + ' find cache/remote-downloads -type f'), '');
await assert.rejects(shell('run-as ' + own + ' ls -d no_backup/remote-save-writes'),
  error => error.code === 1 && /No such file or directory/.test(error.stderr + error.stdout));
const reverse = await execute(adb, ['-s', serial, 'reverse', '--list'], { windowsHide: true });
assert.doesNotMatch(reverse.stdout, /tcp:16956|tcp:16957/);
const startup = JSON.parse(await readFile('../plugin/artifacts/official-dsh-plugin-only/official-web-receipt.json', 'utf8'));
assert.equal(startup.pid, race || sending ? checks.at(-1).officialLaunchPid : checks.at(-1).hostStarts.at(-1).launchPid);
assert.equal(startup.stage, 'plugin-ready'); assert.equal(startup.entry, 'pnpm dsh web'); assert.equal(startup.port, 16955);
process.kill(startup.pid, 0);
const launch = await shell('am start -W -a android.intent.action.MAIN -c android.intent.category.LAUNCHER -n '
  + original + '/dev.dshmobile.validation.ValidationActivity');
assert.match(launch, /Status: ok/);
const focus = (await shell('dumpsys window')).split('\n').filter(line => /mCurrentFocus/.test(line));
assert.ok(focus.some(line => line.includes(original)));
const screenshot = await execute(adb, ['-s', serial, 'exec-out', 'screencap', '-p'],
  { windowsHide: true, encoding: 'buffer', maxBuffer: 8 * 1024 * 1024 });
await writeFile('artifacts/official-plugin-only/' + evidenceName + '-original-foreground.png', screenshot.stdout);
const report = { at: new Date().toISOString(), runs, race, sending, original: { path, pid, sha256, foreground: true },
  ownStopped: true, downloadsEmpty: true, saveRecordsAbsent: true, testReverseMappingsAbsent: true,
  testDevicesRevoked: true, timedPresetCleanup: checks.find(check => check.scope.startsWith('continued-'))?.testTimedPresetCleanup,
  officialLaunchPid: startup.pid, officialEntry: startup.entry,
  appInstalled: false, appBuilt: false, dshModified: false, dshBuilt: false, sdkBuilt: false,
  keyRead: false, bindingReplaced: false };
await writeFile('artifacts/official-plugin-only/' + evidenceName + '-final-restoration.json', JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report));
