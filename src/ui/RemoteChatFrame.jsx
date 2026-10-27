import React from 'react';
import { IconChevronDownOutlineRegular } from '@deepseek-ai/dsh-client-ui-primitives';
import { zh, en } from '@upstream/ui-chat/src/client/locale.ts';
import css from '@upstream/ui-chat/src/client/chat/ChatView.module.css';
import { useLocale } from './locale.jsx';

/** 原ChatView没有单独导出按钮；保留其JSX，样式、图标与文案直接导入原模块。 */
export function RemoteChatFrame({ children, scroll }) {
  const locale = useLocale();
  const t = key => (locale?.startsWith('en') ? en : zh)[key];
  return <div className={`${css.frame} remote-chat-frame`} data-chat-following-tail={scroll.followingTail ? '' : undefined}>
    {children}
    {!scroll.followingTail && (
      <div className={css.toBottomSlot}>
        <button
          type="button"
          className={css.toBottom}
          aria-label={t('chat.toBottom')}
          onClick={scroll.returnToBottom}
        >
          <IconChevronDownOutlineRegular />
        </button>
      </div>
    )}
  </div>;
}
