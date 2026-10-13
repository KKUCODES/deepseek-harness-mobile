import { z } from 'zod';
import { requiresCodingTools } from '@upstream/ui-agent-preset/src/client/settings-store.ts';
import { RemotePluginSettingsScope } from './remote-plugin-settings.mjs';

const viewSchema = z.object({ enabled: z.boolean(), documentId: z.string().min(1).max(1024).optional() }).strict();

/** 聊天设备只读取一个布尔偏好；写入仍使用管理权限、原文档身份和一次性设置快照。 */
export class RemoteCodingTools {
  listeners = new Set();
  snapshot = { mode: 'host', status: 'loading', writable: false, value: undefined, busy: false, error: null };
  version = 0;
  disposed = false;
  constructor(model) {
    this.model = model;
    this.writer = new RemotePluginSettingsScope(model, 'ui-settings');
    this.defaults = new RemotePluginSettingsScope(model, 'agent-preset-registry');
    this.off = model.remote.$on('settings/document-updated', ns => {
      if (ns === 'ui-settings' || ns === this.documentId) void this.refresh();
    });
    this.offGeneration = model.connection.generation.subscribe(() => { this.request?.cancel(); void this.refresh(); });
  }
  getSnapshot = () => this.snapshot;
  subscribe = listener => { this.listeners.add(listener); return () => this.listeners.delete(listener); };
  current() { return !this.disposed && !this.model.lifetime.signal.aborted && this.model.connection.state.getSnapshot() === 'connected'
    && this.model.transport.capabilities?.codingToolsSettings === true && this.model.connection.generation.getSnapshot(); }
  publish(patch) {
    if (this.disposed || this.model.lifetime.signal.aborted) return;
    this.snapshot = { ...this.snapshot, ...patch };
    for (const fn of this.listeners) fn();
  }
  allows(preset) { return !requiresCodingTools(preset) || this.snapshot.value?.enabled === true; }
  refresh() {
    this.version++;
    this.publish({ writable: false, status: 'loading', value: undefined });
    return this.load();
  }
  load() {
    return this.pending ??= this.read().finally(() => { this.pending = undefined; });
  }
  async read() {
    for (;;) {
      const generation = this.current(), version = this.version;
      if (!generation) return;
      let request;
      try {
        this.request = request = this.model.client.request({ method: 'remote.codingToolsRead' });
        const value = viewSchema.parse(await request.promise);
        if (this.current() !== generation || version !== this.version) continue;
        this.documentId = value.documentId;
        this.publish({ status: 'ready', value: { enabled: value.enabled }, error: null,
          writable: this.model.transport.capabilities?.management === true });
        return;
      } catch {
        if (this.current() !== generation || version !== this.version) continue;
        this.publish({ status: 'error', writable: false, error: '暂时无法读取电脑设置，请重新连接后重试。' });
        return;
      } finally { request?.cancel(); if (this.request === request) this.request = undefined; }
    }
  }
  set(key, value) { return key === 'enabled' && typeof value === 'boolean' ? this.write(value) : Promise.resolve(false); }
  unset(key) { return key === 'enabled' ? this.write(undefined) : Promise.resolve(false); }
  async write(enabled) {
    if (!this.snapshot.writable || this.snapshot.busy || !this.current()) return false;
    const generation = this.current();
    this.publish({ busy: true, error: null });
    try {
      await this.writer.load();
      if (this.current() !== generation || !this.writer.getSnapshot().writable) throw Error('stale');
      // 与原页面一致：关闭代码视图前，将被隐藏的内置默认模式纠正为健康 Standard。
      const next = enabled ?? this.writer.getSnapshot().base?.enabled ?? true;
      if (next === false) {
        const roster = await this.model.remote.agentPresets.list();
        if (!roster.ok || this.current() !== generation) throw Error('stale');
        if (requiresCodingTools(roster.value.presets.find(row => row.isDefault))) {
          if (!roster.value.presets.some(row => row.id === 'standard' && row.broken === undefined)) throw Error('standard unavailable');
          await this.defaults.load();
          if (this.current() !== generation || !await this.defaults.set('selectedDefault', 'standard')) throw Error('default not saved');
        }
      }
      if (this.current() !== generation) throw Error('stale');
      const saved = enabled === undefined ? await this.writer.unset('enabled') : await this.writer.set('enabled', enabled);
      if (!saved || this.current() !== generation) throw Error('write not confirmed');
      await this.refresh();
      return this.current() === generation && this.snapshot.status === 'ready';
    } catch {
      this.publish({ writable: false, error: this.writer.getSnapshot().error ?? '保存结果尚未确认，请重新连接电脑并重新读取设置后核对。' });
      return false;
    } finally { this.publish({ busy: false }); }
  }
  dispose() { this.disposed = true; this.version++; this.request?.cancel(); this.off(); this.offGeneration(); this.writer.dispose(); this.defaults.dispose(); this.listeners.clear(); }
}
