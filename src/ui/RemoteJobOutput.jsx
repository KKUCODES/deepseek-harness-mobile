import React, { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { Button } from '@upstream/ui-primitives/src/Button.tsx';
import { IconCloseOutline16 } from '@upstream/ui-primitives/src/icons/index.tsx';
import { parseAnsiLines } from '@upstream/ui-primitives/src/ansi.ts';
import { markdownPages } from '../remote-markdown-pages.mjs';
import { useVirtualizer } from '@tanstack/react-virtual';
import { writeClipboard } from '../ordinary-clipboard.mjs';
import { jobOutputRecords } from '../remote-job-output.mjs';
import { loadRemoteHistory } from '../remote-history.mjs';
import { Surface, IconButton } from './Surface.jsx';
import { FullscreenIcon } from './FullscreenIcon.jsx';
import { useSurfacePresent } from './motion.jsx';

import { useLocale, useTranslate } from './locale.jsx';

function OutputRecord({ record }) {
  const t = useTranslate(), locale = useLocale();
  const pages = useMemo(() => markdownPages(record.text, 6000), [record.text]);
  const [selected, setSelected] = useState(0);
  const page = Math.min(selected, Math.max(0, pages.length - 1));
  const lines = useMemo(() => parseAnsiLines(pages[page] ?? ''), [pages, page]);
  const [copied, setCopied] = useState('');
  useEffect(() => { setCopied(''); }, [record.text]);
  const visibleLines = lines;
  return <article className="remote-job-output-record" aria-label={t('任务输出记录')}>
    <div className="remote-job-heading"><time>{new Date(record.started).toLocaleString(locale?.startsWith('en') ? 'en' : 'zh-CN')}</time><span>{t(!record.settled ? '正在读取' : record.interrupted ? '读取已停止' : record.failed ? '读取失败' : '已记录')}</span></div>
    {record.text ? <>
      <Button onClick={() => void writeClipboard(record.text).then(ok => setCopied(ok ? '已复制' : '复制失败，请重试'))}>{t(copied || '复制这段输出')}</Button>
      <pre className="remote-command-output">{visibleLines.map((line, index) => <React.Fragment key={index}>{line.map((span, at) => <span key={at} style={span.style}>{span.text}</span>)}{index < visibleLines.length - 1 ? '\n' : ''}</React.Fragment>)}</pre>
      {pages.length > 1 && <div className="remote-history-navigation" aria-label={t('长内容分页')}>
        <Button disabled={!page} onClick={() => setSelected(page - 1)}>{t('上一段')}</Button>
        <span>{t('第 {page} / {total} 段', { page: page + 1, total: pages.length })}</span>
        <Button disabled={page === pages.length - 1} onClick={() => setSelected(page + 1)}>{t('下一段')}</Button>
      </div>}
    </> : <p>{record.error || t(record.settled ? '这次读取没有文本输出。' : '等待电脑返回输出…')}</p>}
  </article>;
}

export function RemoteJobOutput({ model, target, onClose }) {
  const t = useTranslate();
  const present = useSurfacePresent();
  const state = useSyncExternalStore(model.subscribeView, model.getSnapshot);
  const [full, setFull] = useState(false), [error, setError] = useState(''), [loading, setLoading] = useState(false);
  const requestRef = useRef(null);
  const body = useRef(null), list = useRef(null);
  const [margin, setMargin] = useState(0);
  useEffect(() => () => { requestRef.current = null; }, [model, target, present]);
  const records = useMemo(() => jobOutputRecords(state, target.sessionId, target), [state.selected, state.list, state.conversation, target]);
  const virtual = useVirtualizer({ count: records?.length ?? 0, getScrollElement: () => body.current,
    getItemKey: index => records[index].key, estimateSize: () => 240, overscan: 1, scrollMargin: margin });
  useEffect(() => {
    if (body.current && list.current) setMargin(list.current.getBoundingClientRect().top - body.current.getBoundingClientRect().top + body.current.scrollTop);
  }, [records, error, full]);
  const loadHistory = async direction => {
    const reference = model.reference;
    if (!reference || reference.sessionId !== target.sessionId || loading || requestRef.current) return;
    const request = {}, generation = model.connection.generation.getSnapshot();
    requestRef.current = request;
    const isCurrent = () => requestRef.current === request && model.reference === reference && model.connection.generation.getSnapshot() === generation;
    setLoading(true); setError('');
    try { await (direction === 'newer' ? reference.binding.history.newer() : loadRemoteHistory(reference.binding, { isCurrent })); }
    catch (failure) { if (isCurrent()) setError(failure.message); }
    finally { if (requestRef.current === request) { requestRef.current = null; setLoading(false); } }
  };
  return <Surface title={t('后台任务输出')} onClose={onClose} className={`remote-file-preview remote-command-preview${full ? ' is-fullscreen' : ''}`}>
    <header><h2>{t('后台任务输出')}</h2><div className="remote-file-header-actions">
      <IconButton label={t(full ? '缩小窗口' : '放大窗口')} onClick={() => setFull(value => !value)}><FullscreenIcon expanded={full}/></IconButton>
      <IconButton label={t('关闭任务输出')} onClick={onClose}><IconCloseOutline16/></IconButton></div></header>
    <div ref={body} className="remote-file-preview-body">
      <p className="remote-job-detail">{target.label || target.id}</p>
      <p className="muted">{t('显示电脑已写入聊天的输出，保留每次读取的内容和状态。缺失或被截断的部分无法在这里恢复。')}</p>
      {state.connectionState !== 'connected' && <p role="status">{t('连接已断开，以下为最近收到的输出记录。')}</p>}
      {error && <p role="alert">{t(error)}</p>}
      {records === null ? <p role="status">{t('任务已变化，请返回任务列表重新查看。')}</p> : <>
        {state.session?.hasMore && <Button disabled={loading || state.session.loadingOlder || state.connectionState !== 'connected'} onClick={() => void loadHistory('older')}>{t('加载更早的输出记录')}</Button>}
        {state.session?.history?.hasNewer && <div className="remote-history-navigation">
          <Button disabled={loading || state.session.loadingOlder || state.connectionState !== 'connected'} onClick={() => void loadHistory('newer')}>{t('加载较新的消息')}</Button>
          <Button onClick={() => model.reference.binding.history.latest()}>{t('返回最新消息')}</Button>
        </div>}
        {!records.length && <p role="status">{t('还没有找到输出记录。电脑读取任务输出后会同步到这里。')}</p>}
        <div ref={list} style={{ height: virtual.getTotalSize(), position: 'relative' }}>
          {virtual.getVirtualItems().map(item => <div key={item.key} data-index={item.index} ref={virtual.measureElement}
            style={{ position: 'absolute', top: 0, width: '100%', transform: `translateY(${item.start - margin}px)` }}>
            <OutputRecord record={records[item.index]}/>
          </div>)}
        </div>
      </>}
    </div>
  </Surface>;
}
