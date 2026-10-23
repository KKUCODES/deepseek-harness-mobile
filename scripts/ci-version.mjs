import assert from 'node:assert/strict';
import { appendFile, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const config = JSON.parse(await readFile(resolve(import.meta.dirname, '../ci/release.json'), 'utf8'));
assert.match(config.version, /^\d+\.\d+\.\d+-preview\.\d+$/);
assert.ok(Number.isInteger(config.versionCode) && config.versionCode >= 3 && config.versionCode <= 2100000000);
assert.equal(config.dshVersion, '0.2.1-rc.2');
assert.deepEqual(config.remoteDshVersions, ['0.2.0-rc.2', '0.2.1-alpha.2', '0.2.1-rc.2']);
assert.equal(config.upstreamCommit, '687f282e8625c6b8d11ff58211a90524be2e4317');
assert.match(config.backendCommit, /^[a-f0-9]{40}$/);
assert.match(config.signingCertificateSha256, /^[a-f0-9]{64}$/);
assert.match(config.requiredPluginVersion, /^\d+\.\d+\.\d+(?:-[A-Za-z0-9.-]+)?$/, 'Declare the companion desktop plugin version');
if (process.env.GITHUB_REF_TYPE === 'tag') {
  assert.equal(process.env.GITHUB_REF_NAME, `v${config.version}`, 'Tag must match ci/release.json');
}
if (process.env.GITHUB_OUTPUT) {
  await appendFile(process.env.GITHUB_OUTPUT, `version=${config.version}\nversion_code=${config.versionCode}\nupstream_ref=${config.upstreamCommit}\nbackend_ref=${config.backendCommit}\n`);
}
console.log(`Android preview ${config.version} (${config.versionCode})`);
