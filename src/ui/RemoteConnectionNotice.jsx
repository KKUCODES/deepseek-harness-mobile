import React from 'react';
import { useTranslate } from './locale.jsx';

/** 能力与授权只有本代连接协商完成后才有意义。 */
export function RemoteConnectionNotice({ state }) {
  const t = useTranslate();
  if (state.connectionState === 'connected') return null;
  return <p role="status">{t(state.connectionState === 'connecting' ? '正在连接电脑…' : '电脑连接已断开，重新连接后可继续操作。')}</p>;
}
