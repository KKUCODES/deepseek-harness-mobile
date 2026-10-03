import React, { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { useTranslate } from './locale.jsx';
import { Button } from '@upstream/ui-primitives/src/Button.tsx';
import { downloadSessionExport, sessionExportError } from '../remote-session-export.mjs';
import { RemoteConnectionNotice } from './RemoteConnectionNotice.jsx';

export function RemoteSessionExport({ model, sessionId }) {
  const t = useTranslate();
  const state = useSyncExternalStore(model.subscribeView, model.getSnapshot);
  const connected = state.connectionState === 'connected';
  const supported = model.transport.capabilities?.sessionExport === true;
  const [includeDescendants, setIncludeDescendants] = useState(false);
  const [progress, setProgress] = useState(null), [notice, setNotice] = useState('');
  const active = useRef(null), mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; active.current?.abort(); }; }, []);
  const save = async () => {
    if (active.current || model.getSnapshot().connectionState !== 'connected' || model.transport.capabilities?.sessionExport !== true) return;
    const controller = new AbortController(); active.current = controller;
    setNotice(''); setProgress({ phase: 'reading', bytes: 0 });
    try {
      await downloadSessionExport({ model, sessionId, includeDescendants,
        signal: AbortSignal.any([controller.signal, model.lifetime.signal]),
        onProgress: value => { if (mounted.current) setProgress(value); } });
      if (mounted.current) setNotice('日志已保存到所选位置。');
    } catch (error) { if (mounted.current) setNotice(sessionExportError(error)); }
    finally { active.current = null; if (mounted.current) setProgress(null); }
  };
  return <section>
    <p>{t("将当前会话的原始记录和附件保存为 ZIP 文件，用于备份或排查问题。日志可能包含聊天中的私人信息。")}</p>
    <p><label><input type="checkbox" checked={includeDescendants} disabled={!!progress} onChange={event => setIncludeDescendants(event.target.checked)}/>{t(" 包含子会话")}</label></p>
    {!connected ? <RemoteConnectionNotice state={state}/>
      : !supported && <p role="status">{t("请更新电脑远程插件和网关后导出日志。")}</p>}
    <Button variant="primary" disabled={!!progress || !connected || !supported} onClick={() => void save()}>{t("导出并保存")}</Button>
    {progress && <div className="remote-file-preview-actions"><span role="status">{progress.phase === 'saving' ? t('请选择保存位置…') : t('正在导出 · {size} KB', { size: (progress.bytes / 1024).toFixed(0) })}</span><Button onClick={() => active.current?.abort()}>{t("取消导出")}</Button></div>}
    {notice && <p role="status">{t(notice)}</p>}
  </section>;
}
