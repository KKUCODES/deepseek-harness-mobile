import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { promisify } from 'node:util';

// 只编译无联网权限的分享接收器；不调用 Gradle、不构建或安装 DSHM App。
const run = promisify(execFile), root = resolve(import.meta.dirname, '..');
const sdk = 'C:/Users/KKirin/AppData/Local/Android/Sdk';
const buildTools = resolve(sdk, 'build-tools/36.1.0'), android = resolve(sdk, 'platforms/android-35/android.jar');
const base = resolve(root, 'artifacts/official-alpha2-share-receiver');
const id = randomUUID(), output = resolve(base, id);
const classes = resolve(output, 'classes'), dex = resolve(output, 'dex');
await mkdir(classes, { recursive: true }); await mkdir(dex);
const manifest = resolve(root, 'tests/fixtures/official-share-receiver/AndroidManifest.xml');
const java = ['RemoteShareReceiver', 'LatestRemoteShareReceiver'].map(name =>
  resolve(root, 'android/app/src/androidTest/java/dev/dshmobile/validation', name + '.java'));
const hash = async path => createHash('sha256').update(await readFile(path)).digest('hex');
const inputs = await Promise.all([manifest, ...java].map(async path => ({ path, sha256: await hash(path) })));
const originalApp = resolve(root, 'android/app/build/outputs/apk/debug/app-debug.apk');
const originalHash = await hash(originalApp);
const execute = async (binary, args, cwd = output) => {
  const result = await run(binary, args, { cwd, windowsHide: true, maxBuffer: 1024 * 1024 });
  return result.stdout;
};
await execute('javac.exe', ['-encoding', 'UTF-8', '--release', '8', '-classpath', android, '-d', classes, ...java]);
await execute('java.exe', ['-cp', resolve(buildTools, 'lib/d8.jar'), 'com.android.tools.r8.D8', '--lib', android,
  '--min-api', '26', '--output', dex, ...['RemoteShareReceiver', 'LatestRemoteShareReceiver'].map(name =>
    resolve(classes, 'dev/dshmobile/validation', name + '.class'))]);
const unsigned = resolve(output, 'unsigned.apk'), apk = resolve(output, 'receiver.apk');
await execute(resolve(buildTools, 'aapt.exe'), ['package', '-f', '-M', manifest, '-I', android, '-F', unsigned]);
await execute(resolve(buildTools, 'aapt.exe'), ['add', unsigned, 'classes.dex'], dex);
const keystore = resolve(output, 'test-signing.jks');
await execute('keytool.exe', ['-genkeypair', '-keystore', keystore, '-storepass', 'dshm-test', '-keypass', 'dshm-test',
  '-alias', 'receiver', '-dname', 'CN=DSHM Official Share Test', '-keyalg', 'RSA', '-validity', '3650']);
await execute('java.exe', ['-jar', resolve(buildTools, 'lib/apksigner.jar'), 'sign', '--ks', keystore,
  '--ks-pass', 'pass:dshm-test', '--key-pass', 'pass:dshm-test', '--out', apk, unsigned]);
await execute('java.exe', ['-jar', resolve(buildTools, 'lib/apksigner.jar'), 'verify', '--verbose', apk]);
const badging = await execute(resolve(buildTools, 'aapt.exe'), ['dump', 'badging', apk]);
assert.match(badging, /package: name='dev\.dshmobile\.validation\.officialtest\.test'/);
assert.equal(await hash(originalApp), originalHash);
const report = { run: id, packageName: 'dev.dshmobile.validation.officialtest.test', apk,
  sha256: await hash(apk), inputs, mainAppArtifactUnchanged: true, appBuilt: false, appInstalled: false };
await writeFile(resolve(output, 'build-report.json'), JSON.stringify(report, null, 2) + '\n', { flag: 'wx' });
await writeFile(resolve(base, 'current.json'), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report));
