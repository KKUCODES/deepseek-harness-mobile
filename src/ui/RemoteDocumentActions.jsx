import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@upstream/ui-primitives/src/Button.tsx';
import { downloadRemoteFile, shareRemoteFile, downloadError } from '../remote-download.mjs';
import { useTranslate } from './locale.jsx';
import { RemoteAttachmentFiles } from '../remote-attachments.mjs';

/** 文件标签的原预览器只负责显示；手机继续提供完整文件保存和系统分享。 */
export function RemoteDocumentActions({ file, model }) {
  // 同名附件和不同会话必须结束旧传输，不能沿用另一个文件的操作状态。
  const identity = JSON.stringify([file.sessionId, file.path, file.attachment?.kind, file.attachment?.attachmentId, file.attachment?.name]);
  return <FileTransferActions key={identity} file={file} model={model}/>;
}

function FileTransferActions({ file, model }) {
  const t = useTranslate(), active = useRef(null);
  const mounted = useRef(false);
  const files = useMemo(() => file.attachment ? new RemoteAttachmentFiles(model, file.attachment) : model.files,
    [model, file.attachment]);
  const [progress, setProgress] = useState(null), [notice, setNotice] = useState('');
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; active.current?.abort(); }; }, []);
  const save = async share => {
    if (active.current) return;
    const controller = new AbortController(); active.current = controller;
    const signal = AbortSignal.any([controller.signal, model.lifetime.signal]);
    const current = () => mounted.current && active.current === controller;
    setProgress({ bytes: 0, phase: 'reading', share }); setNotice('');
    try {
      await (share ? shareRemoteFile : downloadRemoteFile)({ files, client: model.client,
        sessionId: file.sessionId, path: file.path, signal,
        onProgress: value => { if (current() && !signal.aborted) setProgress({ ...value, share }); } });
      // 原生已完成交付时，迟到的取消不能抹去成功；离开文件后的结果则不再展示。
      if (current()) setNotice(share ? '已打开系统分享面板。' : '已保存到所选位置。');
    } catch (error) { if (current()) setNotice(downloadError(error, share ? '分享' : '下载')); }
    finally { if (current()) { active.current = null; setProgress(null); } }
  };
  return <div className="remote-file-preview-actions">
    <Button disabled={!!progress} onClick={() => void save(false)}>{t(file.diffs ? '下载最新完整文件' : '下载完整文件')}</Button>
    <Button disabled={!!progress} onClick={() => void save(true)}>{t(file.diffs ? '分享最新完整文件' : '分享完整文件')}</Button>
    {progress && <><span role="status">{t(progress.phase === 'saving' ? '请选择保存位置…' : progress.phase === 'sharing' ? '正在打开分享面板…' : progress.share ? '正在准备分享 · {size} KB' : '正在下载 · {size} KB', { size: (progress.bytes / 1024).toFixed(0) })}</span>
      <Button onClick={() => active.current?.abort()}>{t(progress.share ? '取消分享' : '取消下载')}</Button></>}
    {notice && <span role="status">{t(notice)}</span>}
  </div>;
}
