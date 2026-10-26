/** 跟踪已有消息的位置，避免尾部流式输出或投影合并被误算为前插高度。 */
export async function loadEarlierHistory({ container, load, isCurrent }) {
  if (container.querySelector('[data-history-count]')) {
    const top = container.getBoundingClientRect().top;
    const anchor = [...container.querySelectorAll('[data-history-group]')]
      .find(node => node.getBoundingClientRect().bottom > top);
    const key = anchor?.dataset.historyGroup, offset = anchor?.getBoundingClientRect().top - top;
    await load();
    // 列表先定位到原组，随后按真实像素收尾；最后一页移除顶部按钮会再改变scrollMargin。
    // 不按虚拟占位总高度补偿，避免把高度估算与真实前插重复计算。
    for (let frame = 0; frame < 3; frame++) {
      await new Promise(resolve => requestAnimationFrame(resolve));
      if (!container.isConnected || !isCurrent()) return;
      const current = [...container.querySelectorAll('[data-history-group]')].find(node => node.dataset.historyGroup === key);
      if (current && Number.isFinite(offset)) container.scrollTop += current.getBoundingClientRect().top - container.getBoundingClientRect().top - offset;
    }
    return;
  }
  const top = container.getBoundingClientRect().top;
  // 插槽外壳使用 display:contents，本身没有位置；只取原 ChatNodeSeat 的实体行。
  const rows = container.querySelector('.messages').querySelectorAll(
    ':scope > :not([data-slot]), :scope > [data-slot="dshm.chat.node"] > [data-chat-flow-key]',
  );
  const visible = node => !node.hasAttribute('hidden') && node.getBoundingClientRect().height > 0;
  const anchors = [...rows]
    .filter(node => !node.hasAttribute('data-history-loader') && visible(node) && node.getBoundingClientRect().bottom > top)
    .map(node => ({ node, offset: node.getBoundingClientRect().top - top + container.scrollTop }));
  // 只在本次前插期间接管定位；平时仍允许浏览器补偿图片等异步内容的高度。
  const previousAnchor = container.style.overflowAnchor;
  container.style.overflowAnchor = 'none';
  try {
    await load();
    // 原会话服务先发通知再完成请求；在 React 提交后的帧中测量实际 DOM。
    await new Promise(resolve => requestAnimationFrame(resolve));
    if (!container.isConnected || !isCurrent()) return;
    const anchor = anchors.find(({ node }) => container.contains(node) && visible(node));
    if (!anchor) return;
    const offset = anchor.node.getBoundingClientRect().top - container.getBoundingClientRect().top + container.scrollTop;
    container.scrollTop += offset - anchor.offset;
  } finally { container.style.overflowAnchor = previousAnchor; }
}
