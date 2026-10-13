// 独立UID的原生通知生命周期回归；保持真实模型App和其凭据/配对不动。
import assert from 'node:assert/strict';
import { access, readFile, writeFile, realpath } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';

const phase = process.argv[2]; assert.equal(process.argv.length, 3);
assert.ok(['red', 'red-recovered', 'green', 'cleanup'].includes(phase));
const verifyingRed = phase === 'red' || phase === 'red-recovered';
const root = resolve(import.meta.dirname, '..'), output = resolve(root, 'artifacts/latest-notice-android-build');
const reportPath = resolve(root, `artifacts/latest-native-notice-click-${phase}.json`);
await assert.rejects(access(reportPath), { code: 'ENOENT' });
const adb = 'C:/Users/KKirin/AppData/Local/Android/Sdk/platform-tools/adb.exe';
const target = 'dev.dshmobile.validation.latestnoticetest';
const primary = 'dev.dshmobile.validation.latesttest';
const run = (...args) => execFileSync(adb, ['-s', 'emulator-5554', ...args],
  { cwd: root, windowsHide: true, encoding: 'utf8', timeout: 60000 }).trim();
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
function installedPath(pkg) {
  try { return run('shell', 'pm', 'path', pkg); }
  catch (error) {
    // Android pm对未安装包返回1及空输出；仅接受这个明确的不存在结果。
    if (error.status === 1 && !error.stdout?.trim() && !error.stderr?.trim()) return '';
    throw error;
  }
}
function installedHash(pkg) {
  const path = installedPath(pkg);
  assert.match(path, /^package:\/data\/app\/[A-Za-z0-9_~.=/+-]+\/base\.apk$/);
  return run('shell', 'sha256sum', path.slice('package:'.length)).split(/\s+/)[0];
}
function primaryUnchanged() {
  assert.equal(run('shell', 'pidof', primary), '12296');
  assert.equal(installedHash(primary), '58921967f03c2a2d8e6b2c9dfdfc623052dbb7ddbfb291684013d2863111114b');
}
async function apk(relative, id) {
  const folder = resolve(output, relative);
  const metadata = JSON.parse(await readFile(resolve(folder, 'output-metadata.json'), 'utf8'));
  assert.equal(metadata.applicationId, id); assert.equal(metadata.elements.length, 1);
  const name = metadata.elements[0].outputFile; assert.match(name, /^app-debug(?:-androidTest)?\.apk$/);
  const file = resolve(folder, name); assert.equal(await realpath(file), file);
  return { file, sha256: hash(await readFile(file)) };
}
const report = { at: new Date().toISOString(), phase, packageName: target, passed: false };
try {
  primaryUnchanged();
  const red = verifyingRed ? undefined : JSON.parse(await readFile(resolve(root, 'artifacts/latest-native-notice-click-red-recovered.json'), 'utf8'));
  if (phase === 'red-recovered') {
    const failed = JSON.parse(await readFile(resolve(root, 'artifacts/latest-native-notice-click-red.json'), 'utf8'));
    assert.equal(failed.passed, false); assert.equal(failed.redReproduced, undefined);
    assert.ok(failed.failure.message.includes('shell pm path ' + target));
  }
  if (phase === 'cleanup') {
    const green = JSON.parse(await readFile(resolve(root, 'artifacts/latest-native-notice-click-green.json'), 'utf8'));
    assert.equal(green.passed, true); assert.equal(installedHash(target), green.apkSha256);
    assert.equal(installedHash(target + '.test'), green.testApkSha256);
    assert.equal(run('uninstall', target + '.test'), 'Success');
    assert.equal(run('uninstall', target), 'Success');
    assert.equal(installedPath(target), '');
    assert.equal(installedPath(target + '.test'), '');
    report.testPackagesRemoved = true; report.passed = true;
  } else {
    const app = await apk('outputs/apk/debug', target), test = await apk('outputs/apk/androidTest/debug', target + '.test');
    report.apkSha256 = app.sha256; report.testApkSha256 = test.sha256;
    report.productionSourceSha256 = hash(await readFile(resolve(root, 'android/app/src/main/java/dev/dshmobile/validation/RemoteNotifications.kt')));
    report.testSourceSha256 = hash(await readFile(resolve(root, 'android/app/src/androidTest/java/dev/dshmobile/validation/RemoteNotificationRestoreChecks.kt')));
    if (verifyingRed) {
      assert.equal(installedPath(target), '');
      assert.equal(installedPath(target + '.test'), '');
    } else {
      assert.equal(red.redReproduced, true); assert.equal(installedHash(target), red.apkSha256);
      assert.equal(installedHash(target + '.test'), red.testApkSha256);
      assert.equal(report.testSourceSha256, red.testSourceSha256);
      assert.notEqual(report.productionSourceSha256, red.productionSourceSha256);
    }
    assert.match(run('install', '-r', app.file), /Success/);
    assert.match(run('install', '-r', test.file), /Success/);
    assert.equal(installedHash(target), app.sha256); assert.equal(installedHash(target + '.test'), test.sha256);
    const result = run('shell', 'am', 'instrument', '-w', '-e', 'notificationsOnly', 'true',
      target + '.test/dev.dshmobile.validation.OrdinarySecurityInstrumentation');
    report.instrumentation = result;
    if (verifyingRed) {
      assert.match(result, /result=FAIL: native notification ledger/);
      assert.match(result, /stage=expect:click-child-result,click-parent-result;actual:click-child-result/);
      assert.match(result, /INSTRUMENTATION_CODE: 0/);
      report.redReproduced = true;
    } else {
      assert.match(result, /result=PASS: native notification ledger and actual system notification restore/);
      assert.match(result, /INSTRUMENTATION_CODE: -1/); report.passed = true;
    }
  }
  primaryUnchanged(); report.primaryAppPreserved = true;
} catch (error) {
  report.failure = { name: error.name, message: error.message?.split('\n')[0] }; process.exitCode = 1;
} finally {
  await writeFile(reportPath, JSON.stringify(report, null, 2), { flag: 'wx' });
  console.log(JSON.stringify(report));
}
