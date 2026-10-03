import React, { useState, useSyncExternalStore } from 'react';
import { startHost } from './plugin-host.jsx';
import { OrdinaryChat } from './ordinary-chat.jsx';
import { InputValidation } from './input-validation.jsx';
import { StreamValidation } from './stream-validation.jsx';
import './validation.css';

function ValidationPage({ renderSlot, SessionProvider, host }) {
  const { ctx, ordinaryInput, setFixture, setThemeModule, optionalPlugins } = host;
  const inputState = useSyncExternalStore(ordinaryInput.state.subscribe, ordinaryInput.state.getSnapshot);
  const [enabled, setEnabled] = useState(optionalPlugins);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [themeLoaded, setThemeLoaded] = useState(optionalPlugins);
  const toggle = async () => {
    setBusy(true);
    try { await setFixture(!enabled); setEnabled(!enabled); setError(''); }
    catch (failure) { setError(String(failure)); }
    finally { setBusy(false); }
  };
  const toggleTheme = async () => {
    setBusy(true);
    try { await setThemeModule(!themeLoaded); setThemeLoaded(!themeLoaded); setError(''); }
    catch (failure) { setError(String(failure)); }
    finally { setBusy(false); }
  };
  return <main className="validation">
    <h1>DSHM 插件技术验证</h1>
    <p>原始 DSH 模块加载器、Cordis、Slots、主题与语言插件。此页用于验证，不是正式手机 UI。</p>
    <p data-testid="ready">插件运行环境已启动</p>
    <OrdinaryChat inputRuntime={ordinaryInput} renderSlot={renderSlot} SessionProvider={SessionProvider} />
    <div className="ordinary-actions">
      <button data-testid="ordinary-input-toggle" disabled={busy} onClick={async () => {
        setBusy(true);
        try { await ordinaryInput.enable(!inputState.enabled); } catch (failure) { setError(String(failure)); }
        finally { setBusy(false); }
      }}>{inputState.enabled ? '卸载输入插件' : '加载输入插件'}</button>
      <button data-testid="ordinary-source-toggle" disabled={!inputState.enabled || busy}
        onClick={() => ordinaryInput.setSource(!inputState.sourceEnabled)}>{inputState.sourceEnabled ? '停用普通聊天提示词' : '启用普通聊天提示词'}</button>
    </div>
    <section><h2>真实插件设置</h2>
      <button onClick={toggleTheme} disabled={busy} data-testid="theme-toggle">{themeLoaded ? '卸载主题插件' : '重新加载主题插件'}</button>
      <p>卸载期间使用验证页基础样式；重新加载后恢复已保存的主题与字号。</p>
      {renderSlot('settings.general.item', {})}
    </section>
    <section><h2>上游安装包样例</h2>
      <button onClick={toggle} disabled={busy} data-testid="fixture-toggle">{enabled ? '卸载样例插件' : '重新加载样例插件'}</button>
      {error && <p role="alert">{error}</p>}
      {renderSlot('plugins.row.config', { view: 'form' }, { entryKey: '@fixture/live-client#fixture-live-client' })}
    </section>
    <InputValidation locale={ctx.locale} />
    <StreamValidation />
    <p>普通聊天与 Remote 可通过安卓入口切换；完整 Remote 插件通道和正式产品 UI 尚未接入。</p>
    {renderSlot('shell.overlay', {})}
  </main>;
}

await startHost(ValidationPage, { diagnostics: true });
