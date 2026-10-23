import { generateKeyPairSync } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { zipSync } from 'fflate';
import { sha256, signResourceManifest } from './web-update-package.mjs';
const output = resolve('artifacts/web-update-tests/fixtures/web-fixtures');
await mkdir(output, { recursive: true });
const keys = generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
const spki = keys.publicKey.export({ type: 'spki', format: 'der' });
const trust = { schema: 1, keys: [{ id: sha256(spki), spki: spki.toString('base64') }] };
const content = Object.fromEntries(['mobile.html', 'remote.html', 'startup.js', 'startup.css', 'mobile-main.js', 'remote-main.js'].map(name => [name, Buffer.from(`fixture:${name}`)]));
const zip = Buffer.from(zipSync(content));
await writeFile(resolve(output, 'valid.zip'), zip);
await writeFile(resolve(output, 'trust.json'), JSON.stringify(trust));
const privateKey = keys.privateKey.export({ type: 'pkcs8', format: 'pem' });
for (const revision of [1, 2, 3]) {
  const payload = { schema: 1, applicationId: 'dev.dshmobile.validation.rc21test', channel: 'preview', revision,
    minApkCode: 2, maxApkCode: 2, bridgeVersion: 1, dataVersion: 1, sdkVersion: '0.2.1-rc.2', requiredPluginVersion: '0.1.87-latest.0', notes: 'fixture',
    archive: { name: `dshm-web-r${revision}.zip`, bytes: zip.length, sha256: sha256(zip) },
    files: Object.entries(content).map(([path, bytes]) => ({ path, bytes: bytes.length, sha256: sha256(bytes) })) };
  await writeFile(resolve(output, `r${revision}.json`), JSON.stringify(signResourceManifest(payload, privateKey, trust)));
  if (revision === 1) for (const [name, change] of [
    ['bridge', { bridgeVersion: 2 }], ['data', { dataVersion: 2 }], ['sdk', { sdkVersion: 'different' }],
    ['package', { applicationId: 'other.app' }], ['apk', { minApkCode: 50, maxApkCode: 60 }],
    ['plugin', { requiredPluginVersion: '0.1.88-latest.0' }],
    ['path', { files: [...payload.files, { path: '../outside.js', bytes: 1, sha256: sha256(Buffer.from('x')) }] }],
  ]) await writeFile(resolve(output, `${name}.json`), JSON.stringify(signResourceManifest({ ...payload, ...change }, privateKey, trust)));
}
console.log('Generated Node ECDSA fixtures for Android verification; no private key written.');
