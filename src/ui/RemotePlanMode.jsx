import React, { useEffect, useState, useSyncExternalStore } from 'react';
import { Button } from '@upstream/ui-primitives/src/Button.tsx';
import { IconCheckOutline16 } from '@upstream/ui-primitives/src/icons/index.tsx';
import { planModeLabel } from '../remote-plan-mode.mjs';
import { useTranslate } from './locale.jsx';

export function RemotePlanMode({ model, sessionId }) {
  const t = useTranslate();
  const state = useSyncExternalStore(model.subscribeView, model.getSnapshot);
  const control = useSyncExternalStore(model.planMode.subscribe, model.planMode.getSnapshot);
  const [error, setError] = useState('');
  useEffect(() => { void model.planMode.load(); }, [model, sessionId]);
  const busy = model.planMode.pendingSessions.has(sessionId);
  const locked = busy || state.selected !== sessionId || state.session?.openState !== 'open'
    || state.connectionState !== 'connected' || !state.plan || !model.planMode.writable || !control.available || control.status !== 'ready';
  const target = state.plan?.pending ? !state.plan.active : state.plan?.active;
  const choose = async active => { setError(''); try { await model.planMode.choose(active, sessionId); } catch (failure) { setError(failure.message); } };
  return <section className="remote-plan-mode">
    <p className="muted">{t('开启后先讨论和制定计划，确认后再执行。与电脑上的当前聊天同步。')}</p>
    <p role="status">{t('计划模式：{state}', { state: t(planModeLabel(state.plan)) })}</p>
    {state.plan?.pending && <p className="muted">{t('将在电脑的下一步生效，可选择另一项取消切换。')}</p>}
    {!model.planMode.writable && <p role="status">{t('请更新电脑插件和网关后切换计划模式。')}</p>}
    {control.status === 'loading' && <p role="status">{t('正在读取电脑能力…')}</p>}
    {control.status === 'ready' && (!control.available || !state.plan) && <p role="status">{t('当前聊天未提供计划模式。')}</p>}
    {(error || control.error) && <p role="alert">{t(error || control.error)}</p>}
    {[true, false].map(active => <Button key={String(active)} className="option" aria-pressed={target === active}
      disabled={locked} onClick={() => void choose(active)}>{t(active ? '开启计划模式' : '关闭计划模式')}{target === active && <IconCheckOutline16/>}</Button>)}
    <Button disabled={busy || control.status === 'loading'} onClick={() => { setError(''); void model.planMode.load(); }}>{t('重新读取计划模式')}</Button>
  </section>;
}
