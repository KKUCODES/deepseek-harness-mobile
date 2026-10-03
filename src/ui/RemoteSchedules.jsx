import React, { useEffect, useState, useSyncExternalStore } from 'react';

import { useLocale, useTranslate } from './locale.jsx';

const units = [[86400, 'day'], [3600, 'hour'], [60, 'minute'], [1, 'second']];

/** 当前会话的原 schedule 投影；显示时钟不会执行提醒或推断已触发。 */
export function RemoteSchedules({ model, sessionId }) {
  const t = useTranslate(), locale = useLocale();
  const dateLocale = locale?.startsWith('en') ? 'en' : 'zh-CN';
  const state = useSyncExternalStore(model.subscribeView, model.getSnapshot);
  const records = state.selected === sessionId ? state.schedules : undefined;
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
  if (!Array.isArray(records)) return <p role="status">{t('电脑暂未提供这个聊天的定时任务。')}</p>;
  const ordered = [...records].sort((a, b) => Date.parse(a.scheduledAt) - Date.parse(b.scheduledAt));
  return <section className="remote-schedules">
    <p className="muted">{t('在聊天中告诉 DSH 提醒的时间和内容。电脑和会话保持运行时才会按时触发；关闭后需重新打开会话。')}</p>
    {!connected && <p role="status">{t('连接已断开，以下为最近收到的定时任务。')}</p>}
    {!records.length && <p role="status">{t('当前没有待触发的定时任务。')}</p>}
    <ul aria-label={t('当前聊天定时任务')}>{ordered.map(record => {
      const [seconds, unit] = units.find(([value]) => record.everySeconds % value === 0) ?? units.at(-1);
      return <li key={record.id}>
        <div className="remote-schedule-heading"><strong>{record.prompt}</strong><span>{t(!connected ? '待核对' : Date.parse(record.scheduledAt) <= now ? '已到时间' : '待触发')}</span></div>
        <p className="muted">{record.kind === 'every' ? t('每 {interval}', { interval: new Intl.NumberFormat(dateLocale, { style: 'unit', unit, unitDisplay: 'long' }).format(record.everySeconds / seconds) }) : t('单次提醒')}</p>
        <time dateTime={record.scheduledAt}>{new Intl.DateTimeFormat(dateLocale, { dateStyle: 'medium', timeStyle: 'medium' }).format(Date.parse(record.scheduledAt))}</time>
      </li>;
    })}</ul>
  </section>;
}
