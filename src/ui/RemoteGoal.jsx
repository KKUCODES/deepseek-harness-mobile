import React, { useEffect, useState, useSyncExternalStore } from 'react';
import { Button } from '@upstream/ui-primitives/src/Button.tsx';

import { useTranslate } from './locale.jsx';

const phaseText = goal => goal.phase === 'active' ? goal.activation === 'armed' ? '进行中' : '等待继续'
  : ({ paused: '已暂停', blocked: '需要处理', complete: '已完成' }[goal.phase] ?? goal.phase);
export function RemoteGoalSummary({ goals, onOpen }) {
  const t = useTranslate();
  const state = useSyncExternalStore(goals.subscribe, goals.getSnapshot);
  if (!state.value || state.value.phase === 'complete') return null;
  return <button className="remote-goal-summary" onClick={onOpen} aria-label={t('查看当前目标')}>
    <strong>{t(phaseText(state.value))}</strong><span>{state.value.objective}</span>
  </button>;
}

export function RemoteGoalPanel({ goals, sessionId }) {
  const t = useTranslate();
  const state = useSyncExternalStore(goals.subscribe, goals.getSnapshot), goal = state.value;
  const [editing, setEditing] = useState(null), [objective, setObjective] = useState(''), [rounds, setRounds] = useState('');
  const [error, setError] = useState(''), [confirmClear, setConfirmClear] = useState(false);
  const ref = goal ? { id: goal.id, revision: goal.revision } : null;
  const disabled = state.busy || state.status !== 'ready';
  useEffect(() => { if (editing && (editing.id !== goal?.id || editing.revision !== goal?.revision)) {
    setEditing(null); setError('目标已更新，请重新打开编辑。');
  } setConfirmClear(false); }, [goal?.id, goal?.revision]);
  const run = async (method, request, expected = ref) => {
    setError('');
    try { await goals.change(method, sessionId, expected, request); setEditing(null); setConfirmClear(false); setObjective(''); setRounds(''); }
    catch (failure) { setError(failure.message); }
  };
  const form = !goal || goal.phase === 'complete' || editing;
  return <section className="remote-goal-panel">
    <p className="muted">{t('目标由电脑持续执行。关闭此窗口或退出手机，不会停止电脑上的任务。')}</p>
    {state.status === 'loading' && <p role="status">{t('正在读取目标…')}</p>}
    {(error || state.error) && <p role="alert">{t(error || state.error)}</p>}
    {goal && <div className="remote-goal-detail">
      <strong>{t(phaseText(goal))}</strong><p>{goal.objective}</p>
      <p className="muted">{t('已开始 {started} / {max} 轮', { started: goal.roundsStarted, max: goal.maxGoalRounds })}</p>
      {goal.blockedReason && <p role="status">{goal.blockedReason.message}</p>}
    </div>}
    {state.status === 'ready' && form && <>
      <label>{t('目标内容')}<textarea className="sheet-editor" aria-label={t('目标内容')} maxLength={32000} value={objective} onChange={event => setObjective(event.target.value)}/></label>
      <label>{t('最多执行轮次')}<input className="sheet-editor" type="number" min="1" step="1" aria-label={t('最多执行轮次')} placeholder={t('使用电脑默认上限')} value={rounds} onChange={event => setRounds(event.target.value)}/></label>
      <Button variant="primary" disabled={disabled || !objective.trim() || !goals.supports(editing ? 'edit' : 'create')}
        onClick={() => void run(editing ? 'edit' : 'create', { objective: objective.trim(), ...(rounds ? { maxGoalRounds: Number(rounds) } : {}) }, editing ?? null)}>{t(editing ? '保存目标' : '开始目标')}</Button>
      {editing && <Button onClick={() => setEditing(null)}>{t('取消编辑')}</Button>}
    </>}
    {goal && !editing && <div className="remote-goal-actions">
      {goal.phase === 'active' && goals.supports('pause') && <Button disabled={disabled} onClick={() => void run('pause')}>{t('暂停目标')}</Button>}
      {(goal.phase === 'paused' || goal.phase === 'blocked' || (goal.phase === 'active' && goal.activation === 'disarmed')) && goals.supports('resume') && <Button disabled={disabled || goal.roundsStarted >= goal.maxGoalRounds} onClick={() => void run('resume')}>{t('继续目标')}</Button>}
      {goal.roundsStarted >= goal.maxGoalRounds && goal.phase !== 'complete' && <p className="muted">{t('已达到轮次上限，编辑目标增加上限后可继续。')}</p>}
      {goals.supports('edit') && <Button disabled={disabled} onClick={() => { setEditing(ref); setObjective(goal.objective); setRounds(String(goal.maxGoalRounds)); setError(''); }}>{t('编辑目标')}</Button>}
      {goal.phase !== 'complete' && goals.supports('complete') && <Button disabled={disabled} onClick={() => void run('complete')}>{t('标记完成')}</Button>}
      {goals.supports('clear') && <Button disabled={disabled} onClick={() => setConfirmClear(true)}>{t('清除目标')}</Button>}
      {confirmClear && <div><p>{t('清除当前目标？已有聊天和目标历史仍会保留。')}</p><Button disabled={disabled} onClick={() => void run('clear')}>{t('确认清除目标')}</Button><Button onClick={() => setConfirmClear(false)}>{t('取消清除')}</Button></div>}
    </div>}
    <Button disabled={state.busy || state.status === 'loading'} onClick={() => void goals.refresh()}>{t('重新读取目标')}</Button>
  </section>;
}
