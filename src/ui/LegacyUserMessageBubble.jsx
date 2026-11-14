import React from 'react';
import messageStyle from '@upstream/ui-chat/src/client/chat/MessageItem.module.css';

export function UserMessageBubble(props) {
  return <div {...props} className={messageStyle.bubble}/>;
}
