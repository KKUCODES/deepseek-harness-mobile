export function historyGroups(conversation) {
  const groups = [];
  for (const key of conversation?.order ?? []) {
    const node = conversation.nodes.get(key);
    if (!node || node.visibility === 'hidden') continue;
    const locationTurn = node.location?.turn;
    const turn = typeof locationTurn === 'number' ? locationTurn : locationTurn?.turn ?? node.data?.turn;
    const id = turn === undefined ? key : `turn:${turn}`;
    let group = groups.at(-1);
    if (group?.turnId !== id || group.nodes.length >= 4) {
      group = { id: group?.turnId === id ? `${id}:${key}` : id, turnId: id, nodes: [], seq: Math.max(0, Math.floor(node.seq ?? node.data?.seq ?? node.anchorSeq)) };
      groups.push(group);
    }
    group.nodes.push(node);
  }
  return groups;
}

export async function loadRemoteHistory(binding, { isCurrent = () => true } = {}) {
  const { session, eventSource } = binding;
  const state = session.getSnapshot();
  if (!isCurrent() || state.openState !== 'open' || !state.hasMore || state.loadingOlder) return;
  let received = false, replaced = false;
  // 原 loadOlder 会消化读取错误；只认可分页发布，实时追加不代表分页成功。
  const off = eventSource.subscribe(() => {
    const kind = eventSource.getSnapshot().change.kind;
    if (kind === 'prepend') received = true;
    if (kind === 'replace') replaced = true;
  });
  try {
    await session.loadOlder();
    // 重连会替换窗口；当前请求已失效，由新连接状态接管提示。
    if (isCurrent() && !replaced && !received) throw new Error('未能加载更早的记录，请重试。');
  } finally { off(); }
}
