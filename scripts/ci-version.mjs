import assert from 'node:assert/strict';
import { appendFile, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const config = JSON.parse(await readFile(resolve(import.meta.dirname, '../ci/release.json'), 'utf8'));
assert.match(config.version, /^\d+\.\d+\.\d+-preview\.\d+$/);
assert.ok(Number.isInteger(config.versionCode) && config.versionCode >= 3 && config.versionCode <= 2100000000);
assert.equal(config.dshVersion, '0.2.1-alpha.2');
assert.equal(config.upstreamCommit, 'd743267388641bc76f17c45ce8b4c231aed1d32c');
assert.match(config.backendCommit, /^[a-f0-9]{40}$/);
assert.match(config.signingCertificateSha256, /^[a-f0-9]{64}$/);
if (process.env.GITHUB_REF_TYPE === 'tag') {
  assert.equal(process.env.GITHUB_REF_NAME, `v${config.version}`, 'Tag must match ci/release.json');
}
if (process.env.GITHUB_OUTPUT) {
  await appendFile(process.env.GITHUB_OUTPUT, `version=${config.version}\nversion_code=${config.versionCode}\nupstream_ref=${config.upstreamCommit}\nbackend_ref=${config.backendCommit}\n`);
}
console.log(`Android preview ${config.version} (${config.versionCode})`);
