import { attachmentFile, RemoteAttachmentFiles } from './remote-attachments.mjs';
import { IMAGE_PREVIEW_BYTES } from './remote-files.mjs';

const extensions = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/gif': 'gif', 'image/webp': 'webp', 'image/bmp': 'bmp', 'image/x-icon': 'ico', 'image/svg+xml': 'svg' };
const mediaTypes = Object.fromEntries(Object.entries(extensions).map(([mime, extension]) => [extension, mime]));
mediaTypes.jpeg = 'image/jpeg';

/** 文件附件仍用 file 身份读取；媒体类型只决定展示，不参与 Host 授权。 */
export function inlineImage(part) {
  const file = attachmentFile(part);
  if (!file) return null;
  const mediaType = part.type === 'image' ? file.mediaType : mediaTypes[file.path.split('.').pop().toLowerCase()];
  if (!extensions[mediaType]) return null;
  return { file, ref: part.attachment, mediaType, displayPath: `image.${extensions[mediaType]}` };
}

/** 会话内共享可见图片读取；离屏最后一个消费者释放后取消，绝不跨会话缓存字节。 */
export class RemoteImageReads {
  constructor(model, sessionId, { read, maxBytes = 64 * 1024 * 1024 } = {}) {
    this.read = read ?? ((image, signal) => new RemoteAttachmentFiles(model, image.file.attachment)
      .bytes(sessionId, image.file.path, signal, { maxBytes: Math.min(image.ref.bytes, IMAGE_PREVIEW_BYTES) }));
    this.entries = new Map(); this.queue = []; this.active = 0; this.reserved = 0;
    this.maxBytes = maxBytes; this.disposed = false;
    this.signal = model?.lifetime?.signal;
    this.abort = () => this.dispose();
    this.signal?.addEventListener('abort', this.abort, { once: true });
    if (this.signal?.aborted) this.dispose();
  }
  acquire(image) {
    if (this.disposed) throw new DOMException('Session closed', 'AbortError');
    const size = image.ref.bytes;
    if (!Number.isSafeInteger(size) || size <= 0 || size > IMAGE_PREVIEW_BYTES) throw new Error('remote_file_preview_too_large');
    const key = JSON.stringify([image.file.attachment, size, image.mediaType]);
    let entry = this.entries.get(key);
    if (!entry) {
      if (this.reserved + size > this.maxBytes) throw new Error('remote_image_memory_full');
      entry = { key, image, size, refs: 0, controller: new AbortController(), started: false, finished: false };
      entry.promise = new Promise((resolve, reject) => { entry.resolve = resolve; entry.reject = reject; });
      // 组件可能在同一帧卸载；取消仍应结算，但不产生未处理拒绝。
      void entry.promise.catch(() => {});
      this.entries.set(key, entry); this.reserved += size; this.queue.push(entry);
    }
    entry.refs++;
    this.pump();
    let released = false;
    return { promise: entry.promise, release: () => {
      if (released) return;
      released = true;
      if (--entry.refs === 0) this.drop(entry);
    } };
  }
  drop(entry) {
    if (this.entries.get(entry.key) === entry) this.entries.delete(entry.key);
    this.queue = this.queue.filter(item => item !== entry);
    entry.controller.abort(); entry.reject(entry.controller.signal.reason);
    if (!entry.started || entry.finished) this.unreserve(entry);
  }
  unreserve(entry) {
    if (entry.unreserved) return;
    entry.unreserved = true; this.reserved -= entry.size;
  }
  pump() {
    while (!this.disposed && this.active < 2 && this.queue.length) {
      const entry = this.queue.shift();
      entry.started = true; this.active++;
      void Promise.resolve().then(() => {
        entry.controller.signal.throwIfAborted();
        return this.read(entry.image, entry.controller.signal);
      }).then(bytes => {
        entry.controller.signal.throwIfAborted();
        if (!(bytes instanceof Uint8Array) || bytes.length !== entry.size) throw new Error('remote_attachment_invalid');
        entry.resolve(bytes);
      }).catch(error => { entry.reject(error); this.unreserve(entry); }).finally(() => {
        entry.finished = true; this.active--;
        if (entry.controller.signal.aborted) this.unreserve(entry);
        this.pump();
      });
    }
  }
  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.signal?.removeEventListener('abort', this.abort);
    for (const entry of this.entries.values()) this.drop(entry);
  }
}

/** 原插件需要 URL/peek 契约；字节仍走有界附件通道，URL 随会话作用域释放。 */
export class RemotePluginImageUrls {
  constructor(model, sessionId, options) {
    this.reads = new RemoteImageReads(model, sessionId, options);
    this.entries = new Map();
    this.abort = () => this.dispose();
    this.signal = model?.lifetime?.signal;
    this.signal?.addEventListener('abort', this.abort, { once: true });
    if (this.signal?.aborted) this.dispose();
    this.load = Object.assign(attachment => this.resolve(attachment), {
      peek: attachment => this.entries.get(JSON.stringify(attachment))?.url,
      forget: (attachment, expectedUrl) => this.forget(attachment, expectedUrl),
    });
  }
  async resolve(attachment) {
    if (this.disposed) throw new DOMException('Session closed', 'AbortError');
    const image = inlineImage({ type: 'image', attachment });
    if (!image) throw new Error('remote_attachment_invalid');
    const key = JSON.stringify(attachment);
    let entry = this.entries.get(key);
    if (!entry) {
      const lease = this.reads.acquire(image);
      entry = { lease };
      this.entries.set(key, entry);
      entry.promise = lease.promise.then(bytes => {
        if (this.disposed || this.entries.get(key) !== entry) throw new DOMException('Image released', 'AbortError');
        entry.url = URL.createObjectURL(new Blob([bytes], { type: image.mediaType }));
        return entry.url;
      }).catch(error => {
        if (this.entries.get(key) === entry) this.entries.delete(key);
        lease.release();
        throw error;
      });
    }
    return entry.promise;
  }
  forget(attachment, expectedUrl) {
    const key = JSON.stringify(attachment), entry = this.entries.get(key);
    // 同图多处同时失败时，后一个重试不能取消前一个刚开始的新读取。
    if (entry && (expectedUrl === undefined || entry.url === expectedUrl)) {
      this.entries.delete(key);
      if (entry.url) URL.revokeObjectURL(entry.url);
      entry.lease.release();
    }
  }
  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.signal?.removeEventListener('abort', this.abort);
    for (const entry of this.entries.values()) {
      if (entry.url) URL.revokeObjectURL(entry.url);
      entry.lease.release();
    }
    this.entries.clear(); this.reads.dispose();
  }
}
