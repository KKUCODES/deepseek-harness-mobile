export const longPluginCalls = new Set(['pluginManager/installBundle', 'pluginManager/removeBundle', 'pluginManager/setBundleEnabled', 'pluginManager/setPluginEnabled']);
const recoverable = error => ['host_offline', 'host_disconnected_outcome_unknown', 'connection_closed_outcome_unknown', 'remote_not_connected', 'request_timeout_outcome_unknown', 'remote_bridge_timeout', 'remote_bridge_unavailable'].includes(error?.message);
const retentionMs = 60 * 60 * 1000;

/** 写入只提交一次；后续短查询可跨中继断线，仍返回原 DSH 的 RPC 结果给原组件。 */
export class RemotePluginOperations {
  controller = new AbortController();
  running = new Set();
  settlements = new Set();
  constructor(client, capabilities, { interval = 1000 } = {}) {
    this.client = client; this.capabilities = capabilities; this.interval = interval;
    this.journal = client.pluginOperationJournal ??= new Map();
    this.listeners = client.pluginOperationListeners ??= new Set();
    this.off = client.subscribe(frame => {
      if (frame.type === 'closed' && frame.reason) this.controller.abort(new Error(frame.reason));
      if (frame.type === 'ready' && this.controller.signal.aborted) this.controller = new AbortController();
    });
  }
  subscribe = listener => { this.listeners.add(listener); return () => this.listeners.delete(listener); };
  changed() { for (const listener of this.listeners) listener(); }
  /** 核心重建交接内存摘要；冷启动只读取同一绑定的摘要，不重放写入。 */
  setScope(key, store) {
    if (this.client.pluginOperationJournalKey !== key) {
      this.client.pluginOperationJournal = new Map();
      this.client.pluginOperationJournalKey = key;
      try {
        for (const item of store?.readPluginOperations?.() ?? []) this.client.pluginOperationJournal.set(item.id, item);
      } catch { /* 保留正常聊天；首次管理写入仍须成功提交本机摘要。 */ }
    }
    this.journal = this.client.pluginOperationJournal;
    this.store = store;
  }
  persist(journal = this.journal, store = this.store) { return store?.writePluginOperations?.([...journal.values()]); }
  prune() {
    for (const [id, item] of this.journal) {
      if (item.state !== 'pending' && Date.now() - (item.finishedAt ?? item.startedAt) >= retentionMs) this.journal.delete(id);
    }
    for (const [id, item] of this.journal) {
      if (this.journal.size <= 64) break;
      if (item.state !== 'pending') this.journal.delete(id);
    }
  }
  async request(operation, signal) {
    signal?.throwIfAborted();
    const request = this.client.request(operation);
    const cancel = () => request.cancel();
    signal?.addEventListener('abort', cancel, { once: true });
    try { const result = await request.promise; signal?.throwIfAborted(); return result; }
    finally { signal?.removeEventListener('abort', cancel); }
  }
  wait(signal) {
    signal.throwIfAborted();
    return new Promise((resolve, reject) => {
      let off;
      const finish = error => { clearTimeout(timer); off?.(); signal.removeEventListener('abort', abort); error ? reject(error) : resolve(); };
      const abort = () => finish(signal.reason);
      const timer = setTimeout(() => finish(), this.interval);
      off = this.client.subscribe(frame => { if (frame.type === 'ready') finish(); });
      signal.addEventListener('abort', abort, { once: true });
    });
  }
  async run(endpoint, payload, callerSignal) {
    const generation = this.capabilities()?.pluginOperationGeneration;
    if (!generation) throw new Error('plugin_operations_unavailable');
    const signal = callerSignal ? AbortSignal.any([callerSignal, this.controller.signal]) : this.controller.signal;
    const operationId = crypto.randomUUID();
    const args = payload?.args;
    const target = args?.spec ?? args?.name ?? args?.id;
    const item = { id: operationId, generation, endpoint, target: typeof target === 'string' ? target.slice(0, 4096) : endpoint,
      requestId: args?.options?.requestId, startedAt: Date.now(), state: 'pending' };
    const journal = this.journal, store = this.store;
    let settled;
    const settlement = new Promise(resolve => { settled = resolve; });
    this.settlements.add(settlement);
    journal.set(operationId, item); this.prune();
    this.running.add(operationId);
    this.changed();
    let submitted = false;
    try {
      // 在电脑可能接收写入前严格提交摘要；存储失败不能先发出安装。
      await this.persist(journal, store);
      signal.throwIfAborted();
      if (journal !== this.journal) throw new Error('remote_generation_changed');
      submitted = true;
      try { await this.request({ method: 'remote.pluginOperationStart', generation, operationId, endpoint, payload }, signal); }
      catch (error) { if (!recoverable(error)) throw error; }
      for (;;) {
        signal.throwIfAborted();
        if (this.client.connected) {
          try {
            const state = await this.read(generation, operationId, signal);
            if (state.state === 'complete') {
              if (typeof state.result?.ok !== 'boolean') throw new Error('invalid_remote_result');
              Object.assign(item, { state: 'complete', finishedAt: Date.now(), ok: state.result.ok, application: state.result.value?.application });
              return state.result;
            }
            if (state.state !== 'pending') throw new Error(state.error ?? 'plugin_operation_outcome_unknown');
          } catch (error) { if (!recoverable(error)) throw error; }
        }
        await this.wait(signal);
      }
    } catch (error) {
      if (submitted) Object.assign(item, { state: 'unknown', finishedAt: Date.now() });
      else journal.delete(operationId);
      throw error;
    } finally {
      this.running.delete(operationId); this.prune(); this.changed();
      // 保存失败不能改写已收到的原电脑结果；上次未确认摘要仍可在下次授权查询时核对。
      try { await this.persist(journal, store); } catch {}
      this.settlements.delete(settlement); settled();
    }
  }
  async list(signal) {
    // 必须先取得电脑授权响应；本地摘要不能绕过撤权，也不能假装是电脑回执。
    const journal = this.journal;
    const lifetime = signal ? AbortSignal.any([signal, this.controller.signal]) : this.controller.signal;
    const result = await this.request({ method: 'remote.pluginOperations' }, lifetime);
    if (journal !== this.journal || journal !== this.client.pluginOperationJournal) throw new Error('remote_generation_changed');
    const known = new Set(result.items.map(item => item.id));
    for (const item of result.items) {
      const existing = this.journal.get(item.id);
      // 已确认的终态不能被此前请求拍到的 pending 快照覆盖。
      if (existing?.generation === result.generation && existing.state === 'complete' && item.state === 'pending') continue;
      // 保留在途 run 持有的对象，避免列表刷新替换它后丢失最终完成状态。
      if (existing) Object.assign(existing, item, { generation: result.generation });
      else this.journal.set(item.id, { ...item, generation: result.generation });
    }
    for (const [id, item] of this.journal) {
      if (known.has(id)) continue;
      if (item.state === 'complete') { this.journal.delete(id); continue; }
      if (item.generation !== result.generation || !this.running.has(id)) {
        if (item.state !== 'unknown') Object.assign(item, { state: 'unknown', finishedAt: Date.now() });
      }
    }
    this.prune();
    try { await this.persist(); } catch {}
    if (journal !== this.journal || journal !== this.client.pluginOperationJournal) throw new Error('remote_generation_changed');
    return { ...result, items: [...this.journal.values()].sort((a, b) => a.startedAt - b.startedAt) };
  }
  read(generation, operationId, signal) { return this.request({ method: 'remote.pluginOperationRead', generation, operationId }, signal); }
  dispose() { this.off(); this.controller.abort(new Error('plugin_operation_outcome_unknown')); }
  settled() { return Promise.allSettled([...this.settlements]); }
}
