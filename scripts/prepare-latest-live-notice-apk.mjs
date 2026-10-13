// 只替换专用新版App安装包；保存原APK以便恢复，不导出私有数据或凭据。
import assert from 'node:assert/strict';
import { access, readFile, writeFile, realpath, mkdir } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { resolve, dirname } from 'node:path';

const phase = process.argv[2];
assert.equal(process.argv.length, 3); assert.ok(['baseline', 'assets', 'assets-recovered', 'update', 'update-recovered', 'restore'].includes(phase));
const root = resolve(import.meta.dirname, '..'), prefix = resolve(root, 'artifacts/latest-child-notice-main-apk');
const reportPath = prefix + '-' + phase + '.json', baselinePath = prefix + '-baseline.apk';
await assert.rejects(access(reportPath), { code: 'ENOENT' });
const pkg = 'dev.dshmobile.validation.latesttest';
const adb = 'C:/Users/KKirin/AppData/Local/Android/Sdk/platform-tools/adb.exe';
const run = (...args) => execFileSync(adb, ['-s', 'emulator-5554', ...args],
  { cwd: root, encoding: 'utf8', windowsHide: true, timeout: 60000 }).trim();
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
function installedHash() {
  const path = run('shell', 'pm', 'path', pkg);
  assert.match(path, /^package:\/data\/app\/[A-Za-z0-9_~.=/+-]+\/base\.apk$/);
  return { path: path.slice(8), hash: run('shell', 'sha256sum', path.slice(8)).split(/\s+/)[0] };
}
const pid = () => { const value = run('shell', 'pidof', pkg); assert.match(value, /^[1-9]\d*$/); return value; };
const report = { at: new Date().toISOString(), phase, packageName: pkg, passed: false };
try {
  if (phase === 'baseline') {
    assert.equal(pid(), '12296'); await assert.rejects(access(baselinePath), { code: 'ENOENT' });
    const current = installedHash();
    assert.equal(current.hash, '58921967f03c2a2d8e6b2c9dfdfc623052dbb7ddbfb291684013d2863111114b');
    run('pull', current.path, baselinePath);
    assert.equal(hash(await readFile(baselinePath)), current.hash);
    report.originalSha256 = current.hash; report.originalPid = pid();
  } else {
    const baseline = JSON.parse(await readFile(prefix + '-baseline.json', 'utf8'));
    assert.equal(baseline.passed, true); assert.equal(hash(await readFile(baselinePath)), baseline.originalSha256);
    const { unzipSync } = await import('fflate');
    const originalZip = unzipSync(await readFile(baselinePath));
    const originalAssets = Object.keys(originalZip).filter(name => name.startsWith('assets/web/')).sort();
    assert.ok(originalAssets.length > 100);
    if (phase === 'assets' || phase === 'assets-recovered') {
      assert.equal(installedHash().hash, baseline.originalSha256); assert.equal(pid(), baseline.originalPid);
      const folder = resolve(root, 'artifacts/latest-notice-baseline-web');
      if (phase === 'assets-recovered') {
        const failed = JSON.parse(await readFile(prefix + '-assets.json', 'utf8'));
        assert.equal(failed.passed, false); assert.equal(failed.failure.name, 'AssertionError');
        assert.ok(failed.failure.message.includes('regular expression'));
        assert.equal(await realpath(folder), folder);
      } else { await assert.rejects(access(folder), { code: 'ENOENT' }); await mkdir(folder); }
      for (const name of originalAssets) {
        const relative = name.slice('assets/web/'.length);
        assert.match(relative, /^[A-Za-z0-9_@./-]+$/); assert.ok(!relative.split('/').includes('..'));
        if (name.endsWith('/')) continue;
        const file = resolve(folder, relative); assert.ok(file.startsWith(folder + '/') || file.startsWith(folder + '\\'));
        await mkdir(dirname(file), { recursive: true });
        try { assert.equal(hash(await readFile(file)), hash(originalZip[name])); }
        catch (error) { if (error.code !== 'ENOENT') throw error; await writeFile(file, originalZip[name], { flag: 'wx' }); }
        assert.equal(hash(await readFile(file)), hash(originalZip[name]));
      }
      report.baselineWebAssets = originalAssets.length; report.passed = true;
      await writeFile(reportPath, JSON.stringify(report, null, 2), { flag: 'wx' }); console.log(JSON.stringify(report));
      process.exit(0);
    }
    const folder = resolve(root, 'artifacts/latest-android-build/outputs/apk/debug');
    const meta = JSON.parse(await readFile(resolve(folder, 'output-metadata.json'), 'utf8'));
    assert.equal(meta.applicationId, pkg); assert.equal(meta.elements.length, 1);
    assert.equal(meta.elements[0].outputFile, 'app-debug.apk');
    const candidate = resolve(folder, meta.elements[0].outputFile);
    assert.equal(await realpath(candidate), candidate);
    const candidateHash = hash(await readFile(candidate));
    const candidateZip = unzipSync(await readFile(candidate));
    assert.deepEqual(Object.keys(candidateZip).filter(name => name.startsWith('assets/web/')).sort(), originalAssets);
    for (const name of originalAssets) assert.equal(hash(candidateZip[name]), hash(originalZip[name]), name);
    const updating = phase === 'update' || phase === 'update-recovered';
    const file = updating ? candidate : baselinePath;
    if (updating) {
      if (phase === 'update-recovered') {
        const failed = JSON.parse(await readFile(prefix + '-update.json', 'utf8'));
        assert.equal(failed.passed, false); assert.equal(failed.failure.name, 'AssertionError');
        assert.equal(failed.installedSha256, undefined);
      }
      assert.equal(installedHash().hash, baseline.originalSha256); assert.equal(pid(), baseline.originalPid);
    } else {
      const update = JSON.parse(await readFile(prefix + '-update-recovered.json', 'utf8'));
      assert.equal(update.passed, true); assert.equal(candidateHash, update.installedSha256);
      assert.equal(installedHash().hash, candidateHash);
    }
    assert.match(run('install', '-r', file), /Success/);
    assert.equal(installedHash().hash, hash(await readFile(file)));
    // 只打开既有Launcher，Remote仍沿原页面入口与原绑定恢复。
    const started = run('shell', 'am', 'start', '-n', pkg + '/dev.dshmobile.validation.ValidationActivity');
    assert.ok(!started.includes('Error'));
    report.originalSha256 = baseline.originalSha256;
    report.installedSha256 = installedHash().hash; report.pid = pid();
    report.webAssetsUnchanged = originalAssets.length; report.dataClearRequested = false;
  }
  report.passed = true;
} catch (error) { report.failure = { name: error.name, message: error.message?.split('\n')[0] }; process.exitCode = 1; }
finally { await writeFile(reportPath, JSON.stringify(report, null, 2), { flag: 'wx' }); console.log(JSON.stringify(report)); }
