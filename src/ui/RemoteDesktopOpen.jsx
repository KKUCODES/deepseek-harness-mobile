import React, { useEffect, useRef, useState } from 'react';
import { Button } from '@upstream/ui-primitives/src/Button.tsx';
import { desktopRequest, desktopError, workspaceDesktopRequest, attachmentDesktopRequest } from '../remote-desktop.mjs';

import { useTranslate } from './locale.jsx';

export function RemoteDesktopOpen({ model, file, autoPrepare = false, initialAction = 'open', onBusyChange, onCancel }) {
  const t = useTranslate();
  const [host, setHost] = useState(null), [notice, setNotice] = useState(''), [busy, setBusy] = useState(false);
  const [action, setAction] = useState(initialAction);
  const canReveal = file.desktopSource?.source === 'presented' && model.transport.capabilities?.desktopReveal;
  const pending = useRef(null), lifetime = useRef(null);
  const prepared = useRef(false);
  useEffect(() => {
    const controller = new AbortController(); lifetime.current = controller;
    return () => controller.abort();
  }, []);
  const run = async (opening, requestedAction = action) => {
    if (pending.current) return;
    const signal = AbortSignal.any([lifetime.current.signal, model.lifetime.signal]);
    pending.current = true; setBusy(true); setNotice('');
    try {
      if (requestedAction === 'reveal' && !canReveal) throw new Error('remote_desktop_unavailable');
      setAction(requestedAction);
      const value = file.attachment ? await attachmentDesktopRequest(model, file, opening ? host : null, signal) : file.desktopSource
        ? await desktopRequest(model, opening ? { ...file.desktopSource, sessionId: file.sessionId, action: requestedAction } : null, signal)
        : await workspaceDesktopRequest(model, file, opening ? host : null, signal);
      if (opening) { setHost(null); setNotice(requestedAction === 'reveal' ? '已请求电脑在文件夹中显示。' : '已请求电脑打开文件。'); }
      else if (value.available) setHost(value);
      else setNotice('这台电脑当前无法打开桌面应用。');
    } catch (error) { if (!signal.aborted) { setHost(null); setNotice(desktopError(error, opening)); } }
    finally { pending.current = null; if (!signal.aborted) setBusy(false); }
  };
  useEffect(() => {
    if (autoPrepare && !prepared.current) { prepared.current = true; void run(false); }
  }, [autoPrepare]);
  useEffect(() => { onBusyChange?.(busy); return () => onBusyChange?.(false); }, [busy, onBusyChange]);
  return <div className="remote-desktop-open">
    <Button disabled={busy} onClick={() => void run(false, 'open')}>{t('在电脑打开')}</Button>
    {canReveal && <Button disabled={busy} onClick={() => void run(false, 'reveal')}>{t('在电脑文件夹中显示')}</Button>}
    {host && <div role="group" aria-label={t(action === 'reveal' ? '确认在电脑文件夹中显示' : '确认在电脑打开')}><p>{t(action === 'reveal' ? '在 {host} 的文件夹中显示 {file}？' : '在 {host} 上打开 {file}？', { host: host.name || t('这台电脑'), file: host.fileName || file.path.split(/[\\/]/).at(-1) })}{t(action === 'reveal' ? '电脑将打开文件所在的文件夹。' : file.attachment ? '电脑将使用默认应用打开附件副本，不会修改聊天原件。副本为临时文件，如需保留修改请另存。' : '电脑将使用默认应用打开当前文件。')}</p>
      <Button disabled={busy} onClick={() => void run(true)}>{t(action === 'reveal' ? '确认在电脑文件夹中显示' : '确认在电脑打开')}</Button>
      <Button disabled={busy} onClick={() => { setHost(null); onCancel?.(); }}>{t('取消')}</Button>
    </div>}
    {busy && <p role="status">{t(host ? '正在请求电脑…' : '正在读取电脑状态…')}</p>}
    {notice && <p role="status">{t(notice)}</p>}
  </div>;
}
