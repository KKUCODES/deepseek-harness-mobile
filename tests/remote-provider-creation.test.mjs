import test from 'node:test';
import assert from 'node:assert/strict';
import { RemoteProviderSettings } from '../src/remote-settings.mjs';
const draft = { kind: 'custom', provider: 'my-service', name: '', useKey: true, api: 'openai-completions', baseURL: 'https://example.invalid', models: ['a'] };
function fixture() {
  const view = { snapshot: crypto.randomUUID(), revision: 1, writable: true, applies: 'live', keyAvailable: true,
    protocols: ['openai-completions'], available: [{ provider: 'openai', name: 'OpenAI' }], taken: ['openai'] };
  const calls = [], state = { generation: 1, respond: async operation => operation.method.endsWith('Write')
    ? { ...view, writable: false, created: { provider: operation.provider, useKey: operation.useKey } } : view };
  const model = { transport: { capabilities: { management: true, providerCreation: true } }, lifetime: new AbortController(),
    connection: { generation: { getSnapshot: () => ({ id: state.generation }) }, state: { getSnapshot: () => 'connected' } },
    client: { request(operation) { calls.push(operation); return { promise: state.respond(operation), cancel() {} }; } } };
  const directory = new RemoteProviderSettings(model);
  return { model, directory, service: directory.creation, state, view, calls };
}
test('创建需要授权/能力/当前目录，确认仅发送固定配置，不接收Key内容', async () => {
  const f = fixture(); f.model.transport.capabilities.management = false;
  await assert.rejects(f.service.read(), /管理权限/); f.model.transport.capabilities.management = true;
  f.model.transport.capabilities.providerCreation = false; await assert.rejects(f.service.read(), /更新/);
  assert.equal(f.calls.length, 0); f.model.transport.capabilities.providerCreation = true;
  const view = await f.service.read();
  for (const change of [{ provider: 'openai' }, { api: 'unknown' }, { models: ['a','a'] }, { apiKey: 'SECRET' }])
    await assert.rejects(f.service.save(view, { ...draft, ...change }), /有效/);
  const created = await f.service.save(view, draft); assert.equal(created.created.provider, 'my-service');
  assert.deepEqual(f.calls.at(-1), { ...draft, method: 'remote.providerCreationWrite', snapshot: view.snapshot, expectedRevision: 1, confirmed: true });
});
test('结构化模型要求电脑协商能力，不降级丢字段；旧ID数组继续可用', async () => {
  const f = fixture(), view = await f.service.read();
  const models = [{ id: 'a', name: 'Model A', contextWindow: 128000, maxTokens: 8000, input: ['text', 'image'] }];
  await assert.rejects(f.service.save(view, { ...draft, models }), /有效/);
  assert.equal(f.calls.filter(call => call.method.endsWith('Write')).length, 0);
  f.model.transport.capabilities.providerCreationModelRows = true;
  await f.service.save(view, { ...draft, models });
  assert.deepEqual(f.calls.at(-1).models, models);
});

test('结果身份不符或未知提交不能重复创建，重读不会解除当前代次的限制', async () => {
  const f = fixture(), view = await f.service.read();
  f.state.respond = async () => ({ ...f.view, created: { provider: 'wrong', useKey: true } });
  await assert.rejects(f.service.save(view, draft), /尚未确认/);
  f.state.respond = async () => f.view;
  await assert.rejects(f.service.save(await f.service.read(), draft), /尚未确认/);
  assert.equal(f.calls.filter(call => call.method.endsWith('Write')).length, 1);
});
test('目录读取和确认绑定当前连接，取消/迟到结果不显示创建成功', async () => {
  const f = fixture(); f.state.respond = async () => { f.state.generation++; return f.view; };
  await assert.rejects(f.service.read(), /重新读取/);
  f.state.respond = async () => ({ ...f.view, created: { provider: 'fake', useKey: false } });
  await assert.rejects(f.service.read(), /无效/);
  assert.equal(f.service.view, null);
  let release; f.state.respond = () => new Promise(resolve => { release = resolve; });
  const controller = new AbortController(), pending = f.service.read(controller.signal);
  controller.abort(); release(f.view); await assert.rejects(pending);
  assert.equal(f.service.view, null);
});
