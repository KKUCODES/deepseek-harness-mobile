import { PermissionCatalogDirectory } from '../../deepseek-harness/packages/client/ui-permission-presets/src/client/catalog.ts';
import { AUTO_REVIEW_PRESET, FULL_ACCESS_PRESET, displayPermissionPreset } from '../../deepseek-harness/packages/client/ui-permission-presets/src/client/presentation.ts';
import { accessZh, accessEn } from '../../deepseek-harness/packages/client/ui-permission-presets/src/client/locales.ts';

export const permissionNeedsConfirmation = value => [AUTO_REVIEW_PRESET, FULL_ACCESS_PRESET].includes(value);
export const permissionCopy = locale => locale === 'en' ? accessEn : accessZh;
export const permissionLabel = (value, name = value, locale = 'zh') => value === AUTO_REVIEW_PRESET ? permissionCopy(locale)['auto.label']
  : value === 'custom' ? (locale === 'en' ? 'Custom permissions' : '自定义权限') : displayPermissionPreset(value, name, key => permissionCopy(locale)[key]);
export { AUTO_REVIEW_PRESET };

/** 使用原权限目录和生成命令接口，当前值只取电脑会话投影。 */
export class RemotePermissions {
  listeners = new Set();
  snapshot = { status: 'idle', options: [], error: null, revision: 0 };
  reads = 0;
  selecting = new Set();
  uncertain = new Map();
  constructor(model) {
    this.model = model;
    if (!this.available) return;
    this.directory = new PermissionCatalogDirectory(model.ctx);
    this.off = this.directory.invalidations.subscribe(() => {
      this.reads++;
      this.publish({ status: 'loading', options: [], revision: this.snapshot.revision + 1 });
      // 原目录先通知失效，再开始新读取；等同一同步栈完成后才等待新结果。
      queueMicrotask(() => { if (!model.lifetime.signal.aborted) void this.load(); });
    });
  }
  get available() { return this.model.transport.capabilities?.endpoints?.calls?.includes('permissionPresets/catalog') ?? false; }
  get writable() { return this.model.transport.capabilities?.endpoints?.calls?.includes('commands/execute') ?? false; }
  subscribe = listener => { this.listeners.add(listener); return () => this.listeners.delete(listener); };
  getSnapshot = () => this.snapshot;
  publish(patch) {
    if (this.model.lifetime.signal.aborted) return;
    this.snapshot = { ...this.snapshot, ...patch };
    for (const listener of this.listeners) listener();
  }
  async load(refresh = false) {
    if (!this.directory) return;
    const read = ++this.reads;
    this.publish({ status: 'loading', error: null });
    try {
      if (refresh) this.directory.refresh();
      const catalog = await this.directory.load();
      if (read === this.reads) this.publish({ status: 'ready', options: catalog.options });
    } catch (error) {
      if (read === this.reads) this.publish({ status: 'error', options: [], error: error.message });
    }
  }
  async choose(value, sessionId, acknowledged = false) {
    const { model } = this;
    const generation = model.connection.generation.getSnapshot()?.id;
    if (!this.writable) throw new Error('请更新电脑插件和网关后切换权限。');
    if (!sessionId || sessionId !== model.snapshot.selected || model.snapshot.session?.openState !== 'open'
      || model.snapshot.session.running || !model.snapshot.permission || model.sessions.subagentAddress(sessionId) !== undefined)
      throw new Error('当前聊天暂时不能切换权限。');
    if (this.selecting.has(sessionId)) throw new Error('权限正在切换，请稍候。');
    if (generation === undefined || this.uncertain.get(sessionId) === generation)
      throw new Error('权限切换结果尚未确认，请重新连接并核对当前权限。');
    if (this.snapshot.status !== 'ready' || !this.snapshot.options.some(option => option.value === value)
      || typeof value !== 'string' || !value.length || value.length > 128 || value.trim() !== value || /[\x00-\x1f\x7f]/u.test(value))
      throw new Error('权限列表已变化，请重新读取后选择。');
    if (value === model.snapshot.permission.currentValue) return;
    if (permissionNeedsConfirmation(value) && !acknowledged) throw new Error('请先确认权限变更的影响。');
    this.selecting.add(sessionId);
    try {
      // Session.command 仅保留 matched，无法识别 handler 的业务拒绝；这里保留原完整结果。
      const result = await model.remote.commands.execute(sessionId, `/permission ${value}`, [], model.lifetime.signal);
      if (!result.ok) {
        if (['gateway/internal', 'gateway/cancelled'].includes(result.error.code)) {
          this.uncertain.set(sessionId, generation);
          throw new Error('权限切换结果尚未确认，请重新连接并核对当前权限。');
        }
        throw result.error;
      }
      if (!result.value) throw new Error('电脑未提供权限切换命令。');
      if (result.value.result.kind === 'error') throw new Error(result.value.result.text);
    } finally { this.selecting.delete(sessionId); }
  }
  dispose() { this.reads++; this.off?.(); this.directory?.dispose(); this.listeners.clear(); }
}
