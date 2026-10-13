import { openDraftDatabase } from './remote-draft-database.mjs';
import { attachmentDrafts, restoreAttachmentDrafts } from './remote-attachment-drafts.mjs';
import { pluginOperationSummaries } from './remote-plugin-journal.mjs';
import { endpointWriteMarker } from './remote-endpoint-journal.mjs';

/** 保存草稿及发送核对编号；不保存 token、附件回执或可自动重放的请求。 */
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
  endpointWriteKey(target) { return this.prefix + 'endpoint-write:' + JSON.stringify(target ?? null); }
  readEndpointWrites() {
    const storage = this.storage(), markers = [];
    for (let index = 0; index < storage.length; index++) {
      const key = storage.key(index);
      if (!key?.startsWith(this.prefix + 'endpoint-write:')) continue;
      const marker = endpointWriteMarker(storage.getItem(key));
      if (key !== this.endpointWriteKey(marker.target)) throw new Error('remote_endpoint_storage_failed');
      markers.push(marker);
    }
    return markers;
  }
  prepareEndpointWrite(value) {
    const marker = endpointWriteMarker(value);
    return this.storage().setItem(this.endpointWriteKey(marker.target), marker);
  }
  async forgetEndpointWrite(value) {
    const marker = endpointWriteMarker(value), key = this.endpointWriteKey(marker.target), storage = this.storage();
    if (storage.getItem(key)?.id !== marker.id) return;
    // 迟到的读取或回执不能清除这一目标后来的提交记录。
    if (typeof storage.batch !== 'function') throw new Error('remote_draft_atomic_storage_required');
    await storage.batch([[key, null]], () => storage.getItem(key)?.id === marker.id);
  }
  readPluginOperations() {
    const value = this.storage().getItem(this.prefix + 'plugin-operations');
    if (value === null) return [];
    if (value?.version !== 1 || !Array.isArray(value.items)) throw new Error('remote_plugin_journal_invalid');
    return pluginOperationSummaries(value.items);
  }
  writePluginOperations(items) {
    const key = this.prefix + 'plugin-operations', summaries = pluginOperationSummaries(items);
    return summaries.length ? this.storage().setItem(key, { version: 1, items: summaries }) : this.storage().removeItem(key);
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
  submissionKey(sessionId) { return `${this.key(sessionId)}:submission`; }
  readSubmission(sessionId) {
    const value = this.storage().getItem(this.submissionKey(sessionId));
    if (value === null) return null;
    if (value?.version !== 1 || typeof value.requestId !== 'string' || !value.requestId
      || typeof value.draft?.text !== 'string' || !Array.isArray(value.attachmentIds)
      || value.attachmentIds.some(id => typeof id !== 'string')) throw new Error('remote_draft_submission_invalid');
    return value;
  }
  async prepareSubmission(sessionId, requestId, draft, attachmentIds) {
    if (typeof requestId !== 'string' || !requestId || typeof draft?.text !== 'string') throw new Error('remote_draft_submission_invalid');
    // 必须先严格落盘再发消息；仅存原请求编号和展示草稿，不保存模型请求或凭据。
    await this.storage().setItem(this.submissionKey(sessionId), { version: 1, requestId, draft, attachmentIds });
  }
  forgetSubmission(sessionId, requestId) {
    if (this.readSubmission(sessionId)?.requestId === requestId) return this.storage().removeItem(this.submissionKey(sessionId));
  }
  async settleSubmission(sessionId, requestId, current = () => true) {
    const pending = this.readSubmission(sessionId);
    if (!pending || pending.requestId !== requestId || !current()) return null;
    const storage = this.storage();
    if (typeof storage.batch !== 'function') throw new Error('remote_draft_atomic_storage_required');
    const clearedDraft = sameRemoteDraft(this.readEntry(sessionId), pending.draft);
    const files = storage.getItem(this.attachmentKey(sessionId)) ?? [];
    restoreAttachmentDrafts(files);
    const kept = files.filter(item => !pending.attachmentIds.includes(item.id));
    const changes = [[this.submissionKey(sessionId), null], [this.attachmentKey(sessionId), kept.length ? kept : null]];
    if (clearedDraft) changes.push([this.key(sessionId), null]);
    await storage.batch(changes, () => current() && this.readSubmission(sessionId) === pending);
    return { clearedDraft, attachmentIds: pending.attachmentIds };
  }
  readAttachments(sessionId) { return restoreAttachmentDrafts(this.storage().getItem(this.attachmentKey(sessionId)) ?? []); }
  writeAttachments(sessionId, items, sendingIds = []) {
    const value = attachmentDrafts(items, sendingIds), key = this.attachmentKey(sessionId);
    return value.length ? this.storage().setItem(key, value) : this.storage().removeItem(key);
  }
  write(sessionId, text, editor) {
    if (typeof text !== 'string') throw new Error('remote_draft_text_required');
    const storage = this.storage(), key = this.key(sessionId);
    const value = text === '' ? null : editor ? { version: 1, text, editor } : text;
    // 用户重新编辑后，旧发送回执不能清除这份新草稿；失败恢复原草稿则保留核对编号。
    if (this.readSubmission(sessionId) && !sameRemoteDraft(this.readEntry(sessionId), { text, editor })) {
      if (typeof storage.batch !== 'function') throw new Error('remote_draft_atomic_storage_required');
      return storage.batch([[key, value], [this.submissionKey(sessionId), null]]);
    }
    return value === null ? storage.removeItem(key) : storage.setItem(key, value);
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

export const sameRemoteDraft = (one, other) => one.text === other.text && JSON.stringify(one.editor) === JSON.stringify(other.editor);
