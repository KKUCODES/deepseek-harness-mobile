import React from 'react';
import { IconChevronDownOutline14, IconThinkOutline14 } from '@upstream/ui-primitives/src/icons/index.tsx';
import messageStyle from '@upstream/ui-chat/src/client/chat/MessageItem.module.css';
import { useTranslate } from './locale.jsx';

/** 两种会话只注入内容和操作；消息布局由同一组件维护。 */
export function UserMessage({ children, attachments, actions }) {
  return <div className={messageStyle.userRow}><div className={messageStyle.userStack}>{attachments}<div className={messageStyle.bubble}>{children}</div>{actions}</div></div>;
}

export function MessageReasoning({ text, active, renderContent }) {
  const t = useTranslate();
  return <details><summary><IconThinkOutline14/>{t('思考过程')}<IconChevronDownOutline14/></summary><div className="thought">{renderContent(text, active)}</div></details>;
}

export function AssistantMessage({ content, reasoning, body, active, error, renderContent, contentOptions, actions, children }) {
  const t = useTranslate();
  return <article className="reply" aria-label={t('模型回复')}>
    {reasoning && <MessageReasoning text={reasoning} active={active} renderContent={renderContent}/>}
    {body ?? (content && renderContent(content, active, contentOptions))}
    {children}
    {active && !content && !body && <p role="status" className="muted">{reasoning ? t('正在思考…') : t('正在连接…')}</p>}
    {error && <p className="turn-status" role="status">{error}</p>}
    {!active && actions && <div className="reply-actions">{actions}</div>}
  </article>;
}
