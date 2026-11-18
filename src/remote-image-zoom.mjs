const MIN_SCALE = 1;
const MAX_SCALE = 5;
const DOUBLE_TAP_SCALE = 2.5;
const DOUBLE_TAP_MS = 300;
const DOUBLE_TAP_PX = 40;

/** 限制原图预览的缩放倍数，避免缩到不可见或放大到像素糊成一团。 */
export function clampScale(scale) {
  return Number.isFinite(scale) ? Math.min(MAX_SCALE, Math.max(MIN_SCALE, scale)) : MIN_SCALE;
}

/**
 * 围绕视口内某一点缩放后应使用的平移量。
 * 原点与中心都用同一坐标系（视口像素），保证手指或指针下的像素不移动。
 */
export function zoomAt({ x, y, scale }, nextScale, point, center) {
  const ratio = nextScale / scale;
  return {
    scale: nextScale,
    x: point.x - center.x - (point.x - center.x - x) * ratio,
    y: point.y - center.y - (point.y - center.y - y) * ratio,
  };
}

/** 放大后的图片最多贴到视口边缘；回到1倍时不保留平移。 */
export function panBounds(width, height, scale, viewportWidth, viewportHeight) {
  return {
    x: Math.max(0, (width * scale - viewportWidth) / 2),
    y: Math.max(0, (height * scale - viewportHeight) / 2),
  };
}

/** 两点距离，触摸捏合使用。 */
export function touchDistance(first, second) {
  return Math.hypot(first.clientX - second.clientX, first.clientY - second.clientY);
}

/** 两点中点，作为捏合锚点。 */
export function touchMidpoint(first, second) {
  return { x: (first.clientX + second.clientX) / 2, y: (first.clientY + second.clientY) / 2 };
}

/** 原图预览是否由原图库打开：占满视口的外层、单一图片、无正文或表单。 */
function isImageLightbox(dialog) {
  if (dialog.getAttribute('role') !== 'dialog' || dialog.getAttribute('aria-modal') !== 'true') return false;
  if (dialog.textContent.trim() !== '') return false;
  const image = dialog.querySelector('img');
  if (image === null || dialog.querySelectorAll('img').length !== 1) return false;
  if (dialog.querySelector('input, textarea, select, [contenteditable="true"]')) return false;
  const stage = image.parentElement;
  if (stage === null || stage === dialog || stage.parentElement !== dialog) return false;
  // 原图库外层只有遮罩、图片和关闭按钮；文档预览等界面另有标题或正文。
  return [...stage.children].every(child => child === image || child.tagName === 'BUTTON'
    || child.getAttribute('aria-hidden') === 'true');
}

/** 为一个已打开的原图预览接入缩放、平移、双击与滚轮；元素关闭后随DOM释放。 */
function enhance(dialog) {
  const image = dialog.querySelector('img');
  const stage = image?.parentElement;
  if (!image || !stage) return;
  let scale = 1, x = 0, y = 0, base = null;
  let pinch = null, pan = null, lastTap = 0, lastTapPoint = null, frame = 0;
  image.style.transformOrigin = 'center center';
  image.style.touchAction = 'none';
  image.draggable = false;

  // 记录1倍时的布局尺寸；放大直接改布局尺寸，WebView会用原图重新栅格化而不是拉伸位图。
  const measure = () => {
    if (base !== null) return base;
    if (!image.complete || image.offsetWidth === 0) return null;
    base = { width: image.offsetWidth, height: image.offsetHeight };
    return base;
  };
  if (measure() === null) image.addEventListener('load', measure, { once: true });

  const center = () => {
    const rect = stage.getBoundingClientRect();
    return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
  };
  const apply = () => {
    if (scale === MIN_SCALE) {
      image.style.width = ''; image.style.height = '';
      image.style.maxWidth = ''; image.style.maxHeight = '';
      image.style.transform = '';
      return;
    }
    if (measure() === null) return;
    image.style.maxWidth = 'none'; image.style.maxHeight = 'none';
    image.style.width = `${base.width * scale}px`;
    image.style.height = `${base.height * scale}px`;
    image.style.transform = `translate3d(${x}px, ${y}px, 0)`;
  };
  const schedule = () => {
    if (frame !== 0) return;
    frame = requestAnimationFrame(() => { frame = 0; apply(); });
  };
  const flush = () => {
    if (frame !== 0) { cancelAnimationFrame(frame); frame = 0; }
    apply();
  };
  const clampPan = () => {
    const size = base ?? { width: image.offsetWidth, height: image.offsetHeight };
    const bounds = panBounds(size.width, size.height, scale, stage.clientWidth, stage.clientHeight);
    x = Math.max(-bounds.x, Math.min(bounds.x, x));
    y = Math.max(-bounds.y, Math.min(bounds.y, y));
    if (scale === MIN_SCALE) { x = 0; y = 0; }
  };
  const setScale = (next, point) => {
    const value = clampScale(next);
    if (value === scale) return;
    const nextOffset = zoomAt({ x, y, scale }, value, point, center());
    scale = nextOffset.scale; x = nextOffset.x; y = nextOffset.y;
    clampPan(); apply();
  };

  const startTouch = event => {
    if (event.touches.length === 2) {
      const [first, second] = event.touches;
      pinch = {
        distance: touchDistance(first, second), midpoint: touchMidpoint(first, second),
        scale, x, y,
      };
      pan = null;
      event.preventDefault();
    } else if (event.touches.length === 1) {
      pinch = null;
      const touch = event.touches[0];
      pan = { x: touch.clientX - x, y: touch.clientY - y, moved: false };
    }
  };
  const moveTouch = event => {
    if (pinch && event.touches.length === 2) {
      event.preventDefault();
      const [first, second] = event.touches;
      const distance = touchDistance(first, second);
      if (pinch.distance === 0) return;
      const value = clampScale(pinch.scale * (distance / pinch.distance));
      const midpoint = touchMidpoint(first, second);
      const centerPoint = center();
      const ratio = value / pinch.scale;
      scale = value;
      x = midpoint.x - centerPoint.x - (pinch.midpoint.x - centerPoint.x - pinch.x) * ratio;
      y = midpoint.y - centerPoint.y - (pinch.midpoint.y - centerPoint.y - pinch.y) * ratio;
      clampPan(); schedule();
    } else if (pan && event.touches.length === 1 && scale > MIN_SCALE) {
      event.preventDefault();
      const touch = event.touches[0];
      x = touch.clientX - pan.x; y = touch.clientY - pan.y;
      pan.moved = true;
      clampPan(); schedule();
    }
  };
  const endTouch = event => {
    if (event.touches.length < 2) pinch = null;
    if (event.touches.length > 0) return;
    const touch = event.changedTouches[0];
    const point = touch === undefined ? null : { x: touch.clientX, y: touch.clientY };
    const tapped = pan !== null && !pan.moved && point !== null;
    pan = null;
    flush();
    if (!tapped) return;
    const now = performance.now();
    if (now - lastTap < DOUBLE_TAP_MS && lastTapPoint !== null
      && Math.hypot(point.x - lastTapPoint.x, point.y - lastTapPoint.y) < DOUBLE_TAP_PX) {
      lastTap = 0; lastTapPoint = null;
      setScale(scale === MIN_SCALE ? DOUBLE_TAP_SCALE : MIN_SCALE, point);
    } else { lastTap = now; lastTapPoint = point; }
  };

  let dragging = null;
  const startDrag = event => {
    if (event.button !== 0) return;
    dragging = { x: event.clientX - x, y: event.clientY - y };
    image.setPointerCapture?.(event.pointerId);
  };
  const moveDrag = event => {
    if (dragging === null || scale === MIN_SCALE) return;
    x = event.clientX - dragging.x; y = event.clientY - dragging.y;
    clampPan(); schedule();
  };
  const endDrag = event => {
    dragging = null;
    flush();
    if (image.hasPointerCapture?.(event.pointerId)) image.releasePointerCapture(event.pointerId);
  };
  const wheel = event => {
    event.preventDefault();
    setScale(scale * (event.deltaY < 0 ? 1.15 : 1 / 1.15), { x: event.clientX, y: event.clientY });
  };
  const doubleClick = event => setScale(scale === MIN_SCALE ? DOUBLE_TAP_SCALE : MIN_SCALE, { x: event.clientX, y: event.clientY });

  image.addEventListener('touchstart', startTouch, { passive: false });
  image.addEventListener('touchmove', moveTouch, { passive: false });
  image.addEventListener('touchend', endTouch);
  image.addEventListener('touchcancel', endTouch);
  image.addEventListener('pointerdown', startDrag);
  image.addEventListener('pointermove', moveDrag);
  image.addEventListener('pointerup', endDrag);
  image.addEventListener('pointercancel', endDrag);
  image.addEventListener('wheel', wheel, { passive: false });
  image.addEventListener('dblclick', doubleClick);
}

let references = 0;
let disposeCurrent = null;

/** 每个 Remote 会话共用一份预览缩放；首个调用接入，最后一个释放时断开。 */
export function installRemoteImageZoom() {
  references++;
  if (disposeCurrent === null) {
    if (typeof document === 'undefined') { references--; return () => {}; }
    const enhanced = new WeakSet();
    const inspect = node => {
      if (node.nodeType !== 1) return;
      if (node.matches?.('[role="dialog"][aria-modal="true"]')) {
        if (!enhanced.has(node) && isImageLightbox(node)) { enhanced.add(node); enhance(node); }
      }
      for (const dialog of node.querySelectorAll?.('[role="dialog"][aria-modal="true"]') ?? []) {
        if (!enhanced.has(dialog) && isImageLightbox(dialog)) { enhanced.add(dialog); enhance(dialog); }
      }
    };
    const scan = () => {
      for (const dialog of document.querySelectorAll('[role="dialog"][aria-modal="true"]')) inspect(dialog);
    };
    const observer = new MutationObserver(records => {
      // 只检查新插入的节点，流式输出时不必反复扫描整棵文档。
      for (const record of records) for (const node of record.addedNodes) inspect(node);
    });
    observer.observe(document.body, { childList: true, subtree: true });
    scan();
    disposeCurrent = () => observer.disconnect();
  }
  const dispose = disposeCurrent;
  return () => {
    references--;
    if (references > 0) return;
    dispose();
    disposeCurrent = null;
  };
}
