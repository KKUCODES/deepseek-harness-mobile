import React, { useState } from 'react';
import { useTranslate } from './locale.jsx';
import { Button } from '@upstream/ui-primitives/src/Button.tsx';
import { subagentStatus } from '../remote-subagents.mjs';

export function RemoteSubagents({ model, state, onOpenAside }) {
  const t = useTranslate();
  const catalog = state.list?.subagentsByParent[state.selected];
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  const run = async action => {
    if (busy) return;
    setBusy(true); setError('');
    try { await action(); } catch (failure) { setError(failure.message); } finally { setBusy(false); }
  };
  if (!model.subagentsAvailable) return <p>{t("请更新电脑插件和网关后查看子会话。")}</p>;
  return <section aria-label={t("子会话列表")}>
    {state.connectionState !== 'connected' && <p role="status">{t("电脑连接已断开，以下为最近读取的状态。")}</p>}
    {catalog?.state === 'loading' && <p role="status">{t("正在读取子会话…")}</p>}
    {(catalog?.error || error) && <p role="alert">{t(error || '无法读取子会话，请重试。')}</p>}
    {catalog?.state === 'ready' && !catalog.entries.length && <p className="muted">{t("当前聊天没有子会话。")}</p>}
    {catalog?.entries.map(entry => <div key={entry.id} role="group" aria-label={entry.label || state.list.byId[entry.id]?.displayTitle || t('子会话')}><Button className="option" disabled={busy || entry.kind === 'diagnostic'}
      onClick={() => void run(() => model.openChild(entry.id))}>
      <span><strong>{entry.label || state.list.byId[entry.id]?.displayTitle || t('子会话')}</strong><br/><small>{subagentStatus(entry, t)}{entry.hasChildren ? ` · ${t('包含子任务')}` : ''}</small></span>
    </Button>{entry.kind === 'child' && model.openChildAside && <Button disabled={busy || state.connectionState !== 'connected'}
      aria-label={t('在旁栏打开')}
      onClick={() => void run(() => { model.openChildAside(entry.id); onOpenAside?.(); })}>{t('在旁栏打开')}</Button>}</div>)}
    <Button disabled={busy || catalog?.state === 'loading' || state.connectionState !== 'connected'} onClick={() => void run(() => model.sessions.refreshSubagents(state.selected))}>{t("刷新子会话")}</Button>
  </section>;
}
