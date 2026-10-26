import test from 'node:test';
import assert from 'node:assert/strict';
import { boundHistory, historySize, compactTransient, RemoteHistoryWindow } from '../src/remote-history-window.mjs';

const records = (first, count, text = 'history') => Array.from({ length: count }, (_, index) => {
  const seq = first + index;
  return { type: 'event', event: { seq, type: ['turn/start', 'step/start', 'assistant/message', 'step/end', 'turn/end'][seq % 5], data: { turn: Math.floor(seq / 5), text } } };
});
function fixture(budget = { records: 30, bytes: 100000, turns: 6 }) {
  const listeners = new Set(), disposal = [], calls = [];
  let snapshot = { entries: records(100, 20), hasMore: true, revision: 0, change: { kind: 'replace', entries: [] } };
  const source = { getSnapshot: () => snapshot, subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); },
    replace(entries, hasMore) { snapshot = { entries, hasMore, revision: snapshot.revision + 1, change: { kind: 'replace', entries } }; for (const fn of listeners) fn(); },
    append(entry) { snapshot = { ...snapshot, entries: [...snapshot.entries, entry], revision: snapshot.revision + 1, change: { kind: 'append', entries: [entry] } }; for (const fn of listeners) fn(); } };
  const projections = {}, session = { sessionId: 'test', projections, getSnapshot: () => ({ openState: 'open', running: true, pendingSubmissions: [{ requestId: 'pending' }] }),
    subscribe: () => () => {}, prompt: async value => value, cancel: () => 'cancelled' };
  const binding = { sessionId: 'test', session, eventSource: source, ctx: { effect(fn) { disposal.push(fn()); } } };
  let fail = false, hold;
  const history = new RemoteHistoryWindow(binding, async (request, signal) => {
    calls.push(request); if (hold) await hold;
    signal.throwIfAborted();
    if (fail) return { ok: false, error: Error('read failed') };
    const end = request.beforeSeq ?? request.throughSeq + 1, first = Math.max(0, end - (request.beforeSeq === undefined ? 150 : 10));
    return { ok: true, value: { records: records(first, end - first), hasMore: first > 0 } };
  }, { budget });
  return { history, source, session, projections, calls, dispose: () => disposal.forEach(fn => fn()), fail: value => { fail = value; }, hold: value => { hold = value; } };
}

test('连续向前和向后移动窗口，数据/回合数受控且不改原实时尾部', async () => {
  const f = fixture();
  for (let index = 0; index < 10; index++) {
    await f.history.older();
    const entries = f.history.feed.getSnapshot().entries;
    assert.ok(entries.length <= 30); assert.ok(historySize(entries) <= 100000);
    assert.equal(f.source.getSnapshot().entries[0].event.seq, 100);
  }
  assert.equal(f.history.feed.getSnapshot().entries[0].event.seq, 0);
  assert.equal(f.history.getSnapshot().hasMore, false);
  for (let index = 0; index < 20 && f.history.getSnapshot().history.hasNewer; index++) await f.history.newer();
  assert.equal(f.history.feed.getSnapshot().entries.at(-1).event.seq, 119);
  f.dispose();
});

test('实时窗口持续追加仍受限，查阅旧记录期间保持页面并提示较新内容', async () => {
  const f = fixture(); await f.history.older(); const old = f.history.feed.getSnapshot().entries;
  for (const entry of records(120, 200)) f.source.append(entry);
  assert.ok(f.source.getSnapshot().entries.length <= 30);
  assert.equal(f.history.feed.getSnapshot().entries, old);
  assert.equal(f.history.getSnapshot().history.hasNewer, true);
  assert.equal(f.history.getSnapshot().running, true);
  assert.deepEqual(f.history.getSnapshot().pendingSubmissions, [{ requestId: 'pending' }]);
  assert.equal(f.history.session.projections, f.projections);
  f.history.latest(); assert.equal(f.history.feed.getSnapshot().entries.at(-1).event.seq, 319);
  assert.equal(f.history.getSnapshot().hasMore, true); f.dispose();
});

test('保留阅读锚点所在窗口，实时尾部淘汰时不拉走阅读内容', () => {
  const f = fixture(); f.history.setAnchor(100); const old = f.history.feed.getSnapshot().entries;
  for (const entry of records(120, 40)) f.source.append(entry);
  assert.ok(f.history.getSnapshot().history.browsing);
  assert.ok(f.history.feed.getSnapshot().entries.some(entry => entry.event.seq === 100));
  assert.ok(f.history.feed.getSnapshot().entries.length >= old.length); f.dispose();
});

test('读取失败保留窗口，重试可继续，发送和控制仍交给原 Session', async () => {
  const f = fixture(); const old = f.history.feed.getSnapshot(); f.fail(true);
  await assert.rejects(f.history.older(), /read failed/); assert.equal(f.history.feed.getSnapshot(), old);
  assert.equal(f.history.getSnapshot().loadingOlder, false);
  f.fail(false); await f.history.older();
  assert.deepEqual(await f.history.session.prompt(['text']), ['text']);
  assert.equal(f.history.getSnapshot().history.browsing, false);
  assert.equal(f.history.session.cancel(), 'cancelled'); f.dispose();
});

for (const method of ['loadOlder', 'loadThrough']) {
  test(`公开${method}保留官方失败行为，错误状态/窗口/控制与有效重试仍保留`, async () => {
    const f = fixture(), originalRead = f.history.read;
    const read = () => method === 'loadOlder' ? f.history.session.loadOlder() : f.history.session.loadThrough(50);
    try {
      for (const failure of ['remote', 'throw', 'discontinuous']) {
        const before = f.history.feed.getSnapshot();
        f.history.read = async () => {
          if (failure === 'throw') throw Error('transport failed');
          if (failure === 'remote') return { ok: false, error: Error('remote failed') };
          return { ok: true, value: { records: method === 'loadOlder' ? records(90, 9) : [records(0, 1)[0], records(2, 1)[0]], hasMore: true } };
        };
        assert.equal(await read(), undefined, '官方公开读取失败也应完成，不向插件抛出');
        assert.equal(f.history.feed.getSnapshot(), before, '坏页不替换原窗口');
        const state = f.history.getSnapshot();
        assert.equal(state.loadingOlder, false);
        assert.equal(state.hasMore, true);
        assert.equal(state.history.error, '未能加载更早的记录，请重试。');
        assert.equal(state.running, true);
        assert.deepEqual(state.pendingSubmissions, [{ requestId: 'pending' }]);
        assert.equal(f.history.session.projections, f.projections);
      }
      f.history.read = originalRead;
      await read();
      assert.equal(f.history.getSnapshot().history.error, null);
      assert.ok(f.history.feed.getSnapshot().entries[0].event.seq < 100, '同一接口可重试恢复');
    } finally { f.dispose(); }
  });
}

test('公开读取完成不代表坏页成功，内部严格读取仍拒绝断层且可重试', async () => {
  const f = fixture(), originalRead = f.history.read;
  try {
    const before = f.history.feed.getSnapshot();
    f.history.read = async () => ({ ok: true, value: { records: records(90, 9), hasMore: true } });
    await assert.rejects(f.history.older(), /remote_history_page_discontinuous/);
    assert.equal(f.history.feed.getSnapshot(), before);
    assert.equal(f.history.getSnapshot().loadingOlder, false);
    f.history.read = originalRead;
    await f.history.older();
    assert.equal(f.history.getSnapshot().history.error, null);
    assert.equal(f.history.feed.getSnapshot().entries[0].event.seq, 90);
  } finally { f.dispose(); }
});

test('过时分页不覆盖返回最新或已释放窗口', async () => {
  const f = fixture(); let release; f.hold(new Promise(resolve => { release = resolve; }));
  const pending = f.history.older(); await new Promise(resolve => setTimeout(resolve, 5));
  f.history.latest(); release(); await pending;
  assert.equal(f.history.feed.getSnapshot().entries[0].event.seq, 100);
  assert.equal(f.history.getSnapshot().loadingOlder, false); f.dispose();
});

test('单条超预算记录不截断，其他记录不随之无界累积', () => {
  const entries = records(0, 10, 'x'.repeat(1000));
  const budget = { records: 5, bytes: 10, turns: 2 };
  assert.equal(boundHistory(entries, 'start', budget).length, 1);
  assert.equal(boundHistory(entries, 'end', budget).length, 1);
  assert.equal(boundHistory(entries, 'end', budget)[0], entries.at(-1));
});

test('连续实时文本和思考增量无损合成，保留attempt身份和块边界，不改原对象', () => {
  const chunks = Array.from({ length: 1000 }, (_, index) => ({ type: 'transient', event: { type: 'assistant/live-chunk', seq: index / 1001,
    time: index, data: { attemptId: 'live', turn: 1, step: 1, chunk: { type: index < 500 ? 'reasoning-delta' : 'text-delta', index: 0, text: String(index) + ' ' } } } }));
  const compact = compactTransient(chunks);
  assert.equal(compact.length, 2); assert.equal(compact[0].event.data.chunk.text, chunks.slice(0, 500).map(value => value.event.data.chunk.text).join(''));
  assert.equal(compact[1].event.data.chunk.text, chunks.slice(500).map(value => value.event.data.chunk.text).join(''));
  assert.equal(chunks[0].event.data.chunk.text, '0 '); assert.equal(compact[1].event.data.attemptId, 'live');
  const unicode = chunks.slice(0, 3).map(entry => ({ ...entry, event: { ...entry.event,
    data: { ...entry.event.data, chunk: { ...entry.event.data.chunk, text: '中文😀\n"\\' } } } }));
  const merged = compactTransient(unicode);
  assert.equal(historySize(merged), new TextEncoder().encode(JSON.stringify(merged[0])).length, '缓存保持UTF-8和JSON转义字节精确');
});

test('重连基线重新读取同一历史cut，旧读取不会覆盖，查阅与实时控制仍独立', async () => {
  const f = fixture(); await f.history.older(); const cut = f.history.feed.getSnapshot().entries.at(-1).event.seq;
  f.source.replace(records(200, 20), true);
  await new Promise(resolve => setTimeout(resolve, 15));
  assert.equal(f.calls.at(-1).throughSeq, cut);
  assert.ok(f.history.feed.getSnapshot().entries.at(-1).event.seq <= cut);
  assert.equal(f.history.getSnapshot().history.hasNewer, true);
  assert.equal(f.history.getSnapshot().running, true); f.dispose();
});

test('长期实时追加后仅在空闲时通过公开读取刷新SDK索引，不重建控制或插件作用域', async () => {
  const f = fixture(); let refreshes = 0;
  f.session.getSnapshot = () => ({ running: false, pendingSubmissions: [] });
  f.session.resync = async () => { refreshes++; const current = f.source.getSnapshot(); f.source.replace(current.entries, true); };
  for (const record of records(120, 2100)) f.source.append(record);
  await new Promise(resolve => setTimeout(resolve, 20));
  assert.equal(refreshes, 1); assert.ok(f.source.getSnapshot().entries.length <= 30);
  assert.equal(f.history.session.projections, f.projections); f.dispose();
});

test('稠密消息页没有重叠时缩小向后cut，不跳过任何历史记录', async () => {
  const f = fixture(); await f.history.older();
  for (const entry of records(120, 100)) f.source.append(entry);
  f.history.read = async request => {
    const end = request.throughSeq;
    return { ok: true, value: { records: records(Math.max(0, end - 4), Math.min(5, end + 1)), hasMore: end > 4 } };
  };
  const before = f.history.feed.getSnapshot().entries.at(-1).event.seq;
  await f.history.newer();
  const after = f.history.feed.getSnapshot().entries;
  assert.ok(after.some(entry => entry.event.seq === before + 1));
  assert.ok(after.at(-1).event.seq > before); f.dispose();
});
