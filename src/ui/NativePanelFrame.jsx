import React, { useLayoutEffect, useRef } from 'react';

/** 官方面板保留原字号层级，只给过小的阅读文字兜底；第三方插槽拥有自己的尺寸。 */
export function NativePanelFrame({ view, children, flow = false }) {
  const root = useRef(null);
  useLayoutEffect(() => {
    const element = root.current;
    let frame;
    const measure = () => {
      frame = undefined;
      const previous = [...element.querySelectorAll('[data-native-font-floor]')].filter(node => node.closest('.remote-native-panel') === element);
      for (const node of previous) node.removeAttribute('data-native-font-floor');
      const small = [...element.querySelectorAll('*')].filter(node => {
        if (node.closest('[data-plugin-frame],svg,style,script') || node.closest('.remote-native-panel') !== element) return false;
        return [...node.childNodes].some(child => child.nodeType === Node.TEXT_NODE && child.textContent.trim())
          && parseFloat(getComputedStyle(node).fontSize) < 13;
      });
      for (const node of small) node.setAttribute('data-native-font-floor', '');
    };
    const schedule = () => { if (frame === undefined) frame = requestAnimationFrame(measure); };
    const observer = new MutationObserver(schedule);
    observer.observe(element, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ['class', 'style'] });
    const resize = new ResizeObserver(schedule); resize.observe(element);
    measure();
    return () => { observer.disconnect(); resize.disconnect(); if (frame !== undefined) cancelAnimationFrame(frame); };
  }, []);
  return <div ref={root} className={`remote-native-panel${flow ? ' is-flow' : ''}`} data-native-panel={view}>{children}</div>;
}
