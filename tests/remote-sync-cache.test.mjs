import test from 'node:test';
import assert from 'node:assert/strict';
import { IDBFactory } from 'fake-indexeddb';
import { build } from 'esbuild';
import { RemoteSyncCache } from '../src/remote-sync-cache.mjs';
import { RemoteClient } from '../src/remote-client.mjs';
import { RemoteTransport } from '../src/remote-transport.mjs';
import { syncHash } from '../../backend/packages/protocol/dist/index.js';

// 使用真正的电脑编码器和手机传输边界，协议夹具不代表真实DSH/Android验收。
const built = await build({ entryPoints: ['../plugin/src/sync-cache.ts'], bundle: true, write: false, platform: 'node', format: 'esm' });
const { RemoteSyncCache: HostCache } = await import(`data:text/javascript;base64,${Buffer.from(built.outputFiles[0].text).toString('base64')}`);
const identity = { paired: true, origin: 'https://fixture.invalid', deviceId: 'one', fingerprint: 'fingerprint' };
const rows = () => Array.from({ length: 100 }, (_, id) => ({ id, text: `message-${id}-` + '历史记录'.repeat(80) }));

function server() {
  const cache = new HostCache(), subscriptions = new Map(), frames = [], wire = [], originals = [];
  const state = { value: rows(), corrupt: false };
  const bridge = { postMessage(raw) {
    const message = JSON.parse(raw);
    queueMicrotask(() => bridge.onmessage({ data: JSON.stringify({ id: message.id, data: {} }) }));
    const frame = message.data?.frame;
    if (!frame) return;
    frames.push(frame);
    if (frame.type === 'cancel') { subscriptions.delete(frame.id); return; }
    if (frame.type !== 'request') return;
    const send = value => { wire.push(value); client.receive(value); };
    void (async () => {
      const op = frame.operation;
      if (op.method === 'remote.negotiate') return send({ type: 'result', id: frame.id, value: { transport: 2, dshVersion: '0.1.6-alpha.2', syncCacheVersion: 1 } });
      if (state.remoteError) return send({ type: 'error', id: frame.id, code: state.remoteError });
      const stream = op.method === 'remote.stream', prepared = cache.prepare('device', op.endpoint, stream, op.payload);
      originals.push(prepared.payload);
      const original = stream ? { type: 'baseline', value: state.value } : { ok: true, value: state.value };
      const value = await prepared.encode(original);
      if (state.corrupt && value.delta) { state.corrupt = false; value.delta = [1, ['missing']]; }
      send({ type: stream ? 'event' : 'result', id: frame.id, value });
      if (stream) subscriptions.set(frame.id, send);
    })().catch(error => send({ type: 'error', id: frame.id, code: error.message }));
  } };
  const client = new RemoteClient(bridge); client.receive({ type: 'ready', protocol: 1, hostOnline: true });
  return { state, client, wire, frames, originals, subscriptions, cache };
}

test('真实编码器跨手机缓存重开：无变化仅引用，新消息/删除只差量，电脑实时更新继续送达', async () => {
  const factory = new IDBFactory(), host = server();
  const open = async () => {
    const syncCache = await RemoteSyncCache.open(identity, factory);
    const transport = new RemoteTransport(host.client, { syncCache });
    await transport.negotiate(); return transport;
  };
  let transport = await open();
  const first = await transport.call('/api', 'session/list', { args: {} });
  assert.deepEqual(first.value, host.state.value);
  const firstBytes = JSON.stringify(host.wire.at(-1)).length;
  transport.dispose(); transport = await open();
  assert.deepEqual(await transport.call('/api', 'session/list', { args: {} }), first);
  assert.ok(JSON.stringify(host.wire.at(-1)).length < firstBytes / 20);
  host.state.value = [...host.state.value.slice(2), { id: 100, text: 'new on computer' }];
  assert.deepEqual((await transport.call('/api', 'session/list', { args: {} })).value, host.state.value);
  assert.ok(JSON.stringify(host.wire.at(-1)).length < firstBytes / 5);
  const controller = new AbortController();
  const stream = transport.stream('/api', 'workspace/follow', { args: {} }, controller.signal);
  assert.deepEqual((await stream.next()).value, { type: 'baseline', value: host.state.value });
  const increment = { type: 'remove', workspaceId: 'deleted' };
  const id = [...host.subscriptions.keys()].at(-1), send = host.subscriptions.get(id);
  send({ type: 'event', id, value: increment });
  assert.deepEqual((await stream.next()).value, increment);
  controller.abort(); await stream.return();
  assert.ok(host.originals.every(payload => !Object.hasOwn(payload, '_dshmSync')));
  transport.dispose(); host.client.reset();
});

test('缓存损坏、隔离身份及原生清理代次均回退完整结果，不显示旧基线', async () => {
  const factory = new IDBFactory(), first = await RemoteSyncCache.open(identity, factory);
  const request = await first.prepare('session/list', { args: {} }, false, 'version');
  const value = { ok: true, value: rows() }, text = JSON.stringify(value), hash = await syncHash(text);
  assert.deepEqual(await first.decode({ _dshmSync: 1, hash, value }, request), value);
  assert.equal((await first.prepare('session/list', { args: {} }, false, 'version')).base.hash, hash);
  const other = await RemoteSyncCache.open({ ...identity, deviceId: 'other' }, factory);
  assert.equal((await other.prepare('session/list', { args: {} }, false, 'version')).base, undefined); other.close();
  await first.save({ key: request.key, text: 'corrupt', hash, at: Date.now() });
  assert.equal((await first.prepare('session/list', { args: {} }, false, 'version')).base, undefined);
  await first.decode({ _dshmSync: 1, hash, value }, request);
  first.close();
  const cleared = await RemoteSyncCache.open({ ...identity, cacheEpoch: 1 }, factory);
  assert.equal((await cleared.prepare('session/list', { args: {} }, false, 'version')).base, undefined);
  assert.equal(await cleared.prepare('session/prompt', { args: {} }, false, 'version'), undefined);
  cleared.close();
});

test('坏差量只重试只读基线一次，实时流重建不丢更新，写操作没有缓存标记', async () => {
  const host = server(), syncCache = await RemoteSyncCache.open(identity, new IDBFactory());
  const transport = new RemoteTransport(host.client, { syncCache }); await transport.negotiate();
  await transport.call('/api', 'session/list', { args: {} }); host.state.corrupt = true;
  assert.deepEqual((await transport.call('/api', 'session/list', { args: {} })).value, host.state.value);
  const reads = host.frames.filter(f => f.operation?.endpoint === 'session/list');
  assert.equal(reads.length, 3); assert.equal(reads.at(-1).operation.payload._dshmSync.hash, undefined);
  const one = new AbortController(), initial = transport.stream('/api', 'session/follow', { args: {} }, one.signal);
  await initial.next(); one.abort(); await initial.return();
  host.state.corrupt = true;
  const two = new AbortController(), retry = transport.stream('/api', 'session/follow', { args: {} }, two.signal);
  assert.deepEqual((await retry.next()).value, { type: 'baseline', value: host.state.value });
  assert.equal(host.frames.filter(f => f.operation?.endpoint === 'session/follow').length, 3);
  two.abort(); await retry.return();
  await transport.call('/api', 'session/cancel', { args: { sessionId: 'fixture' } });
  assert.equal(host.frames.at(-1).operation.payload._dshmSync, undefined);
  // 远端同名错误不能冒充本机解码失败，尤其不能使写操作重发。
  host.state.remoteError = 'sync_cache_invalid';
  const before = host.frames.length;
  await assert.rejects(transport.call('/api', 'session/cancel', { args: { sessionId: 'fixture' } }), /sync_cache_invalid/);
  const failureFrames = host.frames.slice(before);
  assert.equal(failureFrames.filter(frame => frame.type === 'request').length, 1);
  assert.equal(failureFrames.filter(frame => frame.type === 'cancel').length, 1);
  transport.dispose(); host.client.reset();
});
