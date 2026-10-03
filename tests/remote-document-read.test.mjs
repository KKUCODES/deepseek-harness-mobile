import test from 'node:test';
import assert from 'node:assert/strict';
import { RemoteFiles } from '../src/remote-files.mjs';
import { readDocumentBytes, DOCUMENT_BYTES } from '../src/remote-document-read.mjs';

const file = { sessionId: 'session-a', path: 'preview.bin' };
const meta = { absolutePath: '/workspace/preview.bin', version: 'v1', bytes: 3 };
test('完整预览通过真实字节窗适配，并保留文件身份', async () => {
  const calls = [];
  const model = { files: new RemoteFiles(async (endpoint, args) => {
    calls.push({ endpoint, args });
    return { ok: true, value: endpoint.endsWith('/stat') ? meta : { ...meta, offset: 0, data: 'AP+A', eof: true } };
  }) };
  const result = await readDocumentBytes(model, file, new AbortController().signal);
  assert.equal(result.ok, true); assert.deepEqual([...result.value.data], [0, 255, 128]);
  assert.equal(result.value.version, 'v1'); assert.equal(result.value.eof, true);
  assert.ok(calls.every(call => call.args.workspaceFileScopeId === file.sessionId));
  assert.ok(calls.every(call => !call.endpoint.endsWith('/readAll')));
});
test('过大文件读取前拒绝，版本变化不交付混合内容，领域失败保留', async () => {
  for (const scenario of ['size', 'changed', 'missing']) {
    let stats = 0, reads = 0;
    const failure = { code: 'workspace-file/not-found', message: 'missing', details: { path: file.path } };
    const model = { files: new RemoteFiles(async endpoint => {
      if (scenario === 'missing') return { ok: false, error: failure };
      if (endpoint.endsWith('/stat')) return { ok: true, value: { ...meta,
        bytes: scenario === 'size' ? DOCUMENT_BYTES + 1 : 3, version: scenario === 'changed' && ++stats > 2 ? 'v2' : 'v1' } };
      reads++; return { ok: true, value: { ...meta, offset: 0, data: 'AP+A', eof: true } };
    }) };
    const result = await readDocumentBytes(model, file, new AbortController().signal);
    assert.equal(result.ok, false);
    if (scenario === 'size') { assert.equal(result.error.code, 'workspace-file/too-large'); assert.equal(reads, 0); }
    if (scenario === 'changed') assert.match(result.error.message, /变化/);
    if (scenario === 'missing') assert.equal(result.error, failure);
  }
});
test('关闭文件时取消读取，不将迟到结果交付预览器', async () => {
  const controller = new AbortController();
  const model = { files: new RemoteFiles(async () => { controller.abort(); return { ok: true, value: meta }; }) };
  await assert.rejects(readDocumentBytes(model, file, controller.signal), { name: 'AbortError' });
});
