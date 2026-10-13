export const workflowPluginId = '@deepseek-ai/dsh-client-ui-workflow-run';

/** 只允许原工作流卡片打开当前父会话仍在运行的成员；迟到点击不能跨会话导航。 */
export function workflowMemberTarget(state, target) {
  if (state.connectionState !== 'connected' || !target || !['one-shot', 'continuable'].includes(target.mode)
    || state.selected !== target.parentSessionId) throw new Error('工作流已变化，请在当前聊天中重新打开。');
  const child = state.list?.byId[target.childSessionId];
  const identity = state.list?.projectionsBySession?.[target.childSessionId]?.values.subagent;
  // 新版工作流的本地成员可继续，必须保留原身份；旧版一次性成员仍按原卡片关系核对。
  if ((state.list?.projectionsBySession || target.mode === 'continuable') && identity?.mode !== target.mode)
    throw new Error('这个工作流成员当前不可打开。');
  const member = state.conversation?.order.some(key => {
    const node = state.conversation.nodes.get(key);
    return node?.kind === 'workflow-run' && node.visibility !== 'hidden'
      && node.data.phases.some(phase => phase.members.some(row => row.childId === target.childSessionId && row.status === 'running'));
  });
  if (!member || !state.list.ids.includes(target.childSessionId) || child?.origin !== 'subagent'
    || child.parentId !== state.selected || !child.running) throw new Error('这个工作流成员当前不可打开。');
  return { parentSessionId: state.selected, childSessionId: child.id, mode: target.mode };
}
