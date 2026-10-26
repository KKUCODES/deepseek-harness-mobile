// 两个窗口分别受预算约束：原 Session 只持有实时尾部，查阅窗口可以独立向前/向后移动。
export const HISTORY_BUDGET = Object.freeze({ records: 400, bytes: 4 * 1024 * 1024, turns: 24 });
const sizes = new WeakMap();
const encoder = new TextEncoder();
export function historyBytes(entry) {
  if (!sizes.has(entry)) sizes.set(entry, encoder.encode(JSON.stringify(entry)).length);
  return sizes.get(entry);
}
export function historySize(entries) { return entries.reduce((sum, entry) => sum + historyBytes(entry), 0); }

/** 连续文本增量可无损合成一个呈现增量；settleAssistant 仍按原 attemptId 原子替换。 */
export function compactTransient(entries) {
  let changed = false;
  const result = [];
  for (const entry of entries) {
    const previous = result.at(-1), a = previous?.event.data, b = entry.event.data;
    if (entry.type === 'transient' && previous?.type === 'transient'
      && a.attemptId === b.attemptId && a.turn === b.turn && a.step === b.step
      && a.chunk?.type === b.chunk?.type && ['text-delta', 'reasoning-delta'].includes(b.chunk?.type)
      && a.chunk.index === b.chunk.index) {
      const merged = { ...entry, event: { ...entry.event, time: previous.event.time,
        data: { ...b, chunk: { ...b.chunk, text: a.chunk.text + b.chunk.text } } } };
      const empty = value => ({ ...value, event: { ...value.event, data: { ...value.event.data, chunk: { ...value.event.data.chunk, text: '' } } } });
      // 拼接文本的JSON转义字节可相加；只编码新增量，避免每个token重新编码整段回复。
      sizes.set(merged, historyBytes(previous) - historyBytes(empty(previous)) + historyBytes(entry)
        - historyBytes(empty(entry)) + historyBytes(empty(merged)));
      result[result.length - 1] = merged;
      changed = true;
    } else result.push(entry);
  }
  return changed ? result : entries;
}

/** 保留连续区间；优先在原回合边界停下，超大单条记录仍完整保留，不改写电脑事件。 */
export function boundHistory(entries, edge = 'end', budget = HISTORY_BUDGET) {
  let bytes = 0, turns = 0, count = 0;
  for (; count < entries.length; count++) {
    const entry = entries[edge === 'end' ? entries.length - count - 1 : count];
    const nextBytes = bytes + historyBytes(entry), nextTurns = turns + Number(entry.event.type === 'turn/start');
    if (count && (count >= budget.records || nextBytes > budget.bytes || nextTurns > budget.turns)) break;
    bytes = nextBytes; turns = nextTurns;
  }
  if (count === entries.length) return entries;
  let start = edge === 'end' ? entries.length - count : 0, end = edge === 'end' ? entries.length : count;
  if (edge === 'end' && entries.at(-1)?.type === 'transient') {
    const active = entries.at(-1).event.data;
    const beginning = entries.findIndex(entry => entry.event.type === 'step/start'
      && entry.event.data.turn === active.turn && entry.event.data.step === active.step);
    // 一个未结算的流式步骤和单条大事件一样是原子单元，不能丢掉前半段让模型正文悄悄变短。
    if (beginning >= 0) start = Math.min(start, beginning);
  }
  if (edge === 'end') {
    const boundary = entries.findIndex((entry, index) => index >= start && entry.event.type === 'turn/start');
    if (boundary >= start && boundary < entries.length - 1) start = boundary;
  } else {
    for (let index = end - 1; index > 0; index--) {
      if (entries[index].event.type === 'turn/end') { end = index + 1; break; }
    }
  }
  return entries.slice(start, end);
}

class HistoryFeed {
  listeners = new Set();
  snapshot = { entries: [], hasMore: false, revision: 0, change: { kind: 'replace', entries: [] } };
  getSnapshot = () => this.snapshot;
  subscribe = listener => { this.listeners.add(listener); return () => this.listeners.delete(listener); };
  publish(entries, hasMore, change = { kind: 'replace', entries }) {
    this.snapshot = { entries, hasMore, revision: this.snapshot.revision + 1, change };
    for (const listener of this.listeners) listener();
  }
}

const durable = entries => entries.filter(entry => entry.type === 'event');
const firstSeq = entries => entries[0]?.event.seq ?? 0;
const lastSeq = entries => durable(entries).at(-1)?.event.seq ?? -1;
export const yieldHistory = () => new Promise(resolve => setTimeout(resolve, 0));

/** 只装饰公开 Session face/eventSource；不触碰 Session 私有游标、投影或审批载体。 */
export class RemoteHistoryWindow {
  feed = new HistoryFeed();
  listeners = new Set();
  lifetime = new AbortController();
  browsing = false;
  loading = false;
  epoch = 0;
  trimmed = false;
  rawHasMore = false;
  latestSeq = -1;
  readRequest;
  anchor;
  error = null;
  evictedSinceBaseline = 0;
  refreshing = false;
  constructor(binding, read, { budget = HISTORY_BUDGET } = {}) {
    this.original = binding; this.read = read; this.budget = budget;
    this.offs = [binding.eventSource.subscribe(() => this.accept()), binding.session.subscribe(() => { this.publish(); this.refreshIdleBaseline(); })];
    const methods = new Map();
    this.session = new Proxy(binding.session, { get: (target, key) => {
      if (key === 'getSnapshot') return this.getSnapshot;
      if (key === 'subscribe') return this.subscribe;
      if (key === 'loadOlder') return this.loadOlder;
      if (key === 'loadThrough') return this.loadThrough;
      if (key === 'prompt') {
        if (!methods.has(key)) methods.set(key, (...args) => { this.latest(); return target.prompt(...args); });
        return methods.get(key);
      }
      const value = Reflect.get(target, key, target);
      if (typeof value !== 'function') return value;
      if (!methods.has(key)) methods.set(key, value.bind(target));
      return methods.get(key);
    } });
    this.binding = { ...binding, session: this.session, eventSource: this.feed, history: this };
    binding.ctx.effect(() => () => this.dispose());
    this.accept();
  }
  getSnapshot = () => this.snapshot;
  subscribe = listener => { this.listeners.add(listener); return () => this.listeners.delete(listener); };
  publish() {
    if (this.lifetime.signal.aborted) return;
    const window = this.feed.getSnapshot();
    this.snapshot = { ...this.original.session.getSnapshot(), hasMore: window.hasMore, loadingOlder: this.loading,
      history: { browsing: this.browsing, hasNewer: this.latestSeq > lastSeq(window.entries),
        records: window.entries.length, bytes: historySize(window.entries), error: this.error } };
    for (const listener of this.listeners) listener();
  }
  accept() {
    if (this.mutating || this.lifetime.signal.aborted) return;
    const source = this.original.eventSource, raw = source.getSnapshot();
    if (raw.change.kind === 'replace') {
      this.epoch++; this.readRequest?.abort(); this.rawHasMore = raw.hasMore; this.trimmed = false;
      this.evictedSinceBaseline = 0;
    }
    this.latestSeq = lastSeq(raw.entries);
    const compact = compactTransient(raw.entries), entries = boundHistory(compact, 'end', this.budget);
    if (entries !== raw.entries) {
      if (entries !== compact) this.trimmed = true;
      this.evictedSinceBaseline += compact.length - entries.length;
      // MutableSessionEventSource 是 SDK 的公开呈现窗口；实际 follow 游标仍由原 Journal 管理。
      // 所有 loadOlder/loadThrough 均经过本装饰器，不能再用原 Session 的历史起点读取。
      this.mutating = true;
      try { source.replace(entries, this.trimmed || raw.hasMore); } finally { this.mutating = false; }
    }
    if (!this.browsing && this.anchor !== undefined && entries !== raw.entries
      && firstSeq(entries) > this.anchor && this.feed.getSnapshot().entries.length) this.browsing = true;
    if (!this.browsing) this.feed.publish(entries, this.trimmed || this.rawHasMore,
      entries === raw.entries ? raw.change : undefined);
    // 重连后的历史重新向同一权威 cut 读取；先保留阅读画面，写操作始终使用实时 Session。
    if (this.browsing && raw.change.kind === 'replace' && this.feed.getSnapshot().entries.length) {
      const cut = Math.min(lastSeq(this.feed.getSnapshot().entries), this.latestSeq);
      void this.page({ throughSeq: cut }, 'replace').catch(() => {});
    }
    this.publish();
    this.refreshIdleBaseline();
  }
  refreshIdleBaseline() {
    const session = this.original.session, state = session.getSnapshot();
    if (this.evictedSinceBaseline < 2000 || this.refreshing || state.running || state.pendingSubmissions?.length
      || this.lifetime.signal.aborted || typeof session.resync !== 'function'
      || this.original.eventSource.getSnapshot().entries.some(entry => entry.type === 'transient')) return;
    this.refreshing = true;
    // SDK还持有已发布seq索引；空闲时通过公开只读resync刷新它，保留独立控制投影与插件作用域。
    void yieldHistory().then(async () => {
      if (!this.lifetime.signal.aborted && !session.getSnapshot().running && !session.getSnapshot().pendingSubmissions?.length) await session.resync();
    }).catch(() => {}).finally(() => { this.refreshing = false; });
  }
  setAnchor(seq) { this.anchor = seq; }
  latest = () => {
    this.epoch++; this.readRequest?.abort(); this.loading = false; this.browsing = false; this.error = null;
    const window = this.original.eventSource.getSnapshot();
    this.feed.publish(window.entries, this.trimmed || this.rawHasMore); this.publish();
  };
  // 官方 Session 的公开读取会消化失败。page 已发布友好错误并保留窗口/重试状态；
  // 这里只完成插件调用，手机自身仍使用下面的严格方法，不能靠公开 Promise 判断分页成功。
  loadOlder = async () => {
    try { await this.older(); } catch { /* 保持官方失败行为，错误仍由 history 状态呈现。 */ }
  };
  loadThrough = async seq => {
    try { await this.through(seq); } catch { /* 内部严格读取继续负责校验与错误状态。 */ }
  };
  older = async () => {
    if (this.loading || !this.feed.getSnapshot().hasMore) return;
    const entries = this.feed.getSnapshot().entries;
    return this.page({ throughSeq: this.latestSeq, beforeSeq: firstSeq(entries) }, 'prepend');
  };
  newer = async () => {
    if (this.loading) return;
    const last = lastSeq(this.feed.getSnapshot().entries);
    if (last >= this.latestSeq) return this.latest();
    return this.page({ throughSeq: Math.min(this.latestSeq, last + 40) }, 'append');
  };
  through = async seq => {
    if (!Number.isSafeInteger(seq) || seq < 0) return;
    const entries = this.feed.getSnapshot().entries;
    if (firstSeq(entries) <= seq && lastSeq(entries) >= seq) return;
    return this.page({ throughSeq: Math.min(this.latestSeq, seq + 20) }, 'replace');
  };
  async page(cut, direction) {
    if (this.lifetime.signal.aborted) return;
    this.readRequest?.abort();
    const controller = this.readRequest = new AbortController(), epoch = this.epoch;
    const signal = AbortSignal.any([controller.signal, this.lifetime.signal]);
    const current = () => !signal.aborted && epoch === this.epoch;
    this.loading = true; this.error = null; this.publish();
    try {
      await yieldHistory(); signal.throwIfAborted();
      const subagent = this.original.session.getSnapshot().subagent?.address;
      const address = subagent ? { kind: 'subagent', ...subagent } : { kind: 'session', sessionId: this.original.sessionId };
      let result;
      for (;;) {
        result = await this.read({ address, ...cut, maxMessages: 24, turnWindow: { minMessages: 12, minTurns: 2 } }, signal);
        if (!current()) return;
        const next = lastSeq(this.feed.getSnapshot().entries) + 1;
        // page按消息数限量，不保证固定40个事件有重叠；缩小只读cut直到覆盖下一条，最多六次。
        if (direction !== 'append' || !result.ok || !result.value.records.length
          || firstSeq(result.value.records) <= next || cut.throughSeq <= next) break;
        cut = { ...cut, throughSeq: Math.floor((next + cut.throughSeq) / 2) };
        await yieldHistory(); signal.throwIfAborted();
      }
      if (!current()) return;
      if (!result.ok) throw result.error;
      const { records, hasMore } = result.value;
      for (let index = 0; index < records.length; index++) {
        const seq = records[index].event.seq;
        if (!Number.isSafeInteger(seq) || seq < 0 || seq > cut.throughSeq
          || index && seq !== records[index - 1].event.seq + 1) throw Error('remote_history_page_discontinuous');
      }
      const old = this.feed.getSnapshot();
      const received = direction === 'prepend' ? records.filter(entry => entry.event.seq < cut.beforeSeq)
        : direction === 'append' ? records.filter(entry => entry.event.seq > lastSeq(old.entries)) : records;
      if (direction === 'prepend' && (received.length ? lastSeq(received) + 1 !== cut.beforeSeq : hasMore)
        || direction === 'append' && (!received.length || firstSeq(received) !== lastSeq(old.entries) + 1)) {
        throw Error('remote_history_page_discontinuous');
      }
      await yieldHistory(); if (!current()) return;
      const merged = direction === 'prepend' ? [...received, ...old.entries]
        : direction === 'append' ? [...durable(old.entries), ...received] : received;
      const entries = boundHistory(merged, direction === 'prepend' ? 'start' : 'end', this.budget);
      const more = direction === 'prepend' || direction === 'replace' ? hasMore || firstSeq(entries) > firstSeq(merged)
        : old.hasMore || firstSeq(entries) > firstSeq(merged);
      this.browsing = true;
      this.feed.publish(entries, more, direction === 'prepend' && entries === merged
        ? { kind: 'prepend', entries: received } : undefined);
    } catch (error) {
      if (!current()) return;
      this.error = direction === 'append' ? '未能加载较新的记录，请重试。' : '未能加载更早的记录，请重试。'; throw error;
    } finally {
      if (this.readRequest === controller) { this.readRequest = undefined; this.loading = false; this.publish(); }
    }
  }
  dispose() {
    this.lifetime.abort(); this.readRequest?.abort(); this.offs.forEach(off => off());
    this.feed.listeners.clear(); this.listeners.clear();
  }
}
