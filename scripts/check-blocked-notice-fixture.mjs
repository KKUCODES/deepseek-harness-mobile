import assert from 'node:assert/strict';
import { access, readFile, writeFile, unlink } from 'node:fs/promises';
import { apply } from '../tests/fixtures/blocked-notice-plugin/index.js';
const control = 'artifacts/blocked-notice-control.json', report = 'artifacts/blocked-notice-host.json';
for (const file of [control, report]) {
  const exists = await access(file).then(() => true, () => false);
  assert.equal(exists, false, 'Do not overwrite a live verification run');
}
let handler;
apply({ on(name, callback) { assert.equal(name, 'agent/pre-step'); handler = callback; } });
const marker = 'DSHM_BLOCK_NOTICE_01234567';
const payload = text => ({ signal: new AbortController().signal, messages: [{ content: [{ type: 'text', text }] }] });
let forwarded = 0;
const next = async () => { forwarded++; return { kind: 'enter' }; };
try {
  await handler(payload(marker), next);
  await writeFile(control, JSON.stringify({ marker, release: true }), { flag: 'wx' });
  await handler(payload('ordinary user message'), next);
  await handler(payload(marker + ' extra'), next);
  assert.equal(forwarded, 3);
  assert.deepEqual(await handler(payload(marker), next), { kind: 'reject' });
  assert.deepEqual(JSON.parse(await readFile(report, 'utf8')), { marker, entered: true, rejected: true });
  console.log('PASS: absent control and unrelated messages forwarded; exact marked input rejects through pre-step only');
} finally {
  for (const file of [control, report]) await unlink(file).catch(error => { if (error.code !== 'ENOENT') throw error; });
}
