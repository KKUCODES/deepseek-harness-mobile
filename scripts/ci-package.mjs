import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const config = JSON.parse(await readFile(resolve(root, 'ci/release.json'), 'utf8'));
const versions = JSON.parse(await readFile(resolve(root, 'artifacts/ci/web/sdk-versions.json'), 'utf8'));
for (const [name, version] of Object.entries(versions)) {
  if (name.startsWith('@deepseek-ai/dsh-')) assert.equal(version, config.dshVersion, `Unexpected SDK: ${name}`);
}
const output = resolve(root, 'artifacts/ci/packages');
await mkdir(output, { recursive: true });
const filename = `DSHM-${config.version}-unsigned.apk`;
const apk = resolve(root, 'artifacts/ci/android/outputs/apk/release/app-release-unsigned.apk');
await copyFile(apk, resolve(output, filename));
const sha256 = createHash('sha256').update(await readFile(apk)).digest('hex');
await writeFile(resolve(output, 'SHA256SUMS.txt'), `${sha256}  ${filename}\n`);
await writeFile(resolve(output, 'compatibility.json'), JSON.stringify({ ...config,
  signed: false, directlyInstallable: false, officialDshModified: false, sdkBuilt: false,
  sourceCommit: process.env.GITHUB_SHA ?? null, sdkVersions: versions,
}, null, 2) + '\n');
console.log(`Prepared ${filename}; signing is required before installation.`);
