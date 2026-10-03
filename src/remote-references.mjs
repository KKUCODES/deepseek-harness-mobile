import { formatFileMention } from '../../deepseek-harness/packages/context/file-reference/src/grammar.ts';

export function referenceSources(model) {
  const calls = model.transport.capabilities?.endpoints?.calls ?? [];
  return { files: calls.includes('fileReferences/list'), chats: calls.includes('sessionReferenceResolver/candidates') };
}

/** 只读取电脑候选；文件格式沿用原语法，聊天引用使用电脑给出的完整 mention。 */
export async function loadReferenceCandidates(model, sessionId, query, signal) {
  const available = referenceSources(model);
  const sources = [
    ['files', available.files, () => model.remote.fileReferences.list(sessionId, query, signal)],
    ['chats', available.chats, () => model.remote.sessionReferenceResolver.candidates(sessionId, query, signal)],
  ];
  const result = await Promise.all(sources.map(async ([kind, enabled, load]) => {
    if (!enabled) return { kind, items: [], unavailable: true };
    try {
      const response = await load();
      signal.throwIfAborted();
      if (!response.ok) throw response.error;
      const items = response.value.flatMap(item => {
        if (kind === 'files') {
          const mention = formatFileMention(item, false);
          return mention === undefined ? [] : [{ kind: item.kind, title: item.path, mention, path: item.path }];
        }
        return [{ kind: 'chat', title: item.displayTitle ?? item.label ?? item.sessionId,
          mention: item.mention, sessionId: item.sessionId, detail: item.cwd }];
      });
      return { kind, items };
    } catch (error) {
      signal.throwIfAborted();
      return { kind, items: [], error: true };
    }
  }));
  signal.throwIfAborted();
  return result;
}

export function insertReference(model, sessionId, candidate, generation) {
  const current = model.getSnapshot();
  if (current.selected !== sessionId || current.connectionState !== 'connected'
    || current.session?.openState !== 'open' || model.connection.generation.getSnapshot()?.id !== generation
    || model.sessions.subagentAddress(sessionId) !== undefined
    || !referenceSources(model)[candidate.kind === 'chat' ? 'chats' : 'files']
    || !['file', 'chat'].includes(candidate.kind) || typeof candidate.mention !== 'string') {
    throw new Error('引用列表已变化，请重新打开后选择。');
  }
  const draft = current.drafts[sessionId] ?? '';
  const text = `${draft}${draft && !/\s$/u.test(draft) ? ' ' : ''}${candidate.mention} `;
  if (text.length > 100000) throw new Error('消息过长，请缩短内容后添加引用。');
  const input = model.inputBindings?.mounted(sessionId);
  if (!input || !input.appendReference({ source: 'reference', ref: candidate.mention,
    clipboardText: candidate.mention, appearance: candidate.kind === 'chat' ? 'session' : 'file',
    label: candidate.kind === 'chat' ? candidate.title : candidate.path.split(/[/\\]/).at(-1) })) {
    throw new Error('输入框暂时无法插入引用，请稍后重新选择。');
  }
}
