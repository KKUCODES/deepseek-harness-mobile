import test from 'node:test';
import assert from 'node:assert/strict';
import { inlineImage, RemoteImageReads, RemotePluginImageUrls } from '../src/remote-images.mjs';

const image = (id, bytes = 4) => inlineImage({ type: 'image', attachment: { attachmentId: id, bytes, mediaType: 'image/png' } });
const tick = () => new Promise(resolve => setImmediate(resolve));

test('图片解码重试仅清除指定URL，迟到读取不能重新占用或发布旧URL', async () => {
  let count = 0, finish;
  const cache = new RemotePluginImageUrls(null, 'session', { read: async () => { count++; return new Uint8Array(4); } });
  const ref = image('one').ref, other = image('two').ref;
  const first = await cache.load(ref), second = await cache.load(other);
  cache.load.forget(ref);
  assert.equal(cache.load.peek(ref), undefined); assert.equal(cache.load.peek(other), second);
  await assert.rejects(fetch(first));
  const replacement = await cache.load(ref);
  assert.notEqual(replacement, first); assert.equal(count, 3);
  cache.load.forget(ref, first); assert.equal(cache.load.peek(ref), replacement, '旧图片的其他重试不能释放新的URL');
  cache.dispose();
  const delayed = new RemotePluginImageUrls(null, 'session', { read: () => new Promise(resolve => { finish = resolve; }) });
  const pending = delayed.load(ref); await tick(); delayed.load.forget(ref); finish(new Uint8Array(4));
  await assert.rejects(pending, { name: 'AbortError' }); await tick();
  assert.equal(delayed.load.peek(ref), undefined); assert.equal(delayed.entries.size, 0); delayed.dispose();
});

test('原插件 URL 契约复用会话有界读取，peek 不发请求，释放后 URL 与迟到内容失效', async () => {
  let reads = 0, finish;
  const lifetime = new AbortController();
  const cache = new RemotePluginImageUrls({ lifetime }, 'session', { maxBytes: 4, read: async () => { reads++; return new Uint8Array([1, 2, 3, 4]); } });
  const ref = image('a').ref;
  assert.equal(cache.load.peek(ref), undefined); assert.equal(reads, 0);
  const [first, second] = await Promise.all([cache.load(ref), cache.load(ref)]);
  assert.equal(first, second); assert.equal(reads, 1); assert.equal(cache.load.peek(ref), first);
  assert.deepEqual(new Uint8Array(await (await fetch(first)).arrayBuffer()), new Uint8Array([1, 2, 3, 4]));
  await assert.rejects(cache.load(image('b').ref), /remote_image_memory_full/);
  await assert.rejects(cache.load({ attachmentId: 'html', bytes: 4, mediaType: 'text/html' }), /remote_attachment_invalid/);
  lifetime.abort(); assert.equal(cache.load.peek(ref), undefined);
  await assert.rejects(fetch(first)); await assert.rejects(cache.load(ref), { name: 'AbortError' });
  const delayed = new RemotePluginImageUrls(null, 'other', { read: () => new Promise(resolve => { finish = resolve; }) });
  const pending = delayed.load(ref); await tick(); delayed.dispose(); finish(new Uint8Array(4));
  await assert.rejects(pending, { name: 'AbortError' }); assert.equal(delayed.load.peek(ref), undefined);
});

test('图片识别保留原 file/image 身份，不接受日志 URL 或未知媒体类型', () => {
  assert.equal(inlineImage({ type: 'image', attachment: { previewUrl: 'https://example.com/private' } }), null);
  assert.equal(inlineImage({ type: 'image', attachment: { attachmentId: 'id', bytes: 1, mediaType: 'text/html' } }), null);
  const file = inlineImage({ type: 'file', attachment: { attachmentId: 'id', bytes: 1, name: 'test.JPEG' } });
  assert.equal(file.file.attachment.kind, 'file');
  assert.equal(file.mediaType, 'image/jpeg');
  assert.equal(file.displayPath, 'image.jpg');
});

test('可见消费者共享读取，同时最多两张；最后释放取消，队列释放不发请求', async () => {
  const calls = [], controls = new Map();
  const pool = new RemoteImageReads(null, 'session', { read: (part, signal) => {
    const id = part.ref.attachmentId; calls.push(id);
    return new Promise((resolve, reject) => {
      controls.set(id, resolve);
      signal.addEventListener('abort', () => reject(signal.reason), { once: true });
    });
  } });
  const first = pool.acquire(image('a')), same = pool.acquire(image('a')), second = pool.acquire(image('b'));
  const queued = pool.acquire(image('c')), removed = pool.acquire(image('d'));
  removed.release(); await assert.rejects(removed.promise, { name: 'AbortError' });
  await tick(); assert.deepEqual(calls, ['a', 'b']);
  first.release(); assert.equal(pool.active, 2);
  controls.get('a')(new Uint8Array(4)); await same.promise; await tick();
  assert.deepEqual(calls, ['a', 'b', 'c']);
  same.release(); second.release(); queued.release();
  await assert.rejects(second.promise, { name: 'AbortError' });
  await assert.rejects(queued.promise, { name: 'AbortError' });
  await tick(); assert.equal(pool.reserved, 0); assert.equal(pool.entries.size, 0);
  pool.dispose();
});

test('切换会话/断线同时取消在途与排队，迟到字节不得发布，下个会话重新读', async () => {
  const lifetime = new AbortController(), finish = [];
  const pool = new RemoteImageReads({ lifetime }, 'old', { read: () => new Promise(resolve => finish.push(resolve)) });
  const leases = ['a', 'b', 'c'].map(id => pool.acquire(image(id)));
  await tick(); lifetime.abort();
  for (const lease of leases) await assert.rejects(lease.promise, { name: 'AbortError' });
  assert.equal(pool.entries.size, 0);
  for (const resolve of finish) resolve(new Uint8Array(4));
  await tick(); assert.equal(pool.active, 0); assert.equal(pool.reserved, 0);
  assert.throws(() => pool.acquire(image('a')), { name: 'AbortError' });
  let reads = 0;
  const next = new RemoteImageReads(null, 'new', { read: async () => { reads++; return new Uint8Array(4); } });
  const lease = next.acquire(image('a')); await lease.promise; assert.equal(reads, 1);
  lease.release(); next.dispose();
});

test('原流确认后才发布图片，匹配引用大小；失败释放额度并可显式重试', async () => {
  let complete, calls = 0, canceled = 0;
  const model = { transport: { capabilities: { channels: ['attachment'] } }, client: {
    call: async () => {},
    request: (operation, event) => {
      assert.deepEqual(operation, { method: 'remote.attachment', sessionId: 'original', kind: 'image', attachmentId: 'a' });
      calls++;
      const promise = new Promise((resolve, reject) => { complete = { resolve, reject }; });
      queueMicrotask(() => {
        event({ type: 'metadata', attachment: { attachmentId: 'a', bytes: 4, mediaType: 'image/png' } });
        event({ type: 'chunk', offset: 0, data: 'AQIDBA==' });
      });
      return { id: 'stream', promise, cancel: () => { canceled++; } };
    },
  } };
  const pool = new RemoteImageReads(model, 'original', { maxBytes: 4 });
  let settled = false;
  const failed = pool.acquire(image('a'));
  void failed.promise.then(() => { settled = true; }, () => {});
  await tick(); assert.equal(settled, false);
  assert.throws(() => pool.acquire(image('b')), /remote_image_memory_full/);
  complete.reject(new Error('remote_attachment_corrupt'));
  await assert.rejects(failed.promise, /remote_attachment_corrupt/); failed.release(); await tick();
  assert.equal(pool.reserved, 0);
  const retry = pool.acquire(image('a')); await tick(); complete.resolve();
  assert.deepEqual(await retry.promise, new Uint8Array([1, 2, 3, 4]));
  assert.equal(calls, 2); assert.equal(canceled, 2);
  retry.release(); pool.dispose();
  const mismatch = new RemoteImageReads(null, 's', { read: async () => new Uint8Array(3) });
  const wrong = mismatch.acquire(image('a'));
  await assert.rejects(wrong.promise, /remote_attachment_invalid/); wrong.release(); mismatch.dispose();
});
