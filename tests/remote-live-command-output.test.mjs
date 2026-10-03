import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { remoteSourceAliases } from '../scripts/remote-source-aliases.mjs';

const root = resolve(import.meta.dirname, '..'), outfile = resolve(root, 'artifacts/tests/remote-live-command-output.cjs');
await build({ absWorkingDir: root, entryPoints: ['src/remote-live-command-output.mjs'], outfile, bundle: true,
  platform: 'node', format: 'cjs', logLevel: 'silent', alias: remoteSourceAliases(root), nodePaths: [resolve(root, 'node_modules')] });
const { RemoteLiveCommandOutput: Reader } = createRequire(import.meta.url)(outfile);

function fixture() {
  const target = { sessionId: 'own', nodeId: 'node', rootCallId: 'root', callId: 'child', rootCallTime: 1000 };
  const rootCall = { callId: 'root', time: 1000, subCalls: [{ callId: 'child', name: 'pwsh', time: 1002 }] };
  const state = { connectionState: 'connected', selected: 'own', session: { openState: 'open' },
    conversation: { nodes: new Map([['node', { kind: 'tool-call', data: { root: rootCall } }]]) } };
  const events = new Set(), requests = []; let connection = 1;
  const model = { getSnapshot: () => state, subscribe(fn) { events.add(fn); return () => events.delete(fn); },
    transport: { capabilities: { commandOutputGeneration: randomUUID() } }, connection: { generation: { getSnapshot: () => ({ id: connection }) } },
    client: { request(operation) { const deferred = Promise.withResolvers(); const task = { operation, ...deferred, cancel() { task.cancelled = true; } }; requests.push(task); return task; } } };
  return { target, state, model, requests, events, rootCall, notify() { for (const listener of events) listener(); },
    reconnect() { connection++; this.notify(); } };
}
const response = (outputId, bytes, startOffset, totalBytes, status = 'running') => ({ outputId, state: 'available', status,
  data: Buffer.from(bytes).toString('base64'), startOffset, nextOffset: startOffset + bytes.length, totalBytes, lossy: false });

test('原根调用/子调用身份发起读取，原始ANSI及UTF-8分段保留，结束后可读完', async () => {
  const f = fixture(), reader = new Reader(f.model, f.target, 'stderr', 'history'), id = randomUUID();
  try {
    const bytes = Buffer.from('\u001b[31m中文🙂\u001b[0m'), pieces = [];
    for (let offset = 0; offset < bytes.length; offset += 2) {
      const reading = reader.read(), request = f.requests.at(-1).operation;
      assert.equal(request.method, 'remote.commandOutput'); assert.equal(request.callId, 'child');
      assert.equal(request.rootCallId, 'root'); assert.equal(request.rootCallTime, 1000); assert.equal(request.stream, 'stderr');
      assert.equal(request.outputId, offset ? id : undefined); assert.equal(request.fromByte, offset);
      f.requests.at(-1).resolve(response(id, bytes.subarray(offset, offset + 2), offset, bytes.length, 'failed'));
      await reading; pieces.push(reader.snapshot.text);
    }
    assert.equal(pieces.join(''), bytes.toString()); assert.equal(reader.snapshot.phase, 'ended');
    assert.equal(reader.snapshot.status, 'failed'); assert.equal(reader.timer, null);
  } finally { reader.dispose(); }
});

test('同名调用换代和电脑服务换代不能继续旧输出', async () => {
  for (const mutate of [f => { f.rootCall.time++; }, f => { f.model.transport.capabilities.commandOutputGeneration = randomUUID(); },
    f => { f.state.selected = 'another'; }]) {
    const f = fixture(), reader = new Reader(f.model, f.target);
    reader.start(); const request = f.requests[0]; mutate(f); f.notify();
    assert.equal(request.cancelled, true); request.resolve(response(randomUUID(), Buffer.from('late'), 0, 4));
    await Promise.resolve(); await Promise.resolve();
    assert.equal(reader.snapshot.text, ''); await reader.retry(); assert.equal(f.requests.length, 1); reader.dispose();
  }
});

test('断线保留已确认输出，重连手动续读带原输出身份；关闭后丢弃迟到响应', async () => {
  const f = fixture(), reader = new Reader(f.model, f.target), id = randomUUID();
  reader.start(); f.requests[0].resolve(response(id, Buffer.from('before'), 0, 6));
  await Promise.resolve(); await Promise.resolve();
  f.reconnect(); assert.equal(reader.snapshot.phase, 'error');
  const retry = reader.retry(); assert.equal(f.requests[1].operation.fromByte, 6); assert.equal(f.requests[1].operation.outputId, id);
  f.requests[1].resolve(response(id, Buffer.from('after'), 6, 11)); await retry;
  assert.equal(reader.snapshot.text, 'beforeafter');
  const last = reader.read(); const request = f.requests.at(-1); reader.dispose();
  assert.equal(request.cancelled, true); request.resolve(response(id, Buffer.from('LATE'), 11, 15)); await last;
  assert.equal(reader.snapshot.text, 'beforeafter'); assert.equal(f.events.size, 0);
});

test('读取中输出身份变化失败，旧电脑不请求新接口，pending不伪造输出', async () => {
  const f = fixture(), reader = new Reader(f.model, f.target, 'stdout', 'history'), id = randomUUID();
  const first = reader.read(); f.requests[0].resolve({ outputId: id, state: 'pending', status: 'running' }); await first;
  assert.equal(reader.snapshot.phase, 'waiting'); assert.equal(reader.snapshot.text, '');
  const next = reader.read(); f.requests[1].resolve(response(randomUUID(), Buffer.from('wrong'), 0, 5)); await next;
  assert.equal(reader.snapshot.phase, 'error'); assert.equal(reader.snapshot.text, ''); reader.dispose();
  delete f.model.transport.capabilities.commandOutputGeneration;
  const old = new Reader(f.model, f.target); await old.read(); assert.equal(f.requests.length, 2); old.dispose();
});

test('完整重建交接前台输出身份、游标和UTF-8半字符，旧响应不能混入', async () => {
  const f = fixture(), first = new Reader(f.model, f.target, 'stderr', 'history'), id = randomUUID();
  const bytes = Buffer.from('A中文🙂B');
  const initial = first.read(); f.requests[0].resolve(response(id, bytes.subarray(0, 3), 0, bytes.length)); await initial;
  const pending = first.read(), late = f.requests[1];
  const saved = first.checkpoint(); first.dispose();
  assert.equal(late.cancelled, true);
  f.reconnect();
  const restored = new Reader(f.model, f.target, 'stderr', 'history', saved);
  try {
    restored.start(); assert.equal(f.requests.length, 2); assert.equal(restored.snapshot.text, 'A');
    assert.equal(restored.snapshot.phase, 'paused'); assert.equal(restored.snapshot.error, '');
    late.resolve(response(id, bytes.subarray(3), 3, bytes.length)); await pending;
    assert.equal(restored.snapshot.text, 'A');
    const reading = restored.retry(); const request = f.requests[2];
    assert.equal(request.operation.outputId, id); assert.equal(request.operation.fromByte, 3);
    assert.equal(request.operation.stream, 'stderr');
    request.resolve(response(id, bytes.subarray(3), 3, bytes.length, 'failed')); await reading;
    assert.equal(restored.snapshot.text, '中文🙂B'); assert.equal(restored.snapshot.phase, 'ended');
    const ended = restored.checkpoint(); restored.dispose();
    f.model.transport.capabilities.commandOutputGeneration = randomUUID();
    const stale = new Reader(f.model, f.target, 'stderr', 'history', ended);
    stale.start(); await stale.retry(); assert.equal(f.requests.length, 3);
    assert.match(stale.snapshot.error, /命令已变化/); stale.dispose();
  } finally { restored.dispose(); }
});
