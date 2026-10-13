import test from 'node:test';
import assert from 'node:assert/strict';
import { IDBFactory } from 'fake-indexeddb';
import { RemoteDraftStore } from '../src/remote-drafts.mjs';
import { pluginOperationSummaries } from '../src/remote-plugin-journal.mjs';
import { draftBinding } from './fixtures/remote-draft-storage.mjs';

const pending = (index = 0) => ({ id: `operation-${index}`, generation: 'original-host',
  endpoint: 'pluginManager/installBundle', target: 'https://user:password@example.com/package.tgz?key=secret#private',
  requestId: 'original-install-request', startedAt: Date.now(), state: 'pending',
  payload: { credentials: 'must-not-save' }, result: { secret: 'must-not-save' } });

test('持久摘要只存展示白名单，下载凭据、完整参数与回执不落盘', () => {
  const [item] = pluginOperationSummaries([pending()]);
  assert.equal(item.target, 'https://example.com/package.tgz');
  assert.deepEqual(Object.keys(item).sort(), ['id', 'generation', 'endpoint', 'target', 'requestId', 'startedAt', 'state'].sort());
  assert.doesNotMatch(JSON.stringify(item), /password|secret|payload|result/);
});

test('冷记录有一小时与64条上限，确认终态、未知入口和非法时间不恢复', () => {
  const now = Date.now(), recent = Array.from({ length: 70 }, (_, index) => ({ ...pending(index), startedAt: now - 70 + index }));
  const result = pluginOperationSummaries([...recent, { ...pending(), startedAt: now - 3600000 },
    { ...pending(), state: 'complete' }, { ...pending(), endpoint: 'other/write' },
    { ...pending(), startedAt: now + 1 }, { ...pending(), startedAt: NaN }], now);
  assert.equal(result.length, 64); assert.equal(result[0].id, 'operation-6'); assert.equal(result.at(-1).id, 'operation-69');
});

test('严格事务跨重新打开保留同绑定摘要，换设备/指纹隔离，移除绑定同时清理', async () => {
  const database = new IDBFactory(), open = binding => RemoteDraftStore.open(binding, database, null);
  const first = await open(draftBinding); await first.writePluginOperations([pending()]);
  await first.write('chat', '原草稿'); first.close();
  for (const binding of [{ ...draftBinding, deviceId: 'other' }, { ...draftBinding, fingerprint: 'other' }]) {
    const other = await open(binding); assert.deepEqual(other.readPluginOperations(), []); other.close();
  }
  const next = await open(draftBinding);
  assert.equal(next.readPluginOperations()[0].id, 'operation-0'); assert.equal(next.read('chat'), '原草稿');
  await next.clear(); next.close();
  const cleared = await open(draftBinding); assert.deepEqual(cleared.readPluginOperations(), []); assert.equal(cleared.read('chat'), ''); cleared.close();
});
