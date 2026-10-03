/** 对齐原 TurnTailNodeView：只允许已完成轮次的最后一个聊天节点分支。 */
export function turnForkAnchor(conversation, nodeId) {
  const node = conversation?.nodes.get(nodeId);
  if (node?.kind !== 'turn-tail' || node.visibility === 'hidden') return null;
  const { closing, branchUnavailable, turn } = node.data;
  // 原版文件改动位于 turnTail 插槽；手机将它展示成独立按钮，不应因此阻断原本有效的分支。
  const last = conversation.locations.getTurn(turn).filter(key => conversation.nodes.get(key)?.kind !== 'remote-changes').at(-1);
  if (!closing || branchUnavailable || last !== nodeId) return null;
  const seq = closing.finalNode.seq;
  // 原客户端负责对中断冻结节点的小数位置取整；不能改用 UI 排序位置或轮号。
  return Number.isFinite(seq) && seq >= 0 && Number.isSafeInteger(Math.floor(seq)) ? seq : null;
}
