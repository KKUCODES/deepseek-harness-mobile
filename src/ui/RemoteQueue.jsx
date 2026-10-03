import React, { useEffect, useState } from 'react';
import { Button } from '@upstream/ui-primitives/src/Button.tsx';
import { RemoteFiles, contentText } from './RemoteMessage.jsx';
import { useTranslate } from './locale.jsx';

/** 队列由电脑投影提供；手机提交操作后等待回传，不先删掉或移动条目。 */
export function RemoteQueue({ state, model, openAttachment }) {
  const t = useTranslate();
  const queue = state.inbox?.['next-turn'] ?? [];
  const observed = new Set(queue.map(row => row.source?.rpcId));
  const pending = state.session?.pendingSubmissions.filter(item => item.placement === 'queued' && !observed.has(item.requestId)) ?? [];
  const [editing, setEditing] = useState(null), [busy, setBusy] = useState(false), [error, setError] = useState('');
  useEffect(() => { if (editing && !queue.some(item => item.id === editing.id)) setEditing(null); }, [queue, editing]);
  if (!queue.length && !pending.length) return null;
  const apply = async (id, action) => {
    if (busy) return;
    setBusy(true); setError('');
    try { await model.updateQueue(id, action); setEditing(null); }
    catch { setError('队列操作未确认，请核对最新队列后再试。'); }
    finally { setBusy(false); }
  };
  return <details className="remote-queue" open aria-label={t('待发送队列')}><summary>{t('队列 · {count}', { count: queue.length + pending.length })}</summary>
    {error && <p role="alert">{t(error)}</p>}
    {queue.map(row => <div key={row.id} className="remote-queue-row"><RemoteFiles content={row.content} openAttachment={openAttachment}/>
      {editing?.id === row.id ? <><textarea aria-label={t('编辑排队消息')} value={editing.text} onChange={event => setEditing({ id: row.id, text: event.target.value })}/><Button disabled={busy || !editing.text.trim()} onClick={() => void apply(row.id, { kind: 'edit', content: [{ type: 'text', text: editing.text }] })}>{t('保存修改')}</Button><Button disabled={busy} onClick={() => setEditing(null)}>{t('取消编辑')}</Button></> : <>
        <p>{contentText(row.content)}</p><div className="remote-actions">
          {row.content.every(part => part.type === 'text') && <Button disabled={busy} onClick={() => setEditing({ id: row.id, text: contentText(row.content) })}>{t('编辑')}</Button>}
          <Button disabled={busy || !state.session?.running} onClick={() => void apply(row.id, { kind: 'steer' })}>{t('立即引导')}</Button>
          <Button disabled={busy} onClick={() => void apply(row.id, { kind: 'remove' })}>{t('取消排队')}</Button>
        </div>
      </>}
    </div>)}
    {pending.map(item => <div key={item.requestId}><RemoteFiles pending={item.attachments} openAttachment={openAttachment}/><p>{item.text || t('附件消息')} · {t('正在发送…')}</p></div>)}
  </details>;
}
