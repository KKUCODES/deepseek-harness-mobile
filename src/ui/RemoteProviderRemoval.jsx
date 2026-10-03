import React, { useEffect, useRef, useState } from 'react';
import { Button } from '@upstream/ui-primitives/src/Button.tsx';
import { useTranslate } from './locale.jsx';

export function RemoteProviderRemoval({ service, onRemoved }) {
  const t = useTranslate(), [view, setView] = useState(null), [notice, setNotice] = useState(''), [busy, setBusy] = useState(false);
  const active = useRef(null), alive = useRef(false);
  useEffect(() => { alive.current = true; return () => { alive.current = false; active.current?.abort(); }; }, [service]);
  if (!service.supported || !service.permitted) return null;
  const run = async removing => {
    if (active.current) return;
    const controller = new AbortController(); active.current = controller; setBusy(true); setNotice('');
    try {
      const result = removing ? await service.save(view, undefined, controller.signal) : await service.read(controller.signal);
      if (!alive.current || controller.signal.aborted) return;
      if (removing && result.removed) { onRemoved(result); return; }
      setView(result);
    } catch (error) { if (alive.current && !controller.signal.aborted) { setView(null); setNotice(error.message); } }
    finally { if (active.current === controller) active.current = null; if (alive.current) setBusy(false); }
  };
  return <section aria-label={t('移除提供方')}>
    {!view && <Button disabled={busy} onClick={() => void run(false)}>{t(busy ? '正在读取…' : '移除提供方')}</Button>}
    {view && <div role="group" aria-label={t('确认移除提供方')}>
      <p>{t('移除电脑上的提供方“{name}”？', { name: view.name })} <span>({view.provider})</span></p>
      <p>{t('将移除此提供方的用户配置，已有聊天记录会保留。')}</p>
      {view.keepsCredential && <p>{t('已保存的 Key 会保留，以免影响共用它的其他配置。')}</p>}
      {!view.removable && <p role="status">{t('此提供方来自电脑基础配置，不能在这里移除。')}</p>}
      {!view.writable && <p role="status">{t('电脑设置目前只读。')}</p>}
      <Button disabled={busy} onClick={() => { setView(null); setNotice(''); }}>{t('取消')}</Button>
      <Button disabled={busy || !view.writable || !view.removable} onClick={() => void run(true)}>{t(busy ? '正在处理…' : '确认移除')}</Button>
    </div>}
    {notice && <p role="status">{t(notice)}</p>}
  </section>;
}
