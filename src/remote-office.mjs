import { officeMetadataSchema, attachmentOfficeMetadataSchema, RESOURCE_CHUNK_BYTES } from '../../backend/packages/protocol/dist/index.js';

/** 转换留在 Host；直到结束帧确认版本和权限，手机才把完整 PDF 交给渲染器。 */
export async function readOffice(model, sessionId, path, signal, attachment, priority = 'foreground') {
  if (!['foreground', 'background'].includes(priority)) throw new Error('remote_office_invalid');
  if (!model.transport.capabilities?.channels?.includes(attachment ? 'attachmentOffice' : 'office')) throw new Error('remote_office_unavailable');
  signal = AbortSignal.any([signal, ...[model.lifetime?.signal, model.transport.lifetime?.signal].filter(Boolean)]);
  signal.throwIfAborted();
  let metadata, bytes, offset = 0, failure, rejectFailure;
  const failed = new Promise((_, reject) => { rejectFailure = reject; });
  const fail = error => { if (!failure) { failure = error; rejectFailure(error); request?.cancel(); } };
  let request;
  const operation = attachment ? { method: 'remote.attachmentOffice', sessionId, attachmentId: attachment.attachmentId, name: attachment.name }
    : { method: 'remote.office', sessionId, path };
  // 旧 Host 不识别额外字段；后台请求不能静默提升为前台占用保留容量。
  if (model.transport.capabilities.officePriority) operation.priority = priority;
  else if (priority === 'background') throw new Error('remote_office_unavailable');
  request = model.client.request(operation, value => {
    try {
      signal.throwIfAborted();
      if (value?.type === 'converting' && !metadata) return;
      if (value?.type === 'metadata' && !metadata) {
        const { type, ...raw } = value;
        metadata = (attachment ? attachmentOfficeMetadataSchema : officeMetadataSchema).parse(raw);
        if (attachment && (metadata.attachmentId !== attachment.attachmentId || metadata.name !== attachment.name)) throw new Error('remote_office_invalid');
        bytes = new Uint8Array(metadata.bytes); return;
      }
      if (value?.type !== 'chunk' || !metadata || value.offset !== offset || typeof value.data !== 'string'
        || value.data.length > 87384 || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(value.data)) throw new Error('remote_office_invalid');
      const raw = atob(value.data);
      if (!raw.length || raw.length > RESOURCE_CHUNK_BYTES || offset + raw.length > bytes.length) throw new Error('remote_office_invalid');
      for (let i = 0; i < raw.length; i++) bytes[offset + i] = raw.charCodeAt(i);
      offset += raw.length;
      void model.client.call('socket.send', { frame: { type: 'ack', id: request.id, count: 1 } }).catch(fail);
    } catch (error) { fail(error); }
  });
  const abort = () => fail(signal.reason);
  signal.addEventListener('abort', abort, { once: true });
  const timer = setTimeout(() => fail(new Error('remote_office_timeout')), 180000);
  try {
    const result = await Promise.race([request.promise, failed]);
    signal.throwIfAborted();
    if (failure) throw failure;
    if (result?.ok === false) throw Object.assign(new Error(result.error?.code ?? 'remote_office_failed'), { code: result.error?.code, details: result.error?.details });
    if (result !== undefined || !metadata || offset !== bytes.length) throw new Error('remote_office_invalid');
    return { ...metadata, data: bytes };
  } finally { clearTimeout(timer); signal.removeEventListener('abort', abort); request.cancel(); }
}

export function officeError(error) {
  const code = error.details?.reason ?? error.code ?? error.message;
  if (['remote_office_unavailable', 'gateway/invocation-unavailable', 'gateway/service-unavailable', 'unavailable'].includes(code)) return '电脑暂不支持 Office 预览，请检查 DSH 和远程插件版本。';
  if (['remote_office_timeout', 'timeout'].includes(code)) return '文档转换超时，请稍后重试。';
  if (['remote_office_busy', 'busy'].includes(code)) return '电脑正在处理其他文档，请稍后重试。';
  if (['input-too-large', 'output-too-large', 'remote_office_too_large'].includes(code)) return '文档较大，无法预览，仍可下载完整文件。';
  if (['remote_file_changed', 'source-changed'].includes(code)) return '文档已在电脑上发生变化，请重新读取。';
  if (code === 'workspace-file/not-found') return '文件已被删除或移动。';
  return '无法预览此文档，请检查电脑连接、文件内容和访问权限后重试。';
}
