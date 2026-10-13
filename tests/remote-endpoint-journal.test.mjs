import test from 'node:test';
import assert from 'node:assert/strict';
import { IDBFactory, IDBDatabase } from 'fake-indexeddb';
import { RemoteDraftStore } from '../src/remote-drafts.mjs';
import { RemoteEndpointJournal, endpointWriteMarker } from '../src/remote-endpoint-journal.mjs';
import { RemoteComputerEndpoint } from '../src/remote-endpoint.mjs';
import { draftBinding } from './fixtures/remote-draft-storage.mjs';

test('严格落盘只存待核对目标；重开按绑定恢复，旧清理不删除新标记', async () => {
  const db = new IDBFactory(), open = binding => RemoteDraftStore.open(binding ?? draftBinding, db, null);
  const store = await open(), journal = new RemoteEndpointJournal(store, () => {});
  const chat = await journal.begin(), provider = await journal.begin({ provider: 'route' });
  assert.deepEqual(store.readEndpointWrites().map(value => Object.keys(value).sort()), [['id', 'version'], ['id', 'target', 'version']]);
  assert.throws(() => endpointWriteMarker({ ...chat, change: { value: 'private' } }));
  store.close(); const restored = await open(), next = new RemoteEndpointJournal(restored, () => {});
  assert.deepEqual(next.summaries(), [null, { provider: 'route' }]);
  const other = await open({ ...draftBinding, deviceId: 'another' }); assert.deepEqual(other.readEndpointWrites(), []); other.close();
  const replacement = await next.begin({ provider: 'route' });
  await next.settled(provider); assert.ok(restored.readEndpointWrites().some(value => value.id === replacement.id));
  await next.settled(chat); await next.settled(replacement); assert.deepEqual(restored.readEndpointWrites(), []); restored.close();
});

test('持久化失败不发出地址写入；明确拒绝清理标记，未知结果待新连接读取', async () => {
  const db = new IDBFactory(), store = await RemoteDraftStore.open(draftBinding, db, null);
  let generation = 1, rejectWrite, count = 0;
  const view = { snapshot: crypto.randomUUID(), revision: 0, writable: true, applies: 'live', protocol: 'messages',
    origin: 'https://site.invalid', inheritedOrigin: 'https://api.deepseek.com', customPath: true, overridden: true };
  const model = { lifetime: new AbortController(), transport: { capabilities: { management: true, computerEndpoint: true } },
    connection: { generation: { getSnapshot: () => ({ id: generation }) }, state: { getSnapshot: () => 'connected' } },
    client: { request(operation) { if (operation.method === 'remote.endpointWrite') { count++; if (rejectWrite) return { promise: Promise.reject(new Error(rejectWrite)), cancel() {} }; }
      return { promise: Promise.resolve(view), cancel() {} }; } } };
  model.endpointJournal = new RemoteEndpointJournal(store, () => {});
  const endpoint = new RemoteComputerEndpoint(model), original = IDBDatabase.prototype.transaction;
  const initial = await endpoint.read();
  try {
    IDBDatabase.prototype.transaction = function (...args) { const tx = original.apply(this, args); if (args[1] === 'readwrite') queueMicrotask(() => tx.abort()); return tx; };
    await assert.rejects(endpoint.save(initial, { op: 'unset' }), /手机存储/); assert.equal(count, 0); assert.deepEqual(store.readEndpointWrites(), []);
  } finally { IDBDatabase.prototype.transaction = original; }
  rejectWrite = 'remote_endpoint_stale'; await assert.rejects(endpoint.save(await endpoint.read(), { op: 'unset' }), /重新读取/);
  assert.deepEqual(store.readEndpointWrites(), []);
  rejectWrite = 'connection_closed_outcome_unknown'; await assert.rejects(endpoint.save(await endpoint.read(), { op: 'unset' }), /尚未确认/);
  assert.equal(store.readEndpointWrites().length, 1); assert.equal(model.endpointJournal.summaries().length, 1);
  await endpoint.read(); assert.equal(store.readEndpointWrites().length, 1);
  generation++; await endpoint.read(); assert.deepEqual(store.readEndpointWrites(), []); assert.deepEqual(model.endpointJournal.summaries(), []); store.close();
});
