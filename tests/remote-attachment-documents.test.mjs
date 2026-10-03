import test from 'node:test';
import assert from 'node:assert/strict';
import { attachmentDocumentAddress, parseAttachmentDocumentAddress, resolveDocumentAddress } from '../src/remote-document-address.mjs';
import { RemoteAttachmentDocuments, attachmentDocumentProvider, ATTACHMENT_DOCUMENT_BYTES } from '../src/remote-attachment-documents.mjs';

const file = { sessionId: 'session-a', path: 'C:/私有/同名 #?.txt', attachment: { kind: 'file', attachmentId: 'opaque:id/一', name: 'C:/私有/同名 #?.txt' } };
function fixture(content, options = {}) {
  const calls = [], cancels = [], releases = [];
  const bytes = Buffer.from(content);
  const model = { lifetime: new AbortController(), transport: { capabilities: { channels: ['attachment'] } }, client: {
    call: async () => {}, request(operation, emit) {
      calls.push(operation);
      let resolve, reject;
      const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
      const finish = () => {
        emit({ type: 'metadata', attachment: { attachmentId: operation.attachmentId, name: operation.name, bytes: options.size ?? bytes.length } });
        if (bytes.length) emit({ type: 'chunk', offset: 0, data: bytes.toString('base64') });
        if (options.fail) reject(new Error('remote_attachment_not_referenced')); else resolve();
      };
      releases.push(finish);
      if (!options.hold) queueMicrotask(finish);
      return { id: `read-${calls.length}`, promise, cancel() { cancels.push(operation); reject(new Error('cancelled')); } };
    },
  } };
  return { model, reader: new RemoteAttachmentDocuments(model), calls, cancels, releases };
}
const signal = () => new AbortController().signal;

test('附件规范地址区分同名ID与会话，显示路径不会成为workspace地址', async () => {
  const address = attachmentDocumentAddress(file);
  assert.deepEqual(resolveDocumentAddress(address), file);
  assert.notEqual(address, attachmentDocumentAddress({ ...file, sessionId: 'session-b' }));
  assert.notEqual(address, attachmentDocumentAddress({ ...file, attachment: { ...file.attachment, attachmentId: 'another' } }));
  for (const value of [address + '/extra', address + '?x=y', address.replace('%2F', '%2f'), 'dsh-resource://dshm-attachment/a/file/id/%ZZ']) {
    assert.equal(parseAttachmentDocumentAddress(value), undefined);
    assert.throws(() => resolveDocumentAddress(value));
  }
  assert.deepEqual(resolveDocumentAddress('dsh-resource://file/session/s/a.txt'), { sessionId: 's', path: 'a.txt' });
  const frame = await attachmentDocumentProvider().open(address, { signal: signal() }).next();
  assert.equal(frame.value.value.source, 'attachment');
  assert.equal(frame.value.value.absolutePath, undefined);
  assert.equal(frame.value.value.version, undefined, '引用描述不伪造文件授权或版本stat');
});

test('原文档分页保持原附件内容、尾行规则和身份，完整字节读取重新授权', async () => {
  const content = Array.from({ length: 5002 }, (_, index) => `${index + 1}🙂`).join('\n') + '\n';
  const f = fixture(content);
  const first = await f.reader.page(file, 1, signal());
  assert.equal(first.ok, true); assert.equal(first.value.lines, 5000); assert.equal(first.value.eof, false);
  const last = await f.reader.page(file, 5001, signal());
  assert.equal(last.value.text, '5001🙂\n5002🙂'); assert.equal(last.value.eof, true);
  assert.equal(last.value.version, attachmentDocumentAddress(file)); assert.equal(last.value.absolutePath, undefined);
  assert.equal((await f.reader.page(file, 6000, signal())).value.lines, 0);
  const complete = await f.reader.bytes(file, signal());
  assert.deepEqual(complete.value.data, new Uint8Array(Buffer.from(content)));
  assert.equal(f.calls.length, 4);
  assert.ok(f.calls.every(call => call.method === 'remote.attachment' && call.path === undefined && call.attachmentId === file.attachment.attachmentId));
  for (const [text, count] of [['', 0], ['\n', 1], ['one\n', 1], ['one\n\n', 2], ['one\r\ntwo', 2]]) {
    assert.equal((await fixture(text).reader.page(file, 1, signal())).value.lines, count);
  }
});

test('迟到拒绝、容量、无效UTF8和二进制不向文档插件发布内容', async () => {
  for (const f of [fixture('secret', { fail: true }), fixture('large', { size: ATTACHMENT_DOCUMENT_BYTES + 1 }), fixture(Buffer.from([255])), fixture('text\0binary')]) {
    const result = await f.reader.page(file, 1, signal());
    assert.equal(result.ok, false); assert.equal(result.value, undefined); assert.equal(f.cancels.length, 1);
  }
});

test('读取并发有界，取消、模型释放和清理后重试使用原附件通道', async () => {
  const f = fixture('read', { hold: true }), first = new AbortController();
  const one = f.reader.bytes(file, first.signal), two = f.reader.bytes(file, signal());
  assert.equal((await f.reader.bytes(file, signal())).ok, false); assert.equal(f.calls.length, 2);
  first.abort(); await assert.rejects(one, { name: 'AbortError' });
  const third = f.reader.bytes(file, signal()); assert.equal(f.calls.length, 3);
  f.releases[1](); f.releases[2](); assert.equal((await two).ok, true); assert.equal((await third).ok, true);
  const final = f.reader.bytes(file, signal()); f.model.lifetime.abort();
  await assert.rejects(final, { name: 'AbortError' });
  await assert.rejects(f.reader.bytes(file, signal()), { name: 'AbortError' });
  assert.equal(f.reader.readers, 0);
});
