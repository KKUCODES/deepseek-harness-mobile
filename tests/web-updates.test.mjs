import test from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPairSync } from 'node:crypto';
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import { resolve } from 'node:path';
import { unzipSync } from 'fflate';
import { sha256, signResourceManifest, verifyResourceManifest, packageResources, validResourcePath, generateResourceKey } from '../scripts/web-update-package.mjs';
import { updateFailures, AppUpdates } from '../src/app-updates.mjs';
import { translate } from '../src/ui/translations.mjs';

test('Node signer pins the APK trust root and verifies exact payload bytes', () => {
  const key = generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
  const spki = key.publicKey.export({ type: 'spki', format: 'der' });
  const trust = { keys: [{ id: sha256(spki), spki: spki.toString('base64') }] };
  const privateKey = key.privateKey.export({ type: 'pkcs8', format: 'pem' });
  const envelope = signResourceManifest({ revision: 7, notes: '中文内容' }, privateKey, trust);
  assert.deepEqual(verifyResourceManifest(envelope, trust), { revision: 7, notes: '中文内容' });
  assert.throws(() => verifyResourceManifest({ ...envelope, payload: Buffer.from('{"revision":8}').toString('base64') }, trust));
  assert.throws(() => verifyResourceManifest({ ...envelope, signature: Buffer.alloc(70).toString('base64') }, trust));
  assert.throws(() => verifyResourceManifest(envelope, { keys: [] }));
  assert.throws(() => signResourceManifest({}, privateKey, { keys: [] }));
});

test('full archive, signed manifest and per-file digests agree; keys cannot be overwritten', async () => {
  const parent = resolve('.test-data'); await mkdir(parent, { recursive: true });
  const folder = await mkdtemp(resolve(parent, 'web-resources-'));
  try {
    const source = resolve(folder, 'source'), output = resolve(folder, 'out'); await mkdir(source);
    const privatePath = resolve(folder, 'private.pem'), trustPath = resolve(folder, 'trust.json');
    await generateResourceKey(privatePath, trustPath);
    await assert.rejects(generateResourceKey(privatePath, trustPath));
    for (const name of ['mobile.html', 'remote.html', 'startup.js', 'startup.css', 'mobile-main.js', 'remote-main.js']) await writeFile(resolve(source, name), `real file ${name}`);
    const manifest = await packageResources({ source, output, privatePath, trustPath, revision: 5, minApkCode: 12, maxApkCode: 15, applicationId: 'dev.dshmobile.validation.officialtest' });
    const archive = await readFile(resolve(output, manifest.archive.name));
    assert.equal(sha256(archive), manifest.archive.sha256);
    const files = unzipSync(archive);
    for (const file of manifest.files) { assert.equal(sha256(files[file.path]), file.sha256); assert.equal(files[file.path].length, file.bytes); }
    const envelope = JSON.parse(await readFile(resolve(output, 'web-update.json'), 'utf8'));
    assert.deepEqual(verifyResourceManifest(envelope, JSON.parse(await readFile(trustPath, 'utf8'))), manifest);
    await writeFile(resolve(source, 'unexpected.dex'), 'not a web resource');
    await assert.rejects(packageResources({ source, output: resolve(folder, 'bad'), privatePath, trustPath, revision: 6, minApkCode: 12, maxApkCode: 15, applicationId: 'dev.dshmobile.validation.officialtest' }));
  } finally { assert.ok(folder.startsWith(parent)); await rm(folder, { recursive: true, force: true }); }
});

test('resource path policy excludes traversal, URL encodings, platform code and case tricks', () => {
  for (const name of ['../x.js', '/x.js', 'a//x.js', 'a/./x.js', 'a\\x.js', 'a/%2e%2e/x.js', 'x.dex', 'x.so', 'x.JS', 'a.js?x']) assert.equal(validResourcePath(name), false, name);
  for (const name of ['chunks/a-b.js', 'plugins/@name/module/client.js', 'image.svg', 'fonts/font.woff2']) assert.equal(validResourcePath(name), true, name);
});

test('resource bridge accepts only argument-free operations', async () => {
  const sent = [], bridge = { postMessage: text => sent.push(JSON.parse(text)) }, service = new AppUpdates(bridge);
  for (const op of ['resources.check', 'resources.download', 'resources.cancel', 'resources.recover']) {
    const task = service.action(op); const request = sent.at(-1);
    assert.equal(request.op, `updates.${op}`); assert.deepEqual(request.data, {});
    bridge.onmessage({ data: JSON.stringify({ id: request.id, data: { phase: 'idle', revision: sent.length, resources: { phase: 'current', currentRevision: 1 } } }) }); await task;
  }
  for (const operation of ['resources.download', 'resources.recover']) await service.action(operation, { path: '/data/private', url: 'https://evil.invalid/' });
  assert.equal(sent.length, 4);
  assert.equal(service.getSnapshot().resources.currentRevision, 1);
});

test('every resource failure has an English and Chinese message', async () => {
  for (const name of ['WebResourceManifest', 'WebResourceStore', 'WebUpdates']) {
    const code = await readFile(resolve(`android/app/src/main/java/dev/dshmobile/validation/${name}.kt`), 'utf8');
    for (const [, error] of code.matchAll(/"(web_[a-z_]+)"/g)) {
      assert.ok(updateFailures[error], error); assert.notEqual(translate('en', updateFailures[error]), updateFailures[error]);
    }
  }
});
