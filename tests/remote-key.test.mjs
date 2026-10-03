import test from 'node:test';
import assert from 'node:assert/strict';
import { RemoteComputerKey } from '../src/remote-key.mjs';

function fixture() {
  const state = { generation: 1, reply: { snapshot: crypto.randomUUID(), provider: 'deepseek-official', configured: true, writable: true } };
  const calls = [], capabilities = { computerKey: true, management: true };
  const model = { transport: { capabilities }, lifetime: new AbortController(),
    connection: { generation: { getSnapshot: () => ({ id: state.generation }) }, state: { getSnapshot: () => 'connected' } },
    client: { request(operation) { calls.push(operation); return { promise: Promise.resolve(state.reply), cancel() {} }; },
      async call(op, data) { calls.push({ op, data }); return { cancelled: true }; } } };
  return { state, calls, model, key: new RemoteComputerKey(model) };
}

test('网页搜索 Key 固定目标隔离，原生交接只含快照与目标', async () => {
  const f = fixture(); f.model.transport.capabilities.webSearchSettings = true;
  f.state.reply.provider = 'deepseek-search';
  const key = new RemoteComputerKey(f.model, 'web-search-deepseek');
  const view = await key.read(); await key.configure();
  assert.deepEqual(f.calls, [{ method: 'remote.keyRead', target: 'web-search-deepseek' },
    { op: 'computerKey.configure', data: { snapshot: view.snapshot, target: 'web-search-deepseek' } }]);
  await assert.rejects(f.key.read());
  f.state.reply.provider = 'deepseek-official'; await assert.rejects(key.read());
  assert.throws(() => new RemoteComputerKey(f.model, 'arbitrary-secret'));
});

test('其他提供方Key严格匹配对象目标，原生交接不包含Key或引用名称', async () => {
  const f = fixture(), target = { provider: 'alpha' };
  f.model.transport.capabilities.providerKey = true;
  f.state.reply = { ...f.state.reply, provider: 'alpha', target };
  const key = new RemoteComputerKey(f.model, target);
  const view = await key.read(); await key.configure();
  assert.deepEqual(f.calls, [{ method: 'remote.keyRead', target }, { op: 'computerKey.configure', data: { snapshot: view.snapshot, target } }]);
  delete f.state.reply.target; await assert.rejects(key.read());
  f.state.reply.target = { provider: 'beta' }; await assert.rejects(key.read());
  f.state.reply.provider = 'beta'; await assert.rejects(key.read());
  assert.throws(() => new RemoteComputerKey(f.model, { provider: 'alpha', ref: 'SECRET' }));
  f.model.transport.capabilities.management = false;
  const before = f.calls.length; await assert.rejects(key.read(), /管理权限/); assert.equal(f.calls.length, before);
});
test('电脑 Key 只读状态与原生配置交接，页面不接收/提交秘密', async () => {
  const f = fixture(); f.model.transport.capabilities.management = false;
  await assert.rejects(f.key.read(), /管理权限/); assert.equal(f.calls.length, 0);
  f.model.transport.capabilities.management = true;
  const view = await f.key.read(); assert.equal(view.configured, true);
  assert.deepEqual(await f.key.configure(), { cancelled: true });
  assert.deepEqual(f.calls, [{ method: 'remote.keyRead' }, { op: 'computerKey.configure', data: { snapshot: view.snapshot } }]);
  assert.equal(f.key.view, null);
  await assert.rejects(f.key.configure(), /重新读取/);
});
test('拒绝未知字段、旧代次和只读状态；异常文本不回显', async () => {
  const f = fixture(); f.state.reply.secret = 'TEST_PRIVATE';
  await assert.rejects(f.key.read(), /无法读取/); delete f.state.reply.secret;
  await f.key.read(); f.state.generation++;
  await assert.rejects(f.key.configure(), /重新读取/);
  f.state.reply.writable = false; await f.key.read();
  await assert.rejects(f.key.configure(), /只读/);
  f.state.reply.writable = true; await f.key.read();
  f.model.client.call = async () => { throw new Error('TEST_PRIVATE'); };
  await assert.rejects(f.key.configure(), error => !error.message.includes('TEST_PRIVATE'));
  assert.equal(f.key.busy, false);
});
test('关闭页面取消原生窗口，迟到结果不恢复 Key 状态，并发不解锁正在进行的操作', async () => {
  const f = fixture(); await f.key.read(); const controller = new AbortController();
  let finish; const nativeCalls = [];
  f.model.client.call = (op) => { nativeCalls.push(op); return op === 'computerKey.cancel' ? Promise.resolve() : new Promise(resolve => { finish = resolve; }); };
  const pending = f.key.configure(controller.signal);
  await assert.rejects(f.key.read(), /稍候/); assert.equal(f.key.busy, true);
  controller.abort(); finish({ cancelled: true }); await assert.rejects(pending);
  assert.deepEqual(nativeCalls, ['computerKey.configure', 'computerKey.cancel']);
  assert.equal(f.key.view, null); assert.equal(f.key.busy, false);
});
