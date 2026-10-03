/** 仅在同一已认证应用运行期间交接标签布局与只读阅读状态，不存储资源实例或写操作。 */
export class RemotePanelMemory {
  layouts = new Map();
  pending = new Map();
  readers = new Map();
  lifetimes = new Map();
  disposed = false;
  capture() {
    const views = new Map(this.pending);
    for (const [key, read] of this.readers) views.set(key, read());
    return { layouts: [...this.layouts], views: [...views] };
  }
  restore(saved) {
    this.layouts.clear(); this.pending.clear();
    for (const [key, value] of saved?.layouts ?? []) this.layouts.set(key, value);
    for (const [key, value] of saved?.views ?? []) this.pending.set(key, value);
  }
  observe(key, read, signal) {
    if (this.disposed || signal?.aborted) return () => {};
    const previous = this.lifetimes.get(key);
    if (signal && previous?.signal !== signal) {
      previous?.signal.removeEventListener('abort', previous.forget);
      const lifetime = { signal, forget: () => {
        if (this.lifetimes.get(key) !== lifetime) return;
        this.pending.delete(key); this.readers.delete(key); this.lifetimes.delete(key);
      } };
      this.lifetimes.set(key, lifetime);
      signal.addEventListener('abort', lifetime.forget, { once: true });
    }
    this.pending.delete(key); this.readers.set(key, read);
    return () => {
      if (this.readers.get(key) !== read) return;
      // 视图卸载不等于关闭标签。只保留快照，原标签终止时连离屏快照一起释放。
      if (signal && !signal.aborted && !this.disposed) this.pending.set(key, read());
      this.readers.delete(key);
    };
  }
  dispose() {
    this.disposed = true;
    for (const { signal, forget } of this.lifetimes.values()) signal.removeEventListener('abort', forget);
    this.lifetimes.clear(); this.layouts.clear(); this.pending.clear(); this.readers.clear();
  }
}
