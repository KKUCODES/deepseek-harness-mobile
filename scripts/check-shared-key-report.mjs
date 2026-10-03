import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

// 只复核实际手机操作记录，不重新发送请求或写入凭据。
const report = JSON.parse(await readFile('artifacts/shared-key-run-android.json', 'utf8'));
assert.equal(report.version, '0.0.3');
for (const field of ['officialReflected', 'officialEndpointInherited', 'searchRemovalReflected',
  'originalKeyConfiguredRestored', 'managementWithdrawn', 'managementDenied', 'draftPreserved', 'headingRestored']) assert.equal(report[field], true, field);
assert.deepEqual(report.errors, []);
const host = report.finalHost;
assert.equal(host.fixtureVersion, '0.0.3');
assert.equal(host.command, 'disposed');
assert.equal(host.cleaned, true);
assert.equal(host.configured, false);
assert.equal(host.refsRestored, true);
assert.equal(host.searchAddressInherited, true);
assert.equal(report.addressRestoredFromPhone.searchAddressInherited, true);
assert.equal(report.firstRequest.searchAddressSaved, true);
assert.equal(report.firstRequest.refsMatch, true);
assert.equal(host.requests.length, 2);
for (const [index, request] of host.requests.entries()) {
  assert.deepEqual(request, { method: 'POST', path: '/anthropic/v1/messages', testKeyIndex: index,
    version: '2023-06-01', model: 'deepseek-v4-flash', queryMatches: true,
    toolType: 'web_search_20250305', maxUses: 5 });
}
assert.deepEqual(host.outcomes, [
  { rejected: true, code: 'WEB_PROVIDER_ERROR', requestCount: 1 },
  { rejected: true, code: 'WEB_PROVIDER_ERROR', requestCount: 1 },
  { rejected: true, code: 'WEB_PROVIDER_CREDENTIAL_MISSING', requestCount: 0 },
]);
console.log('PASS: native shared-key save/replace/remove, search HTTP dispatch, configuration restore and management withdrawal. External search success is not covered.');
