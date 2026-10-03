import { Service } from '@deepseek-ai/cordis';

export const pluginIdentity = ctx => ctx.fiber.entry?.options.name ?? ctx.fiber.name;
const storageKey = 'dshm.remote.plugin-layout.v1';

/** 作者声明随插件 fiber 释放；用户覆盖只保存在手机，优先于声明，缺省开启。 */
export class MobilePluginLayout extends Service {
  revision = 0;
  listeners = new Set();
  declarations = new Map();
  users = new Map();
  constructor(ctx, storage) {
    super(ctx, 'dshmLayout');
    this.storage = storage;
    try {
      const saved = JSON.parse(storage.getItem(storageKey) ?? '{}');
      for (const [id, value] of Object.entries(saved)) if (typeof value === 'boolean') this.users.set(id, value);
    } catch { /* 本机布局偏好损坏不阻断连接。 */ }
  }
  subscribe = listener => { this.listeners.add(listener); return () => this.listeners.delete(listener); };
  getSnapshot = () => this.revision;
  publish() { this.revision++; for (const listener of this.listeners) listener(); }
  effective(id) { return this.users.get(id) ?? this.declarations.get(id)?.at(-1)?.autoFit ?? true; }
  userValue(id) { return this.users.get(id); }
  configure(options) {
    if (!options || typeof options.autoFit !== 'boolean' || Object.keys(options).some(key => key !== 'autoFit')) throw new Error('dshmLayout.configure requires { autoFit: boolean }');
    const id = pluginIdentity(this.ctx);
    if (!id) throw new Error('dshmLayout requires a named plugin');
    const declaration = { autoFit: options.autoFit };
    return this.ctx.effect(() => {
      const entries = this.declarations.get(id) ?? [];
      this.declarations.set(id, [...entries, declaration]); this.publish();
      return () => {
        const remaining = (this.declarations.get(id) ?? []).filter(item => item !== declaration);
        if (remaining.length) this.declarations.set(id, remaining); else this.declarations.delete(id);
        this.publish();
      };
    }, 'dshmLayout.configure');
  }
  setUser(id, value) {
    if (typeof id !== 'string' || !id || (value !== undefined && typeof value !== 'boolean')) throw new Error('invalid_plugin_layout_preference');
    const next = new Map(this.users);
    if (value === undefined) next.delete(id); else next.set(id, value);
    this.storage.setItem(storageKey, JSON.stringify(Object.fromEntries(next)));
    this.users = next; this.publish();
  }
}
