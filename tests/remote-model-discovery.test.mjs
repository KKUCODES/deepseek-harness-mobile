import test from 'node:test';
import assert from 'node:assert/strict';
import { RemoteProviderModelSettings } from '../src/remote-settings.mjs';

function fixture() {
  const calls = [], controller = new AbortController(), state = { generation: 1, connected: 'connected' };
  const view = () => ({ provider: 'alpha', snapshot: crypto.randomUUID(), revision: 0, writable: true, overridden: false, applies: 'live', rows: [] });
  state.respond = async operation => operation.method === 'remote.providerModelsDiscover' ? { provider: 'alpha', rows: [{ id: 'one' }] } : view();
  const model = { transport: { capabilities: { management: true, providerModels: true, providerModelDiscovery: true } }, lifetime: controller,
    connection: { generation: { getSnapshot: () => ({ id: state.generation }) }, state: { getSnapshot: () => state.connected } },
    client: { request(operation) { calls.push(operation); return { promise: state.respond(operation), cancel() {} }; } } };
  return { calls, state, model, service: new RemoteProviderModelSettings(model, 'alpha') };
}

test('读取候选不丢弃模型编辑快照，也不自动保存；旧插件和无授权不发请求', async () => {
  const f = fixture(), view = await f.service.read();
  assert.deepEqual(await f.service.discovery.read(), { provider: 'alpha', rows: [{ id: 'one' }] });
  assert.equal(f.service.view, view);
  assert.equal(f.calls.filter(x => x.method.endsWith('Write')).length, 0);
  await f.service.save(view, { op: 'set', rows: [{ id: 'one' }] });
  f.model.transport.capabilities.management = false;
  await assert.rejects(f.service.discovery.read(), /管理权限/);
  f.model.transport.capabilities.management = true; f.model.transport.capabilities.providerModelDiscovery = false;
  await assert.rejects(f.service.discovery.read(), /更新/);
  assert.equal(f.calls.length, 3);
});

test('候选响应跨提供方、换连接、撤权、取消和错误都不接纳', async () => {
  for (const change of [
    f => { f.state.generation++; }, f => { f.model.transport.capabilities.management = false; },
    f => { f.state.connected = 'disconnected'; },
  ]) {
    const f = fixture(); let finish;
    f.state.respond = () => new Promise(resolve => { finish = resolve; });
    const pending = f.service.discovery.read(); change(f); finish({ provider: 'alpha', rows: [] });
    await assert.rejects(pending);
  }
  const f = fixture(); f.state.respond = async () => ({ provider: 'beta', rows: [] });
  await assert.rejects(f.service.discovery.read());
  f.state.respond = async () => { throw Error('remote_model_discovery_failed'); };
  await assert.rejects(f.service.discovery.read(), /手动添加/);
  let finish; f.state.respond = () => new Promise(resolve => { finish = resolve; });
  const controller = new AbortController(), pending = f.service.discovery.read(controller.signal);
  controller.abort(); finish({ provider: 'alpha', rows: [] }); await assert.rejects(pending);
});
