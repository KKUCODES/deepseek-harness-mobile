import test from 'node:test';
import assert from 'node:assert/strict';
import { RemoteProviderSettings } from '../src/remote-settings.mjs';

function fixture() {
  const view = { provider: 'alpha', name: 'Alpha', snapshot: crypto.randomUUID(), revision: 1, writable: true,
    removable: true, removed: false, keepsCredential: true, applies: 'live' };
  const calls = [], state = { generation: 1, respond: async operation => ({ ...view,
    ...(operation.method.endsWith('Write') ? { removed: true, removable: false, writable: false } : {}) }) };
  const model = { transport: { capabilities: { management: true, providerRemoval: true } }, lifetime: new AbortController(),
    connection: { generation: { getSnapshot: () => ({ id: state.generation }) }, state: { getSnapshot: () => 'connected' } },
    client: { request(operation) { calls.push(operation); return { promise: state.respond(operation), cancel() {} }; } } };
  const directory = new RemoteProviderSettings(model), service = directory.forProvider('alpha').removal;
  return { model, directory, service, state, view, calls };
}

test('删除需管理授权和独立能力，只提交已确认快照及路由', async () => {
  const f = fixture(); f.model.transport.capabilities.management = false;
  await assert.rejects(f.service.read(), /管理权限/);
  f.model.transport.capabilities.management = true; f.model.transport.capabilities.providerRemoval = false;
  await assert.rejects(f.service.read(), /更新/); assert.equal(f.calls.length, 0);
  f.model.transport.capabilities.providerRemoval = true;
  const view = await f.service.read(); assert.equal((await f.service.save(view)).removed, true);
  assert.deepEqual(f.calls.at(-1), { method: 'remote.providerRemovalWrite', provider: 'alpha', snapshot: view.snapshot, expectedRevision: 1 });
});

test('未知删除结果切换表单后仍禁止重发，换代重读才解除；基础配置不提交', async () => {
  const f = fixture(), view = await f.service.read();
  f.state.respond = async () => { throw Error('private'); };
  await assert.rejects(f.service.save(view), /尚未确认/);
  assert.equal(f.directory.forProvider('alpha').removal, f.service);
  f.state.respond = async () => f.view;
  await assert.rejects(f.service.save(await f.service.read()), /尚未确认/);
  assert.equal(f.calls.filter(call => call.method.endsWith('Write')).length, 1);
  f.state.generation++; f.state.respond = async () => ({ ...f.view, removable: false });
  await assert.rejects(f.service.save(await f.service.read()), /有效/);
  assert.equal(f.calls.filter(call => call.method.endsWith('Write')).length, 1);
});

test('跨路由、断线迟到和取消结果不进入确认页', async () => {
  const f = fixture(); f.state.respond = async () => ({ ...f.view, provider: 'beta' });
  await assert.rejects(f.service.read(), /无效/);
  f.state.respond = async () => { f.state.generation++; return f.view; };
  await assert.rejects(f.service.read(), /重新读取/);
  let release; f.state.respond = () => new Promise(resolve => { release = resolve; });
  const controller = new AbortController(), pending = f.service.read(controller.signal);
  controller.abort(); release(f.view); await assert.rejects(pending);
  assert.equal(f.service.view, null);
});
