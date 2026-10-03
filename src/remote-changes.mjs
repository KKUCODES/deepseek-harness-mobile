import { MAX_CHANGES_BYTES, RESOURCE_CHUNK_BYTES } from '../../backend/packages/protocol/dist/index.js';
import { isChangesSummary, isChangesDiff } from '../../deepseek-harness/packages/client/ui-deliverables/src/changes.ts';
import { deliverablesDefinition, selectProducedFiles, presentedForClosing, producedFileMentions } from '../../deepseek-harness/packages/client/ui-deliverables/src/client/turn-deliverables.ts';
import { chatNode } from '../../deepseek-harness/packages/client/ui-chat/src/client/conversation-nodes/common.ts';

/** 沿用原逐轮归属和最新公告归并，只为手机增加自己的查看入口。 */
export const remoteChangesDefinition = {
  ...deliverablesDefinition, target: 'chat',
  buildViewNode: context => context.state?.changes || context.state?.presented?.length
    ? chatNode(context, 'remote-changes', context.state.changes?.seq ?? context.state.presented.at(-1).seq,
      { turn: context.state.turn, ...(context.state.changes ? { seq: context.state.changes.seq } : {}),
        ...(context.state.presented?.length ? { presented: context.state.presented } : {}) }) : null,
};

/** 文件名引用只来自原投影确认的本轮成功写入/交付，不从回复文字猜测路径。 */
export function closingFileMentions(owner, label) {
  const produced = selectProducedFiles(owner), presented = presentedForClosing(owner);
  if (produced === null && presented.length === 0) return undefined;
  return producedFileMentions([...new Set([...(produced ?? []), ...presented.map(file => file.path)])], owner.openFile, label);
}

/** 固定记录坐标；只在完整流成功、JSON 和原字段验证通过后发布。 */
export async function readChanges(model, coordinates, signal) {
  signal.throwIfAborted();
  if (!model.transport.capabilities?.channels?.includes('changes')) throw new Error('remote_changes_unavailable');
  const { sessionId, seq, index } = coordinates;
  let metadata = false, length = 0, failure, rejectFailure, request;
  const chunks = [], decoder = new TextDecoder('utf-8', { fatal: true });
  const failed = new Promise((_, reject) => { rejectFailure = reject; });
  const fail = error => { if (!failure) { failure = error; rejectFailure(error); request?.cancel(); } };
  request = model.client.request({ method: 'remote.changes', sessionId, seq, ...(index === undefined ? {} : { index }) }, value => {
    try {
      signal.throwIfAborted();
      if (value?.type === 'metadata' && !metadata && value.sessionId === sessionId && value.seq === seq && value.index === index) { metadata = true; return; }
      if (!metadata || value?.type !== 'chunk' || value.offset !== length || typeof value.data !== 'string'
        || value.data.length > 87384 || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(value.data)) throw new Error('remote_changes_invalid');
      const raw = atob(value.data);
      if (!raw.length || raw.length > RESOURCE_CHUNK_BYTES || length + raw.length > MAX_CHANGES_BYTES) throw new Error('remote_changes_too_large');
      length += raw.length;
      chunks.push(decoder.decode(Uint8Array.from(raw, character => character.charCodeAt(0)), { stream: true }));
      void model.client.call('socket.send', { frame: { type: 'ack', id: request.id, count: 1 } }).catch(fail);
    } catch (error) { fail(error); }
  });
  const abort = () => fail(signal.reason);
  signal.addEventListener('abort', abort, { once: true });
  const timer = setTimeout(() => fail(new Error('remote_changes_timeout')), 60000);
  try {
    const result = await Promise.race([request.promise, failed]);
    signal.throwIfAborted();
    if (failure) throw failure;
    if (result !== undefined || !metadata) throw new Error('remote_changes_invalid');
    const value = JSON.parse(chunks.join('') + decoder.decode());
    if (!(index === undefined ? isChangesSummary(value) : isChangesDiff(value))) throw new Error('remote_changes_invalid');
    return value;
  } finally { clearTimeout(timer); signal.removeEventListener('abort', abort); request.cancel(); chunks.length = 0; }
}

export function changesError(error) {
  if (error.message === 'remote_changes_missing') return '电脑已不再保留这轮改动记录，无法重新读取当时的差异。';
  if (error.message === 'remote_changes_unavailable') return '请更新电脑远程插件和网关后查看改动。';
  if (error.message === 'remote_changes_too_large') return '这份改动记录较大，无法在手机预览。';
  if (error.message === 'remote_changes_busy') return '电脑正在读取其他改动，请稍后重试。';
  return '无法读取改动，请检查电脑连接后重试。';
}
