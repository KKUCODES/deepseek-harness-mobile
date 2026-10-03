/** 沿原 SessionSummary 的直接父关系回溯；缺项或环路即停止，不猜测父会话。 */
export function sessionLineage(list, selected) {
  const chain = [], seen = new Set();
  let id = selected;
  while (id && !seen.has(id)) {
    seen.add(id);
    const summary = list?.byId[id];
    if (!summary) break;
    chain.unshift({ id: summary.id, displayTitle: summary.displayTitle, subagent: summary.origin === 'subagent' });
    if (summary.origin !== 'subagent') break;
    id = summary.parentId;
  }
  return chain;
}

/** 插件可保留回调，因此在点击时再次核对当前引用和祖先链。 */
export async function openLineageAncestor(model, reference, id) {
  const state = model.getSnapshot();
  const ancestors = sessionLineage(state.list, state.selected).slice(0, -1);
  if (model.lifetime.signal.aborted || model.reference !== reference || !ancestors.some(item => item.id === id)) {
    throw new Error('聊天已切换，请在当前聊天中操作。');
  }
  const trail = state.selectionTrail ?? [];
  const index = trail.findIndex(target => (typeof target === 'string' ? target : target.childSessionId) === id);
  // 沿已保存的直接父地址返回；无导航轨迹时仍由原会话模型解析持久化身份。
  return model.select(index < 0 ? id : trail[index], { trail: index < 0 ? [] : trail.slice(0, index) });
}
