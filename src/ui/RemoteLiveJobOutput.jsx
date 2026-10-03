import React, { useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { Button } from '@upstream/ui-primitives/src/Button.tsx';
import { IconCloseOutline16 } from '@upstream/ui-primitives/src/icons/index.tsx';
import { parseAnsiLines } from '@upstream/ui-primitives/src/ansi.ts';
import { RemoteLiveJobOutput as Reader } from '../remote-live-job-output.mjs';
import { writeClipboard } from '../ordinary-clipboard.mjs';
import { Surface, IconButton } from './Surface.jsx';
import { FullscreenIcon } from './FullscreenIcon.jsx';
import { RemoteOfflineStatus } from './RemoteOfflineStatus.jsx';

import { useTranslate } from './locale.jsx';

function Output({ model, target, stream, mode, full }) {
  const t = useTranslate();
  const reader = useMemo(() => {
    const resume = model.jobOutputResume;
    return new Reader(model, target, stream, mode, resume?.target === target && resume.stream === stream && resume.mode === mode ? resume.reader : undefined);
  }, [model, target, stream, mode]);
  useEffect(() => {
    model.jobOutputResume = undefined;
    const capture = () => ({ target, stream, mode, full, reader: reader.checkpoint() });
    model.captureJobOutput = capture;
    return () => { if (model.captureJobOutput === capture) delete model.captureJobOutput; };
  }, [model, target, stream, mode, full, reader]);
  return <RemoteOutputContent reader={reader} mode={mode} label={t('独立任务输出')}/>;
}

/** 后台任务与前台命令共用显示和生命周期；调用方只提供具有准确身份的 reader。 */
export function RemoteOutputContent({ reader, mode, label }) {
  const t = useTranslate();
  const value = useSyncExternalStore(reader.subscribe, reader.getSnapshot);
  const [copied, setCopied] = useState('');
  const lines = useMemo(() => parseAnsiLines((value.ansiPrefix ?? '') + (value.ansiText ?? value.text)), [value.text, value.ansiText, value.ansiPrefix]);
  useEffect(() => { reader.start(); return () => reader.dispose(); }, [reader]);
  useEffect(() => { setCopied(''); }, [value.text]);
  return <>
    <p className="muted" role="status">{t(['paused', 'error'].includes(value.phase) ? '读取已暂停' : value.phase === 'ended' ? '输出已读完' : value.phase === 'reading' ? '正在读取…' : mode === 'live' ? '实时读取' : '按段查看')} · {t('{offset} / {total} 字节', { offset: value.offset.toLocaleString(), total: value.total.toLocaleString() })}</p>
    {value.phase === 'paused' && <p className="muted">{t('已保留上次读取的位置，点击“重新读取”继续。')}</p>}
    {value.gap && <p role="status">{t('部分早期输出已不再保留，以下显示电脑仍保存的内容。')}</p>}
    {value.trimmed && <p className="muted">{t('当前显示最近的输出。可选择“从头查看”分段读取早期内容。')}</p>}
    {value.error && <p role="alert">{t(value.error)}</p>}
    {['paused', 'error'].includes(value.phase) && <Button onClick={() => void reader.retry()}>{t('重新读取')}</Button>}
    {value.text ? <>
      <Button onClick={() => void writeClipboard(value.text).then(ok => setCopied(ok ? '已复制' : '复制失败，请重试'))}>{t(copied || '复制当前输出')}</Button>
      <pre className="remote-command-output" aria-label={label}>{lines.map((line, index) => <React.Fragment key={index}>{line.map((span, at) => <span key={at} style={span.style}>{span.text}</span>)}{index < lines.length - 1 ? '\n' : ''}</React.Fragment>)}</pre>
    </> : !value.error && <p>{t('还没有输出。')}</p>}
    {mode === 'history' && !['ended', 'unsupported', 'error', 'paused'].includes(value.phase) && <Button disabled={value.phase === 'reading'} onClick={() => void reader.read()}>{t('读取下一段')}</Button>}
  </>;
}

export function RemoteLiveJobOutput({ model, target, onClose }) {
  const t = useTranslate();
  const connected = useSyncExternalStore(model.subscribeView, model.getSnapshot).connectionState === 'connected';
  const resume = model.jobOutputResume?.target === target ? model.jobOutputResume : undefined;
  const [full, setFull] = useState(resume?.full ?? false), [stream, setStream] = useState(resume?.stream ?? 'stdout'), [mode, setMode] = useState(resume?.mode ?? 'live');
  return <Surface title={t('实时任务输出')} onClose={onClose} className={`remote-file-preview remote-command-preview${full ? ' is-fullscreen' : ''}`}>
    <header><h2>{t('任务输出')}</h2><div className="remote-file-header-actions">
      <IconButton label={t(full ? '缩小窗口' : '放大窗口')} onClick={() => setFull(value => !value)}><FullscreenIcon expanded={full}/></IconButton>
      <IconButton label={t('关闭任务输出')} onClick={onClose}><IconCloseOutline16/></IconButton>
    </div></header>
    <div className="remote-file-preview-body">
      <RemoteOfflineStatus model={model}/>
      <p className="remote-job-detail">{target.label || target.id}</p>
      <div role="group" aria-label={t('输出类型')}><Button disabled={!connected} variant={stream === 'stdout' ? 'primary' : 'ghost'} aria-pressed={stream === 'stdout'} onClick={() => setStream('stdout')}>{t('标准输出')}</Button><Button disabled={!connected} variant={stream === 'stderr' ? 'primary' : 'ghost'} aria-pressed={stream === 'stderr'} onClick={() => setStream('stderr')}>{t('错误输出')}</Button></div>
      <div role="group" aria-label={t('读取方式')}><Button disabled={!connected} variant={mode === 'live' ? 'primary' : 'ghost'} aria-pressed={mode === 'live'} onClick={() => setMode('live')}>{t('实时读取')}</Button><Button disabled={!connected} variant={mode === 'history' ? 'primary' : 'ghost'} aria-pressed={mode === 'history'} onClick={() => setMode('history')}>{t('从头查看')}</Button></div>
      <Output key={`${stream}:${mode}`} model={model} target={target} stream={stream} mode={mode} full={full}/>
    </div>
  </Surface>;
}
