import React, { useEffect, useMemo, useRef, useState } from 'react';
import { changesReviewAddress } from '@upstream/ui-deliverables/src/changes.ts';
import { DiffBlock } from '@upstream/ui-primitives/src/DiffBlock.tsx';
import { hunkRows, renderedHunks } from '@dshm/review-diff';
import { readChanges, changesError } from '../remote-changes.mjs';
import { Surface, IconButton } from './Surface.jsx';
import { useSurfacePresent } from './motion.jsx';
import { FullscreenIcon } from './FullscreenIcon.jsx';
import { IconCloseOutline16 } from '@upstream/ui-primitives/src/icons/index.tsx';
import { Button } from '@upstream/ui-primitives/src/Button.tsx';
import { RemoteDesktopOpen } from './RemoteDesktopOpen.jsx';

import { useTranslate } from './locale.jsx';

export function RemoteToolDiff({ diffs, compact = false }) {
  const t = useTranslate();
  const labels = { copy: t('复制差异'), copied: t('已复制'), collapseAria: t('收起差异'), expandAria: count => t('展开 {count} 行差异', { count }),
    collapse: t('收起'), expand: count => t('展开 {count} 行', { count }), files: count => t('{count} 个文件', { count }) };
  return <DiffBlock diffs={diffs} labels={labels} maxLines={compact ? 9 : 5000}/>;
}

function RecordedDiff({ diff }) {
  const t = useTranslate();
  const rendered = useMemo(() => diff.kind === 'text' ? renderedHunks(diff.hunks) : null, [diff]);
  if (diff.kind !== 'text') return <p>{t(diff.kind === 'binary' ? '这是二进制文件，无法显示文字差异。' : '文件较大，电脑未保留可预览的文字差异。')}</p>;
  return <div className="remote-recorded-diff">
    {!diff.before && <p>{t('本轮新建文件')}</p>}{!diff.after && <p>{t('本轮删除文件')}</p>}
    {diff.coarse && <p>{t('电脑使用整段替换显示本次改动。')}</p>}
    {rendered.truncated && <p>{t('当前显示前 5000 行差异。')}</p>}
    {!diff.hunks.length && <p>{t('内容没有变化')}</p>}
    {rendered.hunks.map((hunk, index) => <section key={index}>
      <div className="remote-diff-range">@@ -{hunk.oldStart},{hunk.oldLines} +{hunk.newStart},{hunk.newLines} @@</div>
      {hunkRows(hunk).map((row, at) => <div key={at} className={`remote-diff-line ${row.kind}`} data-diff-line={row.kind}>
        <span aria-hidden="true">{row.old}</span><span aria-hidden="true">{row.new}</span><code>{row.kind === 'add' ? '+' : row.kind === 'del' ? '−' : ' '}{row.text}</code>
      </div>)}
    </section>)}
  </div>;
}

export function RemoteChangesPreview({ file, model, onClose, onCurrent }) {
  if (model.reviewPreview) return <RemoteReviewRequest file={file} model={model} onClose={onClose}/>;
  return <LegacyChangesPreview file={file} model={model} onClose={onClose} onCurrent={onCurrent}/>;
}

function RemoteReviewRequest({ file, model, onClose }) {
  const opened = useRef(false);
  useEffect(() => {
    if (opened.current) return;
    opened.current = true;
    model.pluginPanels.openResource(changesReviewAddress(file), { params: { index: file.index ?? 0 } });
    onClose();
  }, [file, model, onClose]);
  return null;
}

function LegacyChangesPreview({ file, model, onClose, onCurrent }) {
  const t = useTranslate();
  const present = useSurfacePresent();
  const [summary, setSummary] = useState(null), [index, setIndex] = useState(0), [diff, setDiff] = useState(null);
  const [error, setError] = useState(''), [revision, setRevision] = useState(0), [full, setFull] = useState(false);
  useEffect(() => {
    if (!present) return;
    const controller = new AbortController(), signal = AbortSignal.any([controller.signal, model.lifetime.signal]);
    setSummary(null); setDiff(null); setError('');
    void readChanges(model, file, signal).then(value => {
      if (value.turn !== file.turn) throw new Error('remote_changes_invalid');
      if (!signal.aborted) { setSummary(value); setIndex(current => current < value.files.length ? current : 0); }
    }).catch(reason => { if (!signal.aborted) setError(changesError(reason)); });
    return () => controller.abort();
  }, [file, model, revision, present]);
  useEffect(() => {
    if (!present) return;
    setDiff(null);
    if (!summary?.files[index]) return;
    const controller = new AbortController(), signal = AbortSignal.any([controller.signal, model.lifetime.signal]);
    setError('');
    void readChanges(model, { ...file, index }, signal).then(value => {
      if (value.path !== summary.files[index].path) throw new Error('remote_changes_invalid');
      if (!signal.aborted) setDiff(value);
    }).catch(reason => { if (!signal.aborted) setError(changesError(reason)); });
    return () => controller.abort();
  }, [summary, index, file, model, present]);
  return <Surface title={t('本轮文件改动')} onClose={onClose} className={`remote-file-preview${full ? ' is-fullscreen' : ''}`}>
    <header><h2>{t('第 {turn} 轮改动', { turn: file.turn })}</h2><div className="remote-file-header-actions">
      <IconButton label={t(full ? '缩小窗口' : '放大窗口')} onClick={() => setFull(value => !value)}><FullscreenIcon expanded={full}/></IconButton>
      <IconButton label={t('关闭改动预览')} onClick={onClose}><IconCloseOutline16/></IconButton></div></header>
    <div className="remote-file-preview-actions"><span>{t('本轮开始与结束时的差异')}</span><Button onClick={() => setRevision(value => value + 1)}>{t('重新读取')}</Button></div>
    {summary && <><label className="remote-diff-selector">{t('文件')}<select aria-label={t('选择改动文件')} value={index} onChange={event => setIndex(Number(event.target.value))}>
      {summary.files.map((item, at) => <option value={at} key={at}>{item.display.split(/[\\/]/).at(-1)} (+{item.added} −{item.deleted})</option>)}</select></label>
      {summary.files[index] && <p className="remote-diff-path">{summary.files[index].display}</p>}
      {summary.total > summary.files.length && <p>{t('电脑列出了 {total} 个改动文件中的 {count} 个。', { total: summary.total, count: summary.files.length })}</p>}
      {summary.files[index] && <><Button onClick={() => onCurrent(summary.files[index].path, index)}>{t('查看最新完整文件')}</Button>
        {model.transport.capabilities?.desktopOpen && <RemoteDesktopOpen key={`${file.sessionId}:${file.seq}:${index}`} model={model}
          file={{ sessionId: file.sessionId, path: summary.files[index].path, desktopSource: { source: 'changes', seq: file.seq, index } }}/>}</>}
    </>}
    <div className="remote-file-preview-body">{error ? <p role="alert">{t(error)}</p> : diff ? <RecordedDiff diff={diff}/>
      : summary?.files.length === 0 ? <p>{t('本轮没有文件改动')}</p> : <p role="status">{t('正在读取改动…')}</p>}</div>
  </Surface>;
}
