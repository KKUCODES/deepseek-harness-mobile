import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { build } from 'esbuild';
import { latestMobileBuild } from '../../scripts/latest-mobile-build.mjs';

// 使用固定新版原 readRoster/presetOptions，不把旧 SDK 的返回结构冒充新版。
const root = resolve(import.meta.dirname, '../..'), latest = latestMobileBuild(root);
const output = resolve(root, 'artifacts/tests/latest-agent-presets.cjs');
await build({ absWorkingDir: root, entryPoints: ['src/remote-agent-presets.mjs'], outfile: output,
  bundle: true, platform: 'node', format: 'cjs', plugins: [latest.resolver], alias: latest.alias, logLevel: 'silent' });
const { RemoteAgentPresets } = createRequire(import.meta.url)(output);

function fixture() {
  const events = new Map(), calls = [], controller = new AbortController();
  let rows = [{ id: 'standard', isDefault: true }, { id: 'cordis' }, { id: 'broken', broken: 'Isolated fixture failure' }], delayed;
  const model = {
    lifetime: controller,
    remote: { $on(name, fn) { events.set(name, fn); return () => events.delete(name); },
      agentPresets: { async list() { return delayed ? delayed() : { ok: true, value: { presets: rows } }; },
        async select(sessionId, id) { calls.push({ sessionId, id }); return { ok: true }; } } },
    connection: { generation: { getSnapshot: () => ({ id: 1 }), subscribe: () => () => {} } },
    transport: { capabilities: { endpoints: { calls: ['agentPresets/list', 'agentPresets/select'] } } },
    snapshot: { selected: 'isolated-session', session: { openState: 'open', blank: true, pendingSubmissions: [] }, agentPreset: 'standard' },
    sending: new Set(), sessions: { subagentAddress: () => undefined },
  };
  model.ctx = { remote: model.remote };
  return { model, calls, events, presets: new RemoteAgentPresets(model), setRows(value) { rows = value; },
    delay(fn) { delayed = fn; } };
}

test('新版真实目录没有旧模式开关，健康预设可以选择且等待电脑投影确认', async () => {
  const f = fixture();
  try {
    await f.presets.load();
    assert.equal(f.presets.snapshot.enabled, true);
    assert.deepEqual(f.presets.snapshot.options.map(row => row.id), ['standard', 'cordis']);
    await f.presets.choose('cordis', 'isolated-session');
    assert.deepEqual(f.calls, [{ sessionId: 'isolated-session', id: 'cordis' }]);
    assert.equal(f.model.snapshot.agentPreset, 'standard');
    f.model.snapshot.session.blank = false;
    await assert.rejects(f.presets.choose('standard', 'isolated-session'), /聊天开始/);
    assert.equal(f.calls.length, 1);
  } finally { f.presets.dispose(); }
});

test('新版实际 profile 实例变化使旧目录响应失效，销毁后不再发布', async () => {
  const f = fixture();
  try {
    await f.presets.load();
    let finish;
    f.delay(() => new Promise(resolve => { finish = resolve; }));
    const pending = f.presets.load();
    f.delay(undefined);
    f.setRows([{ id: 'updated', isDefault: true }]);
    f.events.get('settings/document-updated')('custom-preset-registry-entry', 2);
    await new Promise(resolve => setImmediate(resolve));
    finish({ ok: true, value: { presets: [{ id: 'stale' }] } });
    await pending;
    assert.deepEqual(f.presets.snapshot.options.map(row => row.id), ['updated']);
    f.delay(() => new Promise(resolve => { finish = resolve; }));
    const late = f.presets.load();
    f.presets.dispose();
    finish({ ok: true, value: { presets: [{ id: 'disposed' }] } });
    await late;
    assert.deepEqual(f.presets.snapshot.options.map(row => row.id), ['updated']);
    assert.equal(f.events.size, 0);
  } finally { f.presets.dispose(); }
});
