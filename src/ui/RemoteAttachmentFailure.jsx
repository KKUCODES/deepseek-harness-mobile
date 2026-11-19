import React from 'react';
import { IconCloseOutline16, IconRefreshOutline16 } from '@upstream/ui-primitives/src/icons/index.tsx';
import { useTranslate } from './locale.jsx';
import { Surface, IconButton } from './Surface.jsx';
import { imageFailureReason, imageFailureReasonFromError } from '../remote-image-failure.mjs';

/** 失败附件统一使用的破图标；不依赖图标库中是否收录图片失败字形。 */
function BrokenImageIcon() {
  return <svg viewBox="0 0 16 16" fill="none" aria-hidden="true">
    <rect x="1.8" y="2.4" width="12.4" height="11.2" rx="2.2" stroke="currentColor" strokeWidth="1.2"/>
    <circle cx="5.9" cy="6.2" r="1.05" fill="currentColor"/>
    <path d="m2.6 11.6 3.2-3.1 2.3 2.2 2.2-2.1 3 2.9" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>;
}

/**
 * 多图消息里的 64px 失败格：上行打开原因小卡，下行在有重试时直接重读。
 * @param {{ name: string, failure: unknown, onOpen: () => void, onRetry: () => void }} props 附件名、原始错误和两个动作
 * @returns {React.ReactElement} 失败格
 */
export function AttachmentFailureTile({ name, failure, onOpen, onRetry }) {
  const t = useTranslate();
  const reason = imageFailureReason(imageFailureReasonFromError(failure));
  return <div className="remote-attachment-failure-tile">
    <button type="button" className="remote-attachment-tile-open" aria-label={t('查看失败原因：{name}', { name })} onClick={onOpen}>
      <BrokenImageIcon/><span>{t('加载失败')}</span>
    </button>
    {reason.retryable && <button type="button" className="remote-attachment-tile-retry" aria-label={t('重试图片：{name}', { name })} onClick={onRetry}>{t('重试')}</button>}
  </div>;
}

/**
 * 单图消息的 240px 失败卡：卡内直接给重试与查看原因。
 * @param {{ name: string, failure: unknown, onOpen: () => void, onRetry: () => void }} props 附件名、原始错误和两个动作
 * @returns {React.ReactElement} 失败卡
 */
export function AttachmentFailureCard({ name, failure, onOpen, onRetry }) {
  const t = useTranslate();
  const reason = imageFailureReason(imageFailureReasonFromError(failure));
  return <div className="remote-attachment-failure-card">
    <div className="remote-attachment-card-main">
      <span className="remote-attachment-card-icon"><BrokenImageIcon/></span>
      <span className="remote-attachment-card-copy"><strong>{t('图片加载失败')}</strong><span title={name}>{name}</span></span>
    </div>
    <div className="remote-attachment-card-actions">
      {reason.retryable && <button type="button" className="remote-attachment-card-retry" onClick={onRetry}><IconRefreshOutline16/>{t('重新加载')}</button>}
      <button type="button" className="remote-attachment-card-reason" onClick={onOpen}>{t('查看原因')}</button>
    </div>
  </div>;
}

/**
 * 附件失败原因小卡：底部弹层，给出原因、附件名和错误码，可重试时提供主按钮。
 * @param {{ name: string, failure: unknown, onRetry: () => void, onClose: () => void }} props 附件名、原始错误、重试与关闭
 * @returns {React.ReactElement} 底部小卡
 */
export function AttachmentFailureSheet({ name, failure, onRetry, onClose }) {
  const t = useTranslate();
  const reason = imageFailureReason(imageFailureReasonFromError(failure));
  return <Surface title={t('图片加载失败')} onClose={onClose}>
    <div className="remote-attachment-failure-sheet">
      <div className="sheet-handle"/>
      <header>
        <h2>{t('图片加载失败')}</h2>
        <IconButton label={t('关闭窗口')} onClick={onClose}><IconCloseOutline16/></IconButton>
      </header>
      <div className="remote-attachment-sheet-file">
        <span className="remote-attachment-sheet-thumb"><BrokenImageIcon/></span>
        <div><strong>{name}</strong><span>{t('聊天中的原始附件')}</span></div>
      </div>
      <p className="remote-attachment-sheet-reason">{t(reason.message)}</p>
      <div className="remote-attachment-sheet-meta"><span>{t('错误码')}</span><code>{reason.code}</code></div>
      <div className="remote-attachment-sheet-actions">
        {reason.retryable && <button type="button" className="remote-attachment-sheet-primary" onClick={onRetry}><IconRefreshOutline16/>{t('重新加载')}</button>}
        <button type="button" className="remote-attachment-sheet-close" onClick={onClose}>{t('关闭窗口')}</button>
      </div>
    </div>
  </Surface>;
}
