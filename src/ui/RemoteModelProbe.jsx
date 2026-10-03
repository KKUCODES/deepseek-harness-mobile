import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@upstream/ui-primitives/src/Button.tsx';
import { RemoteModelProbe as Probe } from '../remote-model-probe.mjs';
import { RemoteModelCandidates } from './RemoteModelCandidates.jsx';
import { useTranslate } from './locale.jsx';

export function RemoteModelProbe({ model, baseURL, api, provider, rows, disabled, onAdopt }) {
  const t = useTranslate(), service = useMemo(() => new Probe(model), [model]);
  const [mode, setMode] = useState('none'), [view, setView] = useState(null), [candidates, setCandidates] = useState(null);
  const [busy, setBusy] = useState(false), [notice, setNotice] = useState('');
  const active = useRef(null);
  useEffect(() => {
    const clear = () => {
      active.current?.abort(); active.current = null;
      service.prepared = null; setView(null); setCandidates(null); setBusy(false); setNotice('');
    };
    clear();
    const offs = ['settings/document-updated', 'llm/adapters-updated'].map(event => model.remote.$on(event, clear));
    return () => { active.current?.abort(); active.current = null; service.prepared = null; offs.forEach(off => off()); };
  }, [service, baseURL, api, provider, mode, disabled]);
  if (!service.supported) return null;
  const run = async execute => {
    if (disabled || active.current) return;
    const controller = new AbortController(); active.current = controller; setBusy(true); setNotice(''); setCandidates(null);
    try {
      const target = { baseURL: baseURL.trim(), api };
      if (mode === 'temporary' || execute) {
        const result = mode === 'temporary' ? await service.temporary(target, controller.signal) : await service.execute(view, controller.signal);
        if (!controller.signal.aborted) { setView(null); if (!result.cancelled) setCandidates(result.rows); }
      } else {
        const next = await service.prepare({ ...target, authentication: mode === 'stored' ? { mode, provider } : { mode } }, controller.signal);
        if (!controller.signal.aborted) setView(next);
      }
    } catch (error) { if (!controller.signal.aborted) { setView(null); setNotice(error.message); } }
    finally { if (active.current === controller) { active.current = null; setBusy(false); } }
  };
  return <section aria-label={t('从当前地址获取模型')}>
    <label>{t('获取模型时使用的认证')}<select className="sheet-editor" disabled={busy || disabled} value={mode} onChange={event => setMode(event.target.value)}>
      <option value="none">{t('不使用认证')}</option>
      <option value="temporary">{t('临时输入 Key')}</option>
      {provider && <option value="stored">{t('沿用此提供方的电脑认证')}</option>}
    </select></label>
    <p className="remote-muted">{t('使用当前填写的地址和协议获取模型，不保存提供方设置。')}</p>
    {!view && <Button disabled={disabled || busy || !baseURL.trim() || !api} onClick={() => void run(false)}>{t('从当前地址获取模型')}</Button>}
    {view && <div role="group" aria-label={t('确认模型请求')}>
      <p className="remote-path">{view.baseURL}</p><p>{view.api}</p>
      {view.authentication.mode === 'stored' && <p>{t('模型提供方')}：<bdi>{view.authentication.provider}</bdi></p>}
      <p>{t(mode === 'stored' ? '此请求会携带电脑为该提供方配置的认证信息。' : '此请求不携带认证信息。')}</p>
      {view.baseURL.startsWith('http:') && <p>{t('HTTP 连接未加密，建议使用 HTTPS。')}</p>}
      <Button disabled={disabled || busy} onClick={() => void run(true)}>{t('确认获取模型')}</Button>
      <Button disabled={busy} onClick={() => { setView(null); service.prepared = null; }}>{t('取消')}</Button>
    </div>}
    {busy && <p role="status">{t('正在处理…')}</p>}
    {notice && <p role="status">{t(notice)}</p>}
    {candidates && <RemoteModelCandidates candidates={candidates} rows={rows} disabled={disabled || busy} onAdopt={chosen => { onAdopt(chosen); setCandidates(null); }}/>}
  </section>;
}
