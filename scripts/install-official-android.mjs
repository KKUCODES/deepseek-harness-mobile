import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { promisify } from 'node:util';

const packageName = 'dev.dshmobile.validation.officialtest';
const protectedPackage = 'dev.dshmobile.validation.latesttest';
assert.equal(process.env.DSHM_ANDROID_SERIAL, '127.0.0.1:16384');
assert.ok(process.env.DSHM_ADB_PATH);
const exec = promisify(execFile);
const adb = async (...args) => (await exec(process.env.DSHM_ADB_PATH,
  ['-s', process.env.DSHM_ANDROID_SERIAL, ...args], { windowsHide: true })).stdout.trim();
const original = async () => {
  const path = await adb('shell', 'pm', 'path', protectedPackage);
  assert.match(path, /^package:\/data\/app\/[A-Za-z0-9_./=+~-]+\/base\.apk$/);
  const pid = await adb('shell', 'pidof', protectedPackage);
  assert.match(pid, /^[1-9]\d*$/);
  const sha256 = (await adb('shell', 'sha256sum', path.slice(8))).split(/\s+/)[0];
  assert.equal(sha256, '58921967f03c2a2d8e6b2c9dfdfc623052dbb7ddbfb291684013d2863111114b');
  return { path, pid, sha256 };
};
assert.ok(process.argv.length === 2 || (process.argv.length === 3 && process.argv[2] === '--alpha2'));
const directory = resolve(import.meta.dirname, '../artifacts', process.argv[2] === '--alpha2' ? 'official-alpha2-android-build' : 'official-android-build');
const metadata = JSON.parse(await readFile(resolve(directory, 'outputs/apk/debug/output-metadata.json'), 'utf8'));
assert.equal(metadata.applicationId, packageName);
assert.equal(metadata.elements.length, 1);
assert.equal(metadata.elements[0].outputFile, 'app-debug.apk');
const apk = resolve(directory, 'outputs/apk/debug/app-debug.apk');
const bytes = await readFile(apk);
const sha256 = createHash('sha256').update(bytes).digest('hex');
const before = await original();
assert.match(await adb('install', '-r', apk), /Success/);
const installed = await adb('shell', 'pm', 'path', packageName);
assert.match(installed, /^package:\/data\/app\/[A-Za-z0-9_./=+~-]+\/base\.apk$/);
assert.equal((await adb('shell', 'sha256sum', installed.slice(8))).split(/\s+/)[0], sha256);
const after = await original();
assert.deepEqual(after, before);
await writeFile(resolve(directory, 'official-app.json'), JSON.stringify({
  packageName, apk, sha256, bytes: bytes.length, before, after, originalAppIdentityUnchanged: true,
}, null, 2) + '\n');
console.log(JSON.stringify({ packageName, sha256, bytes: bytes.length, originalAppIdentityUnchanged: true }));
