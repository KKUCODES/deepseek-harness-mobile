import React, { createContext, useContext, useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react';
import { schedulePluginFrameMeasurement } from '../plugin-frame-measurement.mjs';

const ParentPlugin = createContext(null);

/** 仅变换最外层；不重写插件内部 CSS，同插件嵌套插槽不重复缩放。 */
export function MobilePluginFrame({ id, layout, children, floating = false, fill = false, viewportOverlay = false, shellOverlay = false, inline = false }) {
  const parent = useContext(ParentPlugin);
  useSyncExternalStore(layout.subscribe, layout.getSnapshot);
  const enabled = layout.effective(id) && parent !== id;
  const outer = useRef(null), inner = useRef(null);
  const [size, setSize] = useState({ scale: 1, height: undefined });
  useLayoutEffect(() => {
    if (!enabled) return;
    let cancel;
    const measure = () => {
      const width = outer.current?.clientWidth, content = inner.current;
      if (!width || !content) return;
      // 页脚插件的 fixed 弹层使用视口坐标，不能拿弹层溢出宽度反向缩放它的触发器。
      const natural = viewportOverlay ? content.offsetWidth : Math.max(content.offsetWidth, content.scrollWidth);
      const scale = natural > 0 ? Math.min(1, width / natural) : 1;
      const height = Math.ceil(content.offsetHeight * scale);
      return { scale, height };
    };
    const schedule = (initial = false) => {
      cancel?.();
      cancel = schedulePluginFrameMeasurement(outer.current.ownerDocument.defaultView, measure,
        size => setSize(previous => previous.scale === size.scale && previous.height === size.height ? previous : size), initial);
    };
    const observer = new ResizeObserver(() => schedule());
    observer.observe(outer.current); observer.observe(inner.current); schedule(true);
    return () => { observer.disconnect(); cancel?.(); };
  }, [enabled, viewportOverlay]);
  if (parent === id) return children;
  return <ParentPlugin.Provider value={id}>
    {/* 缩放前的宽度仍参与焦点滚动；clip 避免浏览器把已缩放的内容再次横向滚走。 */}
    <div ref={outer} data-plugin-frame={id} data-auto-fit={enabled} style={{ width: inline ? 'max-content' : '100%', minWidth: 0,
      maxWidth: inline ? '100%' : undefined, flex: inline ? 'none' : undefined,
      overflow: floating || shellOverlay ? 'visible' : enabled ? 'clip' : 'auto', height: floating ? 0 : fill ? '100%' : enabled ? size.height : undefined,
      minHeight: fill ? 0 : undefined,
      ...(floating ? { position: 'absolute', top: 0, left: 0, zIndex: 100 } : {}) }}>
      {/* 整块会话继承窗口高度；缩放前反算高度，保持缩放后输入框仍在窗口内。 */}
      <div ref={inner} style={{ width: enabled ? 'max-content' : undefined, minWidth: enabled ? '100%' : undefined,
        height: fill ? `calc(100% / ${enabled ? size.scale : 1})` : undefined,
        transform: enabled && size.scale !== 1 ? `scale(${size.scale})` : undefined, transformOrigin: 'top left', display: 'flow-root' }}>{children}</div>
    </div>
  </ParentPlugin.Provider>;
}
