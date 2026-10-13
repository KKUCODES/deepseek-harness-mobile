import { computerEndpointTargetSchema } from '../../backend/packages/protocol/dist/index.js';

export function endpointWriteMarker(value) {
  if (!value || Object.keys(value).some(key => !['version', 'id', 'target'].includes(key))
    || value.version !== 1 || typeof value.id !== 'string' || !/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/.test(value.id)) {
    throw new Error('remote_endpoint_storage_failed');
  }
  const target = value.target === undefined ? undefined : computerEndpointTargetSchema.parse(value.target);
  return { version: 1, id: value.id, ...(target === undefined ? {} : { target }) };
}

const key = target => JSON.stringify(target ?? null);

/** 只持久化待核对目标；进程恢复后没有可重发的请求或地址。 */
export class RemoteEndpointJournal {
  pending = new Map(); recovered = new Map(); failure = false;
  constructor(store, changed) {
    this.store = store; this.changed = changed;
    try {
      for (const marker of store?.readEndpointWrites?.() ?? []) {
        this.pending.set(key(marker.target), marker); this.recovered.set(key(marker.target), marker);
      }
    } catch { this.failure = true; }
  }
  recovery(target) { return this.recovered.get(key(target)); }
  summaries() { return [...this.recovered.values()].map(marker => marker.target ?? null); }
  async begin(target) {
    if (this.failure || !this.store?.prepareEndpointWrite) throw new Error('remote_endpoint_storage_failed');
    const marker = endpointWriteMarker({ version: 1, id: crypto.randomUUID(), ...(target === undefined ? {} : { target }) });
    try { await this.store.prepareEndpointWrite(marker); } catch { throw new Error('remote_endpoint_storage_failed'); }
    this.pending.set(key(target), marker); return marker;
  }
  uncertain(marker) {
    if (marker && this.pending.get(key(marker.target))?.id === marker.id) {
      this.recovered.set(key(marker.target), marker); this.changed();
    }
  }
  async settled(marker) {
    if (!marker || this.pending.get(key(marker.target))?.id !== marker.id) return;
    await this.store.forgetEndpointWrite(marker);
    if (this.pending.get(key(marker.target))?.id !== marker.id) return;
    this.pending.delete(key(marker.target)); this.recovered.delete(key(marker.target)); this.changed();
  }
}
