import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Surface, IconButton } from '../../src/ui/Surface.jsx';
import { SurfacePresence, MotionDetails } from '../../src/ui/motion.jsx';
import { PanelSurface } from '../../src/remote-plugin-panels.jsx';

/** 隔离交互夹具只验证窗口生命周期，不伪装电脑授权或模型响应。 */
export function mountMotionProbe() {
  const node = document.createElement('div'); document.body.append(node);
  node.style.cssText = 'position:fixed;inset:0;z-index:1;background:white;overflow:auto';
  const root = createRoot(node);
  function Probe() {
    const [kind, setKind] = useState(null), [full, setFull] = useState(false);
    const [model] = useState(() => ({}));
    window.motionProbe = { open: value => setKind(value), close: () => setKind(null), dispose: () => { root.unmount(); node.remove(); } };
    return <><button data-testid="probe-trigger" onClick={() => setKind('sheet')}>打开窗口</button>
      <MotionDetails title="展开过程"><p>执行过程详情</p><p>保留内容与选择状态</p></MotionDetails>
      <SurfacePresence>{kind && (kind === 'panel' ? <PanelSurface open model={model} title="测试插件面板" onClose={() => setKind(null)}>
        <header><h2>测试插件面板</h2><button onClick={() => setKind(null)}>关闭面板</button></header><input aria-label="插件局部草稿"/>
      </PanelSurface> : <Surface title="测试窗口" kind={kind} className={`remote-file-preview${full ? ' is-fullscreen' : ''}`} onClose={() => setKind(null)}>
        <header><h2>测试窗口</h2><IconButton label="切换全屏" onClick={() => setFull(value => !value)}>↗</IconButton><button onClick={() => setKind(null)}>关闭窗口</button></header>
        <input aria-label="窗口草稿"/><div style={{ flex: 1, overflow: 'auto' }}>{Array.from({ length: 25 }, (_, index) => <p key={index}>预览内容 {index}</p>)}</div>
      </Surface>)}</SurfacePresence></>;
  }
  root.render(<Probe/>);
}
