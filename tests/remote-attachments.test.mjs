import test from 'node:test';
import assert from 'node:assert/strict';
import { RemoteAttachmentFiles, attachmentFile } from '../src/remote-attachments.mjs';
import { downloadRemoteFile } from '../src/remote-download.mjs';

const ref = { attachmentId: 'opaque:ref', name: '原始.txt', bytes: 0 };
const target = { kind: 'file', attachmentId: ref.attachmentId, name: ref.name };
function fixture(bytes, { failure, altered } = {}) {
  const calls = []; let canceled = false;
  const model = { transport: { capabilities: { channels: ['attachment'] } }, client: {
    request: (operation, event) => {
      calls.push(operation);
      return { id: 'id', cancel: () => { canceled = true; }, promise: new Promise((resolve, reject) => {
        setTimeout(() => {
          event({ type: 'metadata', attachment: { ...ref, bytes: bytes.length } });
          if (bytes.length) event({ type: 'chunk', offset: altered ? 1 : 0, data: Buffer.from(bytes).toString('base64') });
          setTimeout(() => failure ? reject(new Error('remote_attachment_corrupt')) : resolve(), 10);
        }, 0);
      }) };
    }, call: async (method, value) => {
      calls.push({ method, value });
      if (method === 'file.begin') return { downloadId: 'download' };
      if (method === 'file.chunk') return { bytes: value.offset + Buffer.from(value.data, 'base64').length };
      if (method === 'file.save') return { saved: true };
      return {};
    },
  } };
  return { files: new RemoteAttachmentFiles(model, target), model, calls, canceled: () => canceled };
}

test('卡片只传附件身份，文字与下载共用流且等待完整性结束', async () => {
  assert.deepEqual(attachmentFile({ type: 'file', attachment: ref }), { path: ref.name, attachment: target, mediaType: undefined });
  assert.equal(attachmentFile({ type: 'file', attachment: { ...ref, attachmentId: '' } }), null);
  const bytes = Buffer.from('原始附件\n完整末行\n'), f = fixture(bytes), signal = new AbortController().signal;
  assert.equal(await f.files.text('session', ref.name, signal), bytes.toString());
  assert.deepEqual(f.calls[0], { method: 'remote.attachment', sessionId: 'session', ...target });
  assert.equal(f.canceled(), true);
  await downloadRemoteFile({ files: f.files, client: f.model.client, sessionId: 'session', path: ref.name, signal });
  assert.equal(f.calls.find(item => item.method === 'file.finish').value.bytes, bytes.length);
  assert.equal(f.calls.some(item => item.method === 'file.save'), true);
});

test('附件在消费者暂停时断线，恢复后旧流不得再确认分片或交付', async () => {
  const f = fixture(Buffer.from('original')), signal = new AbortController().signal;
  f.model.transport.lifetime = new AbortController();
  const reader = f.files.read('session', ref.name, signal);
  assert.equal(Buffer.from((await reader.next()).value).toString(), 'original');
  f.model.transport.lifetime.abort(); f.model.transport.lifetime = new AbortController();
  await assert.rejects(reader.next(), error => error.name === 'AbortError');
  assert.equal(f.calls.some(call => call.method === 'socket.send'), false);
  assert.equal(f.canceled(), true);
  assert.equal(await f.files.text('session', ref.name, signal), 'original');
});

test('完整性迟到失败不能发布文字或保存文件，坏偏移、超限、取消均释放请求', async () => {
  const bytes = Buffer.from('partial');
  for (const mode of [{ failure: true }, { altered: true }]) {
    const f = fixture(bytes, mode), signal = new AbortController().signal;
    await assert.rejects(f.files.text('s', ref.name, signal));
    await assert.rejects(downloadRemoteFile({ files: f.files, client: f.model.client, sessionId: 's', path: ref.name, signal }));
    assert.equal(f.calls.some(item => item.method === 'file.save' || item.method === 'file.finish'), false);
    assert.equal(f.canceled(), true);
  }
  const f = fixture(bytes);
  await assert.rejects(f.files.bytes('s', ref.name, new AbortController().signal, { maxBytes: 1 }), /remote_file_preview_too_large/);
  const controller = new AbortController(), canceled = fixture(bytes);
  const work = canceled.files.bytes('s', ref.name, controller.signal); controller.abort(); await assert.rejects(work);
  assert.equal(canceled.canceled(), true);
});

test('HTML 原始附件不解析显示名为电脑路径，完整性与容量验证通过才返回文档', async () => {
  const html = Buffer.from('<h1>附件内容</h1><script>document.title="local"</script>');
  const f = fixture(html), signal = new AbortController().signal;
  const doc = await f.files.document('session', 'C:/private/view.html', signal, { maxBytes: 32768 });
  assert.deepEqual(doc, { data: new Uint8Array(html) });
  assert.deepEqual(f.calls[0], { method: 'remote.attachment', sessionId: 'session', ...target });
  assert.equal(f.calls.some(call => call.method?.startsWith('workspaceFiles/')), false);
  await assert.rejects(fixture(html, { failure: true }).files.document('session', 'view.html', signal), /remote_attachment_corrupt/);
  await assert.rejects(f.files.document('session', 'view.html', signal, { maxBytes: 1 }), /remote_file_preview_too_large/);
});
