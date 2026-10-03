import { createSnapshotStore } from '@deepseek-ai/dsh-client-store';

export const PHONE_PLUGIN_CATALOG = Object.freeze([
  { id: 'input', name: '输入提示词', version: '0.1.6-alpha.2', description: '在消息中输入 /，选择本地总结或翻译提示词。',
    source: '@deepseek-ai/dsh-client-ui-input-trigger', capabilities: '输入菜单、纯文本插入', configurable: true },
  { id: 'theme', name: '外观主题', version: '0.1.6-alpha.2', description: '调整手机上的浅色、深色主题与阅读字号。',
    source: '@deepseek-ai/dsh-client-ui-theme', capabilities: '主题、字号、本地偏好', configurable: true },
  { id: 'rendering', name: '聊天排版', version: '0.1.0', description: '使用 DSH 的 Markdown、代码高亮和公式排版显示回复。',
    source: '@dsh-mobile/ordinary-rendering', capabilities: '回复内容渲染', configurable: false },
]);
const key = 'dshm:ordinary:plugins:v1';

/** 安装目录只提供经过手机适配核验的随包原始插件；不执行用户输入的任意脚本。 */
export class PhonePlugins {
  #storage;
  #apply;
  #busy = false;
  state;
  constructor(storage, apply) {
    this.#storage = storage; this.#apply = apply;
    const stored = storage.getItem(key);
    const record = stored === null ? Object.fromEntries(PHONE_PLUGIN_CATALOG.map(plugin => [plugin.id, { installed: true, enabled: true, version: plugin.version }])) : JSON.parse(stored);
    if (!record || typeof record !== 'object' || Array.isArray(record) || Object.keys(record).some(id => !PHONE_PLUGIN_CATALOG.some(plugin => plugin.id === id))) throw new Error('invalid_plugin_record');
    for (const plugin of PHONE_PLUGIN_CATALOG) {
      // 随 App 新增的核验插件默认安装；已有插件的启停与卸载状态不被升级覆盖。
      if (!Object.hasOwn(record, plugin.id)) record[plugin.id] = { installed: true, enabled: true, version: plugin.version };
      const value = record[plugin.id];
      if (!value || typeof value.installed !== 'boolean' || typeof value.enabled !== 'boolean' || typeof value.version !== 'string' || value.version.length > 80 || (!value.installed && value.enabled)) throw new Error('invalid_plugin_record');
      // 随包插件代码随 App 一起升级；不能把旧记录版本显示成正在运行的旧代码。
      if (value.installed) value.version = plugin.version;
    }
    this.state = createSnapshotStore({ record, busy: null, error: null });
  }
  enabled(id) { const item = this.state.getSnapshot().record[id]; return item.installed && item.enabled; }
  async change(id, action) {
    const plugin = PHONE_PLUGIN_CATALOG.find(item => item.id === id);
    if (!plugin || !['install', 'uninstall', 'enable', 'disable', 'update'].includes(action)) throw new Error('unsupported_plugin');
    if (this.#busy) throw new Error('plugin_busy');
    const previous = this.state.getSnapshot().record;
    const current = previous[id];
    if (['enable', 'disable', 'update'].includes(action) && !current.installed) throw new Error('plugin_not_installed');
    const next = { ...current };
    if (action === 'install') Object.assign(next, { installed: true, enabled: true, version: plugin.version });
    if (action === 'uninstall') Object.assign(next, { installed: false, enabled: false });
    if (action === 'enable') next.enabled = true;
    if (action === 'disable') next.enabled = false;
    if (action === 'update') next.version = plugin.version;
    this.#busy = true;
    this.state.set({ record: previous, busy: id, error: null });
    try {
      if (action === 'update' && current.version !== plugin.version) await this.#apply(id, false);
      await this.#apply(id, next.installed && next.enabled);
      const record = { ...previous, [id]: next };
      this.#storage.setItem(key, JSON.stringify(record));
      this.state.set({ record, busy: null, error: null });
    } catch (error) {
      // 只有运行结果和持久化都成功才发布；失败恢复上次配置，并报告恢复失败。
      let code = 'plugin_operation_failed';
      try { await this.#apply(id, current.installed && current.enabled); } catch { code = 'plugin_recovery_failed'; }
      this.state.set({ record: previous, busy: null, error: code });
      throw new Error(code, { cause: error });
    } finally { this.#busy = false; }
  }
}
