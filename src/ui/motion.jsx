import React, { createContext, useCallback, useContext, useEffect, useLayoutEffect, useRef, useState } from 'react';

const PresenceContext = createContext(null);
export const RemoteFlowMotion = createContext(undefined);
const EASE = 'cubic-bezier(0.22, 1, 0.36, 1)';
const ENTER_MS = 260, EXIT_MS = 170;
export const reducedMotion = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
export const useSurfacePresent = () => useContext(PresenceContext)?.present ?? true;

/** 只在退出期间保留窗口；旧按钮立即失去交互，业务写入不等待动画。 */
export function SurfacePresence({ children }) {
  const present = !!children;
  const [retained, setRetained] = useState(present);
  const content = useRef(children);
  if (present) content.current = children;
  const latest = useRef(children);
  latest.current = children;
  const finish = useCallback(() => { if (!latest.current) { content.current = null; setRetained(false); } }, []);
  useLayoutEffect(() => {
    if (present) setRetained(true);
  }, [present]);
  useEffect(() => {
    if (present || !retained) return;
    // 组件可能在打开窗口前就返回 null（例如把文件请求转交给原文档面板）。
    const timer = setTimeout(finish, reducedMotion() ? 0 : ENTER_MS + 80);
    return () => clearTimeout(timer);
  }, [present, retained, finish]);
  return <PresenceContext.Provider value={{ present, finish }}>{present || retained ? content.current : null}</PresenceContext.Provider>;
}

/** 中途反向时从屏幕上的当前位置接续；结束后清掉临时合成层和变换。 */
function animate(element, running, frames, duration, onFinish = () => {}) {
  const previous = running.current;
  if (previous?.effect.target === element) frames[0] = { transform: getComputedStyle(element).transform, opacity: getComputedStyle(element).opacity };
  previous?.cancel();
  if (reducedMotion() || !element.animate) { running.current = null; onFinish(); return; }
  const animation = element.animate(frames, { duration, easing: EASE, fill: 'both' });
  running.current = animation;
  const finish = () => {
    if (running.current !== animation) return;
    running.current = null;
    animation.cancel();
    onFinish();
  };
  const preference = matchMedia('(prefers-reduced-motion: reduce)');
  preference.addEventListener('change', finish, { once: true });
  animation.finished.then(finish, () => {}).finally(() => preference.removeEventListener('change', finish));
}

/** Surface 与保留插件实例的 PanelSurface 共用进出时钟，保持各自的模态契约。 */
export function useSurfaceMotion(ref, open = true, kind = 'sheet', layoutKey = '') {
  const owner = useContext(PresenceContext);
  const present = open && (owner?.present ?? true);
  const [retained, setRetained] = useState(open);
  const mounted = present || retained;
  const running = useRef(null), bounds = useRef(null), latest = useRef(null);
  latest.current = { present, finish: owner?.finish };
  const finish = useCallback(() => {
    if (latest.current.present) return;
    setRetained(false);
    latest.current.finish?.();
  }, []);
  useLayoutEffect(() => {
    const element = ref.current;
    if (!element || !mounted) return;
    if (present) setRetained(true);
    element.inert = !present;
    if (present) element.removeAttribute('aria-hidden');
    else {
      if (element.contains(document.activeElement)) document.activeElement.blur();
      element.setAttribute('aria-hidden', 'true');
      // 关闭立即交还模态层。原窗口转为只读视觉残影，不能让退出动画拦住
      // 新会话的首个输入；遮罩由同级外壳继续淡出，不留原生模态占位。
      if (element.tagName === 'DIALOG' && element.open) {
        element.previousElementSibling?.style.setProperty('--surface-backdrop-opacity', getComputedStyle(element, '::backdrop').opacity);
        element.close();
        // 只保留退出画面；show() 会再次执行聚焦步骤，可能收起背景输入框。
        element.open = true; element.inert = true;
      }
    }
    element.dataset.motionPresence = present ? 'open' : 'closed';
    element.dataset.motionState = present ? 'enter' : 'exit';
    const offset = kind === 'drawer' ? 'translateX(-100%)' : kind === 'panel' ? 'translateX(24px)' : 'translateY(32px)';
    animate(element, running, present
      ? [{ transform: offset, opacity: 0 }, { transform: 'none', opacity: 1 }]
      : [{ transform: 'none', opacity: 1 }, { transform: kind === 'drawer' ? offset : 'translateY(16px)', opacity: 0 }],
    present ? ENTER_MS : EXIT_MS, () => {
      element.dataset.motionState = 'idle';
      if (present) bounds.current = { key: layoutKey, rect: element.getBoundingClientRect() };
      else finish();
    });
  }, [present, mounted, kind, finish]);
  useLayoutEffect(() => {
    const element = ref.current;
    if (!element || !present) return;
    const before = bounds.current;
    if (!before || before.key === layoutKey) {
      if (!running.current) bounds.current = { key: layoutKey, rect: element.getBoundingClientRect() };
      return;
    }
    let old = before.rect;
    if (running.current) {
      if (element.dataset.motionState !== 'layout') return;
      const transform = new DOMMatrixReadOnly(getComputedStyle(element).transform);
      old = { left: old.left + transform.e, top: old.top + transform.f, width: old.width * transform.a, height: old.height * transform.d };
      running.current.cancel(); running.current = null;
    }
    const rect = element.getBoundingClientRect();
    bounds.current = { key: layoutKey, rect };
    if (Math.abs(old.width - rect.width) + Math.abs(old.height - rect.height) < 1) return;
    element.dataset.motionState = 'layout';
    element.style.transformOrigin = 'top left';
    animate(element, running, [{ transform: `translate(${old.left - rect.left}px, ${old.top - rect.top}px) scale(${old.width / rect.width}, ${old.height / rect.height})`, opacity: 1 },
      { transform: 'none', opacity: 1 }], ENTER_MS, () => { element.style.transformOrigin = ''; element.dataset.motionState = 'idle'; });
  }, [layoutKey, present]);
  useEffect(() => () => { running.current?.cancel(); running.current = null; }, []);
  return { mounted, present };
}

/** 按导航身份播放一次；流式正文、模型状态和搜索输入更新不会重播整页动画。 */
export function useSceneMotion(ref, identity, depth, enter = false) {
  const previous = useRef({ identity: enter ? null : identity, depth }), running = useRef(null);
  useLayoutEffect(() => {
    const before = previous.current;
    previous.current = { identity, depth };
    const element = ref.current;
    if (!element || before.identity === identity) return;
    const distance = depth < before.depth ? -18 : 24;
    element.dataset.navigationMotion = depth < before.depth ? 'back' : 'forward';
    animate(element, running, [{ transform: `translateX(${distance}px)`, opacity: 0.55 }, { transform: 'none', opacity: 1 }], ENTER_MS,
      () => { delete element.dataset.navigationMotion; });
  }, [identity, depth]);
  useEffect(() => () => { running.current?.cancel(); running.current = null; }, []);
}

/** 原生 details 保留语义与键盘操作，关闭到末帧才折叠盒子，内容更新不重播。 */
export function MotionDetails({ children, title, open = false, className = '' }) {
  const [expanded, setExpanded] = useState(open);
  const details = useRef(null), body = useRef(null), running = useRef(null), first = useRef(true);
  useEffect(() => { setExpanded(open); }, [open]);
  useLayoutEffect(() => {
    const element = body.current, container = details.current;
    if (first.current) { first.current = false; return; }
    const before = container.open ? element.getBoundingClientRect().height : 0;
    running.current?.cancel(); running.current = null;
    container.open = true;
    element.inert = !expanded;
    const finish = () => { container.open = expanded; element.style.overflow = ''; };
    if (reducedMotion() || !element.animate) { finish(); return; }
    element.style.overflow = 'clip';
    const animation = element.animate([{ height: `${before}px`, opacity: expanded ? 0.4 : 1 },
      { height: `${expanded ? element.scrollHeight : 0}px`, opacity: expanded ? 1 : 0 }], { duration: 200, easing: EASE, fill: 'both' });
    running.current = animation;
    const complete = () => {
      if (running.current !== animation) return;
      running.current = null; animation.cancel(); finish();
    };
    const preference = matchMedia('(prefers-reduced-motion: reduce)');
    preference.addEventListener('change', complete, { once: true });
    animation.finished.then(complete, () => {}).finally(() => preference.removeEventListener('change', complete));
  }, [expanded]);
  useEffect(() => () => running.current?.cancel(), []);
  return <details ref={details} className={className} open={open} data-expanded={expanded || undefined}>
    <summary aria-expanded={expanded} onClick={event => { event.preventDefault(); setExpanded(value => !value); }}>{title}</summary>
    <div ref={body}>{children}</div>
  </details>;
}
