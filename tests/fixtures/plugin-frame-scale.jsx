import React, { useLayoutEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { MobilePluginFrame } from '../../src/ui/MobilePluginFrame.jsx';

const listeners = new Set();
let enabled = true;
const layout = { effective: () => enabled, subscribe: fn => { listeners.add(fn); return () => listeners.delete(fn); }, getSnapshot: () => enabled };
function Plugin({ index }) {
  const ref = useRef();
  // 模拟插件在自己的布局阶段更新内容；宿主不应逐项迫使浏览器重新布局。
  useLayoutEffect(() => { ref.current.style.width = `${600 + index % 3}px`; }, [index]);
  return <button ref={ref} style={{ height: 80 }} onClick={event => { event.currentTarget.dataset.clicked = 'yes'; }}>Plugin {index}</button>;
}
function App() {
  const [count, setCount] = useState(0);
  window.frameFixture = { setCount, toggle: value => { enabled = value; for (const fn of listeners) fn(); } };
  return <div style={{ width: 320 }}>{Array.from({ length: count }, (_, index) =>
    <MobilePluginFrame key={index} id={`plugin-${index}`} layout={layout}><Plugin index={index}/></MobilePluginFrame>)}</div>;
}
createRoot(document.getElementById('app')).render(<App/>);
