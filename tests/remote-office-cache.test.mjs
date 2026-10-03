import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';

const output = resolve('artifacts/tests/remote-office-cache.cjs');
await build({ entryPoints: ['src/remote-office-cache.mjs'], outfile: output, bundle: true, platform: 'node', format: 'cjs', logLevel: 'silent' });
const { createRemoteOfficeReader } = createRequire(import.meta.url)(output);
const file = { sessionId: 'one', path: 'a.docx' }, signal = () => new AbortController().signal;
function fixture() {
  const calls = [], streams = [], listeners = new Set(), disposers = [];
  let version = 'v1', generation = 'g1', denied = false, changedStat = false, hold = false;
  const info = (path = 'a.docx') => ({ absolutePath: `/work/${path}`, version, bytes: 9 });
  const model = { lifetime: new AbortController(),
    ctx: { on(_name, listener) { this.reset = listener; }, effect(fn) { disposers.push(fn()); } },
    transport: { generation: 0, lifetime: new AbortController(), capabilities: { officePriority: true, channels: ['office', 'attachmentOffice'], endpoints: { calls: ['officeToPdf/generation'] } },
      async call(_channel, endpoint) { calls.push(endpoint); return { ok: true, value: generation }; } },
    remote: { workspaceFiles: {
      async readBytes(...args) { calls.push(['authorize', ...args.slice(0, 3)]); return denied ? { ok: false, error: { code: 'workspace-file/not-found', message: 'denied' } } : { ok: true, value: info(args[1]) }; },
      async stat(_session, path) { calls.push('stat'); return { ok: true, value: { ...info(path), version: changedStat ? 'changed' : version } }; },
    } },
    client: { subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener); }, async call() {},
      request(operation, emit) {
        let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
        const entry = { operation, cancelled: false, finish() {
          emit({ type: 'metadata', ...(operation.method === 'remote.attachmentOffice' ? { attachmentId: operation.attachmentId, name: operation.name } : info(operation.path)),
            bytes: 9, generation, missingFonts: [] });
          emit({ type: 'chunk', offset: 0, data: btoa('%PDF-1.7\n') }); resolve();
        } };
        streams.push(entry); if (!hold) queueMicrotask(() => entry.finish());
        return { id: String(streams.length), promise, cancel() { entry.cancelled = true; reject(new Error('cancelled')); } };
      },
    } };
  const read = createRemoteOfficeReader(model);
  return { model, read, calls, streams, set(values) {
    if ('version' in values) version = values.version; if ('generation' in values) generation = values.generation;
    if ('denied' in values) denied = values.denied; if ('changedStat' in values) changedStat = values.changedStat;
    if ('hold' in values) hold = values.hold;
  }, async dispose() { model.lifetime.abort(); await Promise.all(disposers.map(fn => fn())); },
  disconnect() { model.transport.generation++; model.transport.lifetime.abort(); model.transport.lifetime = new AbortController(); for (const cb of listeners) cb({ type: 'closed' }); } };
}
const waitStreams = async (f, count) => { for (let i = 0; i < 20 && f.streams.length < count; i++) await new Promise(resolve => setImmediate(resolve)); assert.equal(f.streams.length, count); };

test('重复预览复用原缓存，但每次重新核验权限和版本；拒绝后不返回旧内容', async () => {
  const f = fixture();
  try {
    const a = await f.read(file, signal()), b = await f.read(file, signal());
    assert.equal(a.value.data, b.value.data); assert.equal(f.streams.length, 1);
    assert.equal(f.calls.filter(x => x === 'officeToPdf/generation').length, 2);
    assert.equal(f.calls.filter(x => Array.isArray(x) && x[0] === 'authorize').length, 2);
    f.set({ denied: true }); assert.equal((await f.read(file, signal())).ok, false); assert.equal(f.streams.length, 1);
    f.set({ denied: false, changedStat: true }); await assert.rejects(f.read(file, signal()), /remote_file_changed/);
  } finally { await f.dispose(); }
});

test('源版本、转换器代次、会话和连接变化分别隔离缓存', async () => {
  const f = fixture();
  try {
    await f.read(file, signal()); f.set({ version: 'v2' }); await f.read(file, signal());
    f.set({ generation: 'g2' }); await f.read(file, signal()); await f.read({ ...file, sessionId: 'two' }, signal());
    f.disconnect(); await f.read(file, signal()); assert.equal(f.streams.length, 5);
  } finally { await f.dispose(); }
});

test('并发同文档共用转换，一个读者取消不影响另一个；最后一个取消释放流', async () => {
  const f = fixture(); f.set({ hold: true });
  try {
    const a = new AbortController(), b = new AbortController();
    const p = f.read(file, a.signal), q = f.read(file, b.signal); const rejected = assert.rejects(p);
    await waitStreams(f, 1); a.abort(); await rejected; assert.equal(f.streams[0].cancelled, false);
    f.streams[0].finish(); assert.equal((await q).ok, true);
    f.set({ version: 'v2' }); const c = new AbortController(), r = f.read(file, c.signal), stopped = assert.rejects(r);
    await waitStreams(f, 2); c.abort(); await stopped;
  } finally { await f.dispose(); }
  assert.equal(f.streams[1].cancelled, true);
});

test('后台留出前台容量，前台通过原队列提升同文件，额外后台立即拒绝', async () => {
  const f = fixture(); f.set({ hold: true });
  try {
    const background = f.read(file, signal(), 'background'); await waitStreams(f, 1);
    await assert.rejects(f.read({ ...file, path: 'other.docx' }, signal(), 'background'), /remote_office_busy/);
    const foreground = f.read(file, signal()); await waitStreams(f, 2);
    assert.deepEqual(f.streams.map(s => s.operation.priority), ['background', 'foreground']);
    f.streams.forEach(s => s.finish()); await Promise.all([background, foreground]);
  } finally { await f.dispose(); }
});

test('旧 Host 与附件每次读转换流，不用伪造 stat 或缓存授权', async () => {
  const f = fixture();
  try {
    const attachment = { ...file, attachment: { kind: 'file', attachmentId: 'original', name: 'a.docx' } };
    await f.read(attachment, signal()); await f.read(attachment, signal()); assert.equal(f.calls.length, 0);
    f.model.transport.capabilities.endpoints.calls = []; f.model.transport.capabilities.officePriority = false;
    await f.read(file, signal()); await f.read(file, signal()); assert.equal(f.streams.length, 4);
    assert.equal('priority' in f.streams[2].operation, false);
    await assert.rejects(f.read(file, signal(), 'background'), /remote_office_unavailable/);
  } finally { await f.dispose(); }
});

test('断线取消在途转换，迟到结束不交付；恢复后重新核验和转换', async () => {
  const f = fixture(); f.set({ hold: true });
  try {
    const p = f.read(file, signal()), rejected = assert.rejects(p); await waitStreams(f, 1);
    f.disconnect(); await rejected; assert.equal(f.streams[0].cancelled, true);
    f.streams[0].finish(); f.set({ hold: false }); assert.equal((await f.read(file, signal())).ok, true);
    assert.equal(f.streams.length, 2);
  } finally { await f.dispose(); }
});
