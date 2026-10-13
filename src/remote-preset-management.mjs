import { presetManagementViewSchema, presetCopySchema, presetDeleteSchema } from '../../backend/packages/protocol/dist/index.js';

/** 一次性原 profile 管理快照；连接变化或关闭后不再接纳迟到结果，不重发未知写入。 */
export class RemotePresetManagement {
  listeners = new Set();
  snapshot = { busy: false, view: null, result: null, error: null };
  version = 0;
  constructor(model) {
    this.model = model;
    this.off = model.connection.generation.subscribe(() => this.clear());
  }
  get supported() { return this.model.transport.capabilities?.presetProfileManagement === true; }
  get permitted() { return this.supported && !this.closed && !this.model.lifetime.signal.aborted
    && this.model.transport.capabilities?.management === true && this.model.connection.state.getSnapshot() === 'connected'; }
  getSnapshot = () => this.snapshot;
  subscribe = listener => { this.listeners.add(listener); return () => this.listeners.delete(listener); };
  publish(value) {
    if (this.closed || this.model.lifetime.signal.aborted) return;
    this.snapshot = value;
    for (const listener of this.listeners) listener();
  }
  clear() {
    this.version++; this.pending?.cancel(); this.pending = undefined;
    this.publish({ busy: false, view: null, result: null, error: null });
  }
  async read(preset) {
    if (!this.permitted || this.snapshot.busy || typeof preset !== 'string' || !/^[a-z0-9][a-z0-9-]{0,127}$/.test(preset)) return false;
    return this.run({ method: 'remote.presetManagementRead', preset }, false);
  }
  async copy(id, name) {
    const view = this.snapshot.view;
    const parsed = presetCopySchema.safeParse({ method: 'remote.presetCopy', snapshot: view?.snapshot, id, name });
    if (!view?.canCopy || !parsed.success) return false;
    return this.run(parsed.data, true);
  }
  async remove(confirmed) {
    const view = this.snapshot.view;
    const parsed = presetDeleteSchema.safeParse({ method: 'remote.presetDelete', snapshot: view?.snapshot, confirmed });
    if (!view?.canDelete || !parsed.success) return false;
    return this.run(parsed.data, true);
  }
  async run(operation, writing) {
    if (!this.permitted || this.snapshot.busy) return false;
    const version = ++this.version, generation = this.model.connection.generation.getSnapshot()?.id;
    if (generation === undefined) return false;
    const view = writing ? this.snapshot.view : null;
    this.publish({ busy: true, view, result: null, error: null });
    let request;
    try {
      request = this.model.client.request(operation); this.pending = request;
      const result = await request.promise;
      if (version !== this.version || generation !== this.model.connection.generation.getSnapshot()?.id || !this.permitted) return false;
      if (!writing) {
        const parsed = presetManagementViewSchema.parse(result);
        if (parsed.preset !== operation.preset) throw Error('invalid_preset_view');
        this.publish({ busy: false, view: parsed, result: null, error: null });
      } else {
        const expected = operation.method === 'remote.presetCopy' ? operation.id : view.preset;
        if (result?.preset !== expected || result.copied !== (operation.method === 'remote.presetCopy')
          || result.deleted !== (operation.method === 'remote.presetDelete')) throw Error('invalid_preset_result');
        this.publish({ busy: false, view: null, result, error: null });
      }
      return true;
    } catch (error) {
      if (version !== this.version || !this.permitted) return false;
      const message = ({ remote_settings_stale: '电脑设置已变化或页面已过期，请重新读取后再修改。',
        remote_preset_exists: '此模式标识已存在，请更换标识并重新读取。',
        remote_preset_inherited: '此模式来自电脑基础配置，不能在这里删除。',
        remote_operation_denied: '电脑配置不允许此操作，请重新读取。',
      })[error?.message] ?? (writing ? '操作结果尚未确认，请重新读取模式列表后核对。' : '无法读取模式信息，请重新连接后重试。');
      this.publish({ busy: false, view: null, result: null, error: message });
      return false;
    } finally { request?.cancel(); if (version === this.version) this.pending = undefined; }
  }
  dispose() { this.clear(); this.closed = true; this.off(); this.listeners.clear(); }
}
