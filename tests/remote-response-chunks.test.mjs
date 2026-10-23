import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { build } from 'esbuild';
import { RemoteClient } from '../src/remote-client.mjs';
import { RemoteTransport } from '../src/remote-transport.mjs';
import { ResponseAssembler, MAX_RESPONSE_BYTES, MAX_RESPONSE_BUFFER_BYTES, MAX_RESPONSE_TRANSFERS, RESPONSE_CHUNK_BYTES } from '../../backend/packages/protocol/dist/index.js';

const built = await build({ entryPoints: ['../plugin/src/response-writer.ts'], bundle: true, write: false, platform: 'node', format: 'esm' });
const { ResponseWriter } = await import(`data:text/javascript;base64,${Buffer.from(built.outputFiles[0].text).toString('base64')}`);
const tick = () => new Promise(resolve => setImmediate(resolve));
const large = () => ({ records: [{ seq: 1, text: '中文🙂'.repeat(240000) }] });

function fixture({ gateway = true, plugin = true, acknowledge = true } = {}) {
  const received = [], sent = [], wire = [], writers = new Map(), controllers = [];
  const budget = { bytes: 0, transfers: 0 };
  const bridge = { postMessage(raw) {
    const message = JSON.parse(raw), frame = message.data?.frame;
    queueMicrotask(() => bridge.onmessage({ data: JSON.stringify({ id: message.id, data: {} }) }));
    if (!frame) return;
    sent.push(frame);
    if (frame.type === 'responseAck' && acknowledge) writers.get(frame.id)?.acknowledge(frame);
    if (frame.type === 'cancel') writers.get(frame.id)?.cancel();
  } };
  const client = new RemoteClient(bridge);
  client.receive({ type: 'ready', protocol: 1, hostOnline: true, ...(gateway ? { responseChunksVersion: 1 } : {}) });
  client.responseChunksEnabled = plugin;
  const open = (stream = false) => {
    const task = client.request({ method: stream ? 'remote.stream' : 'remote.rpc', endpoint: stream ? 'session/follow' : 'session/page', payload: {} }, value => received.push(value));
    const controller = new AbortController(); controllers.push(controller);
    const writer = new ResponseWriter(frame => { wire.push(frame); client.receive(frame); }, sent.at(-1).responseChunks === 1, controller, budget);
    writers.set(task.id, writer);
    return { task, writer, controller };
  };
  return { client, open, received, sent, wire, budget, close() { for (const controller of controllers) controller.abort(); client.reset(); } };
}

test('实际电脑发送器与手机入口完整还原超2MiB历史RPC，包括中文和跨块emoji', async () => {
  const f = fixture(), { task, writer } = f.open(), value = { ok: true, value: large() };
  try {
    await writer.write({ type: 'result', id: task.id, value });
    assert.deepEqual(await task.promise, value);
    assert.ok(f.wire.some(frame => frame.type === 'responseStart'));
    assert.ok(f.wire.every(frame => Buffer.byteLength(JSON.stringify(frame)) < 2 * 1024 * 1024));
    assert.equal(f.client.assembler.bytes, 0); assert.equal(f.budget.bytes, 0);
  } finally { f.close(); }
});

test('首次快照、连续大实时事件及后续小事件保持原次序，结束帧不越过重组', async () => {
  const f = fixture(), { task, writer } = f.open(true);
  const values = [{ type: 'snapshot', ...large() }, { type: 'event', ...large() }, { type: 'event', text: 'tail' }];
  try {
    await Promise.all([...values.map(value => writer.write({ type: 'event', id: task.id, value })), writer.write({ type: 'end', id: task.id })]);
    await task.promise;
    assert.deepEqual(f.received, values); assert.equal(f.client.assembler.size, 0);
  } finally { f.close(); }
});

test('四块窗口在手机确认前停止生产，取消释放在途数据', async () => {
  const f = fixture({ acknowledge: false }), { task, writer } = f.open();
  const writing = writer.write({ type: 'result', id: task.id, value: large() });
  try {
    await tick(); await tick();
    assert.equal(f.wire.filter(frame => frame.type === 'responseChunk').length, 4);
    task.cancel(); await assert.rejects(writing, /cancelled/);
    assert.equal(f.client.assembler.bytes, 0); assert.equal(f.budget.bytes, 0);
  } finally { f.close(); }
});

test('新手机配旧网关或旧插件不发送新协议字段，原小响应仍可用', async () => {
  for (const options of [{ gateway: false }, { plugin: false }]) {
    const f = fixture(options), { task, writer } = f.open();
    try {
      assert.equal(f.sent[0].responseChunks, undefined);
      await writer.write({ type: 'result', id: task.id, value: { ok: true } });
      assert.deepEqual(await task.promise, { ok: true });
      const second = f.open();
      await assert.rejects(second.writer.write({ type: 'result', id: second.task.id, value: large() }), /response_too_large/);
      second.task.cancel();
    } finally { f.close(); }
  }
});

test('断线丢弃半份快照，旧片段不能进入新连接，新读取完整恢复且不重发写操作', async () => {
  const f = fixture({ acknowledge: false }), first = f.open(true);
  const failed = assert.rejects(first.task.promise, /connection_closed/);
  const writing = first.writer.write({ type: 'event', id: first.task.id, value: large() });
  await tick(); await tick();
  f.client.receive({ type: 'closed' }); first.controller.abort();
  await failed; await assert.rejects(writing);
  f.client.receive({ type: 'ready', protocol: 1, hostOnline: true, responseChunksVersion: 1 });
  assert.equal(f.client.responseChunksEnabled, false); assert.equal(f.client.assembler.bytes, 0);
  f.client.receive(f.wire.find(frame => frame.type === 'responseChunk'));
  assert.equal(f.received.length, 0);
  const next = f.client.request({ method: 'remote.rpc', endpoint: 'session/page', payload: {} });
  f.client.receive({ type: 'result', id: next.id, value: { fresh: true } });
  assert.deepEqual(await next.promise, { fresh: true });
  assert.equal(f.sent.filter(frame => frame.type === 'request').length, 2);
  f.close();
});

test('损坏、重排、重复、缺块和跨请求片段均拒绝，不泄露半份内容', async () => {
  for (const mode of ['corrupt', 'reorder', 'duplicate', 'missing', 'cross-request']) {
    const assembler = new ResponseAssembler(), id = randomUUID(), transferId = randomUUID();
    const bytes = Buffer.from(JSON.stringify({ text: 'a'.repeat(RESPONSE_CHUNK_BYTES + 100) }));
    const start = { type: 'responseStart', id, transferId, kind: 'result', bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex') };
    await assembler.accept(start, false);
    const part = index => ({ type: 'responseChunk', id, transferId, index, data: bytes.subarray(index * RESPONSE_CHUNK_BYTES, (index + 1) * RESPONSE_CHUNK_BYTES).toString('base64') });
    if (mode === 'reorder') await assert.rejects(assembler.accept(part(1), false));
    else if (mode === 'cross-request') await assert.rejects(assembler.accept({ ...part(0), id: randomUUID() }, false));
    else {
      const first = part(0);
      if (mode === 'corrupt') first.data = Buffer.alloc(RESPONSE_CHUNK_BYTES, 97).toString('base64');
      await assembler.accept(first, false);
      if (mode === 'duplicate') await assert.rejects(assembler.accept(first, false));
      else if (mode === 'missing') await assert.rejects(assembler.accept({ type: 'responseEnd', id, transferId }, false));
      else {
        await assembler.accept(part(1), false);
        await assert.rejects(assembler.accept({ type: 'responseEnd', id, transferId }, false), /corrupt/);
      }
    }
    assembler.clear(); assert.equal(assembler.bytes, 0);
  }
});

test('重组预留按声明字节限制并发，超限不会静默截断', async () => {
  const assembler = new ResponseAssembler();
  const start = () => ({ type: 'responseStart', id: randomUUID(), transferId: randomUUID(), kind: 'event', bytes: MAX_RESPONSE_BYTES, sha256: '0'.repeat(64) });
  await assembler.accept(start(), true); await assembler.accept(start(), true);
  await assert.rejects(assembler.accept(start(), true), /buffer_limit/);
  assembler.clear(); assert.equal(assembler.bytes, 0);
});

test('协商必须同时具备中转与插件能力，重连后重新协商', async () => {
  for (const gateway of [false, true]) for (const plugin of [false, true]) {
    const f = fixture({ gateway }), transport = new RemoteTransport(f.client);
    const pending = transport.negotiate();
    f.client.receive({ type: 'result', id: f.sent.at(-1).id, value: { transport: 2, dshVersion: '0.1.6-alpha.2', ...(plugin ? { responseChunksVersion: 1 } : {}) } });
    await pending;
    assert.equal(f.client.responseChunksEnabled, gateway && plugin);
    f.client.receive({ type: 'closed' });
    assert.equal(f.client.responseChunksEnabled, false);
    transport.dispose(); f.close();
  }
});

test('分块空闲超时只结束对应请求，释放预留并发送取消', async t => {
  t.mock.timers.enable({ apis: ['setTimeout', 'Date'], now: 1000 });
  const f = fixture(), { task } = f.open();
  const rejected = assert.rejects(task.promise, /response_chunk_timeout/);
  try {
    f.client.receive({ type: 'responseStart', id: task.id, transferId: randomUUID(), kind: 'result', bytes: 100, sha256: '0'.repeat(64) });
    await tick();
    assert.equal(f.client.assembler.bytes, 100);
    t.mock.timers.tick(30000); await rejected;
    assert.equal(f.client.assembler.bytes, 0);
    assert.ok(f.sent.some(frame => frame.type === 'cancel' && frame.id === task.id));
    assert.equal(f.client.connected, true);
  } finally { f.close(); t.mock.timers.reset(); }
});

test('分块期间电脑断开保留原断线机器码，能交由既有只读重连处理', async () => {
  const f = fixture(), { task } = f.open(true);
  const rejected = assert.rejects(task.promise, /host_disconnected_outcome_unknown/);
  f.client.receive({ type: 'responseStart', id: task.id, transferId: randomUUID(), kind: 'event', bytes: 100, sha256: '0'.repeat(64) });
  await tick();
  f.client.receive({ type: 'error', id: task.id, code: 'host_disconnected_outcome_unknown' });
  await rejected;
  assert.equal(f.client.assembler.bytes, 0); f.close();
});

test('声明超过单条上限在分配前拒绝，RPC不能接收伪装的event分块', async () => {
  for (const fields of [{ bytes: MAX_RESPONSE_BYTES + 1 }, { kind: 'event' }]) {
    const f = fixture(), { task } = f.open();
    const rejected = assert.rejects(task.promise);
    f.client.receive({ type: 'responseStart', id: task.id, transferId: randomUUID(), kind: 'result', bytes: 100, sha256: '0'.repeat(64), ...fields });
    await rejected; assert.equal(f.client.assembler.bytes, 0); f.close();
  }
});

test('正文未超2MiB但加RPC/缓存包络越界时也分块，不按正文长度误判', async () => {
  const f = fixture(), { task, writer } = f.open();
  const value = { ok: true, value: { text: 'x'.repeat(2 * 1024 * 1024 - 45) } };
  assert.ok(Buffer.byteLength(JSON.stringify(value)) < 2 * 1024 * 1024);
  try {
    await writer.write({ type: 'result', id: task.id, value });
    assert.deepEqual(await task.promise, value);
    assert.ok(f.wire.some(frame => frame.type === 'responseStart'));
  } finally { f.close(); }
});

test('发送端单条、连接字节与并发预算超限均明确拒绝，并释放自身预留', async () => {
  for (const mode of ['single', 'bytes', 'transfers']) {
    const emitted = [], controller = new AbortController();
    const budget = { bytes: mode === 'bytes' ? MAX_RESPONSE_BUFFER_BYTES : 0, transfers: mode === 'transfers' ? MAX_RESPONSE_TRANSFERS : 0 };
    const before = { ...budget }, writer = new ResponseWriter(frame => emitted.push(frame), true, controller, budget);
    const value = mode === 'single' ? { text: 'x'.repeat(MAX_RESPONSE_BYTES) } : large();
    await assert.rejects(writer.write({ type: 'result', id: randomUUID(), value }), mode === 'single' ? /response_too_large/ : /response_buffer_limit/);
    assert.deepEqual(budget, before); assert.deepEqual(emitted, []); controller.abort();
  }
});

test('慢消费者的已完成事件共享总队列预算，退出各订阅后归零', async () => {
  const streams = [];
  const client = { subscribe: () => () => {}, request(_operation, onEvent) {
    const settled = Promise.withResolvers(), entry = { onEvent, cancelled: false };
    streams.push(entry);
    return { promise: settled.promise, cancel() { entry.cancelled = true; settled.resolve(); } };
  } };
  const transport = new RemoteTransport(client); transport.capabilities = {};
  const controller = new AbortController();
  const a = transport.readStream('/api', 'session/follow', { args: {} }, controller.signal);
  const b = transport.readStream('/api', 'session/follow', { args: {} }, controller.signal);
  const first = a.next(); streams[0].onEvent({ seed: 1 }); await first;
  const second = b.next(); streams[1].onEvent({ seed: 2 }); await second;
  const value = { text: 'x'.repeat(1024 * 1024) };
  for (let index = 0; index < 40; index++) streams[0].onEvent(value);
  for (let index = 0; index < 24; index++) streams[1].onEvent(value);
  assert.ok(transport.queuedStreamBytes <= MAX_RESPONSE_BUFFER_BYTES);
  assert.equal(streams[0].cancelled, false); assert.equal(streams[1].cancelled, true);
  await assert.rejects(b.next(), /remote_consumer_too_slow/);
  await a.return(); assert.equal(transport.queuedStreamBytes, 0); transport.dispose();
});
