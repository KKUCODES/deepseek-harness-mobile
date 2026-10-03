import test from 'node:test';
import assert from 'node:assert/strict';
import { RemoteComputerSettings } from '../src/remote-settings.mjs';

const result = () => ({ snapshot: crypto.randomUUID(), namespace: 'llm-deepseek', revision: 2, writable: true, applies: 'live',
  fields: Object.entries({ thinking: 'enabled', reasoningEffort: 'high', maxTokens: 1024, defaultContextWindow: 4096, streamIdleTimeoutMs: 30000 })
    .map(([key, value]) => ({ key, value, overridden: false })) });
function fixture() {
  const calls = [], state = { generation: 1, connected: 'connected', respond: async () => result(), cancelled: 0 };
  const model = { transport: { capabilities: { management: true, computerSettings: true } }, lifetime: new AbortController(),
    connection: { generation: { getSnapshot: () => ({ id: state.generation }) }, state: { getSnapshot: () => state.connected } },
    client: { request(operation) { calls.push(operation); let cancel;
      return { promise: Promise.race([state.respond(operation), new Promise(resolve => { cancel = resolve; })]),
        cancel() { state.cancelled++; cancel(); } }; } } };
  return { model, calls, state, settings: new RemoteComputerSettings(model) };
}
const edits = [{ op: 'set', key: 'maxTokens', value: 2048 }];

test('设置读取要求管理授权和 Host 能力；保存沿用已读快照，只发送已编辑字段', async () => {
  const f = fixture(); f.model.transport.capabilities.management = false;
  await assert.rejects(f.settings.read(), /管理权限/);
  f.model.transport.capabilities.management = true; f.model.transport.capabilities.computerSettings = false;
  await assert.rejects(f.settings.read(), /更新/);
  assert.equal(f.calls.length, 0); f.model.transport.capabilities.computerSettings = true;
  const view = await f.settings.read();
  await f.settings.save(view, edits);
  assert.deepEqual(f.calls[1], { method: 'remote.settingsWrite', snapshot: view.snapshot, expectedRevision: 2, edits });
  await assert.rejects(f.settings.save(view, edits), /重新读取/);
});

test('不回显未知错误；失败保存不自动重发，重新读取也不能清除同连接的不确定状态', async () => {
  const f = fixture(), view = await f.settings.read();
  f.state.respond = async () => { throw new Error('TEST_PRIVATE_PROVIDER_ERROR'); };
  await assert.rejects(f.settings.save(view, edits), /保存结果尚未确认/);
  f.state.respond = async () => result();
  const newView = await f.settings.read();
  await assert.rejects(f.settings.save(newView, edits), /保存结果尚未确认/);
  assert.equal(f.calls.filter(call => call.method === 'remote.settingsWrite').length, 1);
  f.state.generation++;
  await f.settings.save(await f.settings.read(), edits);
});

test('原版本冲突必须重读；断线、在途换代和关闭不会误报保存成功', async () => {
  const f = fixture(); let view = await f.settings.read();
  f.state.respond = async () => { throw new Error('remote_settings_stale'); };
  await assert.rejects(f.settings.save(view, edits), /重新读取/);
  f.state.respond = async () => result(); view = await f.settings.read();
  f.state.respond = async () => { f.state.generation++; return result(); };
  await assert.rejects(f.settings.save(view, edits), /尚未确认/);
  f.state.connected = 'disconnected';
  await assert.rejects(f.settings.read(), /连接/);
  f.state.connected = 'connected'; f.state.respond = async () => result(); view = await f.settings.read();
  const controller = new AbortController(); let resolve;
  f.state.respond = () => new Promise(done => { resolve = done; });
  const pending = f.settings.save(view, edits, controller.signal);
  await assert.rejects(f.settings.save(view, edits), /稍候/);
  controller.abort(); resolve(result());
  await assert.rejects(pending, /尚未确认/);
  assert.equal(f.settings.view, null);
});

test('迟到读取不复活表单，畸形响应不会进入视图', async () => {
  const f = fixture(); let resolve;
  f.state.respond = () => new Promise(done => { resolve = done; });
  const controller = new AbortController(), pending = f.settings.read(controller.signal);
  controller.abort(); resolve(result());
  await assert.rejects(pending); assert.equal(f.settings.view, null);
  f.state.respond = async () => ({ ...result(), schema: 'TEST_PRIVATE' });
  await assert.rejects(f.settings.read(), /无效/);
  assert.equal(f.settings.view, null);
});
