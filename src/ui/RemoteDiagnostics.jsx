import React, { createContext, useContext, useEffect, useState } from 'react';
import { Surface } from './Surface.jsx';
import { DesignButton, DesignIconButton } from './system/Primitives.jsx';
import { diagnosticRecord, diagnosticView } from '../remote-diagnostics.mjs';
import { useLocale, useTranslate } from './locale.jsx';
import { IconCloseOutline16 } from '@upstream/ui-primitives/src/icons/index.tsx';
import './remote-diagnostics.css';

export const RemoteDiagnosticsContext = createContext(null);
export const useRemoteDiagnostics = () => useContext(RemoteDiagnosticsContext);

/** Only the host-owned connection prompt gets this link; plugin content and composer slots stay untouched. */
export function RemoteDiagnosticEntry({ failure, phase = 'reading' }) {
  const diagnostics = useRemoteDiagnostics(), t = useTranslate();
  if (!diagnostics) return null;
  return <button type="button" className="dshm-diagnostic-link" onClick={async () => {
    const record = failure ? await diagnostics.store.capture({ message: failure }, phase, false) : diagnostics.latest;
    diagnostics.open(record?.id ?? 'recent');
  }}>
    {t('查看诊断详情')}<span aria-hidden="true">›</span>
  </button>;
}

export function RemoteDiagnosticSheet({ store, records, selection, onSelect, onClose, onEnvironment }) {
  const t = useTranslate(), locale = useLocale();
  const [expanded, setExpanded] = useState(false), [copying, setCopying] = useState(false), [feedback, setFeedback] = useState('');
  const record = selection === 'recent' ? null : records.find(record => record.id === selection);
  const view = diagnosticView(record);
  useEffect(() => { setExpanded(false); setFeedback(''); }, [selection]);
  useEffect(() => { if (!feedback) return; const timer = setTimeout(() => setFeedback(''), 2200); return () => clearTimeout(timer); }, [feedback]);
  const when = value => new Date(value).toLocaleString(locale?.startsWith('en') ? 'en' : 'zh-CN');
  const close = () => selection !== 'recent' && records.length ? onSelect('recent') : onClose();
  const stack = record?.exceptions.flatMap((cause, index) => [`${index ? 'Caused by: ' : ''}${cause.type}`, ...cause.frames.map(frame => `  ${frame}`)]).join('\n');
  const copy = async () => {
    setCopying(true); setFeedback('');
    try {
      // Re-project even the local record before exporting; never copy a model, Error or raw bridge payload.
      const safe = diagnosticRecord(record);
      await store.client.call('clipboard.write', { text: JSON.stringify({ format: 'dshm-connection-diagnostic', version: 1, record: safe }, null, 2) });
      setFeedback('诊断信息已复制');
    } catch { setFeedback('复制未完成，请重试。'); }
    finally { setCopying(false); }
  };
  return <Surface title={t(record ? '诊断详情' : '最近诊断')} onClose={onClose} className="dshm-design remote-diagnostic-sheet">
    <div className="remote-diagnostic-handle" aria-hidden="true"/>
    <header><h2>{t(record ? '诊断详情' : '最近诊断')}</h2><DesignIconButton label={t('关闭窗口')} onClick={onClose}><IconCloseOutline16/></DesignIconButton></header>
    <div className="remote-diagnostic-content">
      {record ? <>
        <p className="remote-diagnostic-time">{when(record.at)} · {record.httpStatus ? `HTTP ${record.httpStatus}` : record.closeCode ? `${t('关闭码')} ${record.closeCode}` : record.code}
          {record.resolvedAt && <span className="remote-diagnostic-resolved"> · {t('已恢复')}</span>}</p>
        <section className="remote-diagnostic-summary"><h3>{t(view.title)}</h3><p>{t(view.descriptionKey, view.values)}</p></section>
        <dl><dt>{t('失败阶段')}</dt><dd>{t(view.phase)}</dd><dt>{t('来源')}</dt><dd>{t(record.source === 'notifications' ? 'Remote 提醒连接' : 'Remote 聊天连接')}</dd></dl>
        <p>{t(record.resolvedAt ? '当前连接已恢复，此记录保留用于排查此前的问题。' : view.suggestion)}</p>
        <button className="remote-diagnostic-toggle" type="button" aria-expanded={expanded} onClick={() => setExpanded(value => !value)}>
          <strong>{t('技术详情')}</strong><span>{t(expanded ? '收起' : '展开')} {expanded ? '⌃' : '⌄'}</span>
        </button>
        {expanded && <><code className="remote-diagnostic-code">{record.code}{record.closeReason ? ` · ${record.closeReason}` : ''}</code>
          <pre className="remote-diagnostic-stack" data-testid="remote-diagnostic-stack" tabIndex={0}>{stack || t('此事件未提供异常栈。可查看错误码和失败阶段。')}</pre></>}
      </> : <>
        <p className="remote-diagnostic-time">{t('仅保留本机最近的诊断记录')}</p>
        {!records.length && <p>{t('暂无连接诊断记录')}</p>}
        <div className="remote-diagnostic-records">{records.map(item => <button key={item.id} type="button" onClick={() => onSelect(item.id)}>
          <span><strong>{t(diagnosticView(item).title)}</strong><small>{when(item.at)} · {item.httpStatus ? `HTTP ${item.httpStatus}` : item.code}</small></span>
          {item.resolvedAt && <span className="remote-diagnostic-resolved">{t('已恢复')}</span>}<span aria-hidden="true">›</span>
        </button>)}</div>
      </>}
    </div>
    <footer>
      {record ? <><p className="remote-diagnostic-time">{t('复制的信息已脱敏，不含凭据或聊天内容')}</p>
        <DesignButton onClick={copy} loading={copying}>{t('复制诊断信息')}</DesignButton>
        <button className="dshm-diagnostic-link" onClick={close}>{t('查看最近诊断')}</button></>
        : <><DesignButton onClick={onClose}>{t('完成')}</DesignButton><button className="dshm-diagnostic-link" onClick={onEnvironment}>{t('应用与兼容信息')}</button></>}
      {feedback && <p className="remote-diagnostic-feedback" role="status">{t(feedback)}</p>}
    </footer>
  </Surface>;
}
