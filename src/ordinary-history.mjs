import { chatPreferences, DEFAULT_MODEL, isModel } from './ordinary-models.mjs';
import { decodeBackup, encodeBackup, portableChat } from './ordinary-backup.mjs';
import { userContent } from './ordinary-attachments.mjs';
import { requestOptions as cleanOptions } from './ordinary-options.mjs';

const DATABASE = 'dshm-ordinary-history-v1';
const active = status => status === 'sending' || status === 'streaming';

/** 每次修改在同一读写事务中读/改/写；数据库只存普通聊天，绝不存模型 Key。 */
export class OrdinaryHistory {
  #db;
  async open() {
    this.#db = await new Promise((resolve, reject) => {
      const request = indexedDB.open(DATABASE, 2);
      request.onupgradeneeded = () => {
        const store = request.result.objectStoreNames.contains('chats')
          ? request.transaction.objectStore('chats') : request.result.createObjectStore('chats', { keyPath: 'id' });
        if (!store.indexNames.contains('recent')) store.createIndex('recent', ['updatedAt', 'id']);
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(new Error('history_unavailable'));
      request.onblocked = () => reject(new Error('history_blocked'));
    });
    this.#db.onversionchange = () => this.#db.close();
    return this;
  }
  #transaction(mode, execute) {
    return new Promise((resolve, reject) => {
      const tx = this.#db.transaction('chats', mode);
      let result;
      let error;
      tx.oncomplete = () => resolve(result);
      tx.onabort = tx.onerror = () => reject(error ?? new Error('history_write_failed'));
      try { execute(tx.objectStore('chats'), value => { result = value; }, failure => { error = failure; tx.abort(); }); }
      catch (failure) { error = failure; tx.abort(); }
    });
  }
  list() {
    return this.#transaction('readonly', (store, done) => {
      store.getAll().onsuccess = event => done(event.target.result.sort((a, b) => b.updatedAt - a.updatedAt));
    });
  }
  get(id) {
    return this.#transaction('readonly', (store, done, fail) => {
      store.get(id).onsuccess = event => {
        const chat = event.target.result;
        if (!chat || chat.mode !== 'ordinary') { fail(new Error('ordinary_chat_missing')); return; }
        done({ ...chat, ...chatPreferences(chat) });
      };
    });
  }
  page({ before = null, limit = 40, query = '' } = {}) {
    if (!Number.isInteger(limit) || limit < 1 || limit > 100 || typeof query !== 'string') return Promise.reject(new Error('invalid_page'));
    const needle = query.trim().toLocaleLowerCase();
    return this.#transaction('readonly', (store, done) => {
      const items = [];
      let next = null;
      store.index('recent').openCursor(before ? IDBKeyRange.upperBound(before, true) : null, 'prev').onsuccess = event => {
        const cursor = event.target.result;
        if (!cursor) { done({ items, next: null }); return; }
        const chat = cursor.value;
        if (chat.mode !== 'ordinary') { cursor.continue(); return; }
        const match = !needle || chat.title.toLocaleLowerCase().includes(needle) ||
          chat.turns.some(turn => turn.prompt.toLocaleLowerCase().includes(needle) || turn.content.toLocaleLowerCase().includes(needle));
        if (match) {
          if (items.length === limit) { done({ items, next }); return; }
          const found = needle && chat.turns.find(turn => `${turn.prompt}\n${turn.content}`.toLocaleLowerCase().includes(needle));
          const body = found ? `${found.prompt}\n${found.content}` : chat.turns.at(-1)?.content ?? '';
          const start = Math.max(0, body.toLocaleLowerCase().indexOf(needle) - 30);
          items.push({ id: chat.id, title: chat.title, draft: !!chat.draft || !!chat.attachments?.length, updatedAt: chat.updatedAt,
            snippet: body.slice(start, start + 180), count: chat.turns.length });
          next = cursor.key;
        }
        cursor.continue();
      };
    });
  }
  create({ model = DEFAULT_MODEL, provider, thinking = false, requestOptions } = {}) {
    if (!isModel(model, provider) || typeof thinking !== 'boolean') return Promise.reject(new Error('invalid_preferences'));
    const chat = { id: crypto.randomUUID(), mode: 'ordinary', title: '新聊天', draft: '', model, thinking, turns: [], updatedAt: Date.now(),
      ...(provider && provider !== 'deepseek' ? { provider } : {}), ...(requestOptions === undefined ? {} : { requestOptions: cleanOptions(requestOptions) }) };
    return this.#transaction('readwrite', (store, done) => { store.add(chat); done(chat); });
  }
  update(id, change) {
    return this.#transaction('readwrite', (store, done, fail) => {
      store.get(id).onsuccess = event => {
        try {
          const chat = event.target.result;
          if (!chat || chat.mode !== 'ordinary') throw new Error('ordinary_chat_missing');
          change(chat);
          chat.updatedAt = Date.now();
          store.put(chat);
          done(chat);
        } catch (error) { fail(error); }
      };
    });
  }
  delete(id) { return this.#transaction('readwrite', (store, done) => { store.delete(id); done(); }); }
  clear() { return this.#transaction('readwrite', (store, done) => { store.clear(); done(); }); }
  stats() {
    return this.#transaction('readonly', (store, done) => {
      const result = { chats: 0, turns: 0, drafts: 0, bytes: 0 };
      store.openCursor().onsuccess = event => {
        const cursor = event.target.result;
        if (!cursor) { done(result); return; }
        const chat = cursor.value;
        if (chat.mode === 'ordinary') {
          result.chats++; result.turns += chat.turns.length;
          result.drafts += Number(!!chat.draft || !!chat.attachments?.length);
          result.bytes += new TextEncoder().encode(JSON.stringify(chat)).length;
        }
        cursor.continue();
      };
    });
  }
  rename(id, title) {
    if (typeof title !== 'string' || !title.trim() || title.length > 200) return Promise.reject(new Error('invalid_title'));
    return this.update(id, chat => { chat.title = title.trim(); });
  }
  fork(id, count, draft = '', attachments = []) {
    return this.#transaction('readwrite', (store, done, fail) => {
      store.get(id).onsuccess = event => {
        const source = event.target.result;
        if (!source || source.mode !== 'ordinary' || !Number.isInteger(count) || count < 0 || count > source.turns.length ||
            typeof draft !== 'string' || draft.length > 100000 || source.turns.slice(0, count).some(turn => active(turn.status))) {
          fail(new Error('invalid_branch')); return;
        }
        const chat = { ...source, ...chatPreferences(source), id: crypto.randomUUID(), branchOf: id,
          title: `${source.title.slice(0, 190)} · 分支`, draft, attachments, turns: source.turns.slice(0, count), updatedAt: Date.now() };
        store.add(chat); done(chat);
      };
    });
  }
  async export() { return encodeBackup(await this.list()); }
  import(text) {
    // 整份文件校验通过后才开启唯一写事务；相同 ID 内容冲突时全部回滚。
    const chats = decodeBackup(text);
    return this.#transaction('readwrite', (store, done, fail) => {
      let imported = 0;
      let skipped = 0;
      for (const chat of chats) store.get(chat.id).onsuccess = event => {
        try {
          const existing = event.target.result;
          if (existing) {
            if (JSON.stringify(portableChat(existing)) !== JSON.stringify(chat)) throw new Error('backup_conflict');
            skipped++;
          } else { store.add(chat); imported++; }
          done({ imported, skipped });
        } catch (error) { fail(error); }
      };
      done({ imported, skipped });
    });
  }
  recover() {
    return this.#transaction('readwrite', (store, done) => {
      let count = 0;
      store.openCursor().onsuccess = event => {
        const cursor = event.target.result;
        if (!cursor) { done(count); return; }
        const chat = cursor.value;
        let changed = false;
        for (const turn of chat.turns) if (active(turn.status)) {
          turn.status = 'interrupted'; turn.error = 'app_restarted'; changed = true; count++;
        }
        if (changed) cursor.update(chat);
        cursor.continue();
      };
    });
  }
  close() { this.#db?.close(); }
}

/** 只把完整成功的历史轮次作为上下文；中断/失败的半条回复仍可读，但不默默重发。 */
export function completionMessages(chat, text, attachments = [], model = chatPreferences(chat).model) {
  if (chat.mode !== 'ordinary') throw new Error('wrong_chat_mode');
  const messages = chat.turns.filter(turn => turn.status === 'completed' && turn.content).flatMap(turn => [
    { role: 'user', content: userContent(turn.prompt, turn.attachments, model) }, { role: 'assistant', content: turn.content },
  ]);
  messages.push({ role: 'user', content: userContent(text, attachments, model) });
  const hasImages = messages.some(message => Array.isArray(message.content));
  if (messages.length > 200 || JSON.stringify(messages).length > (hasImages ? 12 * 1024 * 1024 : 240_000)) throw new Error('context_limit');
  return messages;
}
