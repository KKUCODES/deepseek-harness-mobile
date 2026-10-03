export const FILE_CHUNK_BYTES = 64 * 1024;
export const PREVIEW_BYTES = 2 * 1024 * 1024;
export const IMAGE_PREVIEW_BYTES = 16 * 1024 * 1024;

function metadata(value) {
  if (!value || typeof value.absolutePath !== 'string' || typeof value.version !== 'string'
    || (value.bytes !== undefined && (!Number.isSafeInteger(value.bytes) || value.bytes < 0))) throw new Error('remote_file_invalid');
  return value;
}

function sameFile(expected, actual) {
  metadata(actual);
  if (actual.absolutePath !== expected.absolutePath || actual.version !== expected.version || actual.bytes !== expected.bytes) throw new Error('remote_file_changed');
}

/** 每次打开重新 stat；按 Host 原字节窗拉取，不能将多个版本拼成一个文件。 */
export class RemoteFiles {
  constructor(call, scopedSignal = signal => signal) { this.call = call; this.scopedSignal = scopedSignal; }
  async request(method, sessionId, path, range, signal) {
    signal.throwIfAborted();
    const result = await this.call(`workspaceFiles/${method}`, { workspaceFileScopeId: sessionId, path, ...(range ? { range } : {}) }, signal);
    signal.throwIfAborted();
    if (!result.ok) throw result.error;
    return result.value;
  }
  async *read(sessionId, path, signal, { maxBytes = Infinity } = {}) {
    // 捕获整次读取的连接，不能在消费者等待磁盘写入时跨重连继续拼接。
    signal = this.scopedSignal(signal);
    const initial = metadata(await this.request('stat', sessionId, path, null, signal));
    if (initial.bytes > maxBytes) throw new Error('remote_file_preview_too_large');
    let offset = 0;
    for (;;) {
      const page = await this.request('readBytes', sessionId, path, { offset, length: FILE_CHUNK_BYTES }, signal);
      sameFile(initial, page);
      if (page.offset !== offset || typeof page.data !== 'string' || typeof page.eof !== 'boolean'
        || page.data.length > Math.ceil(FILE_CHUNK_BYTES / 3) * 4
        || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(page.data)) throw new Error('remote_file_invalid');
      const raw = atob(page.data), bytes = Uint8Array.from(raw, char => char.charCodeAt(0));
      if (bytes.length > FILE_CHUNK_BYTES || (!page.eof && bytes.length === 0)) throw new Error('remote_file_invalid');
      offset += bytes.length;
      if (offset > maxBytes) throw new Error('remote_file_preview_too_large');
      if (initial.bytes !== undefined && (offset > initial.bytes || page.eof !== (offset === initial.bytes))) throw new Error('remote_file_changed');
      yield bytes;
      if (page.eof) break;
    }
    // 最后一块读完后仍核对版本；消费者在迭代完成前不能宣布下载成功。
    sameFile(initial, await this.request('stat', sessionId, path, null, signal));
  }
  async bytes(sessionId, path, signal, { maxBytes = IMAGE_PREVIEW_BYTES } = {}) {
    const parts = []; let length = 0;
    for await (const part of this.read(sessionId, path, signal, { maxBytes })) { parts.push(part); length += part.length; }
    const result = new Uint8Array(length); let offset = 0;
    for (const part of parts) { result.set(part, offset); offset += part.length; }
    return result;
  }
  async document(sessionId, path, signal, options) {
    signal = this.scopedSignal(signal);
    const initial = metadata(await this.request('stat', sessionId, path, null, signal));
    const data = await this.bytes(sessionId, path, signal, options);
    await this.assertVersion(sessionId, path, initial, signal);
    return { ...initial, data };
  }
  async assertVersion(sessionId, path, expected, signal) {
    sameFile(expected, await this.request('stat', sessionId, path, null, signal));
  }
  async text(sessionId, path, signal) {
    const decoder = new TextDecoder('utf-8', { fatal: true });
    const parts = [];
    const decode = (bytes, stream = false) => {
      try { return decoder.decode(bytes, { stream }); }
      catch { throw new Error('remote_file_not_text'); }
    };
    for await (const bytes of this.read(sessionId, path, signal, { maxBytes: PREVIEW_BYTES })) parts.push(decode(bytes, true));
    parts.push(decode());
    const text = parts.join('');
    if (text.includes('\0')) throw new Error('remote_file_not_text');
    return text;
  }
}

export function fileError(error) {
  const code = error.code ?? error.message;
  if (code === 'remote_file_changed') return '文件已在电脑上发生变化，请重新读取。';
  if (code === 'remote_file_preview_too_large') return '文件较大，无法在此显示全文。';
  if (code === 'workspace-file/not-found') return '文件已被删除或移动。';
  if (code === 'remote_file_not_text') return '此文件无法作为文本预览。';
  if (code === 'remote_operation_denied') return '请更新电脑插件和网关后重新打开文件。';
  if (code === 'remote_attachment_unavailable') return '请更新电脑插件和网关后重新打开附件。';
  if (code === 'remote_attachment_not_referenced') return '该附件已不在此聊天中，无法读取。';
  if (code === 'remote_attachment_timeout') return '附件读取超时，请重试。';
  return '无法读取文件，请检查电脑连接及文件访问权限后重试。';
}
