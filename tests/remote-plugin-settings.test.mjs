import test from 'node:test';
import assert from 'node:assert/strict';
import { RemotePluginSettingsScope } from '../src/remote-plugin-settings.mjs';
import { RemoteComputerSettings } from '../src/remote-settings.mjs';

function fixture() {
  const calls = [], listeners = new Map(), generations = new Set();
  const state = { generation: 1, connected: 'connected', fail: false, override: undefined, revision: 0 };
  const view = () => ({ namespace: 'shell', snapshot: crypto.randomUUID(), revision: state.revision, writable: true, applies: 'live', fields: [
    { key: 'timeoutMs', value: state.override ?? 120000, base: 120000, ...(state.override === undefined ? {} : { user: state.override }), overridden: state.override !== undefined },
    { key: 'maxOutputBytes', value: 64000, base: 64000, overridden: false },
  ] });
  const model = { transport: { capabilities: { management: true, pluginSettings: true } }, lifetime: new AbortController(),
    remote: { $on: (event, cb) => { listeners.set(event, cb); return () => listeners.delete(event); } },
    connection: { state: { getSnapshot: () => state.connected }, generation: { getSnapshot: () => ({ id: state.generation }), subscribe: cb => { generations.add(cb); return () => generations.delete(cb); } } },
    client: { request(operation) { calls.push(operation); return { cancel() {}, promise: Promise.resolve().then(() => {
      if (state.fail) throw new Error('PRIVATE');
      if (operation.method === 'remote.settingsWrite') { state.override = operation.edits[0].op === 'set' ? operation.edits[0].value : undefined; state.revision++; }
      return view();
    }) }; } },
  };
  return { model, calls, state, listeners, generations, view };
}

test('原表单 scope 读取实际继承层、逐字段保存并恢复默认', async () => {
  const f = fixture(), scope = new RemotePluginSettingsScope(f.model, 'shell');
  await scope.load();
  assert.deepEqual(scope.getSnapshot().base, { timeoutMs: 120000, maxOutputBytes: 64000 });
  await scope.set('timeoutMs', 120001);
  assert.equal(scope.getSnapshot().user.timeoutMs, 120001);
  await scope.unset('timeoutMs');
  assert.equal(scope.getSnapshot().value.timeoutMs, 120000);
  assert.equal(Object.hasOwn(scope.getSnapshot().user, 'timeoutMs'), false);
  assert.equal(f.calls.every(call => call.namespace === 'shell'), true);
  scope.dispose(); assert.equal(f.listeners.size, 0); assert.equal(f.generations.size, 0);
});

test('电脑变更使旧表单不可写；错误保留旧层供原表单显示失败，未知结果不重发', async () => {
  const f = fixture(), scope = new RemotePluginSettingsScope(f.model, 'shell');
  await scope.load(); f.listeners.get('settings/document-updated')('shell');
  await scope.set('timeoutMs', 150000); assert.equal(f.calls.length, 1);
  await scope.load(); await scope.set('timeoutMs', 120001);
  f.state.fail = true; await scope.unset('timeoutMs');
  assert.equal(scope.getSnapshot().user.timeoutMs, 120001);
  assert.equal(scope.getSnapshot().writable, false);
  assert.doesNotMatch(scope.getSnapshot().error, /PRIVATE/);
  f.state.fail = false; await scope.load(); await scope.unset('timeoutMs');
  assert.equal(f.calls.filter(call => call.method === 'remote.settingsWrite').length, 2);
  scope.dispose();
});

test('插件专用能力、namespace 与返回投影必须相符', async () => {
  const f = fixture(), settings = new RemoteComputerSettings(f.model, 'agent-loop');
  await assert.rejects(settings.read(), /无效/);
  f.model.transport.capabilities.pluginSettings = false;
  await assert.rejects(settings.read(), /更新/);
  assert.equal(f.calls.length, 1);
  assert.throws(() => new RemoteComputerSettings(f.model, 'credentials'));
});

test('模型 scope 原子提交精确路由，保留草稿版本，拒绝嵌套路径与旧电脑能力', async () => {
  const f = fixture(), namespace = 'subagent-model-selection';
  let value = { enabled: false, allowedModels: [] }, revision = 3;
  f.model.transport.capabilities.subagentSettings = true;
  f.model.client.request = operation => {
    f.calls.push(operation);
    return { cancel() {}, promise: Promise.resolve().then(() => {
      if (operation.method === 'remote.settingsWrite') {
        assert.equal(operation.expectedRevision, revision);
        assert.equal(operation.edits.length, 2);
        for (const edit of operation.edits) value[edit.key] = edit.value;
        revision++;
      }
      return { namespace, snapshot: crypto.randomUUID(), revision, writable: true, applies: 'live',
        fields: Object.entries(value).map(([key, field]) => ({ key, value: field, user: field, overridden: true })) };
    }) };
  };
  const scope = new RemotePluginSettingsScope(f.model, namespace);
  await scope.load();
  const operations = [{ op: 'set', path: ['enabled'], value: true },
    { op: 'set', path: ['allowedModels'], value: [{ provider: 'deepseek', model: 'deepseek-chat' }] }];
  await scope.mutate(operations, 3);
  assert.deepEqual(scope.getSnapshot().value, value);
  assert.equal(f.calls.length, 2);
  await scope.mutate(operations, 3); // 新快照不能给旧草稿绕过 revision。
  assert.equal(f.calls.length, 2); assert.equal(scope.getSnapshot().writable, false);
  await scope.load();
  await scope.mutate([{ op: 'set', path: ['allowedModels', '0'], value: 'secret' }], revision);
  assert.equal(f.calls.length, 3); assert.equal(scope.getSnapshot().writable, false);
  f.model.transport.capabilities.subagentSettings = false;
  await scope.load(); assert.equal(f.calls.length, 3);
  scope.dispose();
});
