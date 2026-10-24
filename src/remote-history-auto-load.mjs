/** 只响应向上阅读意图；布局、锚点恢复和重连产生的滚动不能连续拉取历史。 */
export function observeHistoryTop(container, { canLoad, load, threshold = 160 }) {
  const view = container.ownerDocument.defaultView;
  let disposed = false, loading = false, intentUntil = 0, frame = null;
  let top = container.scrollTop, touchY = null, touchConsumed = false, dragging = false;
  const check = () => {
    frame = null;
    if (disposed || loading || Date.now() >= intentUntil) return;
    if (!canLoad()) { intentUntil = 0; return; }
    if (container.scrollTop > threshold) return;
    intentUntil = 0;
    if (touchY !== null) touchConsumed = true;
    loading = true;
    // 请求及前插校正期间的手势不排队；完成后需继续向上阅读才会加载下一页。
    void Promise.resolve().then(load).catch(() => {}).finally(() => {
      if (disposed) return;
      frame = view.requestAnimationFrame(() => {
        frame = view.requestAnimationFrame(() => {
          frame = null; top = container.scrollTop; intentUntil = 0; loading = false;
        });
      });
    });
  };
  const upward = () => {
    if (disposed || loading) return;
    intentUntil = Date.now() + 1500;
    if (frame === null) frame = view.requestAnimationFrame(check);
  };
  const wheel = event => { if (event.deltaY < 0) upward(); else intentUntil = 0; };
  const touchStart = event => { touchConsumed = false; touchY = event.touches.length === 1 ? event.touches[0].clientY : null; };
  const touchMove = event => {
    const next = event.touches.length === 1 ? event.touches[0].clientY : null;
    if (next !== null && touchY !== null) {
      if (next > touchY && !touchConsumed) upward(); else if (next < touchY) intentUntil = 0;
    }
    touchY = next;
  };
  const touchEnd = () => { touchY = null; };
  const key = event => {
    if (event.defaultPrevented || event.target.closest?.('input, textarea, select, [contenteditable="true"]')) return;
    if (['ArrowUp', 'PageUp', 'Home'].includes(event.key)) upward();
    else intentUntil = 0;
  };
  const pointerDown = event => { dragging = event.pointerType === 'mouse'; };
  const pointerEnd = () => { dragging = false; };
  const scroll = () => {
    if (dragging && container.scrollTop < top) upward();
    // 抬手后的惯性滚动仍属于刚才的阅读动作，但不能无限保留这次意图。
    if (container.scrollTop < top && Date.now() < intentUntil && frame === null && !loading) frame = view.requestAnimationFrame(check);
    if (container.scrollTop > top) intentUntil = 0;
    top = container.scrollTop;
  };
  const listeners = { wheel, touchstart: touchStart, touchmove: touchMove, touchend: touchEnd,
    touchcancel: touchEnd, keydown: key, pointerdown: pointerDown, scroll };
  for (const [name, handler] of Object.entries(listeners)) container.addEventListener(name, handler, { passive: true });
  view.addEventListener('pointerup', pointerEnd); view.addEventListener('pointercancel', pointerEnd);
  const reset = () => { intentUntil = 0; };
  const dispose = () => {
    disposed = true; reset(); view.cancelAnimationFrame(frame);
    for (const [name, handler] of Object.entries(listeners)) container.removeEventListener(name, handler);
    view.removeEventListener('pointerup', pointerEnd); view.removeEventListener('pointercancel', pointerEnd);
  };
  return { reset, dispose };
}
