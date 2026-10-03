import test from 'node:test';
import assert from 'node:assert/strict';
import { RemoteDeepSeekModels } from '../src/remote-settings.mjs';

function fixture() {
  const view = () => ({ provider: 'deepseek', snapshot: crypto.randomUUID(), revision: 0, writable: true, applies: 'live',
    overridden: false, advancedEditable: true, compatEditable: false, rows: [{ source: crypto.randomUUID(), id: 'one', advanced: { input: ['text'] } }] });
  const calls = [], state = { generation: 1, respond: async () => view() };
  const model = { transport: { capabilities: { management: true, deepSeekModels: true } }, lifetime: new AbortController(),
    connection: { generation: { getSnapshot: () => ({ id: state.generation }) }, state: { getSnapshot: () => 'connected' } },
    client: { request(operation) { calls.push(operation); return { promise: state.respond(operation), cancel() {} }; } } };
  return { model, calls, state, view, service: new RemoteDeepSeekModels(model) };
}
test('官方模型使用固定读写操作，不借用pi-ai同名路由；管理和版本能力必需', async () => {
  const f = fixture(); f.model.transport.capabilities.management = false;
  await assert.rejects(f.service.read(), /管理权限/);
  f.model.transport.capabilities.management = true; f.model.transport.capabilities.deepSeekModels = false;
  await assert.rejects(f.service.read(), /更新/); assert.equal(f.calls.length, 0);
  f.model.transport.capabilities.deepSeekModels = true;
  const view = await f.service.read(); assert.deepEqual(f.calls[0], { method: 'remote.deepSeekModelsRead' });
  await f.service.save(view, { op: 'set', rows: [{ id: ' new ', advanced: { input: ['image'] } }] });
  assert.equal(f.calls[1].method, 'remote.deepSeekModelsWrite'); assert.equal(f.calls[1].provider, undefined);
  assert.equal(f.calls[1].change.rows[0].id, 'new');
});
test('错误目标/思考兼容响应拒绝，未知写入不能通过重新读绕过', async () => {
  const f = fixture();
  for (const bad of [{ ...f.view(), provider: 'other' }, { ...f.view(), compatEditable: true },
    { ...f.view(), rows: [{ ...f.view().rows[0], advanced: { reasoningEfforts: false } }] }]) {
    f.state.respond = async () => bad; await assert.rejects(f.service.read(), /设置值无效/);
  }
  f.state.respond = async () => f.view(); const view = await f.service.read();
  f.state.respond = async () => { throw Error('private'); };
  await assert.rejects(f.service.save(view, { op: 'unset' }), /尚未确认/);
  f.state.respond = async () => f.view();
  await assert.rejects(f.service.save(await f.service.read(), { op: 'unset' }), /尚未确认/);
})
