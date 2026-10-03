import test from 'node:test';
import assert from 'node:assert/strict';
import { RemoteClient } from '../src/remote-client.mjs';
import { uploadRemote, promptRemote } from '../src/remote-upload.mjs';
import { RemoteTransport } from '../src/remote-transport.mjs';

const url = 'https://remote.dshm.invalid/api/session/uploadFileBinary?sessionId=s1&name=test.pdf';
const init = body => ({ method: 'POST', headers: { 'content-type': 'application/octet-stream' }, body });

test('GMT时区规范化同样进入主聊天和子会话图片分片正文', async () => {
  for (const endpoint of ['session/prompt', 'subagents/prompt']) {
    const f = fixture(), transport = new RemoteTransport(f.client);
    transport.capabilities = { channels: ['prompt'], subagentPromptUpload: true };
    const payload = { args: { request: { clientTimeZone: '+00:00', requestId: 'same-request', content: [{ type: 'image', mediaType: 'image/png', data: 'AA==' }] } } };
    try {
      await transport.call('/api', endpoint, payload);
      const envelope = JSON.parse(Buffer.concat(f.chunks).toString());
      assert.equal(envelope.method, endpoint);
      assert.equal(envelope.payload.args.request.clientTimeZone, 'UTC');
      assert.equal(envelope.payload.args.request.requestId, 'same-request');
      assert.deepEqual(envelope.payload.args.request.content, payload.args.request.content);
      assert.equal(payload.args.request.clientTimeZone, '+00:00');
    } finally { transport.dispose(); }
  }
});
test('子会话图片使用独立原 prompt 地址，保留父子身份、requestId 和大图片字节', async () => {
  const f = fixture(), payload = { args: { request: { parentSessionId: 'parent', childSessionId: 'child', mode: 'continuable', requestId: crypto.randomUUID(), delivery: 'queue',
    content: [{ type: 'image', mediaType: 'image/png', data: Buffer.alloc(2400000, 33).toString('base64') }] } } };
  await promptRemote(f.client, payload, new AbortController().signal, undefined, 'subagents/prompt');
  assert.equal(f.frames[0].operation.endpoint, 'subagents/prompt');
  assert.deepEqual(JSON.parse(Buffer.concat(f.chunks).toString()), { type: 'client-request', rpcId: f.frames[0].operation.rpcId, method: 'subagents/prompt', payload });
  assert.ok(f.chunks.length > 4);
});
function fixture({ grant = true, early } = {}) {
  const frames = [], chunks = []; let id;
  const bridge = { postMessage(raw) {
    const message = JSON.parse(raw), frame = message.data.frame;
    queueMicrotask(() => {
      bridge.onmessage({ data: JSON.stringify({ id: message.id, data: {} }) });
      if (!frame) return;
      frames.push(frame);
      if (frame.type === 'request') {
        id = frame.id;
        if (early) client.receive({ type: 'result', id, value: early });
        else if (grant) client.receive({ type: 'event', id, value: { type: 'credit', count: 4 } });
      } else if (frame.type === 'uploadChunk') {
        chunks.push(Buffer.from(frame.data, 'base64'));
        client.receive({ type: 'event', id, value: { type: 'credit', count: 1 } });
      } else if (frame.type === 'uploadEnd') client.receive({ type: 'result', id, value: { ok: true, value: { receiptId: 'real-host-receipt' } } });
    });
  } };
  const client = new RemoteClient(bridge); client.receive({ type: 'ready', protocol: 1 });
  return { client, frames, chunks };
}

test('Blob and one-shot stream upload exact bytes larger than one frame with the original session/name', async () => {
  const bytes = Buffer.alloc(65536 * 35 + 3, 67);
  for (const body of [new Blob([bytes]), new ReadableStream({ start(c) { c.enqueue(new Uint8Array(bytes)); c.close(); } })]) {
    const f = fixture(), result = await uploadRemote(f.client, url, init(body), new AbortController().signal);
    assert.deepEqual(Buffer.concat(f.chunks), bytes);
    assert.ok(f.chunks.every(chunk => chunk.length <= 65536));
    assert.equal((await result.json()).value.receiptId, 'real-host-receipt');
    assert.deepEqual(f.frames[0].operation, { method: 'remote.upload', sessionId: 's1', name: 'test.pdf' });
    assert.equal(f.frames.at(-1).type, 'uploadEnd');
  }
});

test('untrusted routes/methods/queries are rejected without sending bytes', async () => {
  const f = fixture(), signal = new AbortController().signal;
  for (const path of ['https://evil.invalid/api/session/uploadFileBinary?sessionId=s1', '/api/dsh-mobile', url + '&cwd=/private', url + '&sessionId=s2']) {
    await assert.rejects(uploadRemote(f.client, path, init(new Blob(['x'])), signal), /remote_upload_denied/);
  }
  await assert.rejects(uploadRemote(f.client, url, { ...init(new Blob()), method: 'PUT' }, signal), /remote_upload_denied/);
  assert.deepEqual(f.frames, []);
});

test('图片消息分片保留原始内容、requestId 和混合文件 receipt，不经过大 RPC 帧', async () => {
  const f = fixture();
  const payload = { args: { request: { sessionId: 's1', requestId: 'original-id', mode: 'queue', content: [
    { type: 'text', text: '中文\n图片' }, { type: 'image', name: 'image.png', mediaType: 'image/png', data: Buffer.alloc(2400000, 67).toString('base64') },
    { type: 'file', receiptId: 'same-session-receipt' },
  ] } } };
  assert.equal((await promptRemote(f.client, payload, new AbortController().signal)).ok, true);
  assert.equal(f.frames[0].operation.method, 'remote.prompt');
  assert.deepEqual(JSON.parse(Buffer.concat(f.chunks).toString()), { type: 'client-request', rpcId: f.frames[0].operation.rpcId, method: 'session/prompt', payload });
  assert.ok(f.frames.every(frame => JSON.stringify(frame).length < 90000));
  const rejected = fixture({ early: { ok: false, error: { code: 'session/attachment-invalid' } } });
  assert.equal((await promptRemote(rejected.client, payload, new AbortController().signal)).error.code, 'session/attachment-invalid');
});

test('aborting while awaiting initial credit sends cancel and does not replay', async () => {
  const f = fixture({ grant: false }), lifetime = new AbortController();
  const task = uploadRemote(f.client, url, init(new Blob(['x'])), lifetime.signal);
  await new Promise(resolve => setImmediate(resolve)); lifetime.abort();
  await assert.rejects(task, { name: 'AbortError' });
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(f.frames.at(-1).type, 'cancel');
  assert.equal(f.frames.filter(frame => frame.type === 'request').length, 1);
  assert.equal(f.chunks.length, 0);
});

test('a Host business rejection before reading bytes is preserved for the original upload plugin', async () => {
  const early = { ok: false, error: { code: 'session/not-found', message: 'missing', details: {} } };
  const f = fixture({ early });
  assert.deepEqual(await (await uploadRemote(f.client, url, init(new Blob(['x'])), new AbortController().signal)).json(), early);
  assert.equal(f.chunks.length, 0);
});
