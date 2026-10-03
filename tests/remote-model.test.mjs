import test from 'node:test';
import assert from 'node:assert/strict';
import { build, transform } from 'esbuild';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { remoteSourceAliases } from '../scripts/remote-source-aliases.mjs';
import { turnForkAnchor } from '../src/remote-forks.mjs';
import { subagentAccess, subagentStatus } from '../src/remote-subagents.mjs';
import { captureRemoteResume } from '../src/remote-resume.mjs';
import { RemoteDraftStore } from '../src/remote-drafts.mjs';
import { draftStorage, draftBinding } from './fixtures/remote-draft-storage.mjs';
import { loadRemoteHistory } from '../src/remote-history.mjs';

const root = resolve(import.meta.dirname, '..');
const require = createRequire(import.meta.url);
const output = resolve(root, 'artifacts/tests/remote-model.cjs');
await build({ absWorkingDir: root, entryPoints: ['tests/fixtures/remote-model-node.mjs'], outfile: output, bundle: true, platform: 'node', format: 'cjs', logLevel: 'silent',
  nodePaths: [resolve(root, 'node_modules')], alias: { ...remoteSourceAliases(root),
    '@deepseek-ai/cordis': require.resolve('@deepseek-ai/cordis'),
    '@deepseek-ai/dsh-client-store': require.resolve('@deepseek-ai/dsh-client-store'),
    '@deepseek-ai/dsh-util-values': resolve(root, '../deepseek-harness/packages/util/values/src/index.ts'),
    '@deepseek-ai/dsh-timeout': resolve(root, '../deepseek-harness/packages/util/timeout/src/index.ts'),
  } });
const { RemoteModel, RemoteConversationModel, RemoteTransport, loadTestRemotes, eventHost } = require(output);
// 原插件清单的读取世代规则；网络结果受控，连接和消费过期结果的逻辑均使用实际源码。
const inventorySource = await readFile(resolve(root, '../deepseek-harness/packages/extensions/ui-cordis/src/client/inventory.ts'), 'utf8');
const inventoryCode = await transform(inventorySource, { loader: 'ts', format: 'esm', target: 'es2024' });
const { createCordisInventory } = await import(`data:text/javascript;base64,${Buffer.from(inventoryCode.code).toString('base64')}`);
const tick = () => new Promise(resolve => setTimeout(resolve, 10));
async function waitFor(check) {
  const end = Date.now() + 3000;
  while (!check()) { assert.ok(Date.now() < end, 'condition did not settle'); await tick(); }
}
const sid = 'dshm-test-session';

test('界面合并同批更新，操作订阅与快照仍同步且保留最终状态', async () => {
  const { model } = fixture(), immediate = [], views = [];
  const off = model.subscribe(() => immediate.push(model.getSnapshot().error));
  model.subscribeView(() => views.push(model.getSnapshot().error));
  model.publish({ error: 'first' }); model.publish({ error: 'last' });
  assert.deepEqual(immediate, ['first', 'last']);
  assert.equal(model.getSnapshot().error, 'last');
  assert.deepEqual(views, []);
  await Promise.resolve(); assert.deepEqual(views, []);
  model.publish({ error: 'microtask' });
  await tick();
  assert.deepEqual(views, ['microtask']);
  model.publish({ error: 'next' });
  await tick();
  assert.deepEqual(views, ['microtask', 'next']);
  off(); await model.dispose();
});

test('界面订阅释放与模型释放取消待发通知，重新订阅读取当前快照', async () => {
  const { model } = fixture(); let oldCalls = 0, newCalls = 0;
  const off = model.subscribeView(() => oldCalls++);
  model.publish({ error: 'pending' }); off();
  await tick(); assert.equal(oldCalls, 0);
  model.subscribeView(() => newCalls++);
  assert.equal(model.getSnapshot().error, 'pending');
  model.publish({ error: 'disposed' });
  await model.dispose();
  assert.equal(newCalls, 0);
  model.subscribeView(() => newCalls++); model.publish({ error: 'ignored' });
  await tick(); assert.equal(newCalls, 0);
});

test('界面通知中的新状态仍安排下一次通知', async () => {
  const { model } = fixture(), views = [];
  model.subscribeView(() => {
    const value = model.getSnapshot().error; views.push(value);
    if (value === 'first') model.publish({ error: 'second' });
  });
  model.publish({ error: 'first' });
  await waitFor(() => views.length === 2);
  assert.deepEqual(views, ['first', 'second']);
  await model.dispose();
});

test('切会话、会话就绪与断线即时通知界面并取消旧批次', async () => {
  const { model } = fixture(), views = [];
  model.subscribeView(() => views.push(model.getSnapshot()));
  model.publish({ error: 'pending' });
  model.publish({ selected: 'one' }); assert.equal(views.length, 1);
  model.publish({ session: {} }); assert.equal(views.length, 2);
  model.publish({ connectionState: 'disconnected' }); assert.equal(views.length, 3);
  model.publish({ session: null }); assert.equal(views.length, 4);
  await tick(); assert.equal(views.length, 4);
  await model.dispose();
});

test('历史分页结束同步交付最终内容，定位不会先于界面通知', async () => {
  const { model } = fixture(), views = [];
  model.publish({ session: { loadingOlder: false } });
  model.subscribeView(() => views.push(model.getSnapshot().conversation));
  model.publish({ session: { loadingOlder: true } });
  assert.equal(views.length, 1);
  model.publish({ conversation: { order: ['older', 'current'] } });
  assert.equal(views.length, 1);
  model.publish({ session: { loadingOlder: false } });
  assert.deepEqual(views.at(-1).order, ['older', 'current']);
  await tick(); assert.equal(views.length, 2);
  await model.dispose();
});

test('旁栏原会话流合并界面刷新，逐条状态与操作订阅保持同步', async () => {
  const f = fixture(); let aside;
  try {
    await f.model.start(); await f.model.select(sid);
    aside = new RemoteConversationModel(f.model); await aside.select('another-session'); await tick();
    let immediate = 0, rendered = 0;
    aside.subscribe(() => immediate++); aside.subscribeView(() => rendered++);
    for (let seq = 0; seq < 100; seq++) f.channels.get('session/follow').push({ type: 'event', event: {
      type: 'turn/start', seq, time: seq, data: { turn: seq + 1 },
    } });
    await waitFor(() => aside.reference.binding.eventSource.getSnapshot().entries.at(-1)?.event.seq === 99); await tick();
    assert.ok(immediate >= 100, '操作订阅保留逐条事件');
    assert.ok(rendered < 10, `同批100事件不应逐条刷新，实际${rendered}`);
    assert.equal(f.model.snapshot.selected, sid);
  } finally { aside?.dispose(); await f.model.dispose(); }
});

test('旁栏会话、分页与连接边界立即刷新并取消旧批次', async () => {
  const f = fixture(); let aside;
  try {
    await f.model.start();
    aside = new RemoteConversationModel(f.model); await tick();
    const views = []; aside.subscribeView(() => views.push(aside.getSnapshot()));
    aside.publish({ error: 'pending' });
    aside.view.publish({ selected: 'one' }); assert.equal(views.length, 1);
    aside.view.publish({ session: { loadingOlder: false } }); assert.equal(views.length, 2);
    aside.view.publish({ session: { loadingOlder: true } }); assert.equal(views.length, 3);
    aside.view.publish({ conversation: { order: ['older', 'current'] } }); assert.equal(views.length, 3);
    aside.view.publish({ session: { loadingOlder: false } }); assert.equal(views.length, 4);
    assert.deepEqual(views.at(-1).conversation.order, ['older', 'current']);
    f.model.publish({ connectionState: 'disconnected' }); assert.equal(views.length, 5);
    await tick(); assert.equal(views.length, 5);
  } finally { aside?.dispose(); await f.model.dispose(); }
});

test('旁栏通知可重入，取消订阅及根销毁不留下延迟刷新', async () => {
  const f = fixture(); let aside;
  try {
    await f.model.start(); aside = new RemoteConversationModel(f.model); await tick();
    const values = []; const off = aside.subscribeView(() => {
      values.push(aside.snapshot.error);
      if (aside.snapshot.error === 'first') aside.publish({ error: 'second' });
    });
    aside.publish({ error: 'first' }); await waitFor(() => values.length === 2);
    assert.deepEqual(values, ['first', 'second']);
    aside.publish({ error: 'unsubscribed' }); off(); await tick();
    assert.equal(values.length, 2);
    aside.subscribeView(() => values.push('disposed')); aside.publish({ error: 'pending' });
    await f.model.dispose();
    const count = values.length;
    aside.subscribeView(() => values.push('late')); aside.publish({ error: 'late' });
    await tick(); assert.equal(values.length, count);
  } finally { aside?.dispose(); await f.model.dispose(); }
});

test('正式RemoteModel文件入口捕获连接生命周期，断线期间旧迭代不能进入新连接', async () => {
  const info = { absolutePath: '/work/file', version: 'v1', bytes: 2 }, calls = [];
  const transport = { lifetime: new AbortController(), async call(_channel, endpoint, payload) {
    calls.push(endpoint);
    return { ok: true, value: endpoint.endsWith('/stat') ? info : { ...info, offset: 0, eof: true, data: 'AQI=' } };
  } };
  const model = new RemoteModel({}, { transport }), signal = new AbortController().signal;
  const read = model.files.read('own', 'file', signal);
  assert.deepEqual((await read.next()).value, Uint8Array.of(1, 2));
  transport.lifetime.abort(); transport.lifetime = new AbortController();
  await assert.rejects(read.next(), error => error.name === 'AbortError');
  assert.equal(calls.length, 2);
  assert.deepEqual(await model.files.bytes('own', 'file', signal), Uint8Array.of(1, 2));
  model.lifetime.abort();
  await assert.rejects(model.files.bytes('own', 'file', signal), error => error.name === 'AbortError');
});
const workspace = { workspaceId: 'existing', title: '已有工作区', path: '/project', sessionIds: [sid], createdAt: '', updatedAt: '' };

function fixture(blank = false, draftStore) {
  const calls = [], channels = new Map();
  const transport = {
    capabilities: { endpoints: { calls: ['skills/list', 'commands/list', 'permissionPresets/catalog', 'commands/execute', 'agentPresets/list', 'agentPresets/select'] } },
    async negotiate() { return { transport: 2 }; }, dispose() {},
    async call(channel, endpoint, payload, signal) {
      signal.throwIfAborted(); calls.push({ channel, endpoint, payload });
      if (endpoint === 'session/list') return { ok: true, value: { items: [sid, 'another-session'].map(sessionId => ({ sessionId, updatedAt: 10, running: false, blank, projections: { asOfSeq: -1, values: { title: '测试聊天' } } })) } };
      if (endpoint === 'session/modelCatalog') return { ok: true, value: { default: { provider: 'deepseek', model: 'pro' }, groups: [] } };
      if (endpoint === 'skills/list') return { ok: true, value: { skills: [{ name: 'test-skill', description: '测试技能', modelInvocable: false }, { name: 'permission', description: '同名技能', modelInvocable: true }] } };
      if (endpoint === 'commands/list') return { ok: true, value: [{ name: 'permission', description: '权限命令' }] };
      if (endpoint === 'permissionPresets/catalog') return { ok: true, value: { options: ['read-only', 'workspace-write', 'danger-full-access', 'auto'].map(value => ({ value, name: value })) } };
      if (endpoint === 'commands/execute') return { ok: true, value: { commandId: 'fixture-command', result: { kind: 'success' } } };
      if (endpoint === 'agentPresets/list') return { ok: true, value: { modeSelectionEnabled: true, authorable: false, presets: [
        { id: 'standard', trust: 'system', isDefault: true }, { id: 'minimal', trust: 'system', isDefault: false },
        { id: 'broken', trust: 'user', isDefault: false, broken: 'invalid composition' },
      ] } };
      if (endpoint === 'agentPresets/select') return { ok: true, value: payload.args.agentPreset };
      if (endpoint === 'session/create') return { ok: true, value: { sessionId: 'new-session' } };
      if (endpoint === 'session/fork') return { ok: true, value: { sessionId: 'forked-session' } };
      if (endpoint === 'session/rename') return { ok: true, value: { title: payload.args.request.title, seq: 1 } };
      if (endpoint === 'workspace/archiveSession') return { ok: true, value: { archivedSessionIds: [payload.args.request.sessionId] } };
      if (endpoint === 'workspace/unarchiveSession') return { ok: true, value: { archivedSessionIds: [] } };
      return { ok: true, value: { accepted: true } };
    },
    async *stream(_channel, endpoint, payload, signal) {
      const frames = [], entry = { push(frame) { frames.push(frame); wake?.(); } }; let wake;
      channels.set(endpoint, entry);
      if (endpoint === 'workspace/follow') yield { type: 'baseline', value: { items: [workspace], archivedSessionIds: [] } };
      if (endpoint === 'session/control') yield { type: 'baseline', value: { jobs: {}, projections: {} } };
      if (endpoint === '$events') yield { type: 'ready', clientId: 'test-event-client', host: { home: '/home/test' } };
      if (endpoint === 'session/follow') yield { type: 'snapshot', header: { version: 1, id: payload.args.request.address.sessionId ?? payload.args.request.address.childSessionId, createdAt: 0, isSeeded: false }, cursor: -1, records: [], hasMore: false, projections: { asOfSeq: -1, values: {} }, assistantStream: { revision: 0 } };
      const abort = () => wake?.(); signal.addEventListener('abort', abort);
      try { while (!signal.aborted) { if (frames.length) yield frames.shift(); else await new Promise(resolve => { wake = resolve; }); } }
      finally { signal.removeEventListener('abort', abort); if (channels.get(endpoint) === entry) channels.delete(endpoint); }
    },
  };
  return { model: new RemoteModel({}, { transport, loadRemotes: loadTestRemotes, draftStore }), calls, channels, transport };
}

function historyFixture(baseSeq = 1) {
  const f = fixture(), stream = f.transport.stream.bind(f.transport);
  f.transport.stream = async function* (...args) {
    for await (const frame of stream(...args)) {
      yield args[1] === 'session/follow' && frame.type === 'snapshot'
        ? { ...frame, cursor: baseSeq, hasMore: true, records: [{ type: 'event', event: { type: 'turn/start', seq: baseSeq, time: 1, data: { turn: 1 } } }] }
        : frame;
    }
  };
  return f;
}

test('原blocked结算在主聊天、旁栏和历史重入保留节点，取消或正常完成不误报', async () => {
  const f = fixture(); let aside;
  const record = (seq, type, data) => ({ type: 'event', event: { seq, time: seq + 1, type, data } });
  const history = [record(0, 'turn/start', { turn: 1 }), record(1, 'turn/end', { turn: 1, reason: { kind: 'blocked' } })];
  const stream = f.transport.stream.bind(f.transport);
  f.transport.stream = async function* (...args) {
    for await (const frame of stream(...args)) yield args[1] === 'session/follow' && frame.type === 'snapshot'
      ? { ...frame, cursor: history.at(-1).event.seq, records: history } : frame;
  };
  const blocked = model => [...model.getSnapshot().conversation.nodes.values()].filter(node => node.kind === 'turn-blocked');
  try {
    await f.model.start(); await f.model.select(sid);
    assert.equal(blocked(f.model).length, 1); assert.equal(blocked(f.model)[0].data.turn, 1);
    const firstKey = blocked(f.model)[0].key;
    aside = new RemoteConversationModel(f.model); await aside.select(sid);
    assert.equal(blocked(aside)[0].key, firstKey);
    for (const [turn, kind] of [[2, 'completed'], [3, 'aborted'], [4, 'blocked']]) {
      const start = record(history.length, 'turn/start', { turn }); history.push(start);
      f.channels.get('session/follow').push(start);
      const end = record(history.length, 'turn/end', { turn, reason: { kind } }); history.push(end);
      f.channels.get('session/follow').push(end);
    }
    await waitFor(() => blocked(f.model).length === 2 && blocked(aside).length === 2);
    assert.deepEqual(blocked(f.model).map(node => node.data.turn), [1, 4]);
    aside.dispose(); aside = null;
    await f.model.select(null); await f.model.select(sid);
    assert.deepEqual(blocked(f.model).map(node => node.data.turn), [1, 4]);
    assert.equal(blocked(f.model)[0].key, firstKey);
  } finally { aside?.dispose(); await f.model.dispose(); }
});

test('历史断层不清除分页入口，原窗口保留，手动重试可补读', async () => {
  const f = historyFixture(10), call = f.transport.call.bind(f.transport);
  const record = seq => ({ type: 'event', event: { type: 'turn/start', seq, time: seq, data: { turn: seq } } });
  let page = { records: [record(4), record(5)], hasMore: true }, reads = 0;
  f.transport.call = (...args) => {
    if (args[1] !== 'session/page') return call(...args);
    assert.equal(args[2].args.request.beforeSeq, 10);
    reads++; return Promise.resolve({ ok: true, value: page });
  };
  try {
    await f.model.start(); await f.model.select(sid); f.model.draft('断层期间保留');
    const binding = f.model.reference.binding, original = binding.eventSource.getSnapshot();
    for (const hasMore of [true, false]) {
      page = { records: [record(4), record(5)], hasMore };
      await assert.rejects(loadRemoteHistory(binding), /未能加载更早的记录/);
      assert.equal(binding.eventSource.getSnapshot(), original);
      assert.equal(binding.session.getSnapshot().hasMore, true);
      assert.equal(binding.session.getSnapshot().loadingOlder, false);
    }
    assert.equal(reads, 2, '不自动重试');
    page = { records: [record(8), record(9)], hasMore: false };
    await loadRemoteHistory(binding);
    assert.deepEqual(binding.eventSource.getSnapshot().entries.map(item => item.event.seq), [8, 9, 10]);
    assert.equal(binding.session.getSnapshot().hasMore, false);
    assert.equal(f.model.getSnapshot().drafts[sid], '断层期间保留');
  } finally { await f.model.dispose(); }
});

test('空页仍称有历史时提示重试，正常空起点与重叠连续页仍接受', async () => {
  const f = historyFixture(10), call = f.transport.call.bind(f.transport);
  const record = seq => ({ type: 'event', event: { type: 'turn/start', seq, time: seq, data: { turn: seq } } });
  let page = { records: [], hasMore: true };
  f.transport.call = (...args) => args[1] === 'session/page' ? Promise.resolve({ ok: true, value: page }) : call(...args);
  try {
    await f.model.start(); await f.model.select(sid);
    const binding = f.model.reference.binding;
    await assert.rejects(loadRemoteHistory(binding), /未能加载更早的记录/);
    assert.equal(binding.session.getSnapshot().hasMore, true);
    page = { records: [record(9), record(10)], hasMore: true };
    await loadRemoteHistory(binding);
    assert.deepEqual(binding.eventSource.getSnapshot().entries.map(item => item.event.seq), [9, 10]);
    page = { records: [], hasMore: false };
    await loadRemoteHistory(binding);
    assert.equal(binding.session.getSnapshot().hasMore, false);
  } finally { await f.model.dispose(); }
});

test('原 Session 吞掉业务分页错误时手机提示失败，原历史/草稿保留且可手动重试', async () => {
  const f = historyFixture(), call = f.transport.call.bind(f.transport);
  let reject = true, reads = 0;
  f.transport.call = (...args) => {
    if (args[1] !== 'session/page') return call(...args);
    reads++;
    return Promise.resolve(reject
      ? { ok: false, error: { code: 'gateway/internal', message: 'fixture read failed', details: {} } }
      : { ok: true, value: { records: [{ type: 'event', event: { type: 'turn/start', seq: 0, time: 0, data: { turn: 0 } } }], hasMore: false } });
  };
  try {
    await f.model.start(); await f.model.select(sid); f.model.draft('未发送草稿');
    const binding = f.model.reference.binding, original = binding.eventSource.getSnapshot();
    await assert.rejects(loadRemoteHistory(binding), /未能加载更早的记录/);
    assert.equal(binding.eventSource.getSnapshot(), original);
    assert.equal(binding.session.getSnapshot().loadingOlder, false);
    assert.equal(f.model.getSnapshot().drafts[sid], '未发送草稿');
    assert.equal(reads, 1, '读取失败不自动重试');
    reject = false; await loadRemoteHistory(binding);
    assert.equal(reads, 2);
    assert.deepEqual(binding.eventSource.getSnapshot().entries.map(item => item.event.seq), [0, 1]);
    assert.equal(binding.session.getSnapshot().hasMore, false);
  } finally { await f.model.dispose(); }
});

test('分页结果为空但已到起点不报错，实时追加不能掩盖分页失败', async () => {
  const f = historyFixture(), call = f.transport.call.bind(f.transport);
  let complete;
  f.transport.call = (...args) => args[1] === 'session/page' ? new Promise(resolve => { complete = resolve; }) : call(...args);
  try {
    await f.model.start(); await f.model.select(sid);
    const binding = f.model.reference.binding;
    const pending = loadRemoteHistory(binding);
    const failed = assert.rejects(pending, /未能加载更早的记录/);
    await waitFor(() => !!complete);
    f.channels.get('session/follow').push({ type: 'event', event: { type: 'turn/start', seq: 2, time: 2, data: { turn: 2 } } });
    await waitFor(() => binding.eventSource.getSnapshot().change.kind === 'append');
    complete({ ok: false, error: { code: 'gateway/internal', message: 'fixture read failed', details: {} } });
    await failed;
    complete = null;
    const empty = loadRemoteHistory(binding); await waitFor(() => !!complete);
    complete({ ok: true, value: { records: [], hasMore: false } }); await empty;
    assert.equal(binding.session.getSnapshot().hasMore, false);
  } finally { await f.model.dispose(); }
});

test('等待分页时离开原会话，迟到失败不污染新页面', async () => {
  const f = historyFixture(), call = f.transport.call.bind(f.transport);
  let complete, current = true;
  f.transport.call = (...args) => args[1] === 'session/page' ? new Promise(resolve => { complete = resolve; }) : call(...args);
  try {
    await f.model.start(); await f.model.select(sid);
    const pending = loadRemoteHistory(f.model.reference.binding, { isCurrent: () => current });
    await waitFor(() => !!complete); current = false;
    await f.model.select(null);
    complete({ ok: false, error: { code: 'gateway/internal', message: 'fixture read failed', details: {} } });
    await pending;
    assert.equal(f.model.getSnapshot().selected, null);
  } finally { await f.model.dispose(); }
});

test('Remote 正式模型重建恢复独立会话草稿，成功发送清理持久草稿，不自动发送', async () => {
  const storage = draftStorage(), store = new RemoteDraftStore(draftBinding, () => storage);
  const first = fixture(false, store);
  try {
    await first.model.start(); await first.model.select(sid); first.model.draft('未发送的中文');
    await first.model.select('another-session'); first.model.draft('另外一份');
  } finally { await first.model.dispose(); }
  const next = fixture(false, new RemoteDraftStore(draftBinding, () => storage));
  try {
    await next.model.start(); const selection = next.model.select(sid);
    assert.equal(next.model.snapshot.drafts[sid], '未发送的中文', '会话网络加载前即恢复输入框');
    await selection;
    assert.equal(next.model.snapshot.drafts[sid], '未发送的中文');
    assert.equal(next.calls.some(call => call.endpoint === 'session/prompt'), false);
    await next.model.send(); assert.equal(store.read(sid), '');
    await next.model.select('another-session'); assert.equal(next.model.snapshot.drafts['another-session'], '另外一份');
    next.model.draft(''); assert.equal(store.read('another-session'), '');
  } finally { await next.model.dispose(); }
});

test('发送失败保留持久草稿，迟到成功不能清除用户发送期间新写的文字', async () => {
  const draftDisk = draftStorage(), store = new RemoteDraftStore(draftBinding, () => draftDisk);
  const f = fixture(false, store), call = f.transport.call; let release, reject = true;
  f.transport.call = async (...args) => {
    if (args[1] !== 'session/prompt') return call(...args);
    if (reject) return { ok: false, error: { code: 'TEST_REJECTION', message: 'rejected' } };
    await new Promise(resolve => { release = resolve; }); return call(...args);
  };
  try {
    await f.model.start(); await f.model.select(sid); f.model.draft('原消息');
    await assert.rejects(f.model.send()); assert.equal(store.read(sid), '原消息');
    reject = false; const sending = f.model.send(); await waitFor(() => release);
    f.model.draft('新草稿'); release(); await sending; assert.equal(store.read(sid), '新草稿');
    await f.model.dispose(); f.model.draft('迟到修改'); assert.equal(store.read(sid), '新草稿');
  } finally { release?.(); await f.model.dispose(); }
});

test('存储失败保留屏幕草稿并明确提示，恢复写入后清理错误', async () => {
  let broken = true;
  const f = fixture(false, { read() { throw new Error('read failed'); }, write() { if (broken) throw new Error('full'); } });
  try {
    await f.model.start(); await f.model.select(sid); assert.match(f.model.snapshot.draftErrors[sid], /无法读取/);
    f.model.draft('仍可编辑'); assert.equal(f.model.snapshot.drafts[sid], '仍可编辑'); assert.match(f.model.snapshot.draftErrors[sid], /未能保存/);
    await f.model.select('another-session'); assert.match(f.model.snapshot.draftErrors[sid], /未能保存/);
    await f.model.select(sid); broken = false; await f.model.draft('重试'); assert.equal(f.model.snapshot.draftErrors[sid], null);
  } finally { await f.model.dispose(); }
});

test('原编辑器提交使用冻结的序列化正文，不读取或清空后续草稿', async () => {
  const f = fixture();
  try {
    await f.model.start(); await f.model.select(sid);
    await f.model.draft('新输入的草稿');
    await f.model.send('queue', { reference: f.model.reference, generation: f.model.connection.generation.getSnapshot().id,
      text: '引用序列化后的模型正文', attachmentIds: [], signal: new AbortController().signal });
    assert.equal(f.calls.find(call => call.endpoint === 'session/prompt').payload.args.request.content[0].text, '引用序列化后的模型正文');
    assert.equal(f.model.snapshot.drafts[sid], '新输入的草稿');
  } finally { await f.model.dispose(); }
});

test('原编辑器过期会话、代次、取消、离线及无效附件均不能提交', async () => {
  const f = fixture();
  try {
    await f.model.start(); await f.model.select(sid);
    const input = { reference: f.model.reference, generation: f.model.connection.generation.getSnapshot().id,
      text: '不得发送', attachmentIds: [] };
    for (const changed of [{ reference: {} }, { generation: 'old-generation' }, { signal: AbortSignal.abort() },
      { attachmentIds: ['missing'] }, { attachmentIds: ['same', 'same'] }, { text: 'x'.repeat(100001) }]) {
      await assert.rejects(f.model.send('queue', { ...input, ...changed }));
    }
    f.model.publish({ connectionState: 'disconnected' });
    await assert.rejects(f.model.send('queue', input));
    assert.equal(f.calls.some(call => call.endpoint === 'session/prompt'), false);
  } finally { await f.model.dispose(); }
});

test('原编辑器只发送冻结附件，序列化期间换会话不产生请求', async () => {
  const f = fixture(); let release;
  try {
    await f.model.start(); await f.model.select(sid);
    const a = { id: 'a', kind: 'file', state: 'ready', receiptId: 'ra', file: { name: 'a' } };
    const b = { id: 'b', kind: 'file', state: 'ready', receiptId: 'rb', file: { name: 'b' } };
    f.model.publish({ attachments: { [sid]: [a, b] } });
    const input = { reference: f.model.reference, generation: f.model.connection.generation.getSnapshot().id, text: 'first', attachmentIds: ['a'] };
    await f.model.send('queue', input);
    assert.deepEqual(f.calls.find(call => call.endpoint === 'session/prompt').payload.args.request.content, [{ type: 'text', text: 'first' }, { type: 'file', receiptId: 'ra' }]);
    assert.deepEqual(f.model.snapshot.attachments[sid], [b]);
    f.model.saveAttachmentDrafts = async () => { if (!release) await new Promise(resolve => { release = resolve; }); return true; };
    const pending = f.model.send('queue', { ...input, text: 'second', attachmentIds: ['b'] });
    await waitFor(() => release);
    await f.model.select('another-session'); release();
    await assert.rejects(pending, /已变化/);
    assert.equal(f.calls.filter(call => call.endpoint === 'session/prompt').length, 1);
    assert.deepEqual(f.model.snapshot.attachments[sid], [b]);
  } finally { release?.(); await f.model.dispose(); }
});

function withSubagents(f) {
  const catalogs = new Map([[sid, { parentAvailable: true, entries: [
    { kind: 'child', id: 'child', mode: 'continuable', label: '可继续子任务', activity: 'inactive', hasChildren: true },
    { kind: 'child', id: 'once', mode: 'one-shot', activity: 'running', hasChildren: false },
    { kind: 'diagnostic', id: 'broken', reason: 'corrupt' },
  ] }], ['child', { parentAvailable: true, entries: [{ kind: 'child', id: 'grandchild', mode: 'one-shot', activity: 'inactive', hasChildren: false }] }]]);
  const follows = [], originalStream = f.transport.stream, originalCall = f.transport.call;
  f.transport.capabilities.endpoints.calls.push('subagents/list', 'subagents/prompt', 'subagents/interruptByParent');
  f.transport.stream = function (...args) { if (args[1] === 'session/follow') follows.push(args[2].args.request.address); return originalStream(...args); };
  f.transport.call = async (...args) => {
    const [, endpoint, payload] = args;
    if (!endpoint.startsWith('subagents/')) return originalCall(...args);
    f.calls.push({ endpoint, payload });
    if (endpoint === 'subagents/list') return { ok: true, value: catalogs.get(payload.args.parentSessionId) ?? { parentAvailable: true, entries: [] } };
    return { ok: true, value: endpoint === 'subagents/prompt' ? { messageId: 'child-message' } : { accepted: true } };
  };
  return { catalogs, follows };
}

test('独立会话视图共享原连接与binding，选择和释放不切换主聊天', async () => {
  const f = fixture(), streams = [], stream = f.transport.stream;
  f.transport.stream = (...args) => { streams.push({ endpoint: args[1], payload: args[2] }); return stream(...args); };
  try {
    await f.model.start(); await f.model.select(sid); await f.model.draft('主聊天草稿');
    const primary = f.model.reference, view = f.model.createSessionView();
    await view.select(sid);
    assert.notEqual(view.reference, primary);
    assert.equal(view.reference.binding, primary.binding);
    assert.equal(streams.filter(row => row.endpoint === 'session/follow').length, 1);
    await f.model.select('another-session');
    assert.equal(view.getSnapshot().selected, sid);
    assert.equal(f.model.snapshot.selected, 'another-session');
    assert.equal(view.reference.binding.session.getSnapshot().openState, 'open');
    assert.equal(f.model.snapshot.drafts[sid], '主聊天草稿');
    view.dispose(); view.dispose();
    assert.equal(view.reference, null);
    assert.equal(f.model.reference.binding.session.getSnapshot().openState, 'open');
    assert.equal(streams.filter(row => row.endpoint === '$events').length, 1);
    assert.equal(f.calls.some(call => call.endpoint === 'session/create' || call.endpoint === 'session/prompt'), false);
    await assert.rejects(view.select(sid), error => error.name === 'AbortError');
    const remaining = f.model.createSessionView(); await remaining.select(sid);
    await f.model.dispose();
    assert.equal(remaining.lifetime.signal.aborted, true);
    assert.equal(remaining.reference, null);
  } finally { await f.model.dispose(); }
});

test('插件菜单关闭不停止活动视图的目录，视图释放也不停止仍打开的菜单', async () => {
  const f = fixture(), host = withSubagents(f);
  const changed = async id => {
    await tick();
    const previous = host.catalogs.get(sid);
    host.catalogs.set(sid, { ...previous, entries: [...previous.entries,
      { kind: 'child', id, mode: 'continuable', activity: 'inactive', hasChildren: false }] });
    f.model.sessions.handleSessionAdded({ sessionId: id, parentSessionId: sid, origin: 'subagent', updatedAt: 11, running: false, blank: true });
    await waitFor(() => f.model.snapshot.list.subagentsByParent[sid]?.entries.some(item => item.id === id));
  };
  try {
    await f.model.start(); await f.model.select(sid);
    await waitFor(() => f.model.snapshot.list.subagentsByParent[sid]?.state === 'ready');
    f.model.sessions.setSubagentCatalogOpen(sid, true);
    f.model.sessions.setSubagentCatalogOpen(sid, true);
    f.model.sessions.setSubagentCatalogOpen(sid, false);
    await changed('after-menu-close');
    const view = f.model.createSessionView(); await view.select('child');
    await f.model.select(null);
    f.model.sessions.setSubagentCatalogOpen(sid, true);
    view.dispose();
    await changed('after-view-close');
    f.model.sessions.setSubagentCatalogOpen(sid, false);
    const before = f.calls.filter(call => call.endpoint === 'subagents/list').length;
    f.model.sessions.handleSessionAdded({ sessionId: 'after-all-closed', parentSessionId: sid, origin: 'subagent', updatedAt: 12, running: false, blank: true });
    await new Promise(resolve => setTimeout(resolve, 100));
    assert.equal(f.calls.filter(call => call.endpoint === 'subagents/list').length, before);
  } finally { await f.model.dispose(); }
});

test('独立子视图保留原一次性地址与只读投影，关闭不停止主视图的父目录', async () => {
  const f = fixture(), host = withSubagents(f);
  try {
    await f.model.start();
    await f.model.select(sid); await f.model.draft('保留根草稿');
    await waitFor(() => f.model.snapshot.list.subagentsByParent[sid]?.state === 'ready');
    const view = f.model.createSessionView();
    await view.select('once');
    await waitFor(() => view.getSnapshot().session?.subagent?.address.mode === 'one-shot');
    assert.equal(subagentAccess(view.getSnapshot()).canSend, false);
    assert.deepEqual(JSON.parse(JSON.stringify(host.follows.at(-1))), { kind: 'subagent', parentSessionId: sid, childSessionId: 'once', mode: 'one-shot' });
    assert.equal(f.model.snapshot.selected, sid);
    const primary = f.model.reference;
    view.dispose();
    assert.equal(f.model.reference, primary);
    assert.equal(view.reference, null);
    assert.equal(f.model.snapshot.drafts[sid], '保留根草稿');
    await f.model.select(null);
    assert.equal(f.model.reference, null);
  } finally { await f.model.dispose(); }
});

test('独立视图恢复同一草稿库，子会话发送与停止不指向主聊天', async () => {
  const f = fixture(false, { read: id => `已保存:${id}`, write() {} }); withSubagents(f);
  try {
    await f.model.start(); await f.model.select(sid);
    await waitFor(() => f.model.snapshot.list.subagentsByParent[sid]?.state === 'ready');
    const primary = f.model.reference, view = f.model.createSessionView();
    await view.select('child');
    await waitFor(() => subagentAccess(view.snapshot).canSend);
    assert.equal(f.model.snapshot.drafts.child, '已保存:child');
    await view.send(); await view.stop();
    const sent = f.calls.find(call => call.endpoint === 'subagents/prompt').payload.args.request;
    assert.equal(sent.childSessionId, 'child'); assert.equal(sent.parentSessionId, sid);
    assert.deepEqual(sent.content, [{ type: 'text', text: '已保存:child' }]);
    assert.equal(f.calls.find(call => call.endpoint === 'subagents/interruptByParent').payload.args.childSessionId, 'child');
    assert.equal(f.model.snapshot.drafts.child, '');
    assert.equal(f.model.snapshot.drafts[sid], `已保存:${sid}`);
    assert.equal(f.model.reference, primary);
    await view.select('once');
    await assert.rejects(view.send(), /一次性/); await assert.rejects(view.stop(), /只能查看/);
    assert.equal(f.calls.filter(call => call.endpoint === 'subagents/prompt').length, 1);
    assert.equal(f.calls.some(call => call.endpoint === 'session/prompt'), false);
    view.dispose(); await assert.rejects(view.stop(), error => error.name === 'AbortError');
  } finally { await f.model.dispose(); }
});

test('同一会话多个视图共享发送锁，主聊天切换不取消独立视图的提交', async () => {
  const f = fixture(), call = f.transport.call, gate = Promise.withResolvers();
  let dispatched = false;
  f.transport.call = async (...args) => {
    if (args[1] === 'session/prompt') { dispatched = true; await gate.promise; }
    return call(...args);
  };
  try {
    await f.model.start(); await f.model.select(sid); await f.model.draft('同一份草稿');
    const view = f.model.createSessionView(); await view.select(sid);
    const sending = view.send(); await waitFor(() => dispatched);
    await assert.rejects(f.model.send(), /remote_submission_pending/);
    await f.model.select('another-session'); await f.model.draft('另一聊天草稿');
    gate.resolve(); await sending;
    assert.equal(f.calls.filter(call => call.endpoint === 'session/prompt').length, 1);
    assert.equal(f.calls.find(call => call.endpoint === 'session/prompt').payload.args.request.sessionId, sid);
    assert.equal(f.model.snapshot.drafts[sid], '');
    assert.equal(f.model.snapshot.drafts['another-session'], '另一聊天草稿');
    view.dispose();
  } finally { gate.resolve(); await f.model.dispose(); }
});

test('独立视图序列化期间切换或关闭，不发送到新会话且附件与草稿保留', async () => {
  for (const close of [false, true]) {
    const f = fixture(), gate = Promise.withResolvers(); let saving = false;
    try {
      await f.model.start(); await f.model.select(sid);
      const view = f.model.createSessionView(); await view.select('another-session');
      await f.model.writeDraft('another-session', '保留旁栏草稿');
      const attachment = { id: 'file', state: 'ready', receiptId: 'receipt', file: { name: 'sample' } };
      f.model.publish({ attachments: { 'another-session': [attachment] } });
      f.model.saveAttachmentDrafts = async () => { saving = true; await gate.promise; return true; };
      const sending = view.send(); await waitFor(() => saving);
      if (close) view.dispose(); else await view.select(sid);
      gate.resolve(); await assert.rejects(sending);
      assert.equal(f.calls.some(call => call.endpoint === 'session/prompt'), false);
      assert.equal(f.model.snapshot.drafts['another-session'], '保留旁栏草稿');
      assert.deepEqual(f.model.snapshot.attachments['another-session'], [attachment]);
      assert.equal(f.model.sending.size, 0);
      view.dispose();
    } finally { gate.resolve(); await f.model.dispose(); }
  }
});

test('独立视图关闭取消在途发送，未知结果保留附件且不会自动重发', async () => {
  const f = fixture(), call = f.transport.call; let signal;
  f.transport.call = async (...args) => {
    if (args[1] !== 'session/prompt') return call(...args);
    signal = args[3];
    await new Promise((_, reject) => signal.addEventListener('abort', () => reject(signal.reason), { once: true }));
  };
  try {
    await f.model.start(); await f.model.select(sid);
    const view = f.model.createSessionView(); await view.select('another-session');
    await f.model.writeDraft('another-session', '未确认消息');
    f.model.publish({ attachments: { 'another-session': [{ id: 'file', state: 'ready', receiptId: 'r', file: { name: 'sample' } }] } });
    const sending = view.send(); await waitFor(() => signal);
    view.dispose(); await assert.rejects(sending);
    assert.equal(signal.aborted, true);
    assert.equal(f.model.snapshot.attachments['another-session'][0].state, 'uncertain');
    assert.equal(f.model.snapshot.drafts['another-session'], '未确认消息');
    assert.equal(f.model.snapshot.selected, sid);
    assert.equal(f.model.sending.size, 0);
  } finally { await f.model.dispose(); }
});

test('独立视图队列操作只使用自己的原队列投影', async () => {
  const f = fixture();
  try {
    await f.model.start(); await f.model.select(sid);
    const view = f.model.createSessionView(); await view.select('another-session');
    const control = f.channels.get('session/control');
    control.push({ type: 'projection', sessionId: 'another-session', key: 'inbox', seq: 1,
      value: { 'next-turn': [{ id: 'side-queued', content: [{ type: 'text', text: '旁栏消息' }], source: { kind: 'user', rpcId: 'side-request' } }], 'next-step': [] } });
    await waitFor(() => view.snapshot.inbox?.['next-turn']?.length === 1);
    await assert.rejects(f.model.updateQueue('side-queued', { kind: 'remove' }), /remote_queue_item_expired/);
    await view.updateQueue('side-queued', { kind: 'remove' });
    assert.deepEqual(f.calls.at(-1).payload.args.request, { sessionId: 'another-session', itemId: 'side-queued', action: { kind: 'remove' } });
    control.push({ type: 'projection', sessionId: 'another-session', key: 'inbox', seq: 2, value: { 'next-turn': [], 'next-step': [] } });
    await waitFor(() => view.snapshot.inbox?.['next-turn']?.length === 0);
    await assert.rejects(view.updateQueue('side-queued', { kind: 'remove' }), /remote_queue_item_expired/);
    view.dispose();
  } finally { await f.model.dispose(); }
});

test('独立视图审批核对原事件归属，拒绝跨会话与关闭后的回调', async () => {
  const f = fixture();
  try {
    await f.model.start(); await f.model.select(sid);
    const view = f.model.createSessionView(); await view.select('another-session');
    const events = f.channels.get('$events');
    events.push({ type: 'waterfall', event: 'approval/request', eventId: 'scoped-approval', agentId: 'another-session', request: { toolName: 'write_file' } });
    await waitFor(() => f.model.snapshot.events.length === 1);
    const key = f.model.snapshot.events[0].eventId, outcome = { kind: 'result', value: 'allowed-once' };
    await assert.rejects(f.model.answer(key, outcome, f.model), /remote_event_expired/);
    assert.equal(f.model.interactions.size, 1);
    await view.answer(key, outcome); await waitFor(() => f.model.interactions.size === 0);
    assert.equal(f.calls.at(-1).payload.args.eventId, 'scoped-approval');
    events.push({ type: 'waterfall', event: 'approval/request', eventId: 'closed-approval', agentId: 'another-session', request: { toolName: 'write_file' } });
    await waitFor(() => f.model.snapshot.events.length === 1);
    const closedKey = f.model.snapshot.events[0].eventId;
    view.dispose(); await assert.rejects(view.answer(closedKey, outcome), error => error.name === 'AbortError');
    assert.equal(f.model.interactions.size, 1);
    events.push({ type: 'cancel', eventId: 'closed-approval' });
    await waitFor(() => f.model.interactions.size === 0);
  } finally { await f.model.dispose(); }
});

test('旁栏呈现模型有独立选择与目录，共享草稿、连接和操作锁，释放不影响主聊天', async () => {
  const f = fixture(); let aside;
  try {
    await f.model.start(); await f.model.select(sid); await f.model.draft('主草稿');
    const reference = f.model.reference;
    aside = new RemoteConversationModel(f.model); await aside.select('another-session');
    assert.equal(aside.getSnapshot(), aside.getSnapshot(), '快照缓存可用于React订阅');
    assert.equal(aside.snapshot.selected, 'another-session');
    assert.equal(aside.skills.snapshot.sessionId, 'another-session');
    assert.equal(f.model.skills.snapshot.sessionId, sid);
    assert.equal(aside.planMode.pendingSessions, f.model.planMode.pendingSessions);
    assert.equal(aside.permissions.uncertain, f.model.permissions.uncertain);
    assert.equal(aside.connection, f.model.connection);
    await aside.draft('旁栏草稿');
    assert.equal(f.model.snapshot.drafts['another-session'], '旁栏草稿');
    assert.equal(aside.snapshot.drafts[sid], '主草稿');
    await aside.rename('旁栏标题');
    assert.equal(f.calls.at(-1).payload.args.request.sessionId, 'another-session');
    await aside.send();
    assert.equal(f.calls.find(call => call.endpoint === 'session/prompt').payload.args.request.sessionId, 'another-session');
    assert.equal(f.model.reference, reference);
    assert.equal(f.model.snapshot.drafts[sid], '主草稿');
    aside.dispose(); assert.equal(f.model.lifetime.signal.aborted, false);
    assert.equal(f.model.reference, reference);
    await assert.rejects(aside.send(), error => error.name === 'AbortError');
  } finally { aside?.dispose(); await f.model.dispose(); }
});

test('旁栏分支及归档只改变本视图，根模型销毁释放局部监听', async () => {
  const f = fixture(); let aside;
  try {
    await f.model.start(); await f.model.select(sid);
    const before = f.model.listeners.size;
    aside = new RemoteConversationModel(f.model); await aside.select('another-session');
    assert.equal(f.model.listeners.size, before + 1);
    await aside.fork();
    assert.equal(f.calls.find(call => call.endpoint === 'session/fork').payload.args.request.sessionId, 'another-session');
    assert.equal(aside.snapshot.selected, 'forked-session'); assert.equal(f.model.snapshot.selected, sid);
    await aside.archive(true);
    assert.equal(aside.snapshot.selected, null); assert.equal(f.model.snapshot.selected, sid);
    await f.model.dispose();
    assert.equal(aside.disposed, true); assert.equal(aside.reference, null);
    assert.equal(f.model.listeners.size, 0);
  } finally { aside?.dispose(); await f.model.dispose(); }
});

test('子会话模型选择不调用普通 Agent RPC，返回父会话仍可切换', async () => {
  const f = fixture(); withSubagents(f);
  try {
    await f.model.start(); await f.model.select(sid);
    await waitFor(() => f.model.snapshot.list.subagentsByParent[sid]?.state === 'ready');
    for (const child of ['once', 'child']) {
      await f.model.openChild(child);
      const before = f.calls.filter(call => call.endpoint === 'session/selectModel').length;
      await assert.rejects(f.model.chooseModel({ provider: 'deepseek', model: 'pro' }), /不支持在子会话中更换模型/);
      await assert.rejects(f.model.chooseModel({ provider: 'deepseek', model: 'pro', reasoningEffort: 'low' }), /思考强度/);
      assert.equal(f.calls.filter(call => call.endpoint === 'session/selectModel').length, before);
      await f.model.back();
    }
    await f.model.chooseModel({ provider: 'deepseek', model: 'pro' });
    assert.equal(f.calls.find(call => call.endpoint === 'session/selectModel').payload.args.request.sessionId, sid);
  } finally { await f.model.dispose(); }
});

test('冷启动按ID打开子会话与孙会话时先读取原父目录，不走普通Agent入口', async () => {
  for (const target of ['child', 'grandchild']) {
    const f = fixture(), host = withSubagents(f);
    try {
      await f.model.start();
      const parent = target === 'child' ? sid : 'child';
      await f.model.sessions.refresh();
      f.model.sessions.handleSessionAdded({ sessionId: target, parentSessionId: parent, origin: 'subagent', updatedAt: 10, running: false, blank: false });
      await waitFor(() => f.model.snapshot.list.byId[target]);
      assert.equal(f.model.sessions.subagentAddress(target), undefined);
      await f.model.select(target);
      assert.deepEqual(JSON.parse(JSON.stringify(host.follows.at(-1))), {
        kind: 'subagent', parentSessionId: parent, childSessionId: target, mode: target === 'child' ? 'continuable' : 'one-shot',
      });
      assert.equal(f.calls.some(call => call.endpoint === 'session/open'), false);
      assert.equal(f.model.snapshot.selectedTarget.childSessionId, target);
    } finally { await f.model.dispose(); }
  }
});

test('冷启动子会话的父目录缺失或读取失败时保留旧聊天和草稿，不降级为普通会话', async () => {
  for (const unavailable of ['missing', 'failure']) {
    const f = fixture(); withSubagents(f);
    try {
      await f.model.start(); await f.model.select('another-session'); await f.model.draft('保留原草稿');
      const previous = f.model.reference, call = f.transport.call;
      f.model.sessions.handleSessionAdded({ sessionId: 'child', parentSessionId: sid, origin: 'subagent', updatedAt: 10, running: false, blank: false });
      await waitFor(() => f.model.snapshot.list.byId.child);
      f.transport.call = (...args) => args[1] === 'subagents/list' && args[2].args.parentSessionId === sid
        ? Promise.resolve(unavailable === 'missing' ? { ok: true, value: { parentAvailable: true, entries: [] } }
          : { ok: false, error: { code: 'subagent/projections-unavailable', message: 'unavailable', details: {} } })
        : call(...args);
      await assert.rejects(f.model.select('child'), /暂时无法打开这个聊天/);
      assert.equal(f.model.reference, previous);
      assert.equal(f.model.snapshot.selected, 'another-session');
      assert.equal(f.model.snapshot.drafts['another-session'], '保留原草稿');
    } finally { await f.model.dispose(); }
  }
});

test('冷启动子会话地址读取期间的新导航使旧结果失效', async () => {
  const f = fixture(); withSubagents(f); let release;
  try {
    await f.model.start();
    await f.model.sessions.refresh();
    f.model.sessions.handleSessionAdded({ sessionId: 'child', parentSessionId: sid, origin: 'subagent', updatedAt: 10, running: false, blank: false });
    await waitFor(() => f.model.snapshot.list.byId.child);
    const call = f.transport.call;
    f.transport.call = (...args) => args[1] === 'subagents/list' && args[2].args.parentSessionId === sid
      ? new Promise(resolve => { release = () => resolve(call(...args)); }) : call(...args);
    const pending = f.model.select('child');
    await waitFor(() => release);
    await f.model.select('another-session');
    release(); await pending;
    assert.equal(f.model.snapshot.selected, 'another-session');
  } finally { release?.(); await f.model.dispose(); }
});

test('子会话通过原目录与父子地址进入、嵌套返回，重建连接保留地址和各自草稿', async () => {
  const f = fixture(), host = withSubagents(f);
  try {
    await f.model.start(); await f.model.select(sid); f.model.draft('父草稿');
    await waitFor(() => f.model.snapshot.list.subagentsByParent[sid]?.state === 'ready');
    assert.equal(f.model.snapshot.list.ids.includes('child'), false);
    await assert.rejects(f.model.openChild('broken'), /子会话已变化/);
    await f.model.openChild('child'); f.model.draft('子草稿');
    assert.deepEqual(JSON.parse(JSON.stringify(host.follows.at(-1))), { kind: 'subagent', parentSessionId: sid, childSessionId: 'child', mode: 'continuable' });
    await waitFor(() => f.model.snapshot.list.subagentsByParent.child?.state === 'ready');
    await f.model.openChild('grandchild');
    const resume = captureRemoteResume(f.model);
    assert.deepEqual(resume.selectedTarget, { parentSessionId: 'child', childSessionId: 'grandchild', mode: 'one-shot' });
    assert.equal(resume.selectionTrail.length, 2);
    await f.model.select(null);
    await f.model.select(resume.selectedTarget, { trail: resume.selectionTrail });
    await f.model.back(); assert.equal(f.model.snapshot.selected, 'child');
    assert.equal(f.model.snapshot.drafts.child, '子草稿');
    await f.model.back(); assert.equal(f.model.snapshot.selected, sid);
    assert.equal(f.model.snapshot.drafts[sid], '父草稿');
    await f.model.back(); assert.equal(f.model.snapshot.selected, null);
  } finally { await f.model.dispose(); }
});

test('父 Agent 释放后返回先重读持久化列表，保留父子草稿', async () => {
  const f = fixture(); withSubagents(f);
  try {
    await f.model.start(); await f.model.select(sid); f.model.draft('父草稿');
    await waitFor(() => f.model.snapshot.list.subagentsByParent[sid]?.state === 'ready');
    await f.model.openChild('child'); f.model.draft('子草稿');
    f.model.sessions.handleSessionRemoved(sid);
    await waitFor(() => !f.model.snapshot.list.byId[sid]);
    const before = f.calls.filter(call => call.endpoint === 'session/list').length;
    await f.model.back();
    assert.equal(f.calls.filter(call => call.endpoint === 'session/list').length, before + 1);
    assert.equal(f.model.snapshot.selected, sid);
    assert.equal(f.model.snapshot.session.openState, 'open');
    assert.equal(f.model.snapshot.drafts[sid], '父草稿');
    assert.equal(f.model.snapshot.drafts.child, '子草稿');
  } finally { await f.model.dispose(); }
});

test('父列表读取失败或父记录缺失时，返回失败保留子会话及导航链', async () => {
  const f = fixture(); withSubagents(f);
  try {
    await f.model.start(); await f.model.select(sid);
    await waitFor(() => f.model.snapshot.list.subagentsByParent[sid]?.state === 'ready');
    await f.model.openChild('child'); f.model.draft('保留子草稿');
    f.model.sessions.handleSessionRemoved(sid);
    await waitFor(() => !f.model.snapshot.list.byId[sid]);
    const reference = f.model.reference, trail = f.model.snapshot.selectionTrail;
    const call = f.transport.call;
    for (const response of [{ ok: false, error: { code: 'gateway/internal', message: 'read failed' } }, { ok: true, value: { items: [] } }]) {
      f.transport.call = (...args) => args[1] === 'session/list' ? response : call(...args);
      await assert.rejects(f.model.back(), /暂时无法打开|read failed/);
      assert.equal(f.model.snapshot.selected, 'child');
      assert.equal(f.model.reference, reference);
      assert.equal(f.model.snapshot.session.openState, 'open');
      assert.equal(f.model.snapshot.selectionTrail, trail);
      assert.equal(f.model.snapshot.drafts.child, '保留子草稿');
    }
  } finally { await f.model.dispose(); }
});

test('返回父会话的迟到列表不能覆盖用户已选择的另一聊天', async () => {
  const f = fixture(); withSubagents(f); let resolveList;
  try {
    await f.model.start(); await f.model.select(sid);
    await waitFor(() => f.model.snapshot.list.subagentsByParent[sid]?.state === 'ready');
    await f.model.openChild('child');
    f.model.sessions.handleSessionRemoved(sid);
    await waitFor(() => !f.model.snapshot.list.byId[sid]);
    const call = f.transport.call;
    f.transport.call = (...args) => args[1] === 'session/list' ? new Promise(resolve => { resolveList = () => resolve(call(...args)); }) : call(...args);
    const back = f.model.back(); await waitFor(() => !!resolveList);
    await f.model.select('another-session'); resolveList(); await back;
    assert.equal(f.model.snapshot.selected, 'another-session');
    assert.equal(f.model.reference.sessionId, 'another-session');
  } finally { resolveList?.(); await f.model.dispose(); }
});

test('子会话续聊沿用原生成接口与回显 requestId，单次任务只读、父离线可停止不可发送', async () => {
  const f = fixture(), host = withSubagents(f);
  try {
    await f.model.start(); await f.model.select(sid);
    await waitFor(() => f.model.snapshot.list.subagentsByParent[sid]?.state === 'ready');
    await f.model.openChild('once'); f.model.draft('不能发送');
    await assert.rejects(f.model.send(), /一次性子任务/);
    await assert.rejects(f.model.stop(), /只能查看/);
    await f.model.back(); await f.model.openChild('child');
    await waitFor(() => subagentAccess(f.model.snapshot).canSend);
    f.model.draft('继续处理'); await f.model.send();
    await waitFor(() => f.model.snapshot.session.pendingSubmissions.length === 1);
    const sent = f.calls.find(call => call.endpoint === 'subagents/prompt').payload.args.request;
    assert.equal(sent.requestId, f.model.snapshot.session.pendingSubmissions[0].requestId);
    assert.equal(sent.parentSessionId, sid); assert.equal(sent.childSessionId, 'child');
    assert.equal(sent.mode, 'continuable'); assert.equal(sent.delivery, 'queue');
    assert.deepEqual(JSON.parse(JSON.stringify(sent.content)), [{ type: 'text', text: '继续处理' }]);
    assert.equal(f.calls.some(call => call.endpoint === 'session/prompt'), false);
    f.channels.get('session/control').push({ type: 'projection', sessionId: 'child', key: 'inbox', seq: 1, value: {
      'next-turn': [{ id: 'child-message', source: { kind: 'user', rpcId: sent.requestId }, content: [{ type: 'text', text: '继续处理' }] }], 'next-step': [],
    } });
    await waitFor(() => f.model.snapshot.session.pendingSubmissions.length === 0);
    host.catalogs.get(sid).parentAvailable = false;
    await f.model.sessions.refreshSubagents(sid);
    await waitFor(() => !subagentAccess(f.model.snapshot).canSend);
    f.model.draft('保留待恢复草稿'); await assert.rejects(f.model.send(), /父会话暂不可用/);
    await f.model.stop();
    assert.deepEqual(JSON.parse(JSON.stringify(f.calls.find(call => call.endpoint === 'subagents/interruptByParent').payload.args)), { childSessionId: 'child', parentSessionId: sid, mode: 'continuable' });
    assert.equal(f.model.snapshot.drafts.child, '保留待恢复草稿');
    assert.match(subagentStatus(host.catalogs.get(sid).entries[0]), /当前未运行/);
    assert.doesNotMatch(subagentStatus(host.catalogs.get(sid).entries[0]), /完成/);
  } finally { await f.model.dispose(); }
});

test('子会话业务拒绝退休本地回显且保留草稿，文件不上传，目录失败保留错误', async () => {
  const f = fixture(); withSubagents(f);
  try {
    await f.model.start(); await f.model.select(sid);
    await waitFor(() => f.model.snapshot.list.subagentsByParent[sid]?.state === 'ready');
    await f.model.openChild('child'); await waitFor(() => subagentAccess(f.model.snapshot).canSend);
    await assert.rejects(f.model.upload(new File(['test'], 'test.txt')), /不支持上传文件/);
    const original = f.transport.call;
    f.transport.call = (...args) => args[1] === 'subagents/prompt' ? Promise.resolve({ ok: false, error: { code: 'subagent/unauthorized', message: 'ownership conflict', details: {} } }) : original(...args);
    f.model.draft('不能丢失'); await assert.rejects(f.model.send(), /ownership conflict/);
    await waitFor(() => f.model.snapshot.session.pendingSubmissions.length === 0);
    assert.equal(f.model.snapshot.drafts.child, '不能丢失');
    f.transport.call = (...args) => args[1] === 'subagents/list' ? Promise.resolve({ ok: false, error: { code: 'subagent/projections-unavailable', message: 'offline', details: {} } }) : original(...args);
    await f.model.sessions.refreshSubagents('child');
    await waitFor(() => f.model.snapshot.list.subagentsByParent.child?.state === 'error');
    assert.equal(f.model.snapshot.list.subagentsByParent.child.entries.length, 1);
  } finally { await f.model.dispose(); }
});

for (const outage of ['Host', '中继']) test(`${outage}中断通过真实 RemoteTransport 恢复当前聊天订阅、工作区和草稿，不重放写入`, async () => {
  const f = fixture(), host = f.transport, pending = new Map();
  host.capabilities.jobControlGeneration = 'before-restart';
  const listeners = new Set(); let online = true;
  const client = {
    subscribe: callback => { listeners.add(callback); return () => listeners.delete(callback); },
    request(operation, onEvent, onEnd) {
      if (!online) throw new Error('remote_not_connected');
      const controller = new AbortController();
      const completion = Promise.withResolvers();
      if (operation.method === 'remote.negotiate') completion.resolve({ transport: 2, dshVersion: '0.1.6-alpha.2', ...host.capabilities });
      else if (operation.method === 'remote.rpc') {
        void host.call('/api', operation.endpoint, operation.payload, controller.signal).then(completion.resolve, completion.reject);
      } else {
        const key = Symbol(operation.endpoint);
        pending.set(key, { endpoint: operation.endpoint, fail() {
          completion.reject(new Error(outage === 'Host' ? 'host_disconnected_outcome_unknown' : 'connection_closed_outcome_unknown')); controller.abort();
        } });
        void (async () => {
          try {
            for await (const frame of host.stream('/api', operation.endpoint, operation.payload, controller.signal)) onEvent(frame);
            onEnd(); completion.resolve();
          } catch (error) { completion.reject(error); }
          finally { pending.delete(key); }
        })();
      }
      return { promise: completion.promise, cancel() { controller.abort(); completion.resolve(); } };
    },
  };
  f.model.transport = new RemoteTransport(client);
  try {
    await f.model.start(); await f.model.select(sid);
    f.model.draft('重启时未发送的草稿');
    const generation = f.model.connection.generation.getSnapshot().id;
    const oldHistory = f.channels.get('session/follow'), oldWorkspace = f.channels.get('workspace/follow');
    // 中继先报告事件载体断开，再报告在途订阅失败；保持客户端到网关的连接。
    const active = [...pending.values()].sort((a, b) => Number(b.endpoint === '$events') - Number(a.endpoint === '$events'));
    if (outage === 'Host') host.capabilities.jobControlGeneration = 'after-restart';
    if (outage === '中继') {
      const reading = Promise.withResolvers(), inventoryErrors = [];
      const inventory = createCordisInventory({ inventory: () => reading.promise }, error => inventoryErrors.push(error.message));
      const offInventory = f.model.connection.generation.subscribe(() => {
        if (!f.model.connection.generation.getSnapshot()) inventory.reset();
      });
      inventory.refresh();
      online = false; for (const listener of listeners) listener({ type: 'closed' });
      const disconnectedGeneration = f.model.connection.generation.getSnapshot();
      reading.reject(new Error('gateway/internal: client api: dynamicCordisRunner/inventory failed: remote_not_connected'));
      try {
        await tick();
        assert.deepEqual(inventoryErrors, [], '网络断开后的旧清单失败不应污染当前页面');
        assert.equal(inventory.getSnapshot().error, undefined);
      } finally { offInventory(); inventory.reset(); }
      // 原插件用 connection.generation 判断旧读取是否仍有效，不能等流的 Promise 报错才清除。
      assert.equal(disconnectedGeneration, undefined, '原生断开必须同步撤回插件的连接世代');
    }
    for (const stream of active) stream.fail();
    if (outage === '中继') {
      await waitFor(() => f.model.snapshot.connectionState !== 'connected');
      const received = f.model.snapshot.lastReceivedAt;
      assert.ok(received);
      await assert.rejects(f.model.select('different-session'), /暂时离线/);
      f.model.draft('离线编辑的草稿');
      await new Promise(resolve => setTimeout(resolve, 400));
      assert.equal(f.model.snapshot.selected, sid);
      assert.equal(f.model.snapshot.lastReceivedAt, received);
      online = true; for (const listener of listeners) listener({ type: 'ready' });
      await f.model.transport.negotiate(); f.model.connection.reconnect();
    }
    await waitFor(() => f.model.connection.generation.getSnapshot()?.id > generation);
    await waitFor(() => f.model.getSnapshot().session.openState === 'open' && f.channels.has('session/follow'));
    await waitFor(() => f.model.snapshot.connectionState === 'connected');
    assert.equal(f.model.transport.capabilities.jobControlGeneration, outage === 'Host' ? 'after-restart' : 'before-restart');
    assert.notEqual(f.channels.get('session/follow'), oldHistory);
    assert.notEqual(f.channels.get('workspace/follow'), oldWorkspace);
    assert.equal(f.model.getSnapshot().selected, sid);
    assert.equal(f.model.getSnapshot().drafts[sid], outage === 'Host' ? '重启时未发送的草稿' : '离线编辑的草稿');
    if (outage === '中继') {
      // 原生重新交付 ready 也会清除协商能力，即使没有先交付 closed。
      const recovered = f.model.connection.generation.getSnapshot().id;
      for (const listener of listeners) listener({ type: 'ready' });
      assert.equal(f.model.connection.generation.getSnapshot(), undefined);
      await f.model.transport.negotiate(); f.model.connection.reconnect();
      await waitFor(() => f.model.connection.generation.getSnapshot()?.id > recovered && f.model.snapshot.connectionState === 'connected');
      assert.equal(f.model.getSnapshot().drafts[sid], '离线编辑的草稿');
    }
    assert.equal(f.calls.some(call => ['session/prompt', 'commands/execute', '$events/result'].includes(call.endpoint)), false);
  } finally { await f.model.dispose(); assert.equal(listeners.size, 0, '释放 Remote 后必须取消载体订阅'); }
});

test('原连接恢复后先核对能力再允许任务操作，协商等待不显示已连接', async () => {
  const f = fixture();
  try {
    await f.model.start(); await f.model.select(sid);
    const pending = Promise.withResolvers();
    f.transport.negotiate = () => pending.promise;
    f.model.connection.reconnect();
    await waitFor(() => f.model.connection.state.getSnapshot() === 'connected');
    assert.equal(f.model.snapshot.connectionState, 'connecting');
    await assert.rejects(f.model.jobActions.stop(sid, { id: 'old', startedAt: 1 }), /请连接/);
    pending.resolve({ transport: 2 });
    await waitFor(() => f.model.snapshot.connectionState === 'connected');
  } finally { await f.model.dispose(); }
});

const goalView = (revision = 1, phase = 'active') => ({ id: 'goal-test', revision, objective: '测试目标', phase,
  maxGoalRounds: 3, roundsStarted: 0, createdAt: 1, updatedAt: revision, activation: phase === 'active' ? 'armed' : 'disarmed' });

function withGoals(f) {
  f.transport.capabilities.endpoints.calls.push(...['get', 'create', 'edit', 'pause', 'resume', 'complete', 'clear'].map(method => `goals/${method}`));
  const original = f.transport.call;
  let value;
  f.transport.call = async (channel, endpoint, payload, signal) => {
    if (!endpoint.startsWith('goals/')) return original(channel, endpoint, payload, signal);
    f.calls.push({ channel, endpoint, payload });
    if (endpoint === 'goals/get') return { ok: true, value };
    if (endpoint === 'goals/create') { value = goalView(); return { ok: true, value: { ref: { id: value.id, revision: value.revision } } }; }
    if (payload.args.ref.revision !== value?.revision) return { ok: false, error: { code: 'GOAL_STALE_REF', message: 'stale goal', details: {} } };
    const next = { ...value, ...payload.args.request, revision: value.revision + 1 };
    if (endpoint === 'goals/pause') { next.phase = 'paused'; next.activation = 'disarmed'; }
    if (endpoint === 'goals/resume') { next.phase = 'active'; next.activation = 'armed'; }
    if (endpoint === 'goals/complete') { next.phase = 'complete'; next.activation = 'disarmed'; }
    value = endpoint === 'goals/clear' ? undefined : next;
    return { ok: true, value: endpoint === 'goals/clear' ? { id: next.id, revision: next.revision } : value };
  };
  return { update(next) { value = next; }, get value() { return value; } };
}

test('目标通过原生成 wire 完成创建编辑暂停继续完成清除；旧版本不覆写', async () => {
  const f = fixture(), host = withGoals(f);
  try {
    await f.model.start(); await f.model.select(sid); await waitFor(() => f.model.goals.snapshot.status === 'ready');
    f.model.draft('未发送草稿');
    await f.model.goals.change('create', sid, null, { objective: '测试目标', maxGoalRounds: 3 });
    assert.deepEqual(JSON.parse(JSON.stringify(f.calls.find(c => c.endpoint === 'goals/create').payload)), { args: { agentId: sid, request: { objective: '测试目标', maxGoalRounds: 3 } } });
    const ref = () => ({ id: host.value.id, revision: host.value.revision });
    const old = ref();
    await f.model.goals.change('edit', sid, ref(), { objective: '更新目标', maxGoalRounds: 4 });
    await assert.rejects(f.model.goals.change('pause', sid, old), /其他地方更新/);
    await f.model.goals.change('pause', sid, ref()); assert.equal(f.model.goals.snapshot.value.phase, 'paused');
    await f.model.goals.change('resume', sid, ref()); assert.equal(f.model.goals.snapshot.value.activation, 'armed');
    await f.model.goals.change('complete', sid, ref()); assert.equal(f.model.goals.snapshot.value.phase, 'complete');
    await f.model.goals.change('clear', sid, ref()); assert.equal(f.model.goals.snapshot.value, null);
    assert.equal(f.model.snapshot.drafts[sid], '未发送草稿');
  } finally { await f.model.dispose(); }
});

test('目标迟到读取、事件、重连和会话隔离；未知结果不能重复提交', async () => {
  const f = fixture(), host = withGoals(f);
  try {
    await f.model.start(); await f.model.select(sid); await waitFor(() => f.model.goals.snapshot.status === 'ready');
    host.update(goalView()); await f.model.goals.refresh();
    const original = f.transport.call; let resolveRead;
    f.transport.call = (...args) => args[1] === 'goals/get' ? new Promise(resolve => { resolveRead = resolve; }) : original(...args);
    const oldRead = f.model.goals.refresh(); const finishOld = resolveRead;
    f.transport.call = original;
    await f.model.select('another-session'); await waitFor(() => f.model.goals.snapshot.status === 'ready');
    finishOld({ ok: true, value: goalView(99) }); await oldRead;
    assert.equal(f.model.goals.snapshot.value.revision, 1);
    await assert.rejects(f.model.goals.change('pause', sid, { id: 'goal-test', revision: 1 }), /聊天或目标/);
    f.transport.call = (...args) => args[1] === 'goals/pause'
      ? Promise.resolve({ ok: false, error: { code: 'gateway/internal', message: 'offline', details: {} } }) : original(...args);
    await assert.rejects(f.model.goals.change('pause', 'another-session', { id: 'goal-test', revision: 1 }), /尚未确认/);
    await f.model.goals.refresh();
    await assert.rejects(f.model.goals.change('pause', 'another-session', { id: 'goal-test', revision: 1 }), /尚未确认/);
    f.transport.call = original; host.update(goalView(2, 'paused'));
    f.channels.get('$events').push({ type: 'emit', event: 'goal/activation-changed', args: [{ sessionId: 'another-session', goal: { id: 'goal-test', revision: 2, activation: 'disarmed' } }] });
    await waitFor(() => f.model.goals.snapshot.value?.revision === 2);
    const gen = f.model.connection.generation.getSnapshot().id;
    f.model.connection.reconnect();
    await waitFor(() => f.model.connection.generation.getSnapshot()?.id > gen);
    await waitFor(() => f.model.goals.snapshot.status === 'ready');
    await f.model.goals.change('resume', 'another-session', { id: 'goal-test', revision: 2 });
  } finally { await f.model.dispose(); }
});

test('目标业务拒绝、读取失败可重试且发送中的单次操作不重复', async () => {
  const f = fixture(), host = withGoals(f);
  try {
    await f.model.start(); await f.model.select(sid); await waitFor(() => f.model.goals.snapshot.status === 'ready');
    host.update(goalView()); await f.model.goals.refresh();
    host.update(goalView(2));
    await assert.rejects(f.model.goals.change('pause', sid, { id: 'goal-test', revision: 1 }), /stale goal/);
    const original = f.transport.call; let settle;
    f.transport.call = (...args) => args[1] === 'goals/get' ? Promise.resolve({ ok: false, error: { code: 'test', message: '读取失败', details: {} } }) : original(...args);
    await f.model.goals.refresh(); assert.equal(f.model.goals.snapshot.status, 'error');
    f.transport.call = original; await f.model.goals.refresh();
    f.transport.call = (...args) => args[1] === 'goals/pause' ? new Promise(resolve => { settle = () => resolve(original(...args)); }) : original(...args);
    const pending = f.model.goals.change('pause', sid, { id: 'goal-test', revision: 2 });
    await assert.rejects(f.model.goals.change('pause', sid, { id: 'goal-test', revision: 2 }), /正在更新/);
    settle(); await pending;
  } finally { await f.model.dispose(); }
});

test('技能目录使用当前会话的原接口，插入保留草稿且不发送，命令同名不能误用', async () => {
  const f = fixture();
  try {
    await f.model.start(); await f.model.select(sid);
    f.model.draft('保留我的要求');
    await Promise.all([f.model.skills.load(), f.model.skills.load()]);
    assert.equal(f.model.skills.getSnapshot().status, 'ready', f.model.skills.getSnapshot().error);
    assert.equal(f.calls.filter(call => call.endpoint === 'skills/list').length, 1);
    assert.deepEqual(JSON.parse(JSON.stringify(f.calls.find(call => call.endpoint === 'skills/list').payload)), { args: { request: { sessionId: sid } } });
    assert.deepEqual(JSON.parse(JSON.stringify(f.calls.find(call => call.endpoint === 'commands/list').payload)), { args: { agentId: sid } });
    assert.equal(f.model.skills.getSnapshot().items[0].modelInvocable, false);
    assert.throws(() => f.model.skills.insert('permission', sid), /技能列表已变化/);
    f.model.skills.insert('test-skill', sid); f.model.skills.insert('test-skill', sid);
    assert.equal(f.model.getSnapshot().drafts[sid], '/test-skill 保留我的要求');
    assert.equal(f.calls.some(call => call.endpoint === 'session/prompt' || call.endpoint === 'commands/execute'), false);
    await f.model.send();
    assert.equal(f.calls.find(call => call.endpoint === 'session/prompt').payload.args.request.content[0].text, '/test-skill 保留我的要求');
    await f.model.select('another-session');
    assert.equal(f.model.skills.getSnapshot().status, 'idle');
    assert.throws(() => f.model.skills.insert('test-skill', sid), /技能列表已变化/);
  } finally { await f.model.dispose(); }
});

test('Agent 模式用原生成接口选择空白会话，当前值来自投影且坏预设不可选', async () => {
  const f = fixture(true);
  try {
    await f.model.start(); await f.model.select(sid); await f.model.agentPresets.load();
    const face = f.model.reference.binding.session.projections;
    face.apply('agentPreset', 'standard', 0);
    await waitFor(() => f.model.snapshot.agentPreset === 'standard');
    assert.equal(f.model.snapshot.session.blank, true);
    assert.deepEqual(f.model.agentPresets.snapshot.options.map(item => item.id), ['standard', 'minimal']);
    await assert.rejects(f.model.agentPresets.choose('broken', sid), /不允许/);
    f.model.draft('我的要求');
    await f.model.agentPresets.choose('minimal', sid);
    assert.deepEqual(JSON.parse(JSON.stringify(f.calls.find(call => call.endpoint === 'agentPresets/select').payload.args)), { agentId: sid, agentPreset: 'minimal' });
    assert.equal(f.model.snapshot.agentPreset, 'standard');
    face.apply('agentPreset', 'minimal', 1);
    await waitFor(() => f.model.snapshot.agentPreset === 'minimal');
    assert.equal(f.model.snapshot.drafts[sid], '我的要求');
    const original = f.transport.call;
    f.transport.call = (...args) => args[1] === 'agentPresets/select' ? { ok: false, error: { code: 'agent-preset/locked', message: 'started on desktop' } } : original(...args);
    await assert.rejects(f.model.agentPresets.choose('standard', sid), /started on desktop/);
    assert.equal(f.model.snapshot.agentPreset, 'minimal');
    await f.model.select('another-session');
    assert.equal(f.model.snapshot.agentPreset, undefined);
    await assert.rejects(f.model.agentPresets.choose('standard', sid), /聊天开始/);
  } finally { await f.model.dispose(); }
});

test('Agent 选择与发消息互斥，未知结果不重放，目录失效后遵守电脑开关', async () => {
  const f = fixture(true), original = f.transport.call; let finish, disabled = false;
  f.transport.call = async (...args) => {
    if (args[1] === 'agentPresets/select') return new Promise(resolve => { finish = resolve; });
    const response = await original(...args);
    if (args[1] === 'agentPresets/list' && disabled) response.value.modeSelectionEnabled = false;
    return response;
  };
  try {
    await f.model.start(); await f.model.select(sid); await f.model.agentPresets.load();
    f.model.draft('保留草稿');
    const pending = f.model.agentPresets.choose('minimal', sid);
    await assert.rejects(f.model.send(), /模式正在切换/);
    await assert.rejects(f.model.agentPresets.choose('standard', sid), /模式正在切换/);
    await waitFor(() => !!finish); finish({ ok: false, error: { code: 'gateway/internal', message: 'unknown result' } });
    await assert.rejects(pending, /尚未确认/);
    await assert.rejects(f.model.agentPresets.choose('minimal', sid), /尚未确认/);
    const generation = f.model.connection.generation.getSnapshot().id;
    disabled = true; f.model.connection.reconnect();
    await waitFor(() => f.model.connection.generation.getSnapshot()?.id > generation);
    await waitFor(() => f.model.agentPresets.snapshot.status === 'ready');
    await assert.rejects(f.model.agentPresets.choose('minimal', sid), /不允许/);
    assert.equal(f.model.snapshot.drafts[sid], '保留草稿');
  } finally { await f.model.dispose(); }
});

test('Agent 目录错误可重试，旧读取不能覆盖新目录，历史会话不能切换', async () => {
  const f = fixture(), original = f.transport.call; let fail = true, delayed;
  f.transport.call = (...args) => args[1] !== 'agentPresets/list' ? original(...args)
    : fail ? { ok: false, error: { code: 'fixture/failure', message: 'roster failed' } }
    : new Promise(resolve => { delayed = resolve; });
  try {
    await f.model.start(); await f.model.agentPresets.load();
    assert.equal(f.model.agentPresets.snapshot.status, 'error');
    fail = false; const old = f.model.agentPresets.load(); await waitFor(() => !!delayed);
    const first = delayed;
    f.transport.call = original; await f.model.agentPresets.load();
    first({ ok: true, value: { presets: [], authorable: false, modeSelectionEnabled: false } });
    await old;
    assert.equal(f.model.agentPresets.snapshot.options.length, 2);
    assert.equal(f.model.agentPresets.snapshot.enabled, true);
    await f.model.select(sid);
    await assert.rejects(f.model.agentPresets.choose('minimal', sid), /聊天开始/);
    assert.equal(f.calls.some(call => call.endpoint === 'agentPresets/select'), false);
  } finally { await f.model.dispose(); }
});

test('权限选择使用真实生成命令，保留业务拒绝、确认门槛与当前会话投影', async () => {
  const f = fixture();
  try {
    await f.model.start(); await f.model.select(sid); await f.model.permissions.load();
    const face = f.model.reference.binding.session.projections;
    face.apply('permissions', { currentValue: 'read-only' }, 0);
    await waitFor(() => f.model.snapshot.permission?.currentValue === 'read-only');
    assert.equal(f.model.snapshot.permission.currentValue, 'read-only');
    f.model.draft('我的草稿');
    await assert.rejects(f.model.permissions.choose('danger-full-access', sid), /先确认/);
    await assert.rejects(f.model.permissions.choose('auto', sid), /先确认/);
    await assert.rejects(f.model.permissions.choose('unknown', sid), /列表已变化/);
    await assert.rejects(f.model.permissions.choose('workspace-write', 'another-session'), /当前聊天/);
    await f.model.permissions.choose('workspace-write', sid);
    assert.deepEqual(JSON.parse(JSON.stringify(f.calls.find(call => call.endpoint === 'commands/execute').payload.args)),
      { agentId: sid, line: '/permission workspace-write', submittedAttachments: [] });
    assert.equal(f.model.snapshot.permission.currentValue, 'read-only', 'admission is not a pushed confirmation');
    face.apply('permissions', { currentValue: 'workspace-write' }, 1);
    await waitFor(() => f.model.snapshot.permission?.currentValue === 'workspace-write');
    assert.equal(f.model.snapshot.permission.currentValue, 'workspace-write');
    assert.equal(f.model.snapshot.drafts[sid], '我的草稿');
    const original = f.transport.call;
    f.transport.call = (...args) => args[1] === 'commands/execute'
      ? { ok: true, value: { commandId: 'rejected', result: { kind: 'error', text: 'preset removed' } } } : original(...args);
    await assert.rejects(f.model.permissions.choose('read-only', sid), /preset removed/);
    assert.equal(f.model.snapshot.permission.currentValue, 'workspace-write');
    await f.model.select('another-session');
    assert.equal(f.model.snapshot.permission, undefined);
  } finally { await f.model.dispose(); }
});

test('计划开关只用固定原命令并等待电脑投影，切换会话不泄漏旧状态', async () => {
  const f = fixture(), original = f.transport.call;
  f.transport.capabilities.planModeControl = true;
  f.transport.call = (...args) => args[1] === 'commands/list' ? { ok: true, value: [{ name: 'plan', definitionId: '@deepseek-ai/dsh-plan-mode' }] } : original(...args);
  try {
    await f.model.start(); await f.model.select(sid); await f.model.planMode.load();
    const face = f.model.reference.binding.session.projections;
    face.apply('plan', { active: false, pending: false }, 0);
    await waitFor(() => f.model.snapshot.plan?.active === false);
    f.model.draft('保留草稿');
    await f.model.planMode.choose(true, sid);
    assert.deepEqual(JSON.parse(JSON.stringify(f.calls.find(call => call.endpoint === 'commands/execute').payload.args)),
      { agentId: sid, line: '/plan', submittedAttachments: [] });
    assert.deepEqual(f.model.snapshot.plan, { active: false, pending: false });
    assert.equal(f.calls.some(call => call.endpoint === 'session/prompt'), false);
    assert.equal(f.model.snapshot.drafts[sid], '保留草稿');
    face.apply('plan', { active: false, pending: true }, 1);
    await waitFor(() => f.model.snapshot.plan.pending);
    const writes = f.calls.length;
    await f.model.planMode.choose(true, sid);
    assert.equal(f.calls.length, writes);
    await f.model.planMode.choose(false, sid);
    assert.equal(f.calls.at(-1).payload.args.line, '/plan off');
    face.apply('plan', { active: true, pending: false }, 2);
    await waitFor(() => f.model.snapshot.plan.active);
    await assert.rejects(f.model.planMode.choose(false, 'another-session'), /当前聊天/);
    await f.model.select('another-session');
    assert.equal(f.model.snapshot.plan, undefined);
  } finally { await f.model.dispose(); }
});

test('计划命令不误用同名插件，旧目录不能覆盖新会话，旧版本拒绝写入', async () => {
  const f = fixture(), original = f.transport.call;
  let catalog = [{ name: 'plan', definitionId: '@third-party/plan' }], finish;
  f.transport.call = (...args) => args[1] === 'commands/list' ? (catalog ? { ok: true, value: catalog } : new Promise(resolve => { finish = resolve; })) : original(...args);
  try {
    await f.model.start(); await f.model.select(sid); await f.model.planMode.load();
    assert.equal(f.model.planMode.snapshot.available, false);
    await assert.rejects(f.model.planMode.choose(true, sid), /更新电脑/);
    f.transport.capabilities.planModeControl = true;
    catalog = null;
    const old = f.model.planMode.load();
    await waitFor(() => !!finish);
    await f.model.select('another-session');
    finish({ ok: true, value: [{ name: 'plan', definitionId: '@deepseek-ai/dsh-plan-mode' }] }); await old;
    assert.equal(f.model.planMode.snapshot.sessionId, 'another-session');
    assert.equal(f.model.planMode.snapshot.status, 'idle');
    assert.equal(f.model.planMode.snapshot.available, false);
    assert.equal(f.calls.some(call => call.endpoint === 'commands/execute'), false);
  } finally { await f.model.dispose(); }
});

test('计划切换与发送互斥，未知结果不重复执行，重连后重新核对投影', async () => {
  const f = fixture(), original = f.transport.call;
  let finish;
  f.transport.capabilities.planModeControl = true;
  f.transport.call = (...args) => args[1] === 'commands/list' ? { ok: true, value: [{ name: 'plan', definitionId: '@deepseek-ai/dsh-plan-mode' }] }
    : args[1] === 'commands/execute' ? new Promise(resolve => { finish = resolve; }) : original(...args);
  try {
    await f.model.start(); await f.model.select(sid); await f.model.planMode.load();
    f.model.reference.binding.session.projections.apply('plan', { active: false, pending: false }, 0);
    await waitFor(() => !!f.model.snapshot.plan);
    const request = f.model.planMode.choose(true, sid);
    f.model.draft('不能抢在开关确认之前发送');
    await assert.rejects(f.model.send(), /正在切换/);
    await assert.rejects(f.model.planMode.choose(true, sid), /正在提交/);
    await waitFor(() => !!finish);
    finish({ ok: false, error: { code: 'gateway/internal', message: 'disconnected' } });
    await assert.rejects(request, /尚未确认/);
    await assert.rejects(f.model.planMode.choose(true, sid), /尚未确认/);
    const generation = f.model.connection.generation.getSnapshot().id;
    f.model.connection.reconnect();
    await waitFor(() => f.model.connection.generation.getSnapshot()?.id > generation);
    await waitFor(() => f.model.planMode.snapshot.status === 'ready');
    await waitFor(() => f.model.snapshot.session?.openState === 'open');
    f.model.reference.binding.session.projections.apply('plan', { active: true, pending: false }, 10);
    await waitFor(() => f.model.snapshot.plan?.active === true);
    await f.model.planMode.choose(true, sid);
    assert.equal(f.model.planMode.pendingSessions.size, 0);
  } finally { await f.model.dispose(); }
});

test('权限目录失败可重试，写入并发/未知结果不重放，失效目录关闭旧选择', async () => {
  const f = fixture(), original = f.transport.call;
  let failure = true, finish;
  f.transport.call = (...args) => {
    if (args[1] === 'permissionPresets/catalog' && failure) return { ok: false, error: { code: 'fixture/failure', message: 'catalog failed' } };
    if (args[1] === 'commands/execute') return new Promise(resolve => { finish = resolve; });
    return original(...args);
  };
  try {
    await f.model.start(); await f.model.select(sid); await f.model.permissions.load();
    assert.equal(f.model.permissions.snapshot.status, 'error');
    failure = false; await f.model.permissions.load(true);
    assert.equal(f.model.permissions.snapshot.status, 'ready');
    f.model.reference.binding.session.projections.apply('permissions', { currentValue: 'read-only' }, 0);
    await waitFor(() => f.model.snapshot.permission?.currentValue === 'read-only');
    const pending = f.model.permissions.choose('workspace-write', sid);
    await assert.rejects(f.model.permissions.choose('workspace-write', sid), /正在切换/);
    finish({ ok: false, error: { code: 'gateway/internal', message: 'disconnected' } });
    await assert.rejects(pending, /尚未确认/);
    await assert.rejects(f.model.permissions.choose('workspace-write', sid), /尚未确认/);
    const revision = f.model.permissions.snapshot.revision;
    f.channels.get('$events').push({ type: 'emit', event: 'permission-presets/catalog-changed', args: [] });
    await waitFor(() => f.model.permissions.snapshot.revision > revision);
    await waitFor(() => f.model.permissions.snapshot.status === 'ready');
    const generation = f.model.connection.generation.getSnapshot().id;
    f.model.connection.reconnect();
    await waitFor(() => f.model.connection.generation.getSnapshot()?.id > generation);
    await waitFor(() => f.model.permissions.snapshot.status === 'ready');
  } finally { await f.model.dispose(); }
});

test('技能读取失败可重试，切会话或断线后迟到目录不能覆盖当前会话', async () => {
  const f = fixture(), original = f.transport.call;
  let failure = true, hold = false, delayed;
  f.transport.call = (...args) => {
    if (args[1] !== 'skills/list') return original(...args);
    if (failure) return { ok: false, error: { code: 'fixture/skills', message: '读取失败' } };
    if (hold) return new Promise(resolve => { delayed = resolve; });
    return original(...args);
  };
  try {
    await f.model.start(); await f.model.select(sid);
    await f.model.skills.load();
    assert.equal(f.model.skills.getSnapshot().status, 'error');
    failure = false; await f.model.skills.load();
    assert.equal(f.model.skills.getSnapshot().status, 'ready', f.model.skills.getSnapshot().error);
    hold = true; const pending = f.model.skills.load();
    await f.model.select('another-session');
    hold = false; await f.model.skills.load();
    delayed({ ok: true, value: { skills: [{ name: 'late-old-session', description: '', modelInvocable: true }] } });
    await pending;
    assert.equal(f.model.skills.getSnapshot().sessionId, 'another-session');
    assert.equal(f.model.skills.getSnapshot().items.some(item => item.name === 'late-old-session'), false);
    const old = f.channels.get('$events'), calls = f.calls.filter(call => call.endpoint === 'skills/list').length;
    old.push({ type: 'emit', event: 'agent-preset/selected', args: ['another-session'] });
    await waitFor(() => f.calls.filter(call => call.endpoint === 'skills/list').length > calls);
    await waitFor(() => f.model.skills.getSnapshot().status === 'ready');
    hold = true; const reconnectPending = f.model.skills.load();
    const generation = f.model.connection.generation.getSnapshot().id;
    hold = false; f.model.connection.reconnect();
    await waitFor(() => f.model.connection.generation.getSnapshot()?.id > generation);
    await waitFor(() => f.model.skills.getSnapshot().status === 'ready');
    delayed({ ok: true, value: { skills: [{ name: 'late-old-connection', description: '', modelInvocable: true }] } });
    await reconnectPending;
    assert.equal(f.model.skills.getSnapshot().items.some(item => item.name === 'late-old-connection'), false);
    assert.equal(f.calls.some(call => call.endpoint === 'session/prompt'), false);
  } finally { await f.model.dispose(); }
});

test('手机会话层使用真实上游服务：列表/工作区/会话，不加载电脑 renderer', async () => {
  const f = fixture();
  try {
    await f.model.start(); await tick();
    assert.equal(f.model.getSnapshot().workspaces.items[0].workspaceId, 'existing');
    assert.deepEqual(JSON.parse(JSON.stringify(f.calls.find(call => call.endpoint === 'session/list').payload)), { args: { _request: {} } });
    assert.ok(f.model.ctx.get('remote.session'));
    assert.ok(f.model.ctx.get('remote.workspace'));
    assert.equal(f.model.remote.$host.home, '/home/test');
    assert.equal(f.model.remote.$host.isLoopback, false);
    await f.model.select(sid); await tick();
    assert.equal(f.model.getSnapshot().session.openState, 'open');
    assert.ok(f.model.getSnapshot().conversation);
    assert.equal(f.model.ctx.get('uiRenderer'), undefined);
    assert.equal(f.model.ctx.get('uiLayout'), undefined);
    await assert.rejects(f.model.create('/arbitrary/directory'), /remote_workspace_required/);
    assert.equal(f.calls.some(call => call.endpoint === 'session/create'), false);
  } finally { await f.model.dispose(); }
  assert.equal(f.channels.size, 0);
});

test('原会话实时公告进入手机聊天投影，按轮归属且新公告替换旧记录', async () => {
  const f = fixture();
  try {
    await f.model.start(); await f.model.select(sid); await tick();
    const follow = f.channels.get('session/follow');
    const emit = (seq, type, turn) => follow.push({ type: 'event', event: { type, seq, time: seq, data: { turn } } });
    emit(0, 'turn/start', 1); emit(1, 'workspace/changes', 1);
    emit(2, 'turn/start', 2); emit(3, 'workspace/changes', 2); emit(4, 'workspace/changes', 1);
    await tick();
    const snapshot = f.model.getSnapshot().conversation;
    const changes = snapshot.order.map(key => snapshot.nodes.get(key)).filter(node => node.kind === 'remote-changes');
    assert.deepEqual(changes.map(node => node.data), [{ turn: 2, seq: 3 }, { turn: 1, seq: 4 }]);
    await f.model.select('another-session'); await tick();
    assert.equal([...f.model.getSnapshot().conversation.nodes.values()].some(node => node.kind === 'remote-changes'), false);
  } finally { await f.model.dispose(); }
});

test('原 Gateway 仅有一个连接循环；插件事件随自身卸载且 Agent 引用释放', async () => {
  const f = fixture(); let count = 0;
  try {
    await f.model.start();
    assert.throws(() => f.model.connection.start({}), /already|owner|started/i);
    const plugin = f.model.ctx.plugin({ name: 'owned-events-test', inject: ['remote'], apply(ctx) {
      ctx.remote.$on('fixture/changed', () => { count++; });
    } });
    await plugin.await();
    f.channels.get('$events').push({ type: 'emit', event: 'fixture/changed', args: [] }); await tick();
    assert.equal(count, 1);
    await plugin.dispose();
    f.channels.get('$events').push({ type: 'emit', event: 'fixture/changed', args: [] }); await tick();
    assert.equal(count, 1);
    f.channels.get('$events').push({ type: 'waterfall', event: 'user-questions/request', eventId: 'question-wire', agentId: sid,
      request: { questions: [{ id: 'q', question: '继续？', options: [{ label: '继续' }] }] } });
    await waitFor(() => f.model.getSnapshot().events.length === 1);
    const key = f.model.getSnapshot().events[0].eventId;
    assert.equal(f.model.interactions.get(key).sessionId, sid);
    f.channels.get('$events').push({ type: 'cancel', eventId: 'question-wire' });
    await waitFor(() => f.model.interactions.size === 0);
    await assert.rejects(f.model.answer(key, { kind: 'result', value: {} }), /expired/);
    assert.equal(f.calls.some(call => call.endpoint === '$events/result'), false);
  } finally { await f.model.dispose(); }
  assert.equal(f.channels.size, 0);
});

test('原 Connection 重建世代取消旧审批，保留草稿并只使用新世代事件身份', async () => {
  const f = fixture();
  try {
    await f.model.start(); await f.model.select(sid); f.model.draft('保留且不重发');
    const events = f.channels.get('$events'), generation = f.model.connection.generation.getSnapshot().id;
    events.push({ type: 'waterfall', event: 'approval/request', eventId: 'old-wire', agentId: sid, request: { toolName: 'write_file' } });
    await waitFor(() => f.model.getSnapshot().events.length === 1);
    const key = f.model.getSnapshot().events[0].eventId;
    f.model.connection.reconnect();
    await waitFor(() => f.model.connection.generation.getSnapshot()?.id > generation);
    assert.notEqual(f.channels.get('$events'), events);
    assert.equal(f.model.interactions.size, 0);
    await assert.rejects(f.model.answer(key, { kind: 'result', value: 'allowed-once' }), /expired/);
    assert.equal(f.model.getSnapshot().drafts[sid], '保留且不重发');
    assert.equal(f.calls.some(call => call.endpoint === 'session/prompt' || call.endpoint === '$events/result'), false);
    assert.equal(f.channels.size, 4);
  } finally { await f.model.dispose(); }
  assert.equal(f.channels.size, 0);
});

test('审批回传失败会结束当前世代并释放所有待答复，不重发旧答案', async () => {
  const f = fixture(), call = f.transport.call;
  let replies = 0;
  f.transport.call = (...args) => {
    if (args[1] !== '$events/result') return call(...args);
    replies++;
    return { ok: false, error: { code: 'gateway/internal', message: 'fixture reply delivery failed', details: {} } };
  };
  try {
    await f.model.start();
    const generation = f.model.connection.generation.getSnapshot().id;
    const events = f.channels.get('$events');
    for (const eventId of ['answer-me', 'cancel-with-generation']) events.push({ type: 'waterfall', event: 'approval/request', eventId, agentId: sid, request: { toolName: 'write_file' } });
    await waitFor(() => f.model.interactions.size === 2);
    const [first, second] = f.model.getSnapshot().events;
    await f.model.answer(first.eventId, { kind: 'result', value: 'allowed-once' });
    await waitFor(() => f.model.connection.generation.getSnapshot()?.id > generation);
    assert.equal(f.model.interactions.size, 0);
    assert.equal(replies, 1);
    await assert.rejects(f.model.answer(second.eventId, { kind: 'result', value: 'allowed-once' }), /expired/);
  } finally { await f.model.dispose(); }
});

test('真实接口声明约束参数个数，调用取消传至载体，缺定义不能启动假服务', async () => {
  const f = fixture(), call = f.transport.call;
  let inFlightSignal;
  f.transport.call = (...args) => {
    if (args[1] !== 'skills/list') return call(...args);
    inFlightSignal = args[3];
    return new Promise((resolve, reject) => inFlightSignal.addEventListener('abort', () => reject(inFlightSignal.reason), { once: true }));
  };
  try {
    await f.model.start();
    await assert.rejects(f.model.remote.session.list(), /expected.*argument/);
    const controller = new AbortController();
    const task = f.model.remote.skills.list({ sessionId: sid }, controller.signal);
    assert.ok(inFlightSignal); controller.abort();
    const result = await task;
    assert.equal(result.ok, false); assert.equal(result.error.code, 'gateway/cancelled');
    assert.equal(inFlightSignal.aborted, true);
    const reference = f.model.sessions.retainAgentScope(sid);
    assert.equal(f.model.ctx.typert.contexts.getClient('agent').identity(reference.binding.ctx), sid);
    reference.release();
  } finally { await f.model.dispose(); }
  const absent = fixture(); absent.model.loadRemotes = undefined;
  try { await assert.rejects(absent.model.start(), /remote_definitions_required/); assert.equal(absent.channels.size, 0); }
  finally { await absent.model.dispose(); }
});

test('手机发送保留会话和 requestId，电脑状态与模型变化更新同一份投影', async () => {
  const f = fixture();
  try {
    await f.model.start(); await f.model.select(sid); await tick();
    f.model.draft('直接修改这个项目'); await f.model.send();
    const request = f.calls.find(call => call.endpoint === 'session/prompt').payload.args.request;
    assert.equal(request.sessionId, sid); assert.equal(request.mode, 'queue');
    assert.equal(request.content[0].text, '直接修改这个项目'); assert.ok(request.requestId);
    assert.equal(f.model.getSnapshot().drafts[sid], '');
    f.channels.get('$events').push({ type: 'emit', event: 'api-session/status', args: [sid, true] });
    f.channels.get('session/control').push({ type: 'projection', sessionId: sid, key: 'modelSelection', seq: 1, value: { next: { provider: 'deepseek', model: 'flash' }, lastUsed: null } });
    await tick();
    assert.equal(f.model.getSnapshot().session.running, true);
    assert.equal(f.model.getSnapshot().model.next.model, 'flash');
    await assert.rejects(f.model.chooseModel({ provider: 'deepseek', model: 'pro' }), /remote_model_busy/);
  } finally { await f.model.dispose(); }
});

test('模型目录失败保留聊天，电脑配置事件与重连刷新目录，旧世代结果不能覆盖新目录', async () => {
  const f = fixture(), call = f.transport.call; let fail = true, version = 'v1', release;
  f.transport.call = async (...args) => {
    if (args[1] !== 'session/modelCatalog') return call(...args);
    if (fail) return { ok: false, error: { code: 'catalog/unavailable', message: 'test outage' } };
    const selected = version;
    if (selected === 'delayed') await new Promise(resolve => { release = resolve; });
    return { ok: true, value: { default: { provider: 'test', model: selected }, routableProviders: ['test'], groups: [], failures: [] } };
  };
  try {
    await f.model.start(); await f.model.select(sid); await tick();
    assert.equal(f.model.getSnapshot().ready, true);
    assert.equal(f.model.getSnapshot().session.openState, 'open');
    assert.match(f.model.getSnapshot().catalogError, /test outage/);
    fail = false; await f.model.modelCatalog.load();
    assert.equal(f.model.getSnapshot().catalog.default.model, 'v1');
    version = 'delayed'; f.channels.get('$events').push({ type: 'emit', event: 'llm/adapters-updated', args: [] });
    await waitFor(() => !!release);
    version = 'v2'; f.model.connection.reconnect();
    await waitFor(() => f.model.getSnapshot().catalog?.default.model === 'v2');
    release(); await tick();
    assert.equal(f.model.getSnapshot().catalog.default.model, 'v2');
  } finally { release?.(); await f.model.dispose(); }
});

test('模型切换绑定原会话、不乐观覆盖投影、不并发重复提交，未知结果不重放', async () => {
  const f = fixture(), call = f.transport.call; let finish, failure = false;
  f.transport.call = async (...args) => {
    if (args[1] !== 'session/selectModel') return call(...args);
    f.calls.push({ endpoint: args[1], payload: args[2] });
    if (failure) throw new Error('network timeout');
    await new Promise(resolve => { finish = resolve; });
    return { ok: true, value: { selected: { provider: 'deepseek', model: 'pro' } } };
  };
  try {
    await f.model.start(); await f.model.select(sid); await tick();
    f.channels.get('session/control').push({ type: 'projection', sessionId: sid, key: 'modelSelection', seq: 1, value: { next: { provider: 'deepseek', model: 'flash' }, lastUsed: null } });
    await waitFor(() => f.model.getSnapshot().model?.next?.model === 'flash');
    const task = f.model.chooseModel({ sessionId: 'wrong-session', provider: 'deepseek', model: 'pro' });
    await waitFor(() => !!finish);
    await assert.rejects(f.model.chooseModel({ provider: 'deepseek', model: 'pro' }), /正在切换/);
    assert.equal(f.model.getSnapshot().model.next.model, 'flash');
    const switched = f.model.select('another-session');
    assert.equal(f.model.getSnapshot().model, null);
    await switched; finish(); await task;
    assert.equal(f.model.getSnapshot().selected, 'another-session');
    assert.equal(f.model.getSnapshot().model?.next, undefined);
    assert.equal(f.calls.find(call => call.endpoint === 'session/selectModel').payload.args.request.sessionId, sid);
    await tick(); failure = true;
    await assert.rejects(f.model.chooseModel({ provider: 'deepseek', model: 'pro' }), /尚未确认/);
    assert.equal(f.calls.filter(call => call.endpoint === 'session/selectModel').length, 2);
    assert.equal(f.model.selectingModels.size, 0);
  } finally { finish?.(); await f.model.dispose(); }
});

test('正式会话投影的导航摘要随流式内容更新，新增轮次保持旧摘要，切换会话隔离', async () => {
  const f = fixture();
  try {
    await f.model.start(); await f.model.select(sid); await tick();
    const follow = f.channels.get('session/follow');
    const emit = (seq, type, data, extra = {}) => follow.push({ type: 'event', event: { seq, time: seq * 10, type, data, ...extra } });
    const items = () => f.model.getSnapshot().conversation.navigation.items();
    emit(0, 'turn/start', { turn: 1 }); emit(1, 'step/start', { turn: 1, step: 1 });
    emit(2, 'assistant/live-chunk', { turn: 1, step: 1, chunk: { type: 'text-delta', index: 0, text: '流式第一段' } });
    await waitFor(() => items()[0]?.response === '流式第一段');
    emit(3, 'assistant/live-chunk', { turn: 1, step: 1, chunk: { type: 'text-delta', index: 0, text: '，第二段' } });
    await waitFor(() => items()[0]?.response === '流式第一段，第二段');
    emit(4, 'assistant/message', { turn: 1, step: 1, stream: [], message: { id: 'navigation-answer', role: 'assistant',
      content: [{ type: 'text', text: '最终内容' }], source: { kind: 'model', provider: 'test', model: 'test' } } }, { surfaceOp: 'append' });
    emit(5, 'step/end', { turn: 1, step: 1 }); emit(6, 'turn/end', { turn: 1, reason: { kind: 'completed' } });
    await waitFor(() => items()[0]?.response === '最终内容');
    const first = items()[0];
    emit(7, 'turn/start', { turn: 2 }); emit(8, 'step/start', { turn: 2, step: 1 });
    emit(9, 'assistant/live-chunk', { turn: 2, step: 1, chunk: { type: 'text-delta', index: 0, text: '另一轮' } });
    await waitFor(() => items().at(-1)?.response === '另一轮');
    assert.equal(items()[0], first);
    await f.model.select('another-session'); await tick();
    assert.deepEqual(items(), []);
  } finally { await f.model.dispose(); }
});

test('按轮分支使用原会话投影的真实消息位置，不用轮号或 UI 排序号', async () => {
  const f = fixture();
  try {
    await f.model.start(); await f.model.select(sid); await tick();
    const follow = f.channels.get('session/follow');
    const emit = (seq, type, data, extra = {}) => follow.push({ type: 'event', event: { seq, time: seq * 10, type, data, ...extra } });
    emit(0, 'turn/start', { turn: 1 }); emit(1, 'step/start', { turn: 1, step: 1 });
    emit(2, 'assistant/message', { turn: 1, step: 1, stream: [], message: { id: 'answer', role: 'assistant',
      content: [{ type: 'text', text: '已完成的答复' }], source: { kind: 'model', provider: 'test', model: 'test' } } }, { surfaceOp: 'append' });
    emit(3, 'step/end', { turn: 1, step: 1 });
    await tick();
    assert.equal([...f.model.getSnapshot().conversation.nodes.values()].some(node => node.kind === 'turn-tail'), false);
    emit(4, 'turn/end', { turn: 1, reason: { kind: 'completed' } }); await tick();
    const conversation = f.model.getSnapshot().conversation;
    const tail = [...conversation.nodes.values()].find(node => node.kind === 'turn-tail');
    assert.ok(tail); assert.equal(turnForkAnchor(conversation, tail.key), 2);
    assert.notEqual(tail.anchorSeq, 2);
    emit(5, 'workspace/changes', { turn: 1 }); await tick();
    assert.equal(turnForkAnchor(f.model.getSnapshot().conversation, tail.key), 2, '文件差异入口不改变分支边界');
    await f.model.forkTurn(tail.key, sid);
    assert.deepEqual(f.calls.find(call => call.endpoint === 'session/fork').payload.args.request, { sessionId: sid, atSeq: 2 });
    assert.equal(f.model.getSnapshot().selected, 'forked-session');
    await assert.rejects(f.model.forkTurn(tail.key, sid), /聊天已切换/);
    await assert.rejects(f.model.forkTurn(tail.key, 'forked-session'), /暂时不能分支/);
    assert.equal(f.calls.filter(call => call.endpoint === 'session/fork').length, 1);
  } finally { await f.model.dispose(); }
});

test('分支在途重复提交被拒绝，迟到结果不能覆盖后来选择的会话', async () => {
  const f = fixture(); let finish;
  const original = f.transport.call;
  f.transport.call = (...args) => args[1] === 'session/fork'
    ? new Promise(resolve => { finish = () => resolve({ ok: true, value: { sessionId: 'late-child' } }); }) : original(...args);
  try {
    await f.model.start(); await f.model.select(sid);
    f.model.draft('原聊天草稿');
    const task = f.model.fork();
    await assert.rejects(f.model.fork(), /正在创建分支/);
    await f.model.select('another-session'); finish(); await task;
    assert.equal(f.model.getSnapshot().selected, 'another-session');
    assert.equal(f.model.getSnapshot().drafts[sid], '原聊天草稿');
    assert.ok(f.model.getSnapshot().list.byId['late-child']);
  } finally { await f.model.dispose(); }
});

for (const sidebar of [false, true]) {
  for (const operation of ['create', 'fork']) {
    test(`${sidebar ? '旁栏' : '主聊天'}${operation}迟到时不抢占尚在查询的较新导航`, async () => {
      const f = fixture(); let finish, releaseList;
      const original = f.transport.call;
      f.transport.call = (...args) => args[1] === `session/${operation}`
        ? new Promise(resolve => { finish = () => resolve({ ok: true, value: { sessionId: 'late-child' } }); })
        : original(...args);
      let view;
      try {
        await f.model.start(); await f.model.select(sid);
        view = sidebar ? new RemoteConversationModel(f.model) : f.model;
        if (sidebar) await view.select(sid);
        await view.draft('导航期间保留草稿');
        const task = operation === 'create' ? view.create(workspace.workspaceId) : view.fork();
        await waitFor(() => finish);
        // 后来的选择先等待目录刷新；selected 尚未改变，单比较 selection 不足以识别它。
        const refresh = f.model.sessions.refresh.bind(f.model.sessions);
        f.model.sessions.refresh = () => new Promise(resolve => { releaseList = async () => { await refresh(); resolve(); }; });
        const navigation = view.select('not-yet-listed');
        await waitFor(() => releaseList);
        finish(); await task;
        assert.equal(view.getSnapshot().selected, sid);
        assert.ok(f.model.sessions.list.getSnapshot().byId['late-child'], '已创建结果仍保留在电脑会话目录投影');
        await releaseList();
        await assert.rejects(navigation, /暂时无法打开/);
        assert.equal(view.getSnapshot().selected, sid);
        assert.equal(f.model.getSnapshot().drafts[sid], '导航期间保留草稿');
      } finally { if (sidebar) view?.dispose(); await f.model.dispose(); }
    });
  }
}

test('新建聊天响应不能覆盖后来已经打开的聊天', async () => {
  const f = fixture(); let finish;
  const original = f.transport.call;
  f.transport.call = (...args) => args[1] === 'session/create'
    ? new Promise(resolve => { finish = () => resolve({ ok: true, value: { sessionId: 'late-created' } }); }) : original(...args);
  try {
    await f.model.start(); await f.model.select(sid);
    const task = f.model.create(workspace.workspaceId); await waitFor(() => finish);
    await f.model.select('another-session'); finish(); await task;
    assert.equal(f.model.snapshot.selected, 'another-session');
    assert.ok(f.model.sessions.list.getSnapshot().byId['late-created']);
  } finally { await f.model.dispose(); }
});

test('同一视图先后创建以最后意图为准，旁栏导航不取消主聊天导航', async () => {
  const f = fixture(), finishes = [];
  const original = f.transport.call;
  f.transport.call = (...args) => args[1] === 'session/create'
    ? new Promise(resolve => finishes.push(id => resolve({ ok: true, value: { sessionId: id } }))) : original(...args);
  let aside;
  try {
    await f.model.start(); await f.model.select(sid);
    const first = f.model.create(workspace.workspaceId);
    const last = f.model.create(workspace.workspaceId);
    await waitFor(() => finishes.length === 2);
    finishes[0]('first-created'); await first;
    assert.equal(f.model.snapshot.selected, sid);
    aside = new RemoteConversationModel(f.model); await aside.select('another-session');
    finishes[1]('last-created'); assert.equal(await last, 'last-created');
    assert.equal(f.model.snapshot.selected, 'last-created');
    assert.equal(aside.snapshot.selected, 'another-session');
  } finally { aside?.dispose(); await f.model.dispose(); }
});

test('离线创建不发请求，关闭旁栏后的已确认创建结果不重新打开旁栏', async () => {
  const f = fixture(); let finish, aside;
  const original = f.transport.call;
  f.transport.call = (...args) => args[1] === 'session/create'
    ? new Promise(resolve => { finish = () => resolve({ ok: true, value: { sessionId: 'closed-aside-created' } }); }) : original(...args);
  try {
    await f.model.start(); await f.model.select(sid);
    f.model.publish({ connectionState: 'disconnected' });
    await assert.rejects(f.model.create(workspace.workspaceId), /暂时离线/); assert.equal(finish, undefined);
    f.model.publish({ connectionState: 'connected' });
    aside = new RemoteConversationModel(f.model); await aside.select(sid);
    const task = aside.create(workspace.workspaceId); await waitFor(() => finish);
    aside.dispose(); finish(); await task;
    assert.equal(f.model.snapshot.selected, sid);
    assert.equal(aside.view.reference, null);
    assert.ok(f.model.sessions.list.getSnapshot().byId['closed-aside-created']);
  } finally { aside?.dispose(); await f.model.dispose(); }
});

test('归档响应不清除稍后发起但仍在查询的导航', async () => {
  const f = fixture(); let finish, releaseList;
  const original = f.transport.call;
  f.transport.call = (...args) => args[1] === 'workspace/archiveSession'
    ? new Promise(resolve => { finish = () => resolve({ ok: true, value: { archivedSessionIds: [sid] } }); }) : original(...args);
  try {
    await f.model.start(); await f.model.select(sid);
    const task = f.model.archive(true); await waitFor(() => finish);
    const refresh = f.model.sessions.refresh.bind(f.model.sessions);
    f.model.sessions.refresh = () => new Promise(resolve => { releaseList = async () => { await refresh(); resolve(); }; });
    const navigation = f.model.select('not-yet-listed'); await waitFor(() => releaseList);
    finish(); await task;
    assert.equal(f.model.snapshot.selected, sid);
    assert.ok(f.model.workspaces.getSnapshot().archivedSessionIds.includes(sid));
    await releaseList(); await assert.rejects(navigation, /暂时无法打开/);
  } finally { await f.model.dispose(); }
});

test('uiWorkspace 使用真实工作区空会话，目录操作明确拒绝且不发RPC', async () => {
  const f = fixture(true), call = f.transport.call;
  f.transport.call = async (...args) => {
    const result = await call(...args);
    return args[1] === 'session/list' ? { ...result, value: { items: result.value.items.map(item => ({ ...item, cwd: workspace.path })) } } : result;
  };
  try {
    await f.model.start(); await waitFor(() => f.model.workspaces.getSnapshot().items.length > 0);
    const api = f.model.ctx.uiWorkspace;
    assert.equal(await api.connectWorkspace(workspace.workspaceId), sid);
    assert.equal(f.calls.some(item => item.endpoint === 'session/create'), false);
    const count = f.calls.length;
    for (const invoke of [() => api.pickDirectory(), () => api.listDirectory('/'), () => api.createDirectory('/', 'new')]) {
      await assert.rejects(invoke(), error => error.code === 'remote_directory_navigation_disabled');
    }
    assert.equal(f.calls.length, count);
    await assert.rejects(api.connectWorkspace('missing'), /工作区已不存在/);
  } finally { await f.model.dispose(); }
});

test('uiWorkspace 合并同一工作区在途创建，connect不导航，open准备回调可以被后续导航取代', async () => {
  const f = fixture(); let finish, creates = 0;
  const call = f.transport.call;
  f.transport.call = (...args) => args[1] === 'session/create'
    ? new Promise(resolve => { creates++; finish = () => resolve({ ok: true, value: { sessionId: 'prepared' } }); }) : call(...args);
  try {
    await f.model.start(); await f.model.select(sid); const api = f.model.ctx.uiWorkspace;
    const first = api.connectWorkspace(workspace.workspaceId), second = api.connectWorkspace(workspace.workspaceId);
    await waitFor(() => finish); assert.equal(creates, 1); finish();
    assert.deepEqual(await Promise.all([first, second]), ['prepared', 'prepared']);
    assert.equal(f.model.snapshot.selected, sid);
    finish = null; let prepared;
    const open = api.openWorkspace(workspace.workspaceId, id => { prepared = id; api.openSession('another-session'); });
    await waitFor(() => finish); finish(); await open;
    await waitFor(() => f.model.snapshot.selected === 'another-session');
    assert.equal(prepared, 'prepared'); assert.equal(f.model.snapshot.selected, 'another-session');
  } finally { await f.model.dispose(); }
});

test('uiWorkspace 迟到创建不调用准备回调，失败保持当前聊天并可重试', async () => {
  const f = fixture(); let finish;
  const call = f.transport.call;
  f.transport.call = (...args) => args[1] === 'session/create'
    ? new Promise(resolve => { finish = result => resolve(result); }) : call(...args);
  try {
    await f.model.start(); await f.model.select(sid); const api = f.model.ctx.uiWorkspace;
    let prepared = false;
    const first = api.openWorkspace(workspace.workspaceId, () => { prepared = true; });
    await waitFor(() => finish); api.openSession('another-session');
    finish({ ok: true, value: { sessionId: 'late-created' } }); await first;
    assert.equal(prepared, false); assert.equal(f.model.snapshot.selected, 'another-session');
    finish = null; const failed = api.openWorkspace(workspace.workspaceId);
    await waitFor(() => finish); finish({ ok: false, error: { code: 'denied', message: 'creation denied' } });
    await assert.rejects(failed); assert.equal(f.model.snapshot.selected, 'another-session');
    finish = null; const retry = api.openWorkspace(workspace.workspaceId);
    await waitFor(() => finish); finish({ ok: true, value: { sessionId: 'retry-created' } }); await retry;
    assert.equal(f.model.snapshot.selected, 'retry-created');
  } finally { await f.model.dispose(); }
});

test('uiWorkspace 原契约始终导航主聊天，成功才收起旁栏，保留旁栏内容', async () => {
  const f = fixture(); let aside, expanded = true;
  try {
    await f.model.start(); await f.model.select(sid);
    aside = new RemoteConversationModel(f.model); await aside.select(sid);
    f.model.pluginPanels = { isExpanded: () => expanded, toggleExpanded: () => { expanded = !expanded; } };
    f.model.ctx.uiWorkspace.openSession('another-session');
    await waitFor(() => !expanded);
    assert.equal(f.model.snapshot.selected, 'another-session'); assert.equal(aside.snapshot.selected, sid);
    await f.model.ctx.uiWorkspace.forkSession(sid);
    assert.equal(f.model.snapshot.selected, 'forked-session');
    assert.equal(f.calls.find(item => item.endpoint === 'session/fork').payload.args.request.sessionId, sid);
  } finally { aside?.dispose(); await f.model.dispose(); }
});

test('uiWorkspace 新聊天继承当前工作区，归档/恢复保持电脑结果，失败不清除选择', async () => {
  const f = fixture();
  try {
    await f.model.start(); await f.model.select(sid); const api = f.model.ctx.uiWorkspace;
    api.startSession(); await waitFor(() => f.model.snapshot.selected === 'new-session');
    assert.equal(f.calls.find(item => item.endpoint === 'session/create').payload.args.request.workspaceId, workspace.workspaceId);
    await api.archiveSession(sid); assert.equal(f.model.snapshot.selected, 'new-session');
    await api.unarchiveSession(sid); assert.equal(f.model.workspaces.getSnapshot().archivedSessionIds.includes(sid), false);
    await api.archiveSession('new-session'); assert.equal(f.model.snapshot.selected, null);
    await f.model.select(sid);
    const call = f.transport.call;
    f.transport.call = (...args) => args[1] === 'workspace/archiveSession'
      ? Promise.resolve({ ok: false, error: { code: 'denied', message: 'archive denied' } }) : call(...args);
    await assert.rejects(api.archiveSession(sid), /archive denied/); assert.equal(f.model.snapshot.selected, sid);
    f.model.workspaces.replaceBaseline({ items: [], archivedSessionIds: [] }); api.startSession();
    await waitFor(() => f.model.snapshot.selected === null);
  } finally { await f.model.dispose(); }
});

test('上游事件协议保留审批归属，取消后拒绝旧答案，未知扩展继续委派', async () => {
  const f = fixture();
  try {
    await f.model.start(); await tick();
    const events = f.channels.get('$events');
    events.push({ type: 'waterfall', event: 'approval/request', eventId: 'approval-1', agentId: sid, request: { toolName: 'write_file' } });
    await tick(); assert.equal(f.model.getSnapshot().events.length, 1);
    const key = f.model.getSnapshot().events[0].eventId;
    assert.notEqual(key, 'approval-1');
    await f.model.answer(key, { kind: 'result', value: 'allowed-once' }); await tick();
    assert.deepEqual(f.calls.at(-1).payload, { args: { clientId: 'test-event-client', eventId: 'approval-1', outcome: { kind: 'result', value: 'allowed-once' } } });
    await assert.rejects(f.model.answer(key, { kind: 'result', value: 'allowed-once' }), /remote_event_expired/);
    events.push({ type: 'waterfall', event: 'approval/request', eventId: 'approval-2', agentId: sid, request: { toolName: 'write_file' } });
    events.push({ type: 'cancel', eventId: 'approval-2' });
    events.push({ type: 'waterfall', event: 'unrecognised/request', eventId: 'plugin-1', agentId: sid, request: {} });
    await tick();
    assert.equal(f.model.getSnapshot().events.length, 0);
    assert.equal(f.calls.at(-1).payload.args.outcome.kind, 'next');
    await assert.rejects(f.model.answer('approval-2', { kind: 'result', value: 'allowed-once' }), /remote_event_expired/);
  } finally { await f.model.dispose(); }
});

test('计划确认保留 Host 原选项，提出修改回传 ASK_CANCELLED，过期请求不能重发', async () => {
  const f = fixture();
  const questions = [{ id: 'review', question: '确认计划？', detail: '# 计划\n\n仅检查同步。',
    options: [{ label: '继续规划' }, { label: '同意原计划' }], intent: { kind: 'plan-review', approve: '同意原计划' } }];
  try {
    await f.model.start(); await tick();
    const events = f.channels.get('$events');
    const request = async id => {
      events.push({ type: 'waterfall', event: 'user-questions/request', eventId: id, agentId: sid, request: { questions } });
      await waitFor(() => f.model.snapshot.events.length === 1);
      return f.model.snapshot.events[0].eventId;
    };
    const key = await request('plan-approve');
    const value = { answers: [{ id: 'review', selected: ['同意原计划'] }] };
    const answers = await Promise.allSettled([f.model.answer(key, { kind: 'result', value }), f.model.answer(key, { kind: 'result', value })]);
    assert.deepEqual(answers.map(answer => answer.status), ['fulfilled', 'rejected']);
    await waitFor(() => f.calls.some(call => call.endpoint === '$events/result'));
    const results = () => f.calls.filter(call => call.endpoint === '$events/result').map(call => call.payload.args);
    assert.equal(results().length, 1);
    assert.deepEqual(results()[0].outcome, { kind: 'result', value });
    const discuss = await request('plan-discuss');
    await f.model.answer(discuss, { kind: 'cancel' });
    await waitFor(() => results().length === 2);
    assert.equal(results()[1].outcome.kind, 'rejected');
    assert.equal(results()[1].outcome.error.code, 'ASK_CANCELLED');
    const stale = await request('plan-other-client');
    events.push({ type: 'cancel', eventId: 'plan-other-client' });
    await waitFor(() => f.model.snapshot.events.length === 0);
    await assert.rejects(f.model.answer(stale, { kind: 'result', value }), /remote_event_expired/);
    assert.equal(results().length, 2);
  } finally { await f.model.dispose(); }
});

test('两个原客户端同时回答时，原 Host 只接受首个结果并结束两端交互', { timeout: 5000 }, async () => {
  const host = await eventHost(), clients = [fixture(), fixture()];
  const questions = [{ id: 'question', question: '由哪端处理？', options: [{ label: '手机' }, { label: '电脑' }] }];
  try {
    for (const f of clients) host.connect(f.transport);
    await Promise.all(clients.map(f => f.model.start()));
    for (const event of ['user-questions/request', 'approval/request']) {
      const pending = host.dispatch(event, event === 'approval/request' ? { toolName: 'test-only' } : { questions }, sid);
      await waitFor(() => clients.every(f => f.model.snapshot.events.length === 1));
      const keys = clients.map(f => f.model.snapshot.events[0].eventId);
      const values = event === 'approval/request' ? ['rejected', 'allowed-once']
        : ['手机', '电脑'].map(label => ({ answers: [{ id: 'question', selected: [label] }] }));
      const inFlight = host.holdReplies();
      const attempts = await Promise.allSettled(clients.map((f, i) => f.model.answer(keys[i], { kind: 'result', value: values[i] })));
      const winner = await pending.outcome;
      assert.equal(inFlight.requests.length, 2, '两个不同客户端的写请求必须实际到达原 Host');
      assert.notEqual(inFlight.requests[0].payload.args.clientId, inFlight.requests[1].payload.args.clientId);
      assert.equal(winner.kind, 'result');
      assert.ok(values.some(value => JSON.stringify(value) === JSON.stringify(winner.value)));
      assert.ok(attempts.some(result => result.status === 'fulfilled'));
      await waitFor(() => clients.every(f => f.model.snapshot.events.length === 0));
      assert.deepEqual(pending.count, { resolved: 1, rejected: 0 });
      for (let i = 0; i < clients.length; i++) await assert.rejects(clients[i].model.answer(keys[i], { kind: 'result', value: values[i] }), /remote_event_expired/);
    }
  } finally { await Promise.all(clients.map(f => f.model.dispose())); await host.dispose(); }
});

test('原 Host 处理计划批准与提出修改竞争、原请求取消，均不重复执行', { timeout: 5000 }, async () => {
  const host = await eventHost(), clients = [fixture(), fixture()];
  const questions = [{ id: 'review', question: '计划？', detail: '# 测试', options: [{ label: '同意' }], intent: { kind: 'plan-review', approve: '同意' } }];
  try {
    for (const f of clients) host.connect(f.transport);
    await Promise.all(clients.map(f => f.model.start()));
    for (const cancelFirst of [true, false]) {
      const pending = host.dispatch('user-questions/request', { questions }, sid);
      await waitFor(() => clients.every(f => f.model.snapshot.events.length === 1));
      const keys = clients.map(f => f.model.snapshot.events[0].eventId);
      const outcomes = [{ kind: 'cancel' }, { kind: 'result', value: { answers: [{ id: 'review', selected: ['同意'] }] } }];
      const order = cancelFirst ? [0, 1] : [1, 0];
      const inFlight = host.holdReplies();
      await Promise.allSettled(order.map(i => clients[i].model.answer(keys[i], outcomes[i])));
      await pending.outcome.catch(error => { assert.equal(error.code, 'ASK_CANCELLED'); });
      assert.equal(inFlight.requests.length, 2);
      await waitFor(() => clients.every(f => f.model.snapshot.events.length === 0));
      assert.equal(pending.count.resolved + pending.count.rejected, 1);
      assert.equal(pending.count.rejected, cancelFirst ? 1 : 0);
    }
    const cancelled = host.dispatch('user-questions/request', { questions }, sid);
    await waitFor(() => clients.every(f => f.model.snapshot.events.length === 1));
    cancelled.abort();
    await assert.rejects(cancelled.outcome, /test_host_cancelled/);
    await waitFor(() => clients.every(f => f.model.snapshot.events.length === 0));
    assert.deepEqual(cancelled.count, { resolved: 0, rejected: 1 });
  } finally { await Promise.all(clients.map(f => f.model.dispose())); await host.dispose(); }
});

test('上传归属原会话，切换会话不串附件；发送只引用 Host receipt', async () => {
  const f = fixture(); let finish, upload;
  f.transport.uploadHooks = { fetch: (input, init) => { upload = { input, init }; return new Promise(resolve => { finish = resolve; }); } };
  try {
    await f.model.start(); await f.model.select(sid);
    const file = new File(['测试附件'], '测试.txt');
    const task = f.model.upload(file);
    await assert.rejects(f.model.send(), /remote_attachments_not_ready/);
    await f.model.select('another-session');
    finish(Response.json({ ok: true, value: { receiptId: 'host-receipt', file: { attachmentId: 'digest', name: '测试.txt', bytes: file.size } } }));
    await task;
    assert.equal(new URL(upload.input, 'https://remote.dshm.invalid').searchParams.get('sessionId'), sid);
    assert.equal(f.model.getSnapshot().attachments['another-session'], undefined);
    await f.model.select(sid); await f.model.send();
    const request = f.calls.find(call => call.endpoint === 'session/prompt').payload.args.request;
    assert.deepEqual(request.content, [{ type: 'file', receiptId: 'host-receipt' }]);
    assert.equal(request.sessionId, sid);
    assert.equal(f.model.getSnapshot().attachments[sid].length, 0);
  } finally { await f.model.dispose(); }
});

test('取消附件会取消请求且迟到 receipt 不能重新出现；错误不能成为可发送附件', async () => {
  const f = fixture(); let finish, signal;
  f.transport.uploadHooks = { fetch: (_input, init) => { signal = init.signal; return new Promise(resolve => { finish = resolve; }); } };
  try {
    await f.model.start(); await f.model.select(sid);
    const task = f.model.upload(new File(['cancel'], 'cancel.txt'));
    await waitFor(() => signal);
    f.model.removeAttachment(f.model.getSnapshot().attachments[sid][0].id);
    assert.equal(signal.aborted, true);
    finish(Response.json({ ok: true, value: { receiptId: 'late', file: { attachmentId: 'digest', name: 'cancel.txt', bytes: 6 } } }));
    await task;
    assert.equal(f.model.getSnapshot().attachments[sid].length, 0);
    f.transport.uploadHooks.fetch = async () => Response.json({ ok: false, error: { code: 'file/rejected', message: 'Cannot upload' } });
    await f.model.upload(new File(['bad'], 'bad.txt'));
    assert.equal(f.model.getSnapshot().attachments[sid][0].state, 'error');
    await assert.rejects(f.model.send(), /remote_attachments_not_ready/);
    assert.equal(f.calls.some(call => call.endpoint === 'session/prompt'), false);
  } finally { await f.model.dispose(); }
});

test('附件草稿重建保存原件但丢弃 Host 凭据，重新准备获取新凭据后才能发送', async () => {
  const disk = draftStorage(), store = new RemoteDraftStore(draftBinding, () => disk);
  const f = fixture(false, store); f.transport.capabilities.channels = ['prompt'];
  f.transport.uploadHooks = { fetch: async () => Response.json({ ok: true, value: { receiptId: 'old-receipt', file: { attachmentId: 'old-file', name: '草稿.txt', bytes: 7 } } }) };
  try {
    await f.model.start(); await f.model.select(sid);
    await f.model.upload(new File(['content'], '草稿.txt'));
    await f.model.upload(new File([new Uint8Array([137, 80, 78, 71])], '草稿.png', { type: 'image/png' }));
    assert.equal(store.readAttachments(sid)[0].receiptId, undefined);
  } finally { await f.model.dispose(); }
  const next = fixture(false, new RemoteDraftStore(draftBinding, () => disk)); let uploaded;
  next.transport.capabilities.channels = ['prompt'];
  next.transport.uploadHooks = { fetch: async (_url, init) => { uploaded = await init.body.text(); return Response.json({ ok: true, value: { receiptId: 'new-receipt', file: { attachmentId: 'new-file', name: '草稿.txt', bytes: 7 } } }); } };
  try {
    await next.model.start(); await next.model.select(sid);
    const [file, image] = next.model.snapshot.attachments[sid];
    assert.equal(uploaded, undefined); assert.equal(file.state, 'restored'); assert.equal(file.file, undefined);
    assert.equal(image.state, 'ready'); assert.deepEqual([...new Uint8Array(await image.source.arrayBuffer())], [137, 80, 78, 71]);
    await assert.rejects(next.model.send(), /not_ready/);
    await next.model.prepareAttachment(file.id); assert.equal(uploaded, 'content');
    await next.model.send();
    const content = next.calls.find(call => call.endpoint === 'session/prompt').payload.args.request.content;
    assert.deepEqual(content[0], { type: 'file', receiptId: 'new-receipt' }); assert.equal(content[1].type, 'image');
    assert.deepEqual(store.readAttachments(sid), []);
  } finally { await next.model.dispose(); }
});

test('附件在发送前先持久标记未知，结果未知后重建不可再次发送或自动重新上传', async () => {
  const disk = draftStorage(), store = new RemoteDraftStore(draftBinding, () => disk), f = fixture(false, store);
  f.transport.capabilities.channels = ['prompt']; const call = f.transport.call;
  f.transport.call = async (...args) => {
    if (args[1] !== 'session/prompt') return call(...args);
    assert.equal(store.readAttachments(sid)[0].state, 'uncertain');
    await f.model.saveAttachmentDrafts(sid);
    assert.equal(store.readAttachments(sid)[0].state, 'uncertain', '发送途中重试保存不能清除在途标记');
    return { ok: false, error: { code: 'gateway/internal', message: 'unknown' } };
  };
  try {
    await f.model.start(); await f.model.select(sid); await f.model.upload(new File(['img'], 'one.png', { type: 'image/png' }));
    await assert.rejects(f.model.send(), /unknown/);
  } finally { await f.model.dispose(); }
  const next = fixture(false, new RemoteDraftStore(draftBinding, () => disk));
  try {
    await next.model.start(); await next.model.select(sid);
    assert.equal(next.model.snapshot.attachments[sid][0].state, 'uncertain');
    await next.model.prepareAttachment(next.model.snapshot.attachments[sid][0].id);
    await assert.rejects(next.model.send(), /not_ready/);
    assert.equal(next.calls.some(call => call.endpoint === 'session/prompt'), false);
    await next.model.removeAttachment(next.model.snapshot.attachments[sid][0].id); assert.deepEqual(store.readAttachments(sid), []);
  } finally { await next.model.dispose(); }
});

test('附件发送标记落盘失败时不能发给电脑；读取原件期间移除不复活附件', async () => {
  const f = fixture(false, { writeAttachments(_id, _items, sending) { if (sending.length) throw new Error('disk full'); } });
  f.transport.capabilities.channels = ['prompt']; let release;
  try {
    await f.model.start(); await f.model.select(sid);
    const delayed = new File(['x'], 'delayed.png', { type: 'image/png' });
    delayed.arrayBuffer = () => new Promise(resolve => { release = resolve; });
    const preparing = f.model.upload(delayed); await f.model.removeAttachment(f.model.snapshot.attachments[sid][0].id);
    release(new Uint8Array([1]).buffer); await preparing; assert.deepEqual(f.model.snapshot.attachments[sid], []);
    await f.model.upload(new File(['x'], 'new.png', { type: 'image/png' }));
    await assert.rejects(f.model.send(), /尚未保存/);
    assert.equal(f.calls.some(call => call.endpoint === 'session/prompt'), false);
  } finally { release?.(new ArrayBuffer(0)); await f.model.dispose(); }
});

test('相册与文件中的图片保持原字节，混合发送并绑定原会话，失败不会静默改成文件', async () => {
  const f = fixture(); f.transport.capabilities = { channels: ['prompt'] };
  f.transport.uploadHooks = { fetch: async () => { throw new Error('图片不能走文件上传'); } };
  try {
    await f.model.start(); await f.model.select(sid);
    const bytes = Buffer.from([137, 80, 78, 71, 0, 255]);
    await f.model.upload(new File([bytes], '相册.png', { type: 'image/png' }), sid, { image: true });
    await f.model.upload(new File([bytes], '文件图片.png'));
    assert.equal(f.model.getSnapshot().attachments[sid][0].kind, 'image');
    await f.model.select('another-session');
    assert.equal(f.model.getSnapshot().attachments['another-session'], undefined);
    await f.model.select(sid); f.model.draft('看看这两张图'); await f.model.send();
    const request = f.calls.find(call => call.endpoint === 'session/prompt').payload.args.request;
    assert.equal(request.content[0].text, '看看这两张图');
    for (const part of request.content.slice(1)) { assert.equal(part.type, 'image'); assert.equal(part.mediaType, 'image/png'); assert.deepEqual(Buffer.from(part.data, 'base64'), bytes); }
    assert.equal(f.model.getSnapshot().attachments[sid].length, 0);
    await f.model.upload(new File(['svg'], 'vector.svg', { type: 'image/svg+xml' }), sid, { image: true });
    assert.equal(f.model.getSnapshot().attachments[sid][0].state, 'error');
    await assert.rejects(f.model.send(), /remote_attachments_not_ready/);
  } finally { await f.model.dispose(); }
  assert.equal(f.model.pendingImageUrls.size, 0);
});

test('发送结果未知时不自动重传已提交的附件', async () => {
  const f = fixture();
  f.transport.uploadHooks = { fetch: async () => Response.json({ ok: true, value: { receiptId: 'once', file: { attachmentId: 'digest', name: 'once.txt', bytes: 4 } } }) };
  try {
    await f.model.start(); await f.model.select(sid);
    await f.model.upload(new File(['once'], 'once.txt'));
    const original = f.transport.call;
    let prompts = 0;
    f.transport.call = (...args) => { if (args[1] === 'session/prompt') { prompts++; throw new Error('request_timeout_outcome_unknown'); } return original(...args); };
    await assert.rejects(f.model.send(), /outcome_unknown/);
    assert.equal(f.model.getSnapshot().attachments[sid][0].state, 'uncertain');
    await assert.rejects(f.model.send(), /remote_attachments_not_ready/);
    assert.equal(prompts, 1);
  } finally { await f.model.dispose(); }
});

test('图片业务拒绝保留草稿，未知发送结果禁止重发，两者都释放临时预览', async () => {
  const f = fixture(); f.transport.capabilities = { channels: ['prompt'] };
  const call = f.transport.call; let requests = 0, uncertain = false;
  f.transport.call = async (channel, endpoint, payload, signal) => {
    if (endpoint !== 'session/prompt') return call(channel, endpoint, payload, signal);
    requests++;
    if (uncertain) throw new Error('request_timeout_outcome_unknown');
    return { ok: false, error: { code: 'session/attachment-invalid', message: 'Unsupported image', details: { reason: 'MODEL_DOES_NOT_SUPPORT_IMAGES' } } };
  };
  try {
    await f.model.start(); await f.model.select(sid);
    await f.model.upload(new File(['fixture'], 'test.png', { type: 'image/png' }));
    f.model.draft('保留草稿');
    await assert.rejects(f.model.send(), error => error.code === 'session/attachment-invalid');
    assert.equal(f.model.getSnapshot().drafts[sid], '保留草稿');
    assert.equal(f.model.getSnapshot().attachments[sid][0].state, 'ready');
    assert.equal(f.model.pendingImageUrls.size, 0);
    uncertain = true;
    await assert.rejects(f.model.send(), /request_timeout_outcome_unknown/);
    assert.equal(f.model.getSnapshot().attachments[sid][0].state, 'uncertain');
    assert.equal(f.model.pendingImageUrls.size, 0);
    await assert.rejects(f.model.send(), /remote_attachments_not_ready/);
    assert.equal(requests, 2);
  } finally { await f.model.dispose(); }
});

test('队列操作绑定电脑条目，条目消失后不再发送旧操作；改名与归档复用原服务', async () => {
  const f = fixture();
  try {
    await f.model.start(); await f.model.select(sid); await tick();
    const control = f.channels.get('session/control');
    control.push({ type: 'projection', sessionId: sid, key: 'inbox', seq: 1, value: { 'next-turn': [{ id: 'queued', content: [{ type: 'text', text: '原排队消息' }], source: { kind: 'user', rpcId: 'queued-request' } }], 'next-step': [] } });
    await tick();
    await f.model.updateQueue('queued', { kind: 'edit', content: [{ type: 'text', text: '修改内容' }] });
    assert.deepEqual(f.calls.at(-1).payload.args.request, { sessionId: sid, itemId: 'queued', action: { kind: 'edit', content: [{ type: 'text', text: '修改内容' }] } });
    control.push({ type: 'projection', sessionId: sid, key: 'inbox', seq: 2, value: { 'next-turn': [], 'next-step': [] } });
    await tick();
    await assert.rejects(f.model.updateQueue('queued', { kind: 'remove' }), /remote_queue_item_expired/);
    await f.model.rename(' 新标题 ');
    assert.equal(f.calls.at(-1).payload.args.request.title, '新标题');
    await f.model.archive(true);
    assert.deepEqual(f.model.getSnapshot().workspaces.archivedSessionIds, [sid]);
    assert.equal(f.model.getSnapshot().selected, null);
    await f.model.select(sid); await f.model.archive(false);
    assert.deepEqual(f.model.getSnapshot().workspaces.archivedSessionIds, []);
  } finally { await f.model.dispose(); }
});
