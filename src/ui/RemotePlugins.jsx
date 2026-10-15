import React, { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import { Button } from '@upstream/ui-primitives/src/Button.tsx';
import { RemotePluginManagerExtension, RemotePluginSettingsExtension } from '../remote-plugin-slots.jsx';
import { useTranslate } from './locale.jsx';
import { workflowPluginId } from '../remote-workflows.mjs';
import { RemotePluginOperationHistory } from './RemotePluginOperations.jsx';
import { RemoteConnectionNotice } from './RemoteConnectionNotice.jsx';
import { retainRemoteSurface } from '../remote-surface-inert.mjs';
import { useSurfaceMotion } from './motion.jsx';
import { NativePanelFrame } from './NativePanelFrame.jsx';

const labels = { active: '运行中', waiting: '暂不可用', failed: '加载失败', mobile: '由手机提供' };
const statusHelp = {
  waiting: '插件依赖尚未就绪，请检查电脑上相关插件是否已启用。',
  failed: '插件加载失败，请尝试重新连接；若仍失败，可在电脑上停用或更新该插件。',
};

/** 原管理组件的弹窗挂在 body，不能放在原生 dialog 的 inert 区域外。 */
export function RemoteComputerPlugins({ model, onClose }) {
  const t = useTranslate();
  const state = useSyncExternalStore(model.subscribeView, model.getSnapshot);
  const panel = useRef(null);
  const { mounted, present } = useSurfaceMotion(panel, true, 'panel');
  useEffect(() => {
    if (!present) return;
    return retainRemoteSurface(panel.current, 90);
  }, [present]);
  const capabilities = model.transport.capabilities;
  const fallback = <p role="status">{t('电脑插件管理界面尚未就绪，请检查插件连接。')}</p>;
  if (!mounted) return null;
  return createPortal(<section ref={panel} tabIndex={-1} className="remote-plugin-manager" role="region" aria-label={t('管理电脑插件')}>
    <header><h2>{t('管理电脑插件')}</h2><Button onClick={onClose}>{t('返回')}</Button></header>
    <div className="remote-plugin-manager-body">
      {capabilities?.management && capabilities.pluginOperationGeneration && <RemotePluginOperationHistory model={model} connected={state.connectionState === 'connected'}/>}
      {state.connectionState !== 'connected' ? <RemoteConnectionNotice state={state}/>
        : !capabilities?.management ? <p role="status">{t('请在电脑 DSH Mobile 插件中，为此设备授予管理权限。')}</p>
          : !capabilities.endpoints?.calls?.includes('pluginInventory/list') ? <p role="status">{t('请更新电脑插件和网关后管理插件。')}</p>
            : <RemotePluginManagerExtension fallback={fallback}/>}
    </div>
  </section>, document.body);
}

export function RemotePluginSettings({ model }) {
  const t = useTranslate();
  const state = useSyncExternalStore(model.subscribeView, model.getSnapshot);
  const endpointNotice = useSyncExternalStore(model.searchEndpoint.subscribeNotice, model.searchEndpoint.getNotice);
  if (state.connectionState !== 'connected') return <>
    <RemoteConnectionNotice state={state}/>
    {endpointNotice && <p role="status">{t(endpointNotice)}</p>}
  </>;
  if (!model.transport.capabilities?.management) return <p role="status">{t('请在电脑 DSH Mobile 插件中，为此设备授予管理权限。')}</p>;
  return <NativePanelFrame view="settings-content" flow><RemotePluginSettingsExtension/></NativePanelFrame>;
}

export function RemotePluginList({ plugins, layout }) {
  const t = useTranslate();
  useSyncExternalStore(layout.subscribe, layout.getSnapshot);
  const [error, setError] = useState('');
  const change = (id, value) => { try { layout.setUser(id, value); setError(''); } catch { setError('设置未保存，请重试。'); } };
  if (!plugins || plugins.state === 'loading') return <p role="status">{t("正在读取电脑插件…")}</p>;
  if (plugins.state === 'error') return <p role="alert">{t("插件连接已中断，请重新连接电脑后再试。")}</p>;
  return <div data-testid="remote-plugin-list">
    {error && <p role="alert">{t(error)}</p>}
    {!plugins.entries.length && <p>{t("电脑上没有可用的界面插件。")}</p>}
    {plugins.entries.map(entry => <div key={entry.id} data-plugin-id={entry.id} data-plugin-state={entry.state}>
      <div className="remote-plugin-row"><span>{entry.id.replace('@deepseek-ai/dsh-', '')}</span><small>{t(labels[entry.state])}</small></div>
      {(entry.reason || statusHelp[entry.state]) && <p className="muted">{t(entry.reason || statusHelp[entry.state])}</p>}
      {entry.state === 'waiting' && entry.missing?.length > 0 && <details className="remote-plugin-dependencies">
        <summary>{t('查看缺少的依赖')}</summary>
        <p className="muted">{t('可将以下依赖名称提供给插件作者排查。')}</p>
        <ul>{entry.missing.map(name => <li key={name}><code>{name}</code></li>)}</ul>
      </details>}
      {(entry.state !== 'mobile' || entry.id === workflowPluginId) && <div className="remote-plugin-layout">
        <button role="switch" aria-label={t('{name} 自适应', { name: entry.id })} aria-checked={layout.effective(entry.id)} onClick={() => change(entry.id, !layout.effective(entry.id))}>{t('自适应：{state}', { state: t(layout.effective(entry.id) ? '开启' : '关闭') })}</button>
        {layout.userValue(entry.id) !== undefined && <button onClick={() => change(entry.id, undefined)}>{t("恢复插件默认")}</button>}
      </div>}
    </div>)}
  </div>;
}
