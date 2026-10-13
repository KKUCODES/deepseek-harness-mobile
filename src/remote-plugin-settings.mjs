import { RemoteComputerSettings } from './remote-settings.mjs';

/** 原配置卡的局部 scope 适配；只消费 Host 已核验字段，不提供通用 settings/credentials。 */
export class RemotePluginSettingsScope {
  listeners = new Set();
  snapshot = { status: 'loading', writable: false, mode: 'host' };
  lifetime = new AbortController();
  version = 0;
  constructor(model, namespace) {
    this.settings = new RemoteComputerSettings(model, namespace);
    this.off = model.remote.$on('settings/document-updated', ns => {
      // 新版原事件携带 profile 实例 ID；只匹配 Host 返回的真实文档身份，不猜测实例名称。
      if ((ns === namespace || ns === this.settings.view?.documentId) && !this.writing) this.invalidate();
    });
    this.offGeneration = model.connection.generation.subscribe(() => this.invalidate());
  }
  getSnapshot = () => this.snapshot;
  subscribe = listener => { this.listeners.add(listener); return () => this.listeners.delete(listener); };
  publish(patch) {
    if (this.lifetime.signal.aborted) return;
    this.snapshot = { ...this.snapshot, ...patch };
    for (const listener of this.listeners) listener();
  }
  invalidate() {
    this.version++;
    this.publish({ writable: false, error: '电脑设置已变化，请重新读取。' });
  }
  accept(view) {
    const value = {}, base = {}, user = {};
    for (const field of view.fields) {
      if (field.value !== undefined) value[field.key] = field.value;
      if (field.base !== undefined) base[field.key] = field.base;
      if (field.overridden) user[field.key] = field.user;
    }
    this.publish({ status: 'ready', writable: view.writable, revision: view.revision, value, base, user, error: null });
  }
  async load() {
    if (this.settings.busy || this.lifetime.signal.aborted) return;
    const version = ++this.version;
    this.publish({ writable: false, error: null, busy: true });
    try {
      const view = await this.settings.read(this.lifetime.signal);
      if (version === this.version) this.accept(view);
    } catch (error) { if (version === this.version) this.publish({ writable: false, error: error.message }); }
    finally { this.publish({ busy: false }); }
  }
  set(key, value) { return this.write([{ op: 'set', key, value }]); }
  unset(key) { return this.write([{ op: 'unset', key }]); }
  mutate(operations, expectedRevision) {
    // 原模型卡一次提交两个字段；只接受顶层路径，不能把局部 scope 扩成任意设置代理。
    if (!operations.every(edit => ['set', 'unset'].includes(edit.op) && Array.isArray(edit.path) && edit.path.length === 1)) {
      this.publish({ writable: false, error: '请输入有效的设置值。' });
      return Promise.resolve(false);
    }
    return this.write(operations.map(edit => edit.op === 'set'
      ? { op: 'set', key: edit.path[0], value: edit.value } : { op: 'unset', key: edit.path[0] }), expectedRevision);
  }
  async write(edits, expectedRevision = this.snapshot.revision) {
    if (!this.snapshot.writable || this.lifetime.signal.aborted || this.writing) return false;
    if (expectedRevision !== this.snapshot.revision) { this.invalidate(); return false; }
    const version = this.version;
    this.writing = true;
    this.publish({ busy: true });
    try {
      const view = await this.settings.save(this.settings.view, edits, this.lifetime.signal);
      if (version !== this.version || this.lifetime.signal.aborted) return false;
      this.accept(view);
      return true;
    } catch (error) {
      // 保留旧 user 层，原 CardForm 据此报告未保存；未知结果不重发。
      this.publish({ writable: false, error: error.message });
      return false;
    } finally { this.writing = false; this.publish({ busy: false }); }
  }
  dispose() { this.lifetime.abort(); this.off(); this.offGeneration(); this.listeners.clear(); }
}
