import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { build } from 'esbuild';
import { latestMobileBuild } from '../../scripts/latest-mobile-build.mjs';

const root = resolve(import.meta.dirname, '../..'), latest = latestMobileBuild(root);
const output = resolve(root, 'artifacts/tests/latest-preset-defaults.cjs');
await build({ absWorkingDir: root, entryPoints: ['src/remote-preset-defaults.mjs'], outfile: output,
  bundle: true, platform: 'node', format: 'cjs', plugins: [latest.resolver], alias: latest.alias, logLevel: 'silent' });
const { RemotePresetDefaults } = createRequire(import.meta.url)(output);

function fixture(management = true) {
  const events = new Map(), calls = [], selections = [], listeners = new Set();
  let state = { saving: false, error: null, rows: [{ id: 'standard', isDefault: true }, { id: 'cordis' }, { id: 'broken', broken: 'invalid' }] };
  const source = { getSnapshot: () => state, set(value) { state = value; for (const fn of listeners) fn(); },
    subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); } };
  const model = { lifetime: new AbortController(), snapshot: { selected: 'one', session: { blank: true } }, sessionView: { request: 1 },
    remote: { $on(name, fn) { events.set(name, fn); return () => events.delete(name); } },
    connection: { generation: { getSnapshot: () => ({ id: 1 }), subscribe: () => () => {} }, state: { getSnapshot: () => 'connected' } },
    transport: { capabilities: { management, presetDefaultSettings: true } },
    client: { async call(_, operation) {
      calls.push(operation);
      return { snapshot: randomUUID(), namespace: 'agent-preset-registry', documentId: 'actual-entry', revision: calls.length,
        writable: true, applies: 'live', fields: [{ key: 'selectedDefault', overridden: false }] };
    } },
    agentPresets: { async load() {}, async choose(id, session) { selections.push({ id, session }); } } };
  const defaults = new RemotePresetDefaults(model);
  model.client.request = operation => ({ promise: model.client.call(null, operation), cancel() {} });
  const face = defaults.bind({ hooks: { agentPresetSection: source }, async load() {}, view() {}, closeView() {} });
  return { defaults, face, model, calls, events, selections, source };
}

test('默认值保存带真实读回快照与版本，只同步仍在当前空白会话的选择', async () => {
  const f = fixture();
  try {
    await f.face.load();
    await f.face.makeDefault('cordis');
    assert.equal(f.calls.length, 2);
    assert.equal(f.calls[1].method, 'remote.settingsWrite');
    assert.equal(f.calls[1].namespace, 'agent-preset-registry');
    assert.equal(f.calls[1].expectedRevision, 1);
    assert.deepEqual(f.calls[1].edits, [{ op: 'set', key: 'selectedDefault', value: 'cordis' }]);
    assert.deepEqual(f.selections, [{ id: 'cordis', session: 'one' }]);
    f.model.snapshot.session.blank = false;
    await f.face.makeDefault('standard');
    assert.equal(f.selections.length, 1, '修改默认值不能重组历史会话');
  } finally { f.defaults.dispose(); }
});

test('管理未授权不读取；电脑实例变更后旧卡锁住，主动重读才恢复写入', async () => {
  const denied = fixture(false);
  try { await denied.face.load(); await denied.face.makeDefault('cordis'); assert.equal(denied.calls.length, 0); }
  finally { denied.defaults.dispose(); }
  const f = fixture();
  try {
    await f.face.load();
    f.events.get('settings/document-updated')('actual-entry');
    assert.equal(f.face.hooks.agentPresetSection.getSnapshot().saving, true);
    await f.face.makeDefault('cordis');
    assert.equal(f.calls.length, 1);
    await f.face.load(); await f.face.makeDefault('broken');
    assert.equal(f.calls.length, 2);
    await f.face.makeDefault('cordis');
    assert.equal(f.calls.length, 3);
  } finally { f.defaults.dispose(); }
});

test('保存中切换聊天或销毁插件，不把迟到结果作用于新聊天', async () => {
  for (const dispose of [false, true]) {
    const f = fixture();
    try {
      await f.face.load();
      let finish;
      const call = f.model.client.call;
      f.model.client.call = async (...args) => { await new Promise(resolve => { finish = resolve; }); return call(...args); };
      const write = f.face.makeDefault('cordis');
      if (dispose) f.defaults.dispose(); else f.model.sessionView.request++;
      finish(); await write;
      assert.deepEqual(f.selections, []);
    } finally { f.defaults.dispose(); }
  }
});
