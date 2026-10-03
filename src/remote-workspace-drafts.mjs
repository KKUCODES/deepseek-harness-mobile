import { attachmentDrafts, restoreAttachmentDrafts } from './remote-attachment-drafts.mjs';
import { rebaseWorkspaceReferences } from './remote-workspace-references.mjs';

/** 先原子交接本机原件，再按目标会话重新上传；旧 receipt 从不进入目标草稿。 */
export async function moveWorkspaceDraft(model, from, to, current) {
  if (from === undefined || from === to) return;
  const source = model.sessions.binding(from)?.session.getSnapshot();
  if (!source?.blank || source.running || source.pendingSubmissions.length || model.sending.has(from))
    throw new Error('聊天已经开始，请新建聊天后选择工作区。');
  if ([from, to].some(id => model.draftTransfers.has(id) || model.sending.has(id)))
    throw new Error('草稿正在提交或转移，请稍后重试。');
  model.publish(model.restoreDraft(to));
  const state = model.getSnapshot(), original = state.attachments[from] ?? [];
  const input = model.inputBindings?.mounted(from);
  let draft = input?.captureDraft() ?? { text: state.drafts[from] ?? '', editor: state.draftEditors[from] };
  if (!draft.text && !original.length) return;
  if ((state.drafts[to] ?? '') !== '' || state.attachments[to]?.length)
    throw new Error('目标聊天已有草稿，请先打开并处理，当前草稿已保留。');
  if ([from, to].some(id => state.draftSaving?.[id] || state.attachmentDraftSaving?.[id]
    || state.draftErrors?.[id] || state.attachmentDraftErrors?.[id]))
    throw new Error('请先等待草稿保存完成，或处理保存错误后重试。');
  if (input?.pending || original.some(item => !(item.source instanceof Blob) || ['uploading', 'uncertain'].includes(item.state)))
    throw new Error('附件正在上传或发送结果待确认，请处理后再切换工作区。');
  if (!model.draftStore?.move) throw new Error('当前存储不支持转移草稿，请更新 App 后重试。');
  draft = rebaseWorkspaceReferences(draft, model.sessions.list?.getSnapshot().byId[from]?.cwd,
    input?.projectDraft ? editor => input.projectDraft(editor) : undefined);
  const versions = [from, to].map(id => [model.draftVersions.get(id), model.attachmentDraftVersions.get(id)]);
  const valid = () => current() && [from, to].every((id, index) => {
    const session = model.sessions.binding(id)?.session.getSnapshot();
    return session?.blank && !session.running && !session.pendingSubmissions.length
      && model.draftVersions.get(id) === versions[index][0] && model.attachmentDraftVersions.get(id) === versions[index][1];
  });
  const carried = restoreAttachmentDrafts(attachmentDrafts(original)).map(item => ({ ...item, id: crypto.randomUUID() }));
  let reference;
  model.draftTransfers.add(from); model.draftTransfers.add(to); model.publish();
  try {
    reference = model.sessions.retain(to, { source: 'controllerOperation', signal: model.lifetime.signal });
    const binding = await reference.ready;
    if (!valid()) throw new Error('聊天或连接已变化，草稿尚未转移。');
    const target = binding.session.getSnapshot();
    if (!target.blank || target.running || target.pendingSubmissions.length)
      throw new Error('目标聊天已经开始，当前草稿已保留。');
    try { await model.draftStore.move(from, to, draft, carried, valid); }
    catch (error) {
      throw new Error(valid() ? '草稿未能保存，内容仍保留在原聊天，请重试。' : '聊天或连接已变化，草稿尚未转移。', { cause: error });
    }
    const latest = model.getSnapshot();
    model.publish({ drafts: { ...latest.drafts, [from]: '', [to]: draft.text },
      draftEditors: { ...latest.draftEditors, [from]: undefined, [to]: draft.editor },
      attachments: { ...latest.attachments, [from]: [], [to]: carried } });
    input?.shell.setDraft('');
    model.inputBindings?.mounted(to)?.restoreDraft(draft);
    // 本地事务已提交后即使用户另行导航，原件也保留在目标草稿，不自动发送。
    for (const item of carried) { if (!current()) break; await model.prepareAttachment(item.id, to); }
  } finally {
    reference?.release(); model.draftTransfers.delete(from); model.draftTransfers.delete(to); model.publish();
  }
}
