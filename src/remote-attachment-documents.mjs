import { RemoteAttachmentFiles } from './remote-attachments.mjs';
import { fileError } from './remote-files.mjs';
import { attachmentDocumentAddress, parseAttachmentDocumentAddress, ATTACHMENT_DOCUMENT_PROTOCOL } from './remote-document-address.mjs';

export const ATTACHMENT_DOCUMENT_BYTES = 32 * 1024 * 1024;
export const ATTACHMENT_DOCUMENT_LINES = 5000;

/** 标准资源描述是引用信息，非Host文件stat；内容始终经原附件通道重新授权。 */
export function attachmentDocumentProvider() {
  return { protocol: ATTACHMENT_DOCUMENT_PROTOCOL, async *open(address, { signal }) {
    if (signal.aborted) return;
    const file = parseAttachmentDocumentAddress(address);
    yield file ? { ok: true, value: { source: 'attachment', sessionId: file.sessionId,
      name: file.path, attachment: file.attachment } }
      : { ok: false, error: { code: 'gateway/internal', message: 'remote_document_address_invalid', details: {} } };
  } };
}

/** 不缓存附件内容或授权结果；有界读取并等待完整性结束，再交给原文档插件。 */
export class RemoteAttachmentDocuments {
  constructor(model) { this.model = model; this.readers = 0; }

  async bytes(file, signal) {
    const address = attachmentDocumentAddress(file);
    signal = AbortSignal.any([signal, this.model.lifetime.signal]);
    signal.throwIfAborted();
    if (this.readers >= 2) return this.failure(new Error('remote_attachment_busy'));
    this.readers++;
    try {
      const data = await new RemoteAttachmentFiles(this.model, file.attachment)
        .bytes(file.sessionId, file.path, signal, { maxBytes: ATTACHMENT_DOCUMENT_BYTES });
      signal.throwIfAborted();
      // 附件原件不可变，版本是完整引用身份；不伪造absolutePath或磁盘stat。
      return { ok: true, value: { name: file.path, version: address, bytes: data.byteLength, data, offset: 0, eof: true } };
    } catch (error) {
      if (signal.aborted) throw error;
      return this.failure(error);
    } finally { this.readers--; }
  }

  async page(file, offset, signal) {
    if (!Number.isSafeInteger(offset) || offset < 1) return this.failure(new Error('remote_attachment_invalid'));
    try {
      const result = await this.bytes(file, signal);
      if (!result.ok) return result;
      let text;
      try { text = new TextDecoder('utf-8', { fatal: true }).decode(result.value.data); }
      catch { throw new Error('remote_file_not_text'); }
      if (text.includes('\0')) throw new Error('remote_file_not_text');
      const lines = text === '' ? [] : text.split('\n');
      if (text.endsWith('\n')) lines.pop();
      const selected = lines.slice(offset - 1, offset - 1 + ATTACHMENT_DOCUMENT_LINES);
      const { data, ...metadata } = result.value;
      return { ok: true, value: { ...metadata, offset, text: selected.join('\n'), lines: selected.length,
        eof: offset - 1 + selected.length >= lines.length } };
    } catch (error) {
      // 原textFace的分页回调返回RemoteResult；中止后store根据signal淘汰此结果。
      return this.failure(error);
    }
  }

  failure(error) {
    return { ok: false, error: { code: 'gateway/internal', message: error.message === 'remote_attachment_busy'
      ? '正在读取其他附件，请稍后重试。' : fileError(error), details: {} } };
  }
}
