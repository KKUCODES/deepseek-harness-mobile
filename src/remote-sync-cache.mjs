import { SYNC_CACHE_FIELD, SYNC_CACHE_LIMIT, syncCacheEndpoint, syncHash, applySyncDelta } from '../../backend/packages/protocol/dist/index.js';

const transactionDone = tx => new Promise((resolve, reject) => {
  tx.oncomplete = resolve; tx.onabort = tx.onerror = () => reject(tx.error ?? Error('sync_cache_storage'));
});

/** 基线只用于解压电脑已确认的结果，绝不离线恢复审批或自动重放操作。 */
export class RemoteSyncCache {
  static async open(binding, factory = globalThis.indexedDB) {
    if (!binding?.paired || !['origin', 'deviceId', 'fingerprint'].every(key => typeof binding[key] === 'string' && binding[key])) return;
    try {
      const request = factory.open('dshm.remote.sync.v1', 1);
      request.onupgradeneeded = () => {
        request.result.createObjectStore('baselines', { keyPath: 'key' });
        request.result.createObjectStore('metadata');
      };
      const database = await new Promise((resolve, reject) => { request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); });
      const tx = database.transaction(['baselines', 'metadata'], 'readwrite'), done = transactionDone(tx);
      const metadata = tx.objectStore('metadata'), epoch = binding.cacheEpoch ?? 0, saved = metadata.get('epoch');
      saved.onsuccess = () => {
        if (saved.result !== epoch) { tx.objectStore('baselines').clear(); metadata.put(epoch, 'epoch'); }
      };
      await done;
      const cache = new RemoteSyncCache(JSON.stringify([binding.origin, binding.deviceId, binding.fingerprint]), database);
      database.onversionchange = () => database.close();
      return cache;
    } catch { /* 存储不可用时保留完整只读同步。 */ }
  }
  constructor(scope, database) { this.scope = scope; this.database = database; this.epoch = 0; }
  key(endpoint, payload, version) { return JSON.stringify([this.scope, version, endpoint, payload]); }
  async prepare(endpoint, payload, stream, version, forceFull = false) {
    if (!syncCacheEndpoint(endpoint, stream)) return;
    const key = this.key(endpoint, payload, version), epoch = this.epoch;
    let base;
    if (!forceFull) {
      try {
        const tx = this.database.transaction('baselines', 'readonly'), done = transactionDone(tx);
        const request = tx.objectStore('baselines').get(key);
        const row = await new Promise((resolve, reject) => { request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); });
        await done;
        if (row && typeof row.text === 'string' && row.text.length <= SYNC_CACHE_LIMIT && Date.now() - row.at < 7 * 86400000
          && await syncHash(row.text) === row.hash) base = { hash: row.hash, value: JSON.parse(row.text) };
      } catch { /* 损坏、淘汰或关闭的缓存均使用完整基线。 */ }
    }
    return { key, epoch, base, payload: { ...payload, [SYNC_CACHE_FIELD]: { version: 1, ...(base ? { hash: base.hash } : {}) } } };
  }
  async decode(value, request, signal) {
    if (value?._dshmSync !== 1) return value;
    signal?.throwIfAborted();
    let result;
    try {
      if (!request || !/^[a-f0-9]{64}$/.test(value.hash)) throw Error();
      if (Object.hasOwn(value, 'delta')) {
        if (!request.base || value.base !== request.base.hash) throw Error();
        result = applySyncDelta(value.delta, request.base.value);
      } else if (Object.hasOwn(value, 'value')) result = value.value;
      else throw Error();
      const text = JSON.stringify(result);
      if (new TextEncoder().encode(text).length > SYNC_CACHE_LIMIT || await syncHash(text) !== value.hash) throw Error();
      signal?.throwIfAborted();
      // 清缓存或撤权在途时不可重新写回；写盘失败也不能隐藏已确认的电脑结果。
      if (request.epoch === this.epoch) await this.save({ key: request.key, text, hash: value.hash, at: Date.now() }).catch(() => {});
      return result;
    } catch (error) {
      signal?.throwIfAborted();
      const failure = Error('sync_cache_invalid', { cause: error });
      failure.dshmSyncDecodeFailure = true;
      throw failure;
    }
  }
  async save(row) {
    const tx = this.database.transaction('baselines', 'readwrite'), done = transactionDone(tx), store = tx.objectStore('baselines');
    store.put(row);
    const all = store.getAll();
    all.onsuccess = () => {
      const rows = all.result.sort((a, b) => b.at - a.at);
      let bytes = 0;
      for (const [index, entry] of rows.entries()) {
        bytes += new TextEncoder().encode(entry.text).length;
        if (index >= 128 || bytes > 16 * 1024 * 1024 || Date.now() - entry.at >= 7 * 86400000) store.delete(entry.key);
      }
    };
    await done;
  }
  async clear() {
    this.epoch++;
    try {
      const tx = this.database.transaction('baselines', 'readwrite'), done = transactionDone(tx);
      tx.objectStore('baselines').clear(); await done;
    } catch { /* 删除失败不允许当前请求再使用旧引用。 */ }
  }
  close() { this.epoch++; this.database.close(); }
}
