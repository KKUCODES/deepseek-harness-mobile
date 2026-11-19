import { clampScale, touchDistance, touchMidpoint } from './remote-image-zoom.mjs';

const DOUBLE_TAP_SCALE = 2.5;
const DOUBLE_TAP_MS = 300;
const DOUBLE_TAP_PX = 40;
const FIT_EPSILON = 0.02;

/** 读取图片固有宽度（面板以 --document-zoom-width 记录原图像素宽）。 */
function intrinsicWidth(surface) {
  const value = parseFloat(surface?.style.getPropertyValue('--document-zoom-width') ?? '');
  return Number.isFinite(value) && value > 0 ? value : 0;
}

/**
 * 为面板图片预览的滚动视口接入触摸捏合、单指平移与双击缩放。
 * 手势以「相对铺满宽度的倍数」计算（与聊天大图一致），换算成面板绝对缩放后写入同一缩放状态。
 * @param {HTMLElement} scrollport 文档缩放滚动视口元素
 * @param {{ commit: (preference: { kind: 'fit-width' } | { kind: 'fixed', scale: number }) => void, signal?: AbortSignal }} options 缩放提交回调与生命周期信号
 * @returns {() => void} 解绑函数，释放触摸监听与样式改动
 */
export function bindImagePreviewZoom(scrollport, { commit, signal }) {
  const frame = scrollport.closest('[data-document-zoom-frame]');
  if (!frame) return () => {};
  let pinch = null, pan = null, lastTap = 0, lastTapPoint = null;

  const surface = () => scrollport.querySelector('[data-document-zoom-surface]');
  const fitZoom = () => {
    const intrinsic = intrinsicWidth(surface());
    return intrinsic > 0 ? Math.min(1, Math.max(1, scrollport.clientWidth - 24) / intrinsic) : 1;
  };
  const currentScale = () => {
    const value = parseFloat(frame.style.getPropertyValue('--document-zoom'));
    return Number.isFinite(value) && value > 0 ? value : fitZoom();
  };
  const zoomed = () => currentScale() > fitZoom() + FIT_EPSILON;
  const syncTouchAction = () => { scrollport.style.touchAction = zoomed() ? 'none' : 'pan-y'; };

  // 围绕手势锚点缩放：先记录锚点相对图片表面的位置，改缩放后按新表面位置补偿滚动。
  const applyZoom = (nextScale, point) => {
    const previous = currentScale();
    if (nextScale === previous) return;
    const node = surface();
    const ratio = nextScale / previous;
    const before = node?.getBoundingClientRect();
    frame.style.setProperty('--document-zoom', String(nextScale));
    frame.setAttribute('data-document-zoom-mode', 'fixed');
    if (node && before && point) {
      const anchorX = point.x - before.left, anchorY = point.y - before.top;
      const after = node.getBoundingClientRect();
      scrollport.scrollLeft += after.left + anchorX * ratio - point.x;
      scrollport.scrollTop += after.top + anchorY * ratio - point.y;
    }
    syncTouchAction();
  };
  const commitFixed = () => commit({ kind: 'fixed', scale: currentScale() });
  const restoreFit = () => {
    frame.setAttribute('data-document-zoom-mode', 'fit-width');
    frame.style.setProperty('--document-zoom', String(fitZoom()));
    syncTouchAction();
    commit({ kind: 'fit-width' });
  };

  const startTouch = event => {
    if (event.touches.length === 2) {
      const [first, second] = event.touches;
      pinch = { distance: touchDistance(first, second), multiplier: currentScale() / fitZoom() };
      pan = null;
      event.preventDefault();
    } else if (event.touches.length === 1) {
      pinch = null;
      const touch = event.touches[0];
      pan = { x: touch.clientX, y: touch.clientY, moved: false };
    }
  };
  const moveTouch = event => {
    if (pinch && event.touches.length === 2) {
      event.preventDefault();
      const [first, second] = event.touches;
      if (pinch.distance === 0) return;
      const multiplier = clampScale(pinch.multiplier * (touchDistance(first, second) / pinch.distance));
      applyZoom(fitZoom() * multiplier, touchMidpoint(first, second));
    } else if (pan && event.touches.length === 1 && zoomed()) {
      event.preventDefault();
      const touch = event.touches[0];
      scrollport.scrollLeft += pan.x - touch.clientX;
      scrollport.scrollTop += pan.y - touch.clientY;
      pan.x = touch.clientX; pan.y = touch.clientY; pan.moved = true;
    }
  };
  const endTouch = event => {
    if (event.touches.length < 2) {
      if (pinch) commitFixed();
      pinch = null;
    }
    if (event.touches.length > 0) return;
    const touch = event.changedTouches[0];
    const point = touch ? { x: touch.clientX, y: touch.clientY } : null;
    const tapped = pan !== null && !pan.moved && point !== null;
    pan = null;
    if (!tapped) return;
    const now = performance.now();
    if (now - lastTap < DOUBLE_TAP_MS && lastTapPoint !== null
      && Math.hypot(point.x - lastTapPoint.x, point.y - lastTapPoint.y) < DOUBLE_TAP_PX) {
      lastTap = 0; lastTapPoint = null;
      if (zoomed()) restoreFit();
      else { applyZoom(fitZoom() * DOUBLE_TAP_SCALE, point); commitFixed(); }
    } else { lastTap = now; lastTapPoint = point; }
  };

  scrollport.addEventListener('touchstart', startTouch, { passive: false });
  scrollport.addEventListener('touchmove', moveTouch, { passive: false });
  scrollport.addEventListener('touchend', endTouch);
  scrollport.addEventListener('touchcancel', endTouch);
  syncTouchAction();
  const abort = () => dispose();
  signal?.addEventListener('abort', abort, { once: true });
  function dispose() {
    scrollport.removeEventListener('touchstart', startTouch);
    scrollport.removeEventListener('touchmove', moveTouch);
    scrollport.removeEventListener('touchend', endTouch);
    scrollport.removeEventListener('touchcancel', endTouch);
    signal?.removeEventListener('abort', abort);
    scrollport.style.touchAction = '';
  }
  return dispose;
}