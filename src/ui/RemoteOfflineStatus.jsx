import React, { useSyncExternalStore } from 'react';

import { useLocale, useTranslate } from './locale.jsx';

/** 时间来自最近一次成功接收的数据，离线期间编辑草稿不会刷新它。 */
export function RemoteOfflineStatus({ model }) {
  const t = useTranslate(), locale = useLocale();
  const state = useSyncExternalStore(model.subscribeView, model.getSnapshot);
  if (state.connectionState === 'connected') return null;
  return <div className="remote-offline-status" role="status" data-testid="remote-offline-status">
    <span>{t('电脑连接已断开，正在重连。已加载的内容仍可查看。')}</span>
    {state.lastReceivedAt && <small>{t('最后同步：')}<time dateTime={new Date(state.lastReceivedAt).toISOString()}>{new Date(state.lastReceivedAt).toLocaleString(locale?.startsWith('en') ? 'en' : 'zh-CN')}</time></small>}
  </div>;
}
