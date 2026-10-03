import { MAX_SESSION_EXPORT_BYTES, RESOURCE_CHUNK_BYTES, RESOURCE_WINDOW } from '../../backend/packages/protocol/dist/index.js';
import { downloadRemoteFile, downloadError } from './remote-download.mjs';

/** 只接收电脑原导出的字节；消费一块后才确认，手机不在内存拼装整份 ZIP。 */
export async function* readSessionExport(model, sessionId, includeDescendants, signal) {
  signal.throwIfAborted();
  if (model.transport.capabilities?.sessionExport !== true) throw new Error('remote_export_unavailable');
  const pending = [];
  let wake, failure, ended = false, metadata = false, offset = 0, timer;
  const notify = () => { wake?.(); wake = undefined; };
  const fail = error => { failure ??= error; notify(); };
  const touch = () => { clearTimeout(timer); timer = setTimeout(() => fail(new Error('remote_export_timeout')), 60000); };
  const request = model.client.request({ method: 'remote.sessionExport', sessionId, includeDescendants }, value => {
    if (failure || ended) return;
    if (pending.length >= RESOURCE_WINDOW + 1) { fail(new Error('remote_export_invalid')); return; }
    pending.push(value); touch(); notify();
  });
  void request.promise.then(result => {
    if (result !== undefined) fail(new Error('remote_export_invalid'));
    ended = true; notify();
  }, fail);
  const abort = () => fail(signal.reason);
  signal.addEventListener('abort', abort, { once: true });
  touch();
  try {
    for (;;) {
      signal.throwIfAborted();
      if (failure) throw failure;
      if (!pending.length) {
        if (ended) break;
        await new Promise(resolve => { wake = resolve; }); continue;
      }
      const value = pending.shift();
      if (value?.type === 'metadata' && !metadata && value.sessionId === sessionId && value.includeDescendants === includeDescendants) {
        metadata = true; continue;
      }
      if (!metadata || value?.type !== 'chunk' || value.offset !== offset || typeof value.data !== 'string'
        || value.data.length > 87384 || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(value.data)) throw new Error('remote_export_invalid');
      const raw = atob(value.data), bytes = Uint8Array.from(raw, character => character.charCodeAt(0));
      if (!bytes.length || bytes.length > RESOURCE_CHUNK_BYTES) throw new Error('remote_export_invalid');
      offset += bytes.length;
      if (offset > MAX_SESSION_EXPORT_BYTES) throw new Error('remote_export_too_large');
      yield bytes;
      signal.throwIfAborted();
      if (failure) throw failure;
      await model.client.call('socket.send', { frame: { type: 'ack', id: request.id, count: 1 } });
      touch();
    }
    if (!metadata || !offset) throw new Error('remote_export_invalid');
  } finally {
    clearTimeout(timer); signal.removeEventListener('abort', abort); request.cancel(); pending.length = 0;
  }
}

export function downloadSessionExport({ model, sessionId, includeDescendants, signal, onProgress }) {
  return downloadRemoteFile({ client: model.client, sessionId, path: 'session-log.zip', signal, onProgress,
    files: { read: () => readSessionExport(model, sessionId, includeDescendants, signal) } });
}

export function sessionExportError(error) {
  if (error.message === 'remote_export_unavailable') return '请更新电脑远程插件和网关后导出日志。';
  if (error.message === 'remote_export_missing') return '电脑上已找不到这份会话日志。';
  if (error.message === 'remote_export_busy') return '电脑正在导出其他日志，请稍后重试。';
  if (error.message === 'remote_export_too_large') return '日志超过当前 256 MiB 导出上限。';
  return downloadError(error, '导出');
}
