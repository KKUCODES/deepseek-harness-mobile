import { createSnapshotStore } from '@deepseek-ai/dsh-client-store';
import { MobilePluginChannel } from './mobile-plugin-channel.mjs';
import { PHONE_PLUGIN_CATALOG, defaultPluginRecord, pluginDescriptor, pluginStatus } from './phone-plugin-catalog.mjs';
import { LocalPluginBackend } from './phone-plugin-records.mjs';
import { externalPhonePlugins } from './external-phone-plugins.mjs';
export { PHONE_PLUGIN_CATALOG, pluginStatus } from './phone-plugin-catalog.mjs';

const runtimeStates = new Set(['inactive', 'loading', 'active', 'stopping', 'failed']);

/** 两个页面使用相同目录和操作协议；原生存储是跨来源的安装意图权威。 */
export class PhonePlugins extends MobilePluginChannel {
  constructor({ bridge = globalThis.DSHMMobilePlugins, storage = globalThis.localStorage, catalog = PHONE_PLUGIN_CATALOG, host = 'ordinary' } = {}) {
    const nativeAvailable = !!bridge;
    super(bridge ?? new LocalPluginBackend(storage, `dshm:phone-plugins:v2:${host}`).bridge(host));
    this.nativeAvailable = nativeAvailable; this.bundledCatalog = catalog; this.catalog = catalog; this.storage = storage; this.host = host;
    this.snapshot = { ready: false, revision: -1, record: Object.fromEntries(catalog.map(entry => [entry.id, defaultPluginRecord(entry)])), runtime: {}, busy: null, error: null };
    this.state = createSnapshotStore(this.snapshot);
  }
  accept(value) {
    if (value?.schema !== 2 || !Number.isSafeInteger(value.revision) || value.revision < this.snapshot.revision || !value.record || !value.runtime) return;
    let external;
    try { external = externalPhonePlugins(value.external); } catch { return; }
    if (external.some(entry => this.bundledCatalog.some(builtin => builtin.id === entry.id))) return;
    this.catalog = [...this.bundledCatalog, ...external];
    const record = {}, runtime = {};
    for (const entry of this.catalog) {
      const item = value.record[entry.id];
      if (item) {
        if (item.id !== entry.id || item.host !== entry.host || typeof item.installed !== 'boolean' || typeof item.enabled !== 'boolean'
          || !item.installed && item.enabled || !Number.isSafeInteger(item.revision) || item.revision < 1 || typeof item.version !== 'string') return;
        record[entry.id] = { ...item, configured: true };
      } else record[entry.id] = defaultPluginRecord(entry);
      const reported = value.runtime[entry.id];
      if (reported && runtimeStates.has(reported.status) && reported.revision === record[entry.id].revision) runtime[entry.id] = reported;
    }
    this.publish({ ready: true, revision: value.revision, record, runtime, installerApi: value.installerApi === 1 ? 1 : 0 });
  }
  publish(value) {
    this.snapshot = { ...this.snapshot, ...value };
    this.state.set(this.snapshot); this.listeners.forEach(listener => listener());
  }
  initialEntries() {
    const old = this.host === 'ordinary' ? JSON.parse(this.storage?.getItem('dshm:ordinary:plugins:v1') ?? 'null') : null;
    const saved = this.host === 'remote' ? this.storage?.getItem('dshm.mobile-interface.v1') : null;
    const selection = saved == null ? undefined : JSON.parse(saved);
    return this.catalog.filter(entry => entry.host === this.host && !entry.external).map(entry => {
      const previous = old?.[entry.id];
      if (previous && (typeof previous.installed !== 'boolean' || typeof previous.enabled !== 'boolean' || !previous.installed && previous.enabled)) throw Error('invalid_plugin_record');
      return { entry: pluginDescriptor(entry), installed: previous?.installed ?? true,
        enabled: previous?.enabled ?? (entry.group && selection !== undefined ? entry.id === selection : entry.defaultEnabled ?? true) };
    });
  }
  start() { return this.started ??= this.call('plugins.watch').then(() => this.call('plugins.initialize', { entries: this.initialEntries() })).catch(error => { this.started = null; throw error; }); }
  enabled(id) { const item = this.snapshot.record[id]; return !!item?.installed && item.enabled; }
  running(id) { return pluginStatus(this.snapshot.record[id], this.snapshot.runtime[id]) === '运行中'; }
  canManage(entry) { return this.nativeAvailable || entry.host === this.host; }
  async importPackage() {
    if (!this.nativeAvailable || this.host !== 'ordinary' || this.snapshot.installerApi !== 1) throw Error('mobile_plugins_unavailable');
    if (this.snapshot.busy) throw Error('plugin_busy');
    this.publish({ busy: 'import', error: null });
    try { await this.call('plugins.import', {}, 300000); }
    finally { this.publish({ busy: null }); }
  }
  async change(id, action) {
    const entry = this.catalog.find(item => item.id === id);
    if (!entry || !this.canManage(entry) || !['install', 'uninstall', 'enable', 'disable', 'retry', 'update'].includes(action)) throw Error('unsupported_plugin');
    if (this.snapshot.busy) throw Error('plugin_busy');
    this.publish({ busy: id, error: null });
    try {
      if (entry.external && ['install', 'update'].includes(action)) throw Error('unsupported_plugin');
      await this.call('plugins.change', { entry: pluginDescriptor(entry), action });
    }
    catch (error) { this.publish({ error: 'plugin_operation_failed' }); throw error; }
    finally { this.publish({ busy: null }); }
  }
  async restore(id) {
    const entry = this.catalog.find(item => item.id === id);
    if (this.host !== 'ordinary' || !this.nativeAvailable || !entry?.preinstalled) throw Error('unsupported_plugin');
    if (this.snapshot.busy) throw Error('plugin_busy');
    this.publish({ busy: id, error: null });
    try { await this.call('plugins.restore', { id }); }
    finally { this.publish({ busy: null }); }
  }
}

/** 通用宿主执行器：安装意图与执行结果分开，过期操作不能报告运行成功。 */
export class PhonePluginHost {
  jobs = new Map(); closed = false;
  constructor(registry, handlers) {
    this.registry = registry; this.handlers = handlers; this.lease = crypto.randomUUID();
    this.ready = registry.start().then(() => registry.call('plugins.claim', { lease: this.lease })).then(() => {
      if (this.closed) return;
      this.off = registry.subscribe(() => this.sync());
      return this.sync();
    });
  }
  report(id, revision, status, error = null) {
    if (this.closed || this.registry.getSnapshot().record[id]?.revision !== revision) return Promise.resolve();
    return this.registry.call('plugins.runtime', { lease: this.lease, id, revision, status, error });
  }
  handler(entry) { return typeof this.handlers === 'function' ? this.handlers(entry) : this.handlers[entry.id]; }
  sync() {
    if (this.closed) return;
    const work = [];
    for (const entry of this.registry.catalog.filter(entry => entry.host === this.registry.host)) {
      const record = this.registry.getSnapshot().record[entry.id];
      if (!record.configured) continue;
      let job = this.jobs.get(entry.id);
      if (!job) { job = { revision: -1, running: false }; this.jobs.set(entry.id, job); }
      if (job.running || job.revision === record.revision) continue;
      job.running = true;
      job.task = this.run(entry, job).finally(() => { job.running = false; if (!this.closed) this.sync(); });
      work.push(job.task);
    }
    return Promise.all(work);
  }
  async run(entry, job) {
    const record = this.registry.getSnapshot().record[entry.id], enabled = record.installed && record.enabled;
    job.revision = record.revision;
    try {
      await this.report(entry.id, record.revision, enabled ? 'loading' : 'stopping');
      const handler = this.handler(entry);
      if (!handler) throw Error('missing');
      await handler(enabled);
      await this.report(entry.id, record.revision, enabled ? 'active' : 'inactive');
    } catch (error) {
      // 激活失败也释放部分注册，默认正文/首页仍由宿主兜底。
      try { await this.handler(entry)?.(false); } catch { /* 后续显式重试重新收敛。 */ }
      await this.report(entry.id, record.revision, 'failed', ['missing', 'incompatible', 'timeout', 'render', 'storage'].includes(error?.message) ? error.message : 'load').catch(() => {});
    }
  }
  async fail(id, error = 'render') {
    const record = this.registry.getSnapshot().record[id];
    if (!record || !this.registry.enabled(id)) return;
    await this.report(id, record.revision, 'failed', error);
  }
  async dispose() {
    if (this.closed) return;
    this.closed = true; this.off?.();
    await this.registry.call('plugins.release', { lease: this.lease }).catch(() => {});
    await Promise.all([...this.jobs.values()].map(job => job.task));
    await Promise.all(this.registry.catalog.filter(entry => this.jobs.has(entry.id)).map(entry => Promise.resolve().then(() => this.handler(entry)?.(false)).catch(() => {})));
  }
}

const registries = new Map();
export function phonePluginsFor(host) {
  if (!registries.has(host)) registries.set(host, new PhonePlugins({ host }));
  return registries.get(host);
}
