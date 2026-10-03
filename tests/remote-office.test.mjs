import test from 'node:test';
import assert from 'node:assert/strict';
import { readOffice, officeError } from '../src/remote-office.mjs';

const metadata = { type: 'metadata', absolutePath: '/w/a.docx', version: 'v1', generation: 'g1', bytes: 7, missingFonts: ['Serif'] };
function fixture() {
  let emit, resolve, reject, canceled = false;
  const calls = [], controller = new AbortController();
  const model = { transport: { capabilities: { channels: ['office'] } }, client: {
    request(operation, event) { calls.push(operation); emit = event; return { id: 'fixture', promise: new Promise((yes, no) => { resolve = yes; reject = no; }), cancel() { canceled = true; resolve(); } }; },
    async call(op, data) { calls.push({ op, data }); },
  } };
  return { model, calls, controller, emit: value => emit(value), finish: value => resolve(value), reject: error => reject(error), canceled: () => canceled };
}
test('Office waits for final Host success before publishing exact PDF bytes and font notice', async () => {
  const f = fixture(), work = readOffice(f.model, 'session', 'a.docx', f.controller.signal);
  f.emit({ type: 'converting' }); f.emit(metadata); f.emit({ type: 'chunk', offset: 0, data: btoa('%PDF-1.') });
  let published = false; void work.then(() => { published = true; }); await Promise.resolve(); assert.equal(published, false);
  f.finish(); const result = await work;
  assert.equal(new TextDecoder().decode(result.data), '%PDF-1.'); assert.deepEqual(result.missingFonts, ['Serif']);
  assert.deepEqual(f.calls[0], { method: 'remote.office', sessionId: 'session', path: 'a.docx' });
  assert.equal(f.calls[1].data.frame.count, 1);
});
test('Office rejects missing/out-of-order/oversized bytes, cancellation and late permission failure', async () => {
  for (const mode of ['short', 'offset', 'oversized', 'cancel', 'denied']) {
    const f = fixture(), work = readOffice(f.model, 's', 'a.docx', f.controller.signal);
    f.emit(metadata);
    if (mode === 'offset') f.emit({ type: 'chunk', offset: 1, data: btoa('x') });
    else if (mode === 'oversized') f.emit({ type: 'chunk', offset: 0, data: btoa('12345678') });
    else if (mode === 'cancel') f.controller.abort();
    else if (mode === 'denied') f.finish({ ok: false, error: { code: 'workspace-file/not-found' } });
    else f.finish();
    await assert.rejects(work); assert.equal(f.canceled(), true);
  }
  assert.match(officeError({ code: 'document-render/failed', details: { reason: 'source-changed' } }), /发生变化/);
});

test('Office attachment binds the exact original identity and waits for final authorization', async () => {
  const attachment = { attachmentId: 'opaque', name: '附件.docx', bytes: 123 };
  const meta = { type: 'metadata', attachmentId: attachment.attachmentId, name: attachment.name, bytes: 7, generation: 'g1', missingFonts: [] };
  for (const mode of ['success', 'wrong-id', 'wrong-name', 'late-denial', 'path']) {
    const f = fixture(); f.model.transport.capabilities.channels.push('attachmentOffice');
    const work = readOffice(f.model, 'session', attachment.name, f.controller.signal, attachment);
    const invalid = { ...meta };
    if (mode === 'wrong-id') invalid.attachmentId = 'other';
    if (mode === 'wrong-name') invalid.name = 'other.docx';
    if (mode === 'path') invalid.absolutePath = '/private/file.docx';
    f.emit(invalid);
    if (mode === 'success' || mode === 'late-denial') {
      f.emit({ type: 'chunk', offset: 0, data: btoa('%PDF-1.') });
      f.finish(mode === 'late-denial' ? { ok: false, error: { code: 'remote_attachment_not_referenced' } } : undefined);
    }
    if (mode === 'success') assert.equal(new TextDecoder().decode((await work).data), '%PDF-1.');
    else await assert.rejects(work);
    assert.deepEqual(f.calls[0], { method: 'remote.attachmentOffice', sessionId: 'session', attachmentId: 'opaque', name: '附件.docx' });
    assert.equal(f.canceled(), true);
  }
  const unsupported = fixture();
  await assert.rejects(readOffice(unsupported.model, 's', attachment.name, unsupported.controller.signal, attachment), /remote_office_unavailable/);
  assert.equal(unsupported.calls.length, 0);
});
