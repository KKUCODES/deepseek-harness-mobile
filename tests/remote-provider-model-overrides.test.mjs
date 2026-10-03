import test from 'node:test';
import assert from 'node:assert/strict';
import { RemoteProviderSettings } from '../src/remote-settings.mjs';

function fixture() {
  const calls = [], state = { generation: 1, fail: false, wrongScope: false };
  const model = { transport: { capabilities: { management: true, providerModels: true, providerModelOverrides: true } }, lifetime: new AbortController(),
    connection: { generation: { getSnapshot: () => ({ id: state.generation }) }, state: { getSnapshot: () => 'connected' } },
    client: { request(operation) { calls.push(operation); return { cancel() {}, promise: state.fail ? Promise.reject(Error('failure')) : Promise.resolve({
      provider: 'alpha', snapshot: crypto.randomUUID(), revision: 1, writable: true, applies: 'live', overridden: true, rows: [],
      ...(!state.wrongScope && operation.scope ? { scope: operation.scope, blockedByModels: false } : {}),
    }) }; } } };
  return { calls, state, model, settings: new RemoteProviderSettings(model).forProvider('alpha') };
}
test('覆盖需要独立能力，清单与覆盖回执/快照不能混用', async () => {
  const f = fixture(), service = f.settings.overrides;
  f.model.transport.capabilities.providerModelOverrides = false;
  await assert.rejects(service.read(), /更新/); assert.equal(f.calls.length, 0);
  f.model.transport.capabilities.providerModelOverrides = true;
  const view = await service.read();
  assert.equal(f.calls.at(-1).scope, 'overrides');
  await assert.rejects(f.settings.models.save(view, { op: 'unset' }), /重新读取/);
  await service.save(view, { op: 'set', rows: [{ id: 'catalog-model', name: 'Changed' }] });
  assert.equal(f.calls.at(-1).scope, 'overrides');
  f.state.wrongScope = true;
  await assert.rejects(service.read(), /无效/);
});
test('覆盖写入结果未知后切回同一提供方仍锁定，重连核对后才可再写', async () => {
  const f = fixture(), service = f.settings.overrides, view = await service.read();
  f.state.fail = true; await assert.rejects(service.save(view, { op: 'unset' }), /尚未确认/);
  f.state.fail = false; await assert.rejects(service.save(await service.read(), { op: 'unset' }), /尚未确认/);
  f.state.generation++; await service.save(await service.read(), { op: 'unset' });
  assert.equal(f.calls.filter(call => call.method.endsWith('Write')).length, 2);
});
