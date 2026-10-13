import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { resolve, relative } from 'node:path';
import { unzipSync } from 'fflate';
import { latestFinalScope } from './latest-final-test-scope.mjs';

const root = resolve(import.meta.dirname, '..'), scope = latestFinalScope();
assert.ok(scope, 'Explicit independent final run required');
assert.ok(process.argv.length === 2 || process.argv.length === 3 && process.argv[2].startsWith('--reuse='));
const previousRun = process.argv[2]?.slice('--reuse='.length);
if (previousRun) assert.match(previousRun, /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
const adb = process.env.DSHM_ADB_PATH;
assert.ok(adb, 'Explicit inspected adb required');
const run = args => execFileSync(adb, ['-s', process.env.DSHM_ANDROID_SERIAL, ...args],
  { cwd: root, windowsHide: true, encoding: 'utf8', maxBuffer: 1024 * 1024 }).trim();
const shell = args => run(['shell', ...args]);
const protectedPackage = 'dev.dshmobile.validation.latesttest';
function protectedState() {
  const path = shell(['pm', 'path', protectedPackage]);
  assert.match(path, /^package:\/data\/app\/[A-Za-z0-9_./=+~-]+\/base\.apk$/);
  const pid = shell(['pidof', protectedPackage]); assert.match(pid, /^[1-9]\d*$/);
  const sha256 = shell(['sha256sum', path.slice(8)]).split(/\s+/)[0];
  assert.equal(sha256, '58921967f03c2a2d8e6b2c9dfdfc623052dbb7ddbfb291684013d2863111114b');
  return { path, pid, sha256 };
}
const before = protectedState();
if (!previousRun) assert.equal(shell(['pm', 'list', 'packages', scope.packageName]), '', 'Only install the previously absent test UID');
const build = resolve(root, 'artifacts/latest-final-android-build/outputs/apk/debug');
const metadata = JSON.parse(await readFile(resolve(build, 'output-metadata.json'), 'utf8'));
assert.equal(metadata.applicationId, scope.packageName);
const apkPath = resolve(build, 'app-debug.apk'), bytes = await readFile(apkPath);
const hash = value => createHash('sha256').update(value).digest('hex');
const apk = unzipSync(bytes, { filter: entry => entry.name.startsWith('assets/web/') });
const web = resolve(root, 'artifacts/latest-mobile-dist');
async function files(directory) {
  const paths = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    assert.equal(entry.isSymbolicLink(), false);
    if (entry.isDirectory()) paths.push(...await files(resolve(directory, entry.name)));
    else if (entry.isFile() && entry.name !== 'bundle-analysis.json') paths.push(resolve(directory, entry.name));
  }
  return paths;
}
const paths = await files(web), names = paths.map(path => 'assets/web/' + relative(web, path).replaceAll('\\', '/'));
assert.deepEqual(Object.keys(apk).filter(name => !name.endsWith('/')).sort(), [...names].sort());
for (let index = 0; index < paths.length; index++)
  assert.equal(hash(apk[names[index]]), hash(await readFile(paths[index])), names[index]);
const versions = JSON.parse(Buffer.from(apk['assets/web/sdk-versions.json']).toString());
for (const [name, version] of Object.entries(versions))
  if (name.startsWith('@deepseek-ai/dsh-')) assert.equal(version, '0.2.1-alpha.1');
if (previousRun) {
  const receipt = JSON.parse(await readFile(resolve(root, 'artifacts/latest-mobile-runtime',
    'latest-final-android-' + previousRun, 'apk-installed.json'), 'utf8'));
  assert.equal(receipt.passed, true); assert.equal(receipt.run, previousRun);
  assert.equal(receipt.packageName, scope.packageName); assert.equal(receipt.sha256, hash(bytes));
  assert.equal(receipt.originalUidUnchanged, true);
} else assert.match(run(['install', apkPath]), /Success/);
const installed = shell(['pm', 'path', scope.packageName]);
assert.match(installed, /^package:\/data\/app\/[A-Za-z0-9_./=+~-]+\/base\.apk$/);
assert.equal(shell(['sha256sum', installed.slice(8)]).split(/\s+/)[0], hash(bytes));
const after = protectedState(); assert.deepEqual(after, before);
const evidence = resolve(root, 'artifacts/latest-mobile-runtime', scope.reportName);
await mkdir(evidence, { recursive: true });
const report = { at: new Date().toISOString(), passed: true, ...scope, apkPath, sha256: hash(bytes),
  ...(previousRun ? { reusedFromRun: previousRun, appInstalledThisRun: false } : { appInstalledThisRun: true }),
  webFiles: paths.length, versions, protectedPackage, before, after, originalUidUnchanged: true };
await writeFile(resolve(evidence, 'apk-installed.json'), JSON.stringify(report, null, 2) + '\n', { flag: 'wx' });
console.log(JSON.stringify(report));
