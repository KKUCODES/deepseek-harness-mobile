// 会话可在旁栏窗口之后异步挂载；其出现/移除也会改变“正在阅读”的判定。
const boundaries = 'dialog, [role="dialog"], .remote-plugin-panel, [data-remote-chat-content]';
const visible = element => !element.closest('[hidden]') && element.getClientRects().length > 0;

/** 原插件Modal通过portal挂载；根据实际遮挡决定是否正在阅读，不把弹窗视作已读。 */
export function observeRemoteReadingContext(document, sessionId, publish) {
  let previous = Symbol('unreported');
  const refresh = () => {
    const modal = [...document.querySelectorAll('dialog[open], [role="dialog"][aria-modal="true"]')].some(visible);
    const otherPanel = [...document.querySelectorAll('.remote-plugin-panel')].some(panel =>
      visible(panel) && ![...panel.querySelectorAll('[data-remote-chat-content]')].some(visible));
    const main = document.querySelector('[data-testid="remote-workspace"]');
    const contentReplaced = main && ![...main.querySelectorAll('[data-remote-chat-content]')].some(visible);
    const next = modal || otherPanel || contentReplaced ? null : sessionId;
    if (next === previous) return;
    previous = next;
    publish(next);
  };
  const containsBoundary = node => node.nodeType === 1 && (node.matches(boundaries) || node.querySelector(boundaries));
  const observer = new MutationObserver(records => {
    // 流式正文不会改变遮挡；只观察窗口增删和显示状态，避免逐token读取布局。
    if (records.some(record => record.type === 'attributes'
      ? containsBoundary(record.target)
      : [...record.addedNodes, ...record.removedNodes].some(containsBoundary))) refresh();
  });
  observer.observe(document.body, { childList: true, subtree: true, attributes: true,
    attributeFilter: ['open', 'hidden', 'aria-modal', 'role', 'style'] });
  refresh();
  return () => { observer.disconnect(); publish(null); };
}
