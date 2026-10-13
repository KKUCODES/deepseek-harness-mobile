/** 仅显示电脑原配置保存位置；换连接、换预设或关闭页面后，旧请求不能重新显示路径。 */
export class RemotePresetDirectory {
  listeners = new Set();
  snapshot = { busy: false, value: null, error: null };
  version = 0;
  constructor(model) {
    this.model = model;
    this.off = model.connection.generation.subscribe(() => this.clear());
  }
  get supported() { return this.model.transport.capabilities?.presetProfileDirectory === true; }
  get permitted() {
    return this.supported && !this.closed && !this.model.lifetime.signal.aborted
      && this.model.transport.capabilities?.management === true
      && this.model.connection.state.getSnapshot() === 'connected';
  }
  getSnapshot = () => this.snapshot;
  subscribe = listener => { this.listeners.add(listener); return () => this.listeners.delete(listener); };
  publish(value) {
    if (this.closed || this.model.lifetime.signal.aborted) return;
    this.snapshot = value;
    for (const listener of this.listeners) listener();
  }
  clear() {
    this.version++;
    this.pending?.cancel(); this.pending = undefined;
    this.publish({ busy: false, value: null, error: null });
  }
  async read(id) {
    if (!this.permitted || this.snapshot.busy || typeof id !== 'string' || !/^[a-z0-9][a-z0-9-]{0,127}$/.test(id)) return;
    this.clear();
    const version = this.version, generation = this.model.connection.generation.getSnapshot()?.id;
    if (generation === undefined) return;
    this.publish({ busy: true, value: null, error: null });
    try {
      const request = this.model.client.request({ method: 'remote.rpc', endpoint: 'settings/openAgentPresetDirectory', payload: { args: { agentPreset: id } } });
      this.pending = request;
      const result = await request.promise;
      if (version !== this.version || generation !== this.model.connection.generation.getSnapshot()?.id || !this.permitted) return;
      if (!result.ok || result.value?.opened !== false || typeof result.value?.path !== 'string'
        || typeof result.value?.documentPath !== 'string') throw Error('invalid_preset_location');
      this.publish({ busy: false, value: result.value, error: null });
    } catch {
      if (version === this.version && this.permitted) this.publish({ busy: false, value: null, error: '无法读取配置位置，请重新连接后重试。' });
    } finally { if (version === this.version) this.pending = undefined; }
  }
  dispose() { this.clear(); this.closed = true; this.off(); this.listeners.clear(); }
}
