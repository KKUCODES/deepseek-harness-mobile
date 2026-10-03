import test from 'node:test';
import assert from 'node:assert/strict';
import { RemoteProviderSettings } from '../src/remote-settings.mjs';

const result = provider => ({ provider, snapshot: crypto.randomUUID(), revision: 1, writable: true, applies: 'live',
  fields: Object.entries({ displayName: 'Alpha', defaultContextWindow: 262144, defaultMaxTokens: 32768, timeoutMs: 1000,
    streamIdleTimeoutMs: 300000, cacheRetention: 'short', transport: 'auto' }).map(([key, value]) => ({ key, value, overridden: false })) });
function fixture() {
  const state = { generation: 1, connected: 'connected', respond: async operation => operation.method === 'remote.providerSettingsList'
    ? { providers: [{ provider: 'alpha', name: 'Alpha' }] } : result(operation.provider) }, calls = [];
  const model = { transport: { capabilities: { management: true, providerSettings: true } }, lifetime: new AbortController(),
    connection: { generation: { getSnapshot: () => ({ id: state.generation }) }, state: { getSnapshot: () => state.connected } },
    client: { request(operation) { calls.push(operation); return { promise: state.respond(operation), cancel() {} }; } } };
  return { state, model, calls, directory: new RemoteProviderSettings(model) };
}
const edits = [{ op: 'set', key: 'timeoutMs', value: 2000 }];

test('协议更改只使用电脑声明的选项和明确确认，旧端或内置路由不发送', async () => {
  const f = fixture(), settings = f.directory.forProvider('alpha');
  const change = { edits: [], protocolChange: { value: 'anthropic-messages', confirmed: true } };
  await assert.rejects(settings.save(await settings.read(), change), /有效/);
  f.state.respond = async () => ({ ...result('alpha'), protocol: { value: 'openai-completions', choices: ['openai-completions', 'anthropic-messages'] } });
  const view = await settings.read(), count = f.calls.length;
  for (const protocolChange of [{ value: 'unknown', confirmed: true }, { value: 'anthropic-messages', confirmed: false }])
    await assert.rejects(settings.save(view, { edits: [], protocolChange }), /有效/);
  assert.equal(f.calls.length, count);
  await settings.save(view, change);
  assert.deepEqual(f.calls.at(-1).protocolChange, change.protocolChange);
});

test('启用Key仅提交固定确认，遵守能力/配置状态并与设置共用未知结果保护', async () => {
  const f = fixture(), settings = f.directory.forProvider('alpha');
  f.state.respond = async operation => ({ ...result(operation.provider), keySetupAvailable: operation.method !== 'remote.providerKeySetup' });
  let view = await settings.read();
  await assert.rejects(settings.prepareKey(view), /有效/);
  f.model.transport.capabilities.providerKeySetup = true;
  assert.equal(settings.writeOperation(view, { setupKey: true, ref: 'TEST_SECRET' }).success, false);
  const next = await settings.prepareKey(view);
  assert.equal(next.keySetupAvailable, false);
  assert.deepEqual(f.calls.at(-1), { method: 'remote.providerKeySetup', provider: 'alpha', snapshot: view.snapshot, expectedRevision: 1, confirmed: true });
  await assert.rejects(settings.prepareKey(next), /有效/);
  view = await settings.read(); f.state.respond = async () => { throw Error('private failure'); };
  await assert.rejects(settings.prepareKey(view), /尚未确认/);
  f.state.respond = async operation => ({ ...result(operation.provider), keySetupAvailable: true });
  await assert.rejects(settings.prepareKey(await settings.read()), /尚未确认/);
  await assert.rejects(settings.save(await settings.read(), edits), /尚未确认/);
  f.state.generation++;
  await assert.rejects(settings.prepareKey(await settings.read()), /尚未确认/); // 未确认已建立引用的响应不可算成功。
  assert.equal(settings.view, null);
});
test('提供方兼容配置只在电脑支持时提交，继承和非法模板保持区别', async () => {
  const f = fixture(), settings = f.directory.forProvider('alpha');
  let view = await settings.read();
  await assert.rejects(settings.save(view, { edits: [], compat: {} }), /有效/);
  f.state.respond = async operation => ({ ...result(operation.provider), compat: { effective: { supportsStore: true }, overrides: {} } });
  view = await settings.read();
  const before = f.calls.length;
  await assert.rejects(settings.save(view, { edits: [], compat: { chatTemplateKwargs: { x: { $var: 'secret' } } } }), /有效/);
  assert.equal(f.calls.length, before);
  await settings.save(view, { edits: [], compat: { supportsStore: false } });
  assert.deepEqual(f.calls.at(-1).compat, { supportsStore: false });
  await settings.save(await settings.read(), { edits: [], compat: {} });
  assert.deepEqual(f.calls.at(-1).compat, {});
});
test('管理授权/能力检查，路由隔离与仅发送修改字段', async () => {
  const f = fixture(); f.model.transport.capabilities.management = false;
  await assert.rejects(f.directory.read(), /管理权限/);
  f.model.transport.capabilities.management = true; f.model.transport.capabilities.providerSettings = false;
  await assert.rejects(f.directory.read(), /更新/); assert.equal(f.calls.length, 0);
  f.model.transport.capabilities.providerSettings = true;
  assert.equal((await f.directory.read()).providers[0].provider, 'alpha');
  const alpha = f.directory.forProvider('alpha'), beta = f.directory.forProvider('beta'), view = await alpha.read();
  await assert.rejects(beta.save(view, edits), /重新读取/);
  await alpha.save(view, edits);
  assert.deepEqual(f.calls.at(-1), { method: 'remote.providerSettingsWrite', provider: 'alpha', snapshot: view.snapshot, expectedRevision: 1, edits });
});
test('切换提供方不能解锁未知写入；重连后核对重读才能再次保存', async () => {
  const f = fixture(), settings = f.directory.forProvider('alpha'), view = await settings.read();
  f.state.respond = async () => { throw Error('TEST_SECRET'); };
  await assert.rejects(settings.save(view, edits), /尚未确认/);
  f.state.respond = async operation => result(operation.provider);
  assert.equal(f.directory.forProvider('alpha'), settings);
  await assert.rejects(settings.save(await settings.read(), edits), /尚未确认/);
  assert.equal(f.calls.filter(call => call.method.endsWith('Write')).length, 1);
  f.state.generation++; await settings.save(await settings.read(), edits);
});
test('错误路由/夹带配置及断线迟到响应拒绝进入表单', async () => {
  const f = fixture(), settings = f.directory.forProvider('alpha');
  f.state.respond = async () => result('beta'); await assert.rejects(settings.read(), /无效/);
  f.state.respond = async () => ({ ...result('alpha'), headers: 'TEST_SECRET' }); await assert.rejects(settings.read(), /无效/);
  f.state.respond = async () => { f.state.generation++; return result('alpha'); };
  await assert.rejects(settings.read(), /重新读取/); assert.equal(settings.view, null);
  let resolve;
  f.state.respond = () => new Promise(done => { resolve = done; });
  const controller = new AbortController(), pending = settings.read(controller.signal);
  controller.abort(); resolve(result('alpha')); await assert.rejects(pending);
  assert.equal(settings.view, null);
});
