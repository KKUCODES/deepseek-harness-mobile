import { isPresentedHost } from '../../deepseek-harness/packages/client/ui-deliverables/src/presented.ts';

/** 手机只传原记录坐标，Host 再检查归属和文件；不把显示路径作为打开授权。 */
export async function desktopRequest(model, coordinates, signal) {
  signal.throwIfAborted();
  if (!model.transport.capabilities?.desktopOpen) throw new Error('remote_desktop_unavailable');
  if (coordinates?.action !== undefined && !['open', 'reveal'].includes(coordinates.action)) throw new Error('remote_desktop_stale');
  if (coordinates?.action === 'reveal' && (coordinates.source !== 'presented' || !model.transport.capabilities.desktopReveal)) throw new Error('remote_desktop_unavailable');
  if (coordinates && (coordinates.sessionId !== model.getSnapshot().selected || !['presented', 'changes'].includes(coordinates.source)
    || ![coordinates.seq, coordinates.index].every(value => Number.isSafeInteger(value) && value >= 0))) throw new Error('remote_desktop_stale');
  const operation = coordinates ? { method: 'remote.openFile', source: coordinates.source, sessionId: coordinates.sessionId,
    seq: coordinates.seq, index: coordinates.index, confirmed: true,
    ...(coordinates.action === 'reveal' ? { action: 'reveal' } : {}) } : { method: 'remote.desktop' };
  const request = model.client.request(operation), abort = () => request.cancel();
  signal.addEventListener('abort', abort, { once: true });
  try {
    const result = await request.promise; signal.throwIfAborted();
    if (coordinates ? result?.opened !== true : !isPresentedHost(result)) throw new Error('remote_desktop_invalid');
    return result;
  } finally { signal.removeEventListener('abort', abort); }
}

export function desktopError(error, opening) {
  if (error.message === 'remote_desktop_copy_capacity') return '电脑的附件临时空间已满，请稍后重试。';
  if (['remote_attachment_invalid', 'remote_attachment_not_referenced'].includes(error.message)) return '无法核对聊天中的原始附件，请重新打开附件后重试。';
  if (error.message === 'remote_desktop_file_changed') return '文件已变化，请重新核对后再打开。';
  if (error.message === 'remote_desktop_busy') return '电脑正忙，请稍后重试。';
  if (error.message === 'remote_desktop_unavailable') return '这台电脑暂不支持打开文件，请检查电脑远程插件和桌面环境。';
  if (error.message === 'remote_desktop_file_missing') return '电脑已不再保留这条文件记录，或文件已被移动、删除。';
  if (error.message === 'remote_desktop_stale') return '当前聊天或确认信息已失效，请重新打开文件预览。';
  return opening ? '打开结果尚未确认，请先在电脑上核对。' : '无法读取电脑状态，请检查连接后重试。';
}

export function canOpenDesktopFile(model, file) {
  return !!(file.attachment ? model.transport.capabilities?.desktopOpenAttachment
    : file.desktopSource ? model.transport.capabilities?.desktopOpen : model.transport.capabilities?.desktopOpenWorkspace);
}

/** 附件只传原引用；确认快照绑定同一会话/ID/类型/名称，不读取电脑同名文件。 */
export async function attachmentDesktopRequest(model, file, prepared, signal) {
  signal.throwIfAborted();
  if (!model.transport.capabilities?.desktopOpenAttachment) throw new Error('remote_desktop_unavailable');
  const attachment = file.attachment;
  if (!attachment || !['file', 'image'].includes(attachment.kind) || typeof attachment.attachmentId !== 'string'
    || !attachment.attachmentId || attachment.kind === 'file' && typeof attachment.name !== 'string'
    || file.sessionId !== model.getSnapshot().selected) throw new Error('remote_desktop_stale');
  const identity = JSON.stringify([file.sessionId, attachment.kind, attachment.attachmentId, attachment.name]);
  if (prepared && (prepared.identity !== identity || !prepared.snapshot)) throw new Error('remote_desktop_stale');
  const operation = prepared ? { method: 'remote.openDesktopAttachment', sessionId: file.sessionId, snapshot: prepared.snapshot, confirmed: true }
    : { method: 'remote.prepareDesktopAttachment', sessionId: file.sessionId, kind: attachment.kind, attachmentId: attachment.attachmentId,
      ...(attachment.kind === 'file' ? { name: attachment.name } : {}) };
  const request = model.client.request(operation), abort = () => request.cancel();
  signal.addEventListener('abort', abort, { once: true });
  try {
    const result = await request.promise; signal.throwIfAborted();
    if (file.sessionId !== model.getSnapshot().selected) throw new Error('remote_desktop_stale');
    if (prepared) {
      if (result?.opened !== true) throw new Error('remote_desktop_invalid');
      return result;
    }
    if (!isPresentedHost(result) || result.attachmentCopy !== true || typeof result.snapshot !== 'string'
      || !/^[0-9a-f-]{36}$/i.test(result.snapshot) || typeof result.fileName !== 'string' || !result.fileName) throw new Error('remote_desktop_invalid');
    return { ...result, identity };
  } finally { signal.removeEventListener('abort', abort); }
}

/** 确认页持有 Host 核验的一次性快照；附件显示名不能降级为电脑文件路径。 */
export async function workspaceDesktopRequest(model, file, prepared, signal) {
  signal.throwIfAborted();
  if (!model.transport.capabilities?.desktopOpenWorkspace) throw new Error('remote_desktop_unavailable');
  if (file.attachment || file.sessionId !== model.getSnapshot().selected || typeof file.path !== 'string' || !file.path
    || prepared && (prepared.sessionId !== file.sessionId || prepared.path !== file.path || !prepared.snapshot)) throw new Error('remote_desktop_stale');
  const operation = prepared ? { method: 'remote.openDesktopFile', sessionId: file.sessionId, snapshot: prepared.snapshot, confirmed: true }
    : { method: 'remote.prepareDesktopFile', sessionId: file.sessionId, path: file.path };
  const request = model.client.request(operation), abort = () => request.cancel();
  signal.addEventListener('abort', abort, { once: true });
  try {
    const result = await request.promise; signal.throwIfAborted();
    if (file.sessionId !== model.getSnapshot().selected) throw new Error('remote_desktop_stale');
    if (prepared) {
      if (result?.opened !== true) throw new Error('remote_desktop_invalid');
      return result;
    }
    if (!isPresentedHost(result) || typeof result.snapshot !== 'string' || !/^[0-9a-f-]{36}$/i.test(result.snapshot)
      || typeof result.fileName !== 'string' || !result.fileName) throw new Error('remote_desktop_invalid');
    return { ...result, sessionId: file.sessionId, path: file.path };
  } finally { signal.removeEventListener('abort', abort); }
}
