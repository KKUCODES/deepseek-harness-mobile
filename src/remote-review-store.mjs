import { createSnapshotStore } from '@deepseek-ai/dsh-client-store';
import { changesSummaryUrl, changesDiffUrl } from '../../deepseek-harness/packages/client/ui-deliverables/src/changes.ts';
import { readChanges } from './remote-changes.mjs';

/** 原 ReviewTab 的状态契约，读取沿已授权的分片通道；一次连接内按记录坐标复用。 */
export class RemoteReviewStore {
  summaries = createSnapshotStore({});
  diffs = createSnapshotStore({});
  errors = createSnapshotStore({});
  generation = new AbortController();
  pending = new Map();
  closed = false;

  constructor(model, read = readChanges) { this.model = model; this.read = read; }

  loadSummary = (sessionId, seq) => this.load(this.summaries, changesSummaryUrl(sessionId, seq), { sessionId, seq });

  loadDiff = async (sessionId, seq, index) => {
    const generation = this.generation;
    await this.loadSummary(sessionId, seq);
    if (generation.signal.aborted || this.closed) return;
    const summary = this.summaries.getSnapshot()[changesSummaryUrl(sessionId, seq)];
    if (typeof summary !== 'object' || !summary.files[index]) return;
    return this.load(this.diffs, changesDiffUrl(sessionId, seq, index), { sessionId, seq, index }, summary.files[index].path);
  };

  load(store, key, coordinates, path) {
    const current = store.getSnapshot()[key];
    if (this.pending.has(key)) return this.pending.get(key);
    if (this.closed || this.model.lifetime.signal.aborted || current !== undefined && current !== 'error') return Promise.resolve();
    const signal = AbortSignal.any([this.generation.signal, this.model.lifetime.signal]);
    store.update(state => { state[key] = 'loading'; });
    this.errors.update(state => { delete state[key]; });
    const task = (async () => {
      try {
        const value = await this.read(this.model, coordinates, signal);
        if (path !== undefined && value.path !== path) throw new Error('remote_changes_invalid');
        if (!signal.aborted) store.update(state => { state[key] = value; });
      } catch (error) {
        if (signal.aborted) return;
        store.update(state => { state[key] = error.message === 'remote_changes_missing' ? 'missing' : 'error'; });
        this.errors.update(state => { state[key] = error; });
      }
    })();
    this.pending.set(key, task);
    void task.finally(() => { if (this.pending.get(key) === task) this.pending.delete(key); });
    return task;
  }

  reset() {
    if (this.closed) return;
    this.generation.abort(); this.generation = new AbortController(); this.pending.clear();
    this.summaries.set({}); this.diffs.set({}); this.errors.set({});
  }

  async dispose() {
    this.closed = true;
    this.generation.abort();
    await Promise.all(this.pending.values());
    this.pending.clear();
  }
}
