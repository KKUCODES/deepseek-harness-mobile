import React, { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { Button } from '@upstream/ui-primitives/src/Button.tsx';
import { zh, en } from '../../../deepseek-harness/packages/client/ui-open-in-app/src/client/locales.ts';
import { useLocale, useTranslate } from './locale.jsx';
import { RemoteConnectionNotice } from './RemoteConnectionNotice.jsx';
import { desktopAppsRequest, desktopAppsError } from '../remote-desktop-apps.mjs';
import { DesktopAppIcon, useDesktopAppIcons } from './RemoteDesktopAppIcons.jsx';

export function RemoteDesktopApps({ model, sessionId, initialAppId }) {
  const t = useTranslate(), locale = useLocale();
  const state = useSyncExternalStore(model.subscribeView, model.getSnapshot);
  const connected = state.connectionState === 'connected', supported = model.transport.capabilities?.desktopApps === true;
  const [catalog, setCatalog] = useState(null), [prepared, setPrepared] = useState(null);
  const iconUrl = useDesktopAppIcons(model, sessionId, catalog?.apps);
  const [busy, setBusy] = useState(false), [notice, setNotice] = useState('');
  const active = useRef(null), mounted = useRef(true);
  const generation = model.transport.generation;
  const label = id => (locale === 'en' ? en : zh)[`app.${id}`] ?? id;
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; active.current?.abort(); }; }, []);
  useEffect(() => { active.current?.abort(); active.current = null; setBusy(false); setCatalog(null); setPrepared(null); }, [connected, generation, sessionId]);
  const run = async (action, value) => {
    if (active.current) return;
    const controller = new AbortController(); active.current = controller; setBusy(true); setNotice('');
    if (action === 'open') setPrepared(null);
    try {
      const result = await desktopAppsRequest(model, sessionId, action, value, controller.signal);
      if (!mounted.current || active.current !== controller) return;
      if (action === 'list') {
        setCatalog(result); setPrepared(null);
        if (initialAppId && result.apps.includes(initialAppId)) {
          const confirmation = await desktopAppsRequest(model, sessionId, 'prepare', initialAppId, controller.signal);
          if (mounted.current && active.current === controller) setPrepared(confirmation);
        }
      }
      else if (action === 'prepare') setPrepared(result);
      else setNotice('已向电脑发送打开请求。');
    } catch (error) { if (mounted.current && active.current === controller) { setPrepared(null); setNotice(desktopAppsError(error, action === 'open')); } }
    finally { if (active.current === controller) { active.current = null; if (mounted.current) setBusy(false); } }
  };
  useEffect(() => { if (connected && supported) void run('list'); }, [connected, supported, generation, sessionId]);
  return <section data-testid="remote-desktop-apps">
    <p>{t('选择电脑上的应用打开当前会话的工作区。')}</p>
    {!connected ? <RemoteConnectionNotice state={state}/> : !supported ? <p role="status">{t(desktopAppsError(new Error('remote_desktop_unavailable')))}</p> : null}
    {connected && supported && <>
      {prepared ? <>
        <p>{t('即将在「{computer}」上使用「{app}」打开：', { computer: prepared.name, app: label(prepared.appId) })}</p>
        <p className="remote-file-path" style={{ overflowWrap: 'anywhere' }}>{prepared.workspacePath}</p>
        <div className="remote-file-preview-actions">
          <Button disabled={busy} onClick={() => setPrepared(null)}>{t('取消')}</Button>
          <Button variant="primary" disabled={busy} onClick={() => void run('open', prepared)}>{t('确认在电脑打开')}</Button>
        </div>
      </> : <>
        {catalog && <p style={{ overflowWrap: 'anywhere' }}>{catalog.name}<br/>{catalog.workspacePath}</p>}
        {catalog?.apps.map(id => <Button className="option" key={id} disabled={busy} onClick={() => void run('prepare', id)}><DesktopAppIcon appId={id} url={iconUrl(id)}/>{label(id)}</Button>)}
        {catalog?.apps.length === 0 && <p>{t('电脑上没有可用的应用。')}</p>}
        <Button disabled={busy} onClick={() => void run('list')}>{t('重新读取')}</Button>
      </>}
    </>}
    {busy && <p role="status">{t('正在处理…')}</p>}
    {notice && <p role="status">{t(notice)}</p>}
  </section>;
}
