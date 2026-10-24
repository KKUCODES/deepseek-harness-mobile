export async function loadRemoteHistory(binding, { isCurrent = () => true } = {}) {
  if (binding.history) {
    if (!isCurrent()) return;
    try { return await binding.history.older(); }
    catch { if (isCurrent()) throw new Error('未能加载更早的记录，请重试。'); }
    return;
  }
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
