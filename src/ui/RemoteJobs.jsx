import React, { useEffect, useState, useSyncExternalStore } from 'react';
import { Button } from '@upstream/ui-primitives/src/Button.tsx';

import { useTranslate } from './locale.jsx';
import { remoteJobs } from '../remote-jobs.mjs';

const labels = { running: '运行中', stopping: '正在停止', completed: '已完成', killed: '已取消', failed: '已失败' };
const live = job => job.status === 'running' || job.status === 'stopping';

/** 数据来自原任务服务或旧版控制流；不从聊天文案推断进程状态。 */
export function RemoteJobs({ model, sessionId, onOpenOutput }) {
  const t = useTranslate();
  const state = useSyncExternalStore(model.subscribeView, model.getSnapshot);
  const jobs = remoteJobs(state, sessionId);
  const connected = state.connectionState === 'connected';
  const [now, setNow] = useState(Date.now);
  const [confirm, setConfirm] = useState(null), [notice, setNotice] = useState(null);
  const noticeJob = notice?.job && jobs.find(job => job.id === notice.job.id && job.startedAt === notice.job.startedAt);
  // 请求回执不表示进程退出；最终提示只跟随同一个任务的电脑状态。
  const noticeText = noticeJob && !live(noticeJob) ? t('任务{status}。', { status: t(labels[noticeJob.status] ?? '已结束') }) : notice?.message && t(notice.message);
  const ticking = connected && jobs.some(live);
  useEffect(() => {
    if (!ticking) return;
    setNow(Date.now());
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [ticking]);
  const ordered = [...jobs].sort((a, b) => live(a) !== live(b) ? Number(live(b)) - Number(live(a))
    : live(a) ? a.startedAt - b.startedAt : (b.finishedAt ?? b.startedAt) - (a.finishedAt ?? a.startedAt));
  return <section className="remote-jobs">
    <p className="muted">{t('任务在电脑上执行，退出手机不会停止任务。')}</p>
    {noticeText && <p role="status">{noticeText}</p>}
    {!connected && <p role="status">{t('连接已断开，以下为最近收到的任务状态。')}</p>}
    {connected && !jobs.length && <p role="status">{t('当前没有后台任务。')}</p>}
    <ul aria-label={t('当前会话后台任务')}>{ordered.map(job => {
      const seconds = Math.max(0, Math.floor(((live(job) ? now : job.finishedAt ?? job.startedAt) - job.startedAt) / 1000));
      return <li key={job.id} data-job-id={job.id}>
        <div className="remote-job-heading"><strong>{job.label || job.id}</strong><span>{t(labels[job.status] ?? job.status)}</span></div>
        <p className="muted">{job.kind} · {t('{minutes} 分 {seconds} 秒', { minutes: Math.floor(seconds / 60), seconds: seconds % 60 })}</p>
        {job.detail && <p className="remote-job-detail">{job.detail}</p>}
        <Button onClick={() => onOpenOutput({ ...job, sessionId })}>{t('查看输出记录')}</Button>
        {model.transport.capabilities?.jobOutput === true && <Button disabled={!connected} onClick={() => onOpenOutput({ ...job, sessionId, independent: true })}>{t('查看实时输出')}</Button>}
        {job.status === 'running' && model.jobActions.available && <Button disabled={!connected || model.jobActions.pending.has(model.jobActions.key(sessionId, job))}
          onClick={() => setConfirm(job)}>{t('停止任务')}</Button>}
        {confirm?.id === job.id && job.status === 'running' && <div><p>{t('停止这个后台任务？已产生的结果会保留。')}</p>
          <Button disabled={!connected || model.jobActions.pending.has(model.jobActions.key(sessionId, job))} onClick={async () => {
            try { const status = await model.jobActions.stop(sessionId, confirm); setNotice({ job: confirm, message: status === 'already-finished' ? '任务已结束。' : '已请求停止，等待电脑确认任务结束。' }); }
            catch (error) { setNotice({ job: confirm, message: error.message }); } finally { setConfirm(null); }
          }}>{t('确认停止任务')}</Button><Button onClick={() => setConfirm(null)}>{t('继续运行')}</Button></div>}
      </li>;
    })}</ul>
  </section>;
}
