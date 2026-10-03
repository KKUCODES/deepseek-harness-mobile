import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { RemotePluginOperationHistory } from '../../src/ui/RemotePluginOperations.jsx';
import { LocaleProvider } from '../../src/ui/locale.jsx';
import '@upstream/ui-theme/src/styles/base.css';
import '@upstream/ui-theme/src/styles/design-platform.css';
import '../../src/ui/mobile.css';
import '../../src/ui/remote-product.css';

// 仅供独立组件回放：不加载原生桥、不连接网关、不提供真实鉴权或写操作。
const listeners = new Set();
let mode = 'pending', cancelled = 0;
const model = { transport: {
  pluginOperations: {
    subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener); },
    async list(signal) {
      signal.throwIfAborted();
      if (mode === 'denied') throw new Error('management_required');
      return { items: [{ id: 'fixture-operation', endpoint: 'pluginManager/installBundle',
        requestId: 'fixture-request', target: '@fixture/phone-layout', state: mode,
        startedAt: 1, application: mode === 'complete' ? 'cancelled' : undefined }] };
    },
  },
  async call() { cancelled++; return { ok: true, value: { status: 'too-late' } }; },
} };
function Fixture() {
  const [connected, setConnected] = useState(true), [locale, setLocale] = useState('zh');
  const set = value => { mode = value; for (const listener of listeners) listener(); };
  return <LocaleProvider locale={locale}>
    <header style={{ padding: 12, borderBottom: '1px solid #ddd' }}>
      <strong>隔离组件回放</strong><p>无电脑连接，不执行安装或权限变更。</p>
      <button onClick={() => set('unknown')}>结果未知</button>
      <button onClick={() => set('pending')}>进行中</button>
      <button onClick={() => set('denied')}>读取拒绝</button>
      <button onClick={() => setConnected(!connected)}>切换连接</button>
      <button onClick={() => setLocale(locale === 'zh' ? 'en' : 'zh')}>切换语言</button>
      <button onClick={() => { document.querySelector('[data-cancel-count]').textContent = String(cancelled); }}>查询取消次数</button>
      <output data-cancel-count>0</output>
    </header>
    <section aria-label="操作记录组件" style={{ padding: 16 }}>
      <RemotePluginOperationHistory model={model} connected={connected}/>
    </section>
  </LocaleProvider>;
}
createRoot(document.getElementById('app')).render(<Fixture/>);
