import { openDraftDatabase } from './remote-draft-database.mjs';
import { attachmentDrafts, restoreAttachmentDrafts } from './remote-attachment-drafts.mjs';

/** 保存文字与附件原件；绑定身份来自原生 binding.info，不保存 token、附件回执或待重放请求。 */
export class RemoteDraftStore {
  static async open(binding, factory, legacy = globalThis.localStorage) {
    const store = new RemoteDraftStore(binding);
    const storage = await openDraftDatabase(store.prefix, factory);
    store.storage = () => storage;
    try {
      // 迁移前一验证包的同绑定草稿，严格提交成功后才移除旧值。
      for (let index = (legacy?.length ?? 0) - 1; index >= 0; index--) {
        const key = legacy.key(index);
        if (!key?.startsWith(store.prefix)) continue;
        if (storage.getItem(key) === null) await storage.setItem(key, legacy.getItem(key));
        legacy.removeItem(key);
      }
      return store;
    } catch (error) { storage.close(); throw error; }
  }
  constructor(binding, storage) {
    if (!binding?.paired || !['origin', 'deviceId', 'fingerprint'].every(key => typeof binding[key] === 'string' && binding[key])) {
      throw new Error('remote_draft_binding_required');
    }
    this.prefix = `dshm.remote.drafts.v1:${JSON.stringify([binding.origin, binding.deviceId, binding.fingerprint])}:`;
    this.storage = storage;
  }
  key(sessionId) {
    if (typeof sessionId !== 'string' || !sessionId) throw new Error('remote_draft_session_required');
    return this.prefix + JSON.stringify(sessionId);
  }
  read(sessionId) {
    return this.readEntry(sessionId).text;
  }
  readEntry(sessionId) {
    const value = this.storage().getItem(this.key(sessionId)) ?? '';
    // 旧版纯文字仍可读取；新记录把文字与原编辑器 JSON 一次提交，避免引用错配。
    if (typeof value === 'string') return { text: value };
    if (value?.version !== 1 || typeof value.text !== 'string' || value.editor?.root?.type !== 'root') {
      throw new Error('remote_draft_structure_invalid');
    }
    return { text: value.text, editor: value.editor };
  }
  attachmentKey(sessionId) { return `${this.key(sessionId)}:attachments`; }
  readAttachments(sessionId) { return restoreAttachmentDrafts(this.storage().getItem(this.attachmentKey(sessionId)) ?? []); }
  writeAttachments(sessionId, items, sendingIds = []) {
    const value = attachmentDrafts(items, sendingIds), key = this.attachmentKey(sessionId);
    return value.length ? this.storage().setItem(key, value) : this.storage().removeItem(key);
  }
  write(sessionId, text, editor) {
    if (typeof text !== 'string') throw new Error('remote_draft_text_required');
    const storage = this.storage(), key = this.key(sessionId);
    return text === '' ? storage.removeItem(key) : storage.setItem(key, editor ? { version: 1, text, editor } : text);
  }
  move(from, to, draft, attachments, current) {
    if (from === to) return Promise.resolve();
    if (typeof draft.text !== 'string') throw new Error('remote_draft_text_required');
    const storage = this.storage();
    if (typeof storage.batch !== 'function') throw new Error('当前存储不支持转移草稿，请更新 App 后重试。');
    const value = draft.text === '' ? null : draft.editor ? { version: 1, text: draft.text, editor: draft.editor } : draft.text;
    const files = attachmentDrafts(attachments);
    return storage.batch([[this.key(to), value], [this.attachmentKey(to), files.length ? files : null],
      [this.key(from), null], [this.attachmentKey(from), null]], current);
  }
  clear() {
    const storage = this.storage(), writes = [];
    // 仅移除这一绑定的草稿，不清空 WebView 存储或影响普通聊天。
    for (let index = storage.length - 1; index >= 0; index--) {
      const key = storage.key(index);
      if (key?.startsWith(this.prefix)) writes.push(storage.removeItem(key));
    }
    return Promise.all(writes);
  }
  close() { try { this.storage()?.close?.(); } catch {} }
}
