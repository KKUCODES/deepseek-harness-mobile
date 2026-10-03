import { attachmentDrafts, restoreAttachmentDrafts } from './remote-attachment-drafts.mjs';

export function captureConversationResume(model) {
  const { selected, selectedTarget, selectionTrail } = model.getSnapshot();
  return { selected, selectedTarget, selectionTrail,
    workspace: model.captureWorkspace?.(), jobOutput: model.captureJobOutput?.(), command: model.captureCommand?.() };
}

/** 转移草稿与只读阅读位置；会话、审批、资源凭据必须由新 Host 重新确认。 */
export function captureRemoteResume(model) {
  const { drafts, draftEditors, attachments } = model.getSnapshot();
  return {
    ...captureConversationResume(model),
    panels: model.panelMemory?.capture(),
    drafts: { ...drafts },
    draftEditors: { ...draftEditors },
    attachments: Object.fromEntries(Object.entries(attachments ?? {}).map(([sessionId, items]) => [sessionId,
      items.map(item => {
        if (item.source instanceof Blob) return restoreAttachmentDrafts(attachmentDrafts([item], model.sending.has(sessionId) ? [item.id] : []))[0];
        if (item.kind === 'image' && item.state === 'ready' && !model.sending.has(sessionId)) return { ...item };
        const uncertain = item.state === 'uncertain' || model.sending.has(sessionId);
        return { id: item.id, name: item.name, bytes: item.bytes, state: uncertain ? 'uncertain' : 'error',
          error: uncertain ? '发送结果尚未确认，请先核对聊天记录。' : '电脑连接已更新，请重新选择此附件。' };
      }),
    ])),
  };
}
