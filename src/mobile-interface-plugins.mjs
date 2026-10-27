import { PHONE_PLUGIN_CATALOG, MOBILE_INTERFACE_API, REMOTE_HOME_SLOT, REMOTE_CONNECTION_SLOT } from './phone-plugin-catalog.mjs';
export { MOBILE_INTERFACE_API, REMOTE_HOME_SLOT, REMOTE_CONNECTION_SLOT } from './phone-plugin-catalog.mjs';

/** 本地随包目录与安装器分开；不读取电脑插件包或启用 npm 安装分支。 */
export const mobileInterfaceCatalog = PHONE_PLUGIN_CATALOG.filter(entry => entry.host === 'remote' && entry.group === REMOTE_HOME_SLOT);

/** 一个页面选择一个界面插件；Cordis 负责收回注册，宿主会话不随外观销毁。 */
export class MobileInterfacePlugins {
  listeners = new Set();
  revision = 0;
  closed = false;
  fiber = null;
  snapshot = { selected: null, status: 'default', error: null };
  subscribe = listener => { this.listeners.add(listener); return () => this.listeners.delete(listener); };
  getSnapshot = () => this.snapshot;
  entries() { return typeof this.catalog === 'function' ? this.catalog() : this.catalog; }
  constructor(ctx, catalog = mobileInterfaceCatalog, { timeoutMs = 8000, autoStart = true } = {}) {
    this.ctx = ctx; this.catalog = catalog;
    this.timeoutMs = timeoutMs;
    this.offError = ctx.slots.onEntryError(slot => {
      if (![REMOTE_HOME_SLOT, REMOTE_CONNECTION_SLOT].includes(slot)) return;
      // 槽的错误账本先完成退位，再释放该插件；不在 React 渲染中更换插件树。
      const revision = this.revision;
      queueMicrotask(() => { if (!this.closed && revision === this.revision) void this.fail('render'); });
    });
    // 安装意图只由统一管理器持有；加载器不再维护另一份启停偏好。
    this.ready = autoStart ? this.select(this.entries()[0]?.id ?? null) : Promise.resolve();
    ctx.effect(() => () => this.dispose(), 'DSHM: mobile interface plugins');
  }
  publish(value) {
    if (this.closed) return;
    this.snapshot = { ...this.snapshot, ...value };
    this.listeners.forEach(listener => listener());
  }
  async release() {
    const fiber = this.fiber;
    if (fiber) await this.bounded(fiber.dispose());
    if (this.fiber === fiber) this.fiber = null;
  }
  async bounded(task) {
    let timer;
    try {
      return await Promise.race([task, new Promise((_, reject) => { timer = setTimeout(() => reject(Error('timeout')), this.timeoutMs); })]);
    } finally { clearTimeout(timer); }
  }
  async fail(error) {
    this.revision++;
    this.publish({ status: 'failed', error });
    await this.release();
  }
  async select(id) {
    if (this.closed) return;
    const revision = ++this.revision;
    this.publish({ selected: id, status: id ? 'loading' : 'default', error: null });
    await this.release();
    if (revision !== this.revision || this.closed || !id) return;
    const entry = this.entries().find(item => item.id === id);
    try {
      if (!entry) throw Error('missing');
      if (entry.apiVersion !== MOBILE_INTERFACE_API) throw Error('incompatible');
      const module = await this.bounded(Promise.resolve().then(() => entry.load()));
      if (revision !== this.revision || this.closed) return;
      if (module.name !== entry.id || typeof module.apply !== 'function' || module.mobileInterface?.apiVersion !== MOBILE_INTERFACE_API
        || module.mobileInterface?.surface !== REMOTE_HOME_SLOT) throw Error('incompatible');
      const fiber = this.ctx.plugin(module);
      this.fiber = fiber;
      await this.bounded(fiber.await());
      if (revision !== this.revision || this.closed) { await fiber.dispose(); return; }
      this.publish({ status: 'active' });
    } catch (error) {
      if (revision === this.revision && !this.closed) await this.fail(['missing', 'incompatible', 'timeout'].includes(error?.message) ? error.message : 'load');
    }
  }
  async dispose() {
    if (this.closed) return;
    this.closed = true; this.revision++; this.offError?.(); this.listeners.clear();
    await this.release();
  }
}
