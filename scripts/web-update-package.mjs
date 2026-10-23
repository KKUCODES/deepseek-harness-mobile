import assert from 'node:assert/strict';
import { createHash, createPrivateKey, createPublicKey, generateKeyPairSync, sign, verify } from 'node:crypto';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { dirname, resolve, relative } from 'node:path';
import { pathToFileURL } from 'node:url';
import { zipSync } from 'fflate';

export const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
export const validResourcePath = name => typeof name === 'string' && name.length <= 240
  && /^[A-Za-z0-9_@][A-Za-z0-9_@./-]*$/.test(name)
  && name.split('/').every(part => part && part !== '.' && part !== '..')
  && /\.(?:html|js|css|json|svg|png|jpe?g|gif|webp|ico|woff2?|ttf|otf|wasm|txt)$/.test(name);
const root = resolve(import.meta.dirname, '..');
export async function generateResourceKey(privatePath, publicPath) {
  const keys = generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
  const spki = keys.publicKey.export({ type: 'spki', format: 'der' });
  const trust = { schema: 1, keys: [{ id: sha256(spki), spki: spki.toString('base64') }] };
  await mkdir(dirname(privatePath), { recursive: true });
  await mkdir(dirname(publicPath), { recursive: true });
  // 私钥仅存忽略目录，公开仓库只携带SPKI公钥。禁止覆盖已有密钥。
  await writeFile(privatePath, keys.privateKey.export({ type: 'pkcs8', format: 'pem' }), { flag: 'wx', mode: 0o600 });
  await writeFile(publicPath, JSON.stringify(trust, null, 2) + '\n', { flag: 'wx' });
  return trust;
}
export function signResourceManifest(payload, privateKey, trust) {
  const key = createPrivateKey(privateKey), publicKey = createPublicKey(key);
  assert.equal(key.asymmetricKeyType, 'ec');
  assert.equal(key.asymmetricKeyDetails.namedCurve, 'prime256v1');
  const spki = publicKey.export({ type: 'spki', format: 'der' }), keyId = sha256(spki);
  assert.ok(trust.keys.some(item => item.id === keyId && item.spki === spki.toString('base64')), 'Signing key is not trusted by the APK');
  // 签确切UTF-8字节，避免JSON重排或不同运行时的规范化差异。
  const bytes = Buffer.from(JSON.stringify(payload));
  return { keyId, payload: bytes.toString('base64'), signature: sign('sha256', bytes, { key, dsaEncoding: 'der' }).toString('base64') };
}
export function verifyResourceManifest(envelope, trust) {
  const entry = trust.keys.find(item => item.id === envelope.keyId);
  assert.ok(entry, 'Unknown resource signing key');
  const spki = Buffer.from(entry.spki, 'base64');
  assert.equal(sha256(spki), entry.id);
  const bytes = Buffer.from(envelope.payload, 'base64');
  assert.ok(verify('sha256', bytes, { key: createPublicKey({ key: spki, format: 'der', type: 'spki' }), dsaEncoding: 'der' }, Buffer.from(envelope.signature, 'base64')), 'Invalid resource signature');
  return JSON.parse(bytes.toString('utf8'));
}
export async function packageResources({ source, output, privatePath, trustPath, revision, minApkCode, maxApkCode, applicationId, notes = '' }) {
  assert.ok(Number.isSafeInteger(revision) && revision > 0 && revision <= 2147483647);
  assert.ok(Number.isSafeInteger(minApkCode) && minApkCode > 0 && Number.isSafeInteger(maxApkCode) && maxApkCode >= minApkCode && maxApkCode <= 2100000000);
  assert.ok(typeof notes === 'string' && notes.length <= 32000);
  const config = JSON.parse(await readFile(resolve(root, 'ci/release.json'), 'utf8'));
  assert.match(applicationId, /^dev\.dshmobile\.validation(?:\.(?:officialtest|rc21test|compatibilitytest))?$/);
  const archiveFiles = {}, files = [], folded = new Set();
  async function visit(directory) {
    for (const entry of (await readdir(directory, { withFileTypes: true })).sort((a, b) => a.name.localeCompare(b.name, 'en'))) {
      const path = resolve(directory, entry.name), name = relative(source, path).replaceAll('\\', '/');
      if (entry.isDirectory()) { await visit(path); continue; }
      assert.ok(entry.isFile(), 'Symlinks and special files are not resources');
      if (name === 'bundle-analysis.json') continue;
      assert.ok(validResourcePath(name), `Invalid resource path: ${name}`);
      assert.ok(!folded.has(name.toLowerCase()), 'Case-colliding resource paths'); folded.add(name.toLowerCase());
      const bytes = await readFile(path);
      archiveFiles[name] = bytes;
      files.push({ path: name, bytes: bytes.length, sha256: sha256(bytes) });
    }
  }
  await visit(source);
  assert.ok(files.length > 0 && files.length <= 4096);
  assert.ok(files.reduce((sum, file) => sum + file.bytes, 0) <= 128 * 1024 * 1024);
  for (const name of ['mobile.html', 'remote.html', 'startup.js', 'startup.css', 'mobile-main.js', 'remote-main.js']) assert.ok(archiveFiles[name], `Missing entry: ${name}`);
  const archive = Buffer.from(zipSync(archiveFiles, { level: 9 }));
  assert.ok(archive.length <= 64 * 1024 * 1024);
  const manifest = { schema: 1, applicationId, channel: 'preview', revision, minApkCode, maxApkCode,
    bridgeVersion: 1, dataVersion: 1, sdkVersion: config.dshVersion, requiredPluginVersion: config.requiredPluginVersion,
    notes, archive: { name: `dshm-web-r${revision}.zip`, bytes: archive.length, sha256: sha256(archive) }, files };
  const trust = JSON.parse(await readFile(trustPath, 'utf8'));
  const envelope = privatePath ? signResourceManifest(manifest, await readFile(privatePath), trust) : null;
  if (envelope) assert.deepEqual(verifyResourceManifest(envelope, trust), manifest);
  await mkdir(output, { recursive: true });
  await writeFile(resolve(output, manifest.archive.name), archive, { flag: 'wx' });
  await writeFile(resolve(output, envelope ? 'web-update.json' : 'web-payload.json'), JSON.stringify(envelope ?? manifest) + '\n', { flag: 'wx' });
  if (!envelope) await writeFile(resolve(output, 'trust.json'), JSON.stringify(trust) + '\n', { flag: 'wx' });
  return manifest;
}
if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  const [operation, ...args] = process.argv.slice(2), options = {};
  assert.equal(args.length % 2, 0);
  for (let i = 0; i < args.length; i += 2) { assert.match(args[i], /^--[a-z-]+$/); options[args[i].slice(2)] = args[i + 1]; }
  const trustPath = resolve(options.trust ?? resolve(root, 'android/app/src/main/assets/web-update-trust.json'));
  if (operation === 'keygen') {
    const trust = await generateResourceKey(resolve(options.private), trustPath);
    console.log(JSON.stringify({ publicKeyId: trust.keys[0].id, privateKeyCreated: true }));
  } else {
    assert.ok(['pack', 'pack-unsigned'].includes(operation));
    const manifest = await packageResources({ source: resolve(options.source), output: resolve(options.output), privatePath: operation === 'pack' ? resolve(options.private) : null,
      trustPath, revision: Number(options.revision), minApkCode: Number(options['min-apk']), maxApkCode: Number(options['max-apk']),
      applicationId: options['application-id'], notes: options.notes ?? '' });
    console.log(JSON.stringify({ revision: manifest.revision, files: manifest.files.length, bytes: manifest.archive.bytes }));
  }
}
