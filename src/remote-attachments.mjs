import { attachmentRefSchema, RESOURCE_CHUNK_BYTES } from '../../backend/packages/protocol/dist/index.js';
import { RemoteFiles } from './remote-files.mjs';

/** 显示名不充当路径；真实读取始终使用会话、类型和不可透明解释的附件 ID。 */
export function attachmentFile(part) {
  const ref = attachmentRefSchema.safeParse(part?.attachment);
  if (!ref.success || !['file', 'image'].includes(part.type)) return null;
  const value = ref.data;
  if (part.type === 'file' && !value.name) return null;
  if (part.type === 'image' && !value.mediaType) return null;
  return { path: value.name ?? `图片.${value.mediaType.split('/')[1]}`, attachment: {
    kind: part.type, attachmentId: value.attachmentId, ...(part.type === 'file' ? { name: value.name } : {}),
  }, mediaType: value.mediaType };
}

/** 与普通文件共用文本/字节收集和下载器；底层读取由原附件 provider 校验，而非 workspace 路径。 */
export class RemoteAttachmentFiles extends RemoteFiles {
  constructor(model, attachment) {
    super(null, signal => AbortSignal.any([signal, ...[model.lifetime?.signal, model.transport.lifetime?.signal].filter(Boolean)]));
    this.model = model; this.attachment = attachment;
  }
  async document(sessionId, displayName, signal, options) {
    // 附件不可变且 read 完成后已通过 provider 完整性验证；没有可借用的工作区目录。
    return { data: await this.bytes(sessionId, displayName, signal, options) };
  }
  async *read(sessionId, _displayName, signal, { maxBytes = Infinity } = {}) {
    signal = this.scopedSignal(signal);
    signal.throwIfAborted();
    if (!this.model.transport.capabilities?.channels?.includes('attachment')) throw new Error('remote_attachment_unavailable');
    const pending = []; let wake, failure, ended = false, metadata, offset = 0;
    const notify = () => { wake?.(); wake = undefined; };
    const fail = error => { failure ??= error; notify(); };
    const request = this.model.client.request({ method: 'remote.attachment', sessionId, ...this.attachment }, value => {
      if (pending.length >= 5) { fail(new Error('remote_attachment_invalid')); return; }
      pending.push(value); notify();
    });
    void request.promise.then(result => {
      if (result !== undefined) fail(new Error('remote_attachment_invalid'));
      ended = true; notify();
    }, fail);
    const abort = () => fail(signal.reason);
    signal.addEventListener('abort', abort, { once: true });
    const timer = setTimeout(() => fail(new Error('remote_attachment_timeout')), 180000);
    try {
      for (;;) {
        signal.throwIfAborted();
        if (failure) throw failure;
        if (!pending.length) {
          if (ended) break;
          await new Promise(resolve => { wake = resolve; }); continue;
        }
        const value = pending.shift();
        if (value?.type === 'metadata' && !metadata) {
          metadata = attachmentRefSchema.parse(value.attachment);
          if (metadata.attachmentId !== this.attachment.attachmentId
            || (this.attachment.kind === 'file' && metadata.name !== this.attachment.name)
            || (this.attachment.kind === 'image' && !metadata.mediaType)) throw new Error('remote_attachment_invalid');
          if (metadata.bytes > maxBytes) throw new Error('remote_file_preview_too_large');
          continue;
        }
        if (value?.type !== 'chunk' || !metadata || value.offset !== offset || typeof value.data !== 'string'
          || value.data.length > 87384 || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(value.data)) throw new Error('remote_attachment_invalid');
        const raw = atob(value.data), bytes = Uint8Array.from(raw, character => character.charCodeAt(0));
        if (!bytes.length || bytes.length > RESOURCE_CHUNK_BYTES || offset + bytes.length > metadata.bytes) throw new Error('remote_attachment_invalid');
        offset += bytes.length;
        yield bytes;
        signal.throwIfAborted();
        await this.model.client.call('socket.send', { frame: { type: 'ack', id: request.id, count: 1 } });
      }
      if (!metadata || offset !== metadata.bytes) throw new Error('remote_attachment_invalid');
    } finally {
      clearTimeout(timer); signal.removeEventListener('abort', abort); request.cancel(); pending.length = 0;
    }
  }
}
