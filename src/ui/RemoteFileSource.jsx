import React, { useLayoutEffect, useMemo, useRef } from 'react';
import { fileLine, fileLineRange } from '../remote-file-position.mjs';
import { useTranslate } from './locale.jsx';

export function RemoteFileSource({ text, line: requested }) {
  const t = useTranslate(), target = useRef(null);
  const line = fileLine(requested);
  const range = useMemo(() => fileLineRange(text, line), [text, line]);
  useLayoutEffect(() => {
    const row = target.current, body = row?.closest('.remote-file-preview-body');
    if (!row || !body) return;
    // 仅移动文件窗口，避免 scrollIntoView 同时带动背后的聊天记录。
    body.scrollTop += row.getBoundingClientRect().top - body.getBoundingClientRect().top - 16;
  }, [text, line]);
  return <>
    {line !== undefined && !range && <p role="status">{t('当前文件中没有第 {line} 行。', { line })}</p>}
    <pre tabIndex={0}>{range ? <>{text.slice(0, range.start)}<mark ref={target} className="remote-file-line-target" data-file-line={line} aria-label={t('第 {line} 行', { line })}>{text.slice(range.start, range.end)}</mark>{text.slice(range.end)}</> : text}</pre>
  </>;
}
