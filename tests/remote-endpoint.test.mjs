import test from 'node:test';
import assert from 'node:assert/strict';
import { RemoteComputerEndpoint } from '../src/remote-endpoint.mjs';

function fixture() {
  const state = { generation: 1, reply: { snapshot: crypto.randomUUID(), revision: 0, writable: true, applies: 'live', protocol: 'messages', origin: 'https://example.invalid', inheritedOrigin: 'https://api.deepseek.com', customPath: true, overridden: true } };
  const calls = [], capabilities = { computerEndpoint: true, management: true };
  const model = { transport: { capabilities }, lifetime: new AbortController(), connection: { generation: { getSnapshot: () => ({ id: state.generation }) }, state: { getSnapshot: () => 'connected' } },
    client: { request(operation) { calls.push(operation); return { promise: Promise.resolve(state.reply), cancel() {} }; } } };
  return { state, calls, model, endpoint: new RemoteComputerEndpoint(model) };
}

test('网页搜索地址读写绑定固定目标，拒绝混用聊天模型响应', async () => {
  const f = fixture(); f.model.transport.capabilities.webSearchSettings = true;
  f.state.reply.target = 'web-search-deepseek';
  const endpoint = new RemoteComputerEndpoint(f.model, 'web-search-deepseek');
  const view = await endpoint.read(); await endpoint.save(view, { op: 'unset' });
  assert.deepEqual(f.calls[0], { method: 'remote.endpointRead', target: 'web-search-deepseek' });
  assert.equal(f.calls[1].target, 'web-search-deepseek');
  await assert.rejects(f.endpoint.read());
  delete f.state.reply.target; await assert.rejects(endpoint.read());
  assert.throws(() => new RemoteComputerEndpoint(f.model, 'arbitrary-service'));
});
test('提供方地址绑定路由且允许目录默认地址；其他路由与普通地址响应拒绝', async () => {
  const f = fixture(); f.model.transport.capabilities.providerEndpoint = true;
  f.state.reply = { ...f.state.reply, target: { provider: 'alpha' }, protocol: 'provider', origin: null, inheritedOrigin: null };
  const endpoint = new RemoteComputerEndpoint(f.model, { provider: 'alpha' });
  const view = await endpoint.read(); await endpoint.save(view, { op: 'set', value: 'https://gateway.invalid/v1' });
  assert.deepEqual(f.calls[0], { method: 'remote.endpointRead', target: { provider: 'alpha' } });
  assert.deepEqual(f.calls[1].target, { provider: 'alpha' });
  await assert.rejects(f.endpoint.read());
  f.state.reply.target = { provider: 'beta' }; await assert.rejects(endpoint.read());
  assert.throws(() => new RemoteComputerEndpoint(f.model, { provider: '__proto__' }));
});
test('真实读取视图、管理授权、快照/版本写入；不猜测完整旧URL', async () => {
  const f = fixture(); f.model.transport.capabilities.management = false;
  await assert.rejects(f.endpoint.read(), /管理权限/); assert.equal(f.calls.length, 0);
  f.model.transport.capabilities.management = true; const view = await f.endpoint.read();
  await assert.rejects(f.endpoint.save(view, { op: 'set', value: 'https://user:pass@example.invalid' }), /不含账号/);
  await f.endpoint.save(view, { op: 'set', value: 'http://127.0.0.1:1234/anthropic' });
  assert.deepEqual(f.calls[1], { method: 'remote.endpointWrite', snapshot: view.snapshot, expectedRevision: 0, confirmed: true, change: { op: 'set', value: 'http://127.0.0.1:1234/anthropic' } });
});
test('旧连接、超时及未知结果不自动重试；返回额外秘密拒绝', async () => {
  const f = fixture(); const view = await f.endpoint.read(); f.state.generation++;
  await assert.rejects(f.endpoint.save(view, { op: 'unset' }), /重新读取/);
  const fresh = await f.endpoint.read();
  f.model.client.request = () => ({ promise: Promise.reject(new Error('TEST_PRIVATE')), cancel() {} });
  await assert.rejects(f.endpoint.save(fresh, { op: 'unset' }), /尚未确认/);
  await assert.rejects(f.endpoint.save(fresh, { op: 'unset' }), /尚未确认/);
  assert.equal(f.endpoint.busy, false);
  const g = fixture(); g.state.reply.secret = 'TEST_PRIVATE'; await assert.rejects(g.endpoint.read(), error => !error.message.includes('TEST_PRIVATE'));
});

test('保存已发出后权限变化或取消，迟到响应不能重建可编辑视图', async () => {
  const f = fixture(); const view = await f.endpoint.read(); let finish;
  f.model.client.request = () => ({ promise: new Promise(resolve => { finish = resolve; }), cancel() {} });
  const pending = f.endpoint.save(view, { op: 'unset' });
  f.model.transport.capabilities.management = false; finish(f.state.reply);
  await assert.rejects(pending, /尚未确认/);
  assert.equal(f.endpoint.view, null); assert.equal(f.endpoint.busy, false);
  f.model.transport.capabilities.management = true;
  await assert.rejects(f.endpoint.save(view, { op: 'unset' }), /尚未确认/);
});
