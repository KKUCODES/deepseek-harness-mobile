import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { build } from 'esbuild';
import { latestMobileBuild } from '../../scripts/latest-mobile-build.mjs';

const root = resolve(import.meta.dirname, '../..'), latest = latestMobileBuild(root);
const output = resolve(root, 'artifacts/tests/latest-coding-tools.cjs');
await build({ absWorkingDir: root, entryPoints: ['src/remote-coding-tools.mjs'], outfile: output,
  bundle: true, platform: 'node', format: 'cjs', plugins: [latest.resolver], alias: latest.alias, logLevel: 'silent' });
const { RemoteCodingTools } = createRequire(import.meta.url)(output);

function fixture(management = true) {
  const events = new Set(), generations = new Set(), calls = [];
  let generation = { id: 1 }, enabled = true, selectedDefault = 'ptc';
  const model = { lifetime: new AbortController(),
    connection: { state: { getSnapshot: () => 'connected' }, generation: { getSnapshot: () => generation,
      subscribe(fn) { generations.add(fn); return () => generations.delete(fn); } } },
    transport: { capabilities: { management, codingToolsSettings: true, presetDefaultSettings: true } },
    remote: { $on(_name, fn) { events.add(fn); return () => events.delete(fn); }, agentPresets: {
      async list() { return { ok: true, value: { presets: [{ id: 'ptc', isDefault: selectedDefault === 'ptc' }, { id: 'standard', isDefault: selectedDefault === 'standard' }] } }; },
    } }, client: { request(operation) {
      calls.push(operation);
      return { promise: Promise.resolve().then(() => {
        if (operation.method === 'remote.codingToolsRead') return { enabled, documentId: 'actual-tools' };
        if (operation.method === 'remote.settingsWrite') for (const edit of operation.edits) {
          if (edit.key === 'selectedDefault') selectedDefault = edit.value;
          else enabled = edit.op === 'unset' ? true : edit.value;
        }
        const key = operation.namespace === 'ui-settings' ? 'enabled' : 'selectedDefault';
        return { snapshot: randomUUID(), namespace: operation.namespace, revision: calls.length, documentId: 'actual-tools', writable: true, applies: 'live',
          fields: [{ key, value: key === 'enabled' ? enabled : selectedDefault, overridden: false }] };
      }), cancel() {} };
    } } };
  const scope = new RemoteCodingTools(model);
  return { model, scope, calls, change(value) { enabled = value; for (const fn of events) fn('actual-tools'); },
    reconnect() { generation = { id: generation.id + 1 }; for (const fn of generations) fn(); },
    get enabled() { return enabled; }, get defaultId() { return selectedDefault; } };
}

test('聊天权限仅读取固定偏好，电脑事件自动更新；自定义同名模式不误隐藏', async () => {
  const f = fixture(false);
  try {
    await f.scope.load();
    assert.equal(f.scope.getSnapshot().writable, false);
    assert.equal(await f.scope.set('enabled', false), false);
    assert.deepEqual(f.calls, [{ method: 'remote.codingToolsRead' }]);
    f.change(false); await f.scope.load();
    assert.equal(f.scope.allows({ id: 'ptc' }), false);
    assert.equal(f.scope.allows({ id: 'minimal' }), false);
    assert.equal(f.scope.allows({ id: 'ptc', name: 'My custom PTC' }), true);
    assert.equal(f.scope.allows({ id: 'standard' }), true);
  } finally { f.scope.dispose(); }
});

test('关闭先恢复健康内置默认，固定快照写入；恢复继承不猜测旧值', async () => {
  const f = fixture();
  try {
    await f.scope.load();
    assert.equal(await f.scope.set('enabled', false), true);
    assert.equal(f.defaultId, 'standard'); assert.equal(f.enabled, false);
    const writes = f.calls.filter(call => call.method === 'remote.settingsWrite');
    assert.deepEqual(writes.map(call => [call.namespace, call.edits]), [
      ['agent-preset-registry', [{ op: 'set', key: 'selectedDefault', value: 'standard' }]],
      ['ui-settings', [{ op: 'set', key: 'enabled', value: false }]],
    ]);
    assert.equal(await f.scope.unset('enabled'), true);
    assert.equal(f.enabled, true);
    assert.equal(await f.scope.set('other', true), false);
    assert.equal(await f.scope.set('enabled', 'false'), false);
  } finally { f.scope.dispose(); }
});

test('销毁或重连丢弃迟到偏好；写入未知结果锁住并且不自动重放', async () => {
  for (const dispose of [false, true]) {
    const f = fixture();
    try {
      let finish;
      const request = f.model.client.request;
      f.model.client.request = operation => ({ promise: new Promise(done => { finish = done; }), cancel() {} });
      const loading = f.scope.load();
      if (dispose) f.scope.dispose(); else { f.model.client.request = request; f.reconnect(); }
      finish({ enabled: false, documentId: 'old-tools' }); await loading;
      assert.equal(f.scope.getSnapshot().value?.enabled, dispose ? undefined : true);
    } finally { f.scope.dispose(); }
  }
  const f = fixture();
  try {
    await f.scope.load();
    const request = f.model.client.request;
    f.model.client.request = operation => operation.method === 'remote.settingsWrite'
      ? { promise: Promise.reject(Error('connection lost')), cancel() {} } : request(operation);
    assert.equal(await f.scope.set('enabled', true), false);
    assert.equal(f.scope.getSnapshot().writable, false);
    const count = f.calls.length;
    assert.equal(await f.scope.set('enabled', true), false);
    assert.equal(f.calls.length, count);
  } finally { f.scope.dispose(); }
});
