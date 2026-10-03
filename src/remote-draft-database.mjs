const completed = transaction => new Promise((resolve, reject) => {
  transaction.oncomplete = resolve;
  transaction.onabort = transaction.onerror = () => reject(transaction.error ?? new Error('remote_draft_storage_failed'));
});

/** 严格事务完成后才确认保存；localStorage 在 WebView 被立即杀进程时可能尚未落盘。 */
export async function openDraftDatabase(prefix, factory = globalThis.indexedDB) {
  const request = factory.open('dshm.remote.drafts.v1', 1);
  request.onupgradeneeded = () => request.result.createObjectStore('drafts');
  const database = await new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error('remote_draft_storage_blocked'));
  });
  database.onversionchange = () => database.close();
  const entries = new Map();
  try {
    const transaction = database.transaction('drafts', 'readonly'), done = completed(transaction);
    const cursor = transaction.objectStore('drafts').openCursor();
    cursor.onsuccess = () => {
      const item = cursor.result;
      if (!item) return;
      if (typeof item.key === 'string' && item.key.startsWith(prefix)) entries.set(item.key, item.value);
      item.continue();
    };
    await done;
  } catch (error) { database.close(); throw error; }
  const write = async (key, value) => {
    const transaction = database.transaction('drafts', 'readwrite', { durability: 'strict' });
    const done = completed(transaction), store = transaction.objectStore('drafts');
    if (value === null) store.delete(key);
    else store.put(value, key);
    await done;
    // 与批量转移一致：事务失败时，读取仍返回最后一次提交的草稿。
    if (value === null) entries.delete(key);
    else entries.set(key, value);
  };
  return { get length() { return entries.size; }, key: index => [...entries.keys()][index] ?? null,
    getItem: key => entries.get(key) ?? null, setItem: (key, value) => write(key, value), removeItem: key => write(key, null),
    async batch(changes, current = () => true) {
      if (!current()) throw new Error('remote_draft_transfer_expired');
      const transaction = database.transaction('drafts', 'readwrite', { durability: 'strict' });
      const done = completed(transaction), store = transaction.objectStore('drafts');
      for (const [key, value] of changes) {
        const request = value === null ? store.delete(key) : store.put(value, key);
        request.onsuccess = () => { if (!current()) transaction.abort(); };
      }
      await done;
      // 转移只在四条记录全部提交后更新内存，失败不能先清空源草稿。
      for (const [key, value] of changes) { if (value === null) entries.delete(key); else entries.set(key, value); }
    },
    close: () => database.close() };
}
