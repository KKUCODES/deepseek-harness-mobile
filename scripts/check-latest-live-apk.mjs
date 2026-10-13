import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFile, readdir, writeFile } from 'node:fs/promises';
import { resolve, relative } from 'node:path';
import { unzipSync } from 'fflate';

const root = resolve(import.meta.dirname, '..'), build = resolve(root, 'artifacts/latest-android-build/outputs/apk/debug');
const attempt = process.argv[2] ?? ''; assert.ok(attempt === '' || /^[a-z][a-z0-9-]{0,30}$/.test(attempt));
const web = resolve(root, 'artifacts/latest-mobile-dist'), apkPath = resolve(build, 'app-debug.apk');
const hash = value => createHash('sha256').update(value).digest('hex');
const metadata = JSON.parse(await readFile(resolve(build, 'output-metadata.json'), 'utf8'));
assert.equal(metadata.applicationId, 'dev.dshmobile.validation.latesttest');
assert.equal(process.env.DSHM_ANDROID_SERIAL, 'emulator-5554');
const bytes = await readFile(apkPath), apk = unzipSync(bytes, { filter: entry => entry.name.startsWith('assets/web/') });
async function files(directory) {
  const result = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    assert.equal(entry.isSymbolicLink(), false);
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) result.push(...await files(path)); else if (entry.isFile()) result.push(path);
  }
  return result;
}
const paths = (await files(web)).filter(path => relative(web, path) !== 'bundle-analysis.json');
const names = paths.map(path => 'assets/web/' + relative(web, path).replaceAll('\\', '/'));
assert.deepEqual(Object.keys(apk).filter(name => !name.endsWith('/')).sort(), [...names].sort());
for (let i = 0; i < paths.length; i++) assert.equal(hash(apk[names[i]]), hash(await readFile(paths[i])), names[i]);
const adb = 'C:/Users/KKirin/AppData/Local/Android/Sdk/platform-tools/adb.exe';
const shell = args => execFileSync(adb, ['-s', 'emulator-5554', 'shell', ...args], { cwd: root, windowsHide: true, encoding: 'utf8' }).trim();
const installed = shell(['pm', 'path', metadata.applicationId]);
assert.match(installed, /^package:\/data\/app\/[A-Za-z0-9_./=+~-]+\/base\.apk$/);
const sha256 = hash(bytes); assert.equal(shell(['sha256sum', installed.slice(8)]).split(/\s+/)[0], sha256);
const report = { at: new Date().toISOString(), passed: true, applicationId: metadata.applicationId,
  sha256, webFiles: paths.length, webMatchesBuild: true, installedMatchesApk: true };
await writeFile(resolve(root, 'artifacts/latest-live-draft-receipt-apk' + (attempt ? '-' + attempt : '') + '.json'), JSON.stringify(report, null, 2), { flag: 'wx' });
console.log(JSON.stringify(report));
