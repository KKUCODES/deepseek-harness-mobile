import { useEffect, useState, useSyncExternalStore } from 'react';
import { desktopAppsRequest } from '../remote-desktop-apps.mjs';

export const genericDesktopAppIcon = 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#777" stroke-width="1.8"><rect x="3" y="3" width="18" height="18" rx="5"/></svg>');

/** 顺序读取小图标；关闭/切换/断线取消，旧连接图标不会带到新电脑。 */
export function useDesktopAppIcons(model, sessionId, apps) {
  const state = useSyncExternalStore(model.subscribeView, model.getSnapshot);
  const available = state.connectionState === 'connected' && state.selected === sessionId && model.transport.capabilities?.desktopAppIcons === true;
  const key = `${sessionId}:${model.transport.generation}:${available}:${(apps ?? []).join(',')}`;
  const [loaded, setLoaded] = useState({ key: '', values: {} });
  useEffect(() => {
    const controller = new AbortController(); setLoaded({ key, values: {} });
    if (available) void (async () => {
      for (const appId of apps ?? []) {
        if (controller.signal.aborted) break;
        try {
          const url = await desktopAppsRequest(model, sessionId, 'icon', appId, controller.signal);
          if (!controller.signal.aborted && url) setLoaded(previous => previous.key === key
            ? { key, values: { ...previous.values, [appId]: url } } : previous);
        } catch { /* 图标不可用保留原通用图形，不阻止应用选择。 */ }
      }
    })();
    return () => controller.abort();
  }, [model, key]);
  return id => loaded.key === key ? loaded.values[id] ?? genericDesktopAppIcon : genericDesktopAppIcon;
}

export function DesktopAppIcon({ appId, url }) {
  return <img data-desktop-app-icon={appId} src={url} width="20" height="20" alt="" aria-hidden="true"
    style={{ flex: 'none', objectFit: 'contain' }} onError={event => { if (event.currentTarget.src !== genericDesktopAppIcon) event.currentTarget.src = genericDesktopAppIcon; }}/>;
}
