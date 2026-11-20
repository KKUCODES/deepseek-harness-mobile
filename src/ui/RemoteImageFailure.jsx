import React, { useEffect, useRef, useState } from 'react';
import { IconRefreshOutline16 } from '@upstream/ui-primitives/src/icons/index.tsx';
import { useTranslate } from './locale.jsx';
import { imageFailureReason } from '../remote-image-failure.mjs';

/**
 * 图片读取失败时的行内提示：红色标题、可选的重新加载按钮和可展开的失败原因。
 * @param {{ failure: object, onRetry?: () => Promise<unknown>, layout?: 'inline' | 'panel' }} props 失败信息、重试回调与容器形态
 * @returns {React.ReactElement} 失败提示
 */
export function RemoteImageFailure({ failure, onRetry, layout = 'inline' }) {
  const t = useTranslate();
  const reason = imageFailureReason(failure.reason);
  const [retrying, setRetrying] = useState(false);
  const mounted = useRef(true);
  useEffect(() => () => { mounted.current = false; }, []);
  const retry = async () => {
    if (retrying || !onRetry) return;
    setRetrying(true);
    try { await onRetry(); } finally { if (mounted.current) setRetrying(false); }
  };
  const busy = retrying || failure.retrying === true;
  const name = failure.alt || failure.path.split(/[/\\]/).pop() || t('图片');
  const canRetry = reason.retryable && typeof onRetry === 'function';
  return <div className="remote-image-failure" data-layout={layout} role="status">
    <span className="remote-image-failure-dot" aria-hidden="true"/>
    <div className="remote-image-failure-body">
      <div className="remote-image-failure-line" data-retry={canRetry ? 'true' : 'false'}>
        <span className="remote-image-failure-copy">
          <span className="remote-image-failure-title">{t('图片加载失败')}</span>
          <span className="remote-image-failure-sep">·</span><span className="remote-image-failure-alt">{name}</span>
        </span>
        {canRetry && <button type="button" className="remote-image-failure-retry" disabled={busy} aria-busy={busy || undefined} onClick={retry}>
          {busy ? <span className="remote-image-failure-spinner" aria-hidden="true"/> : <IconRefreshOutline16/>}
          {t(busy ? '重新加载中…' : '重新加载')}
        </button>}
      </div>
      <details className="remote-image-failure-details">
        <summary>{t('失败原因')}</summary>
        <div className="remote-image-failure-reason">
          <p>{t(reason.message)}</p>
          <div className="remote-image-failure-meta"><span>{t('路径')}</span><code>{failure.path}</code></div>
          <div className="remote-image-failure-meta"><span>{t('错误码')}</span><code>{reason.code}</code></div>
        </div>
      </details>
    </div>
  </div>;
}
