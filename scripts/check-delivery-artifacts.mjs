import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFile, readdir, mkdir, writeFile } from 'node:fs/promises';
import { resolve, relative } from 'node:path';
import { unzipSync } from 'fflate';

const root = resolve(import.meta.dirname, '..');
const collection = resolve(root, '..');
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const pathName = file => relative(collection, file).replaceAll('\\', '/');
async function record(file) {
  const bytes = await readFile(file);
  return { path: pathName(file), bytes: bytes.length, sha256: hash(bytes) };
}
async function files(directory) {
  const result = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const file = resolve(directory, entry.name);
    assert.ok(!entry.isSymbolicLink(), `Unexpected link: ${pathName(file)}`);
    if (entry.isDirectory()) result.push(...await files(file));
    else if (entry.isFile()) result.push(file);
  }
  return result.sort();
}

const report = { at: new Date().toISOString(), ok: false, scope: 'local-build-artifacts', errors: [] };
try {
  const apkDirectory = resolve(root, 'android/app/build/outputs/apk/debug');
  const metadata = JSON.parse(await readFile(resolve(apkDirectory, 'output-metadata.json'), 'utf8'));
  assert.equal(metadata.applicationId, 'dev.dshmobile.validation');
  assert.equal(metadata.variantName, 'debug');
  assert.equal(metadata.elements.length, 1);
  assert.equal(metadata.elements[0].outputFile, 'app-debug.apk');
  const apkFile = resolve(apkDirectory, 'app-debug.apk');
  const apk = unzipSync(await readFile(apkFile), { filter: entry => entry.name.startsWith('assets/web/') });
  const webRoot = resolve(root, 'dist');
  const web = (await files(webRoot)).filter(file => relative(webRoot, file) !== 'bundle-analysis.json');
  const names = web.map(file => `assets/web/${relative(webRoot, file).replaceAll('\\', '/')}`);
  assert.deepEqual(Object.keys(apk).filter(name => !name.endsWith('/')).sort(), [...names].sort(), 'APK Web file inventory differs from dist');
  for (let i = 0; i < web.length; i++)
    assert.equal(hash(apk[names[i]]), hash(await readFile(web[i])), `APK Web content differs: ${names[i]}`);
  for (const entry of ['mobile.html', 'remote.html']) assert.ok(names.includes(`assets/web/${entry}`), `Missing own page: ${entry}`);
  report.android = { ...await record(apkFile), applicationId: metadata.applicationId, variant: metadata.variantName,
    versionCode: metadata.elements[0].versionCode, versionName: metadata.elements[0].versionName, webFiles: web.length, webMatchesDist: true };

  const pluginRoot = resolve(collection, 'plugin');
  const plugin = JSON.parse(await readFile(resolve(pluginRoot, 'package.json'), 'utf8'));
  assert.match(plugin.version, /^\d+\.\d+\.\d+$/);
  const archive = resolve(pluginRoot, `artifacts/dsh-mobile-plugin-${plugin.version}.tgz`);
  // 只读取已知条目，不把压缩包解开到用户目录，也不执行包内脚本。
  const packedFile = name => execFileSync('tar', ['-xOf', archive, `package/${name}`], { cwd: pluginRoot, maxBuffer: 32 * 1024 * 1024, windowsHide: true });
  const packed = JSON.parse(packedFile('package.json').toString('utf8'));
  assert.deepEqual(packed, plugin, 'Packed plugin metadata differs from package.json');
  const runtimeFiles = ['dist/index.js', 'dist/client.js', 'cordis.patch.yml'];
  for (const file of runtimeFiles)
    assert.equal(hash(packedFile(file)), hash(await readFile(resolve(pluginRoot, file))), `Packed runtime differs: ${file}`);
  report.plugin = { ...await record(archive), version: plugin.version, runtimeFiles, runtimeMatchesDist: true };

  const gatewayRoot = resolve(collection, 'backend');
  // 只登记产物与锁文件；不读取环境配置、数据库、凭据或用户会话。
  const backendFiles = ['package.json', 'package-lock.json', 'packages/gateway/package.json', 'packages/protocol/package.json']
    .map(file => resolve(gatewayRoot, file));
  for (const directory of ['packages/gateway/dist', 'packages/protocol/dist'])
    backendFiles.push(...await files(resolve(gatewayRoot, directory)));
  report.backend = { files: await Promise.all(backendFiles.map(record)) };
  report.ok = true;
} catch (error) {
  report.errors.push(error.message);
  process.exitCode = 1;
}
await mkdir(resolve(root, 'artifacts'), { recursive: true });
await writeFile(resolve(root, 'artifacts/delivery-artifacts-current.json'), `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify({ ok: report.ok, webFiles: report.android?.webFiles, pluginVersion: report.plugin?.version,
  backendFiles: report.backend?.files.length, errors: report.errors }));
