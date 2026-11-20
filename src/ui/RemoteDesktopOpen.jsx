import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Button } from '@upstream/ui-primitives/src/Button.tsx';
import { desktopRequest, desktopError, workspaceDesktopRequest, attachmentDesktopRequest, canRevealDesktopFile } from '../remote-desktop.mjs';

import { useTranslate } from './locale.jsx';

/**
 * 文件的电脑打开入口，负责读取电脑状态、二次确认与结果提示
 * @param model Remote 模型
 * @param file 当前文件坐标
 * @param autoPrepare 挂载后是否自动读取电脑状态
 * @param initialAction 初始动作类型
 * @param onBusyChange 忙碌状态变化回调
 * @param onCancel 取消确认时的回调
 * @param presentation 呈现形式：inline 内嵌触发按钮与确认组；panel 由外部菜单触发，确认用对话框、提示用状态条
 * @param actionsRef panel 模式下向外部暴露 open/reveal 触发器的 ref
 */
export function RemoteDesktopOpen({ model, file, autoPrepare = false, initialAction = 'open', onBusyChange, onCancel, presentation = 'inline', actionsRef }) {
  const t = useTranslate();
  const [host, setHost] = useState(null), [notice, setNotice] = useState(''), [busy, setBusy] = useState(false);
  const [action, setAction] = useState(initialAction);
  const canReveal = canRevealDesktopFile(model, file);
  const pending = useRef(null), lifetime = useRef(null), dialog = useRef(null);
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
  // 菜单项在组件外触发，每次渲染刷新触发器闭包以读取最新状态
  useEffect(() => {
    if (!actionsRef) return;
    actionsRef.current = { open: () => void run(false, 'open'), reveal: () => void run(false, 'reveal') };
    return () => { actionsRef.current = null; };
  });
  useLayoutEffect(() => {
    if (presentation !== 'panel') return;
    const node = dialog.current;
    if (!node) return;
    if (host && !node.open) node.showModal();
    else if (!host && node.open) node.close();
  }, [host, presentation]);
  const confirmTitle = t(action === 'reveal' ? '确认在电脑文件夹中显示' : '确认在电脑打开');
  const question = t(action === 'reveal' ? '在 {host} 的文件夹中显示 {file}？' : '在 {host} 上打开 {file}？', { host: host?.name || t('这台电脑'), file: host?.fileName || file.path.split(/[\\/]/).at(-1) });
  const explanation = t(action === 'reveal' ? '电脑将打开文件所在的文件夹。' : file.attachment ? '电脑将使用默认应用打开附件副本，不会修改聊天原件。副本为临时文件，如需保留修改请另存。' : '电脑将使用默认应用打开当前文件。');
  const cancel = () => { setHost(null); onCancel?.(); };
  if (presentation === 'panel') return <>
    {(busy || notice) && <div className="remote-panel-status-strip" role="status">{t(busy ? (host ? '正在请求电脑…' : '正在读取电脑状态…') : notice)}</div>}
    <dialog ref={dialog} className="remote-desktop-confirm" aria-label={confirmTitle}
      onCancel={event => { event.preventDefault(); cancel(); }}>
      <p>{question}</p>
      <p className="remote-desktop-confirm-sub">{explanation}</p>
      <div className="remote-desktop-confirm-actions">
        <Button variant="primary" disabled={busy} onClick={() => void run(true)}>{confirmTitle}</Button>
        <Button disabled={busy} onClick={cancel}>{t('取消')}</Button>
      </div>
    </dialog>
  </>;
  return <div className="remote-desktop-open">
    <Button disabled={busy} onClick={() => void run(false, 'open')}>{t('在电脑打开')}</Button>
    {canReveal && <Button disabled={busy} onClick={() => void run(false, 'reveal')}>{t('在电脑文件夹中显示')}</Button>}
    {host && <div role="group" aria-label={confirmTitle}><p>{question}{explanation}</p>
      <Button disabled={busy} onClick={() => void run(true)}>{confirmTitle}</Button>
      <Button disabled={busy} onClick={cancel}>{t('取消')}</Button>
    </div>}
    {busy && <p role="status">{t(host ? '正在请求电脑…' : '正在读取电脑状态…')}</p>}
    {notice && <p role="status">{t(notice)}</p>}
  </div>;
}
