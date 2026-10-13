import React, { useState, useSyncExternalStore } from 'react';
import { useTranslate } from './locale.jsx';
import { Button } from '@upstream/ui-primitives/src/Button.tsx';
import { subagentStatus, externalSubagentResults, EXTERNAL_SUBAGENT_MESSAGE } from '../remote-subagents.mjs';

const EMPTY_ENTRIES = Object.freeze([]);
const emptySubscribe = () => () => {};
const emptySnapshot = () => EMPTY_ENTRIES;

export function RemoteSubagents({ model, state, onOpenAside }) {
  const t = useTranslate();
  const catalog = state.list?.subagentsByParent[state.selected];
  const source = model.reference?.binding.eventSource;
  const entries = useSyncExternalStore(source ? listener => source.subscribe(listener) : emptySubscribe,
    source ? () => source.getSnapshot().entries : emptySnapshot);
  const results = externalSubagentResults(entries);
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
    {catalog?.entries.map(entry => <div key={entry.id} role="group" aria-label={entry.label || state.list.byId[entry.id]?.displayTitle || t('子会话')}><Button className="option" disabled={busy || entry.kind === 'diagnostic' || entry.mode === 'external'}
      onClick={() => void run(() => model.openChild(entry.id))}>
      <span><strong>{entry.label || state.list.byId[entry.id]?.displayTitle || t('子会话')}</strong><br/><small>{subagentStatus(entry, t)}{entry.hasChildren ? ` · ${t('包含子任务')}` : ''}</small></span>
    </Button>{entry.mode === 'external' && <><p className="muted">{t(EXTERNAL_SUBAGENT_MESSAGE)}</p>{results.has(entry.id) && <details className="remote-tool-card" data-external-subagent-result={entry.id} data-result-notice-seq={results.get(entry.id).seq}>
      <summary>{t('查看任务结果')}</summary><div className="remote-external-result">{results.get(entry.id).text}</div>
    </details>}</>}{entry.kind === 'child' && entry.mode !== 'external' && model.openChildAside && <Button disabled={busy || state.connectionState !== 'connected'}
      aria-label={t('在旁栏打开')}
      onClick={() => void run(() => { model.openChildAside(entry.id); onOpenAside?.(); })}>{t('在旁栏打开')}</Button>}</div>)}
    <Button disabled={busy || catalog?.state === 'loading' || state.connectionState !== 'connected'} onClick={() => void run(() => model.sessions.refreshSubagents(state.selected))}>{t("刷新子会话")}</Button>
  </section>;
}
