import React, { useEffect, useState, useSyncExternalStore } from 'react';
import { createSnapshotStore } from '@deepseek-ai/dsh-client-store';
import { OpenInAppAction } from '@dshm/desktop-app-action';
import { zh, en } from '@upstream/ui-open-in-app/src/client/locales.ts';
import { IconCloseOutline16 } from '@upstream/ui-primitives/src/icons/index.tsx';
import { desktopAppsRequest } from '../remote-desktop-apps.mjs';
import { RemoteDesktopApps } from './RemoteDesktopApps.jsx';
import { Surface, IconButton } from './Surface.jsx';
import { useLocale, useTranslate } from './locale.jsx';
import { MobilePluginFrame } from './MobilePluginFrame.jsx';
import { useDesktopAppIcons } from './RemoteDesktopAppIcons.jsx';

const pluginId = '@deepseek-ai/dsh-client-ui-open-in-app';
// 与原按钮一样只记住应用ID；下一台电脑仍只从其实际应用目录选择。
const choice = createSnapshotStore('', { persist: { name: 'dshm.remote.desktop-app-choice.v1' } });

/** 保留原局部按钮/菜单，仅把网络动作交给手机固定协议与共用确认页。 */
export function RemoteDesktopAppAction({ model, sessionId }) {
  const state = useSyncExternalStore(model.subscribeView, model.getSnapshot);
  const currentChoice = useSyncExternalStore(choice.subscribe, choice.getSnapshot);
  const locale = useLocale(), translate = useTranslate(), dictionary = locale === 'en' ? en : zh;
  const [catalog, setCatalog] = useState(null), [target, setTarget] = useState(null);
  const iconUrl = useDesktopAppIcons(model, sessionId, catalog?.apps);
  const generation = model.transport.generation;
  const enabled = state.connectionState === 'connected' && model.transport.capabilities?.desktopApps === true
    && state.plugins?.entries?.some(entry => entry.id === pluginId && entry.state === 'mobile');
  useEffect(() => {
    setCatalog(null); setTarget(null);
    if (!enabled) return;
    const controller = new AbortController();
    void desktopAppsRequest(model, sessionId, 'list', undefined, controller.signal)
      .then(value => { if (!controller.signal.aborted) setCatalog(value); }, () => {});
    return () => controller.abort();
  }, [model, sessionId, enabled, generation]);
  if (!enabled || !catalog) return null;
  const t = (key, values) => (dictionary[key] ?? key).replace('{app}', values?.app ?? '');
  return <div data-remote-desktop-app-action>
    <MobilePluginFrame id={pluginId} layout={model.pluginSlots.layout}>
    <OpenInAppAction sessionId={sessionId} t={t}
      useSessions={select => select({ byId: { [sessionId]: { cwd: catalog.workspacePath } } })}
      useOpenInAppApps={select => select(catalog.apps)} useOpenInAppChoice={select => select(currentChoice)}
      choose={id => choice.set(id)} iconUrl={iconUrl}
      launch={async (appId, _displayPath) => {
        // 原组件的显示路径不是授权；确认页按当前会话重新向电脑准备快照。
        if (model.getSnapshot().selected === sessionId && catalog.apps.includes(appId)) setTarget({ appId, id: crypto.randomUUID() });
      }}/>
    </MobilePluginFrame>
    {target && <Surface kind="sheet" title={translate('在电脑应用中打开')} onClose={() => setTarget(null)}>
      <header><h2>{translate('在电脑应用中打开')}</h2><IconButton label={translate('关闭窗口')} onClick={() => setTarget(null)}><IconCloseOutline16/></IconButton></header>
      <RemoteDesktopApps key={target.id} model={model} sessionId={sessionId} initialAppId={target.appId}/>
    </Surface>}
  </div>;
}
