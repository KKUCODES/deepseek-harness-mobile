import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { readFile, writeFile } from 'node:fs/promises';

const execute = promisify(execFile), adb = 'C:/Users/KKirin/AppData/Local/Android/Sdk/platform-tools/adb.exe';
const serial = '127.0.0.1:16384', own = 'dev.dshmobile.validation.officialtest';
const original = 'dev.dshmobile.validation.latesttest';
const shell = async command => (await execute(adb, ['-s', serial, 'shell', command], { windowsHide: true })).stdout.trim();
const path = await shell('pm path ' + original);
assert.match(path, /^package:\/data\/app\/[A-Za-z0-9_./=+~-]+\/base\.apk$/);
const pid = await shell('pidof ' + original);
assert.equal(pid, '4249');
const sha256 = (await shell('sha256sum ' + path.slice(8))).split(/\s+/)[0];
assert.equal(sha256, '58921967f03c2a2d8e6b2c9dfdfc623052dbb7ddbfb291684013d2863111114b');
// pidof不存在的UID正常退出1，只接受空输出，不掩盖其他ADB错误。
await assert.rejects(shell('pidof ' + own), error => error.code === 1 && error.stdout === '' && error.stderr === '');
assert.equal(await shell('run-as ' + own + ' find cache/remote-downloads -type f'), '');
await assert.rejects(shell('run-as ' + own + ' ls -d no_backup/remote-save-writes'),
  error => error.code === 1 && /No such file or directory/.test(error.stderr + error.stdout));
const reversed = await execute(adb, ['-s', serial, 'reverse', '--list'], { windowsHide: true });
assert.doesNotMatch(reversed.stdout, /tcp:16956|tcp:16957/);
const launch = await shell('am start -W -a android.intent.action.MAIN -c android.intent.category.LAUNCHER -n '
  + original + '/dev.dshmobile.validation.ValidationActivity');
assert.match(launch, /Status: ok/);
const focus = (await shell('dumpsys window')).split('\n').filter(line => /mCurrentFocus/.test(line));
assert.ok(focus.some(line => line.includes(original)));
const screenshot = await execute(adb, ['-s', serial, 'exec-out', 'screencap', '-p'],
  { windowsHide: true, encoding: 'buffer', maxBuffer: 8 * 1024 * 1024 });
await writeFile('artifacts/official-plugin-only/timed-question-original-foreground.png', screenshot.stdout);
const startup = JSON.parse(await readFile('../plugin/artifacts/official-dsh-plugin-only/official-web-receipt.json', 'utf8'));
process.kill(startup.pid, 0);
const check = JSON.parse(await readFile('../backend/artifacts/official-plugin-only/official-android-36cc0fd6-ee9e-4212-a1e4-c0b32c9b6a67.json', 'utf8'));
assert.equal(check.cleanupCompleted, true);
const report = { at: new Date().toISOString(), original: { path, pid, sha256, foreground: true },
  ownStopped: true, downloadsEmpty: true, saveRecordsAbsent: true, testReverseMappingsAbsent: true,
  testDevicesRevoked: check.testDevicesRevoked, timedPresetCleanup: check.testTimedPresetCleanup,
  officialLaunchPid: startup.pid, officialEntry: startup.entry, appInstalled: false, appBuilt: false,
  dshModified: false, dshBuilt: false, keyRead: false, bindingReplaced: false };
await writeFile('artifacts/official-plugin-only/timed-question-final-restoration.json', JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report));
