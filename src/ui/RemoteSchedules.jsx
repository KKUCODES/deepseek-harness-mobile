import React, { useEffect, useMemo, useState, useSyncExternalStore } from 'react';

import { useLocale, useTranslate } from './locale.jsx';
import { RemoteScheduleCatalog, scheduleRuleText } from '../remote-schedules.mjs';
import { Button } from '@upstream/ui-primitives/src/Button.tsx';

/** 两版均只显示电脑事实；手机时钟不会执行提醒或推断已触发。 */
export function RemoteSchedules({ model, sessionId }) {
  const t = useTranslate(), locale = useLocale();
  const dateLocale = locale?.startsWith('en') ? 'en' : 'zh-CN';
  const state = useSyncExternalStore(model.subscribeView, model.getSnapshot);
  const catalog = useMemo(() => new RemoteScheduleCatalog(model, sessionId), [model, sessionId]);
  const current = useSyncExternalStore(catalog.subscribe, catalog.getSnapshot);
  useEffect(() => { catalog.start(); return () => catalog.dispose(); }, [catalog]);
  const records = state.selected === sessionId ? current.modern ? current.records : state.schedules : undefined;
  const connected = state.connectionState === 'connected';
  const [now, setNow] = useState(Date.now);
  const ticking = connected && Array.isArray(records) && records.length > 0;
  useEffect(() => {
    if (!ticking) return;
    setNow(Date.now());
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [ticking]);
  if (!state.session || state.session.openState !== 'open') return <p role="status">{t('正在读取当前聊天的定时任务…')}</p>;
  if (current.modern && connected && !catalog.available) return <p role="status">{t('电脑暂未提供这个聊天的定时任务。')}</p>;
  if (!Array.isArray(records)) return <p role="status">{t('电脑暂未提供这个聊天的定时任务。')}</p>;
  const ordered = [...records].sort((a, b) => Date.parse(a.scheduledAt) - Date.parse(b.scheduledAt));
  return <section className="remote-schedules">
    <p className="muted">{t(current.modern ? '在聊天中告诉 DSH 提醒的时间和内容。定时任务保存在电脑，电脑和 DSH 运行时按时触发。'
      : '在聊天中告诉 DSH 提醒的时间和内容。电脑和会话保持运行时才会按时触发；关闭后需重新打开会话。')}</p>
    {current.modern && connected && current.status === 'loading' && <p role="status">{t('正在读取当前聊天的定时任务…')}</p>}
    {current.modern && connected && current.status === 'error' && <div role="alert"><p>{t('无法读取定时任务，请重试。')}</p>
      <Button variant="outline" onClick={() => void catalog.refresh()}>{t('重试')}</Button></div>}
    {!connected && <p role="status">{t('连接已断开，以下为最近收到的定时任务。')}</p>}
    {!records.length && (!current.modern || connected && current.status === 'ready') && <p role="status">{t('当前没有待触发的定时任务。')}</p>}
    <ul aria-label={t('当前聊天定时任务')}>{ordered.map(record => {
      return <li key={record.id}>
        <div className="remote-schedule-heading"><strong>{record.title ?? record.prompt}</strong><span>{t(!connected ? '待核对' : Date.parse(record.scheduledAt) <= now ? '已到时间' : '待触发')}</span></div>
        {record.title && record.title !== record.prompt && <p>{record.prompt}</p>}
        <p className="muted">{scheduleRuleText(record, t, dateLocale)}</p>
        <time dateTime={record.scheduledAt}>{new Intl.DateTimeFormat(dateLocale, { dateStyle: 'medium', timeStyle: 'medium' }).format(Date.parse(record.scheduledAt))}</time>
      </li>;
    })}</ul>
  </section>;
}
