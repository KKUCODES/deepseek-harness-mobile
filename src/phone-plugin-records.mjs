/** 无原生桥的网页预览只管理本来源；测试可用同协议隔离后端，不代替Android验收。 */
export class LocalPluginBackend {
  revision = 0; runtime = {}; leases = new Map(); watchers = new Set();
  constructor(storage, key = 'dshm:phone-plugins:v2') { this.storage = storage; this.key = key; this.record = JSON.parse(storage?.getItem(key) ?? '{}'); }
  snapshot() { return { schema: 2, revision: this.revision, record: structuredClone(this.record), runtime: structuredClone(this.runtime) }; }
  change(value) { this.storage?.setItem(this.key, JSON.stringify(value)); this.record = value; this.revision++; }
  peers(next, item) {
    if (!item.enabled || !item.group) return;
    for (const other of Object.values(next)) if (other.id !== item.id && other.host === item.host && other.group === item.group && other.enabled) { other.enabled = false; other.revision++; }
  }
  bridge(host) {
    const emit = value => queueMicrotask(() => bridge.onmessage?.({ data: JSON.stringify(value) }));
    const owner = crypto.randomUUID();
    const bridge = { postMessage: raw => {
      const { id, op, data } = JSON.parse(raw);
      try {
        const next = structuredClone(this.record);
        if (op === 'plugins.watch') this.watchers.add(emit);
        else if (op === 'plugins.initialize') {
          for (const { entry, installed, enabled } of data.entries) {
            if (entry.host !== host) throw Error('wrong_host');
            if (!next[entry.id]) { const item = next[entry.id] = { ...entry, installed, enabled, revision: 1, configured: true }; this.peers(next, item); }
            else if (next[entry.id].version !== entry.version) { next[entry.id].version = entry.version; next[entry.id].revision++; }
          }
          if (JSON.stringify(next) !== JSON.stringify(this.record)) this.change(next);
        } else if (op === 'plugins.change') {
          const { entry, action } = data;
          const item = next[entry.id] ??= { ...entry, installed: true, enabled: false, revision: 1, configured: true };
          if (['enable', 'disable', 'update'].includes(action) && !item.installed) throw Error('plugin_not_installed');
          if (action === 'install') Object.assign(item, { installed: true, enabled: true });
          if (action === 'uninstall') Object.assign(item, { installed: false, enabled: false });
          if (action === 'enable') item.enabled = true;
          if (action === 'disable') item.enabled = false;
          item.version = entry.version; item.revision++; this.peers(next, item); this.change(next);
          if (this.leases.has(item.host)) this.runtime[item.id] = { revision: item.revision, status: item.enabled ? 'loading' : 'stopping', error: null };
        } else if (op === 'plugins.claim') {
          this.leases.set(host, { owner, lease: data.lease });
          for (const key of Object.keys(this.runtime)) if (this.record[key]?.host === host) delete this.runtime[key];
          this.revision++;
        } else if (op === 'plugins.runtime') {
          const lease = this.leases.get(host), item = this.record[data.id];
          if (lease?.owner === owner && lease.lease === data.lease && item?.host === host && item.revision === data.revision
            && (data.status !== 'active' || item.installed && item.enabled)) { this.runtime[data.id] = { revision: data.revision, status: data.status, error: data.error }; this.revision++; }
        } else if (op === 'plugins.release') {
          const lease = this.leases.get(host);
          if (lease?.owner === owner && lease.lease === data.lease) {
            this.leases.delete(host);
            for (const key of Object.keys(this.runtime)) if (this.record[key]?.host === host) delete this.runtime[key];
            this.revision++;
          }
        } else throw Error('unsupported_operation');
        const state = this.snapshot();
        for (const watcher of this.watchers) watcher({ event: state });
        emit({ id, data: state });
      } catch { emit({ id, error: 'plugin_operation_failed' }); }
    } };
    return bridge;
  }
}
