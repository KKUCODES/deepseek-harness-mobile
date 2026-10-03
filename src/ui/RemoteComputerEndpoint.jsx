import React, { useEffect, useId, useRef, useState, useSyncExternalStore } from 'react';
import { useTranslate } from './locale.jsx';
import { Button } from '@upstream/ui-primitives/src/Button.tsx';
import { computerEndpointUrlSchema } from '../../../backend/packages/protocol/dist/index.js';

export function RemoteComputerEndpoint({ model, service = model.computerEndpoint, onDraftChange }) {
  const t = useTranslate();
  const state = useSyncExternalStore(model.subscribeView, model.getSnapshot);
  const connected = state.connectionState === 'connected';
  const endpoint = service, search = endpoint.target === 'web-search-deepseek';
  const inputId = useId(), provider = typeof endpoint.target === 'object' ? endpoint.target.provider : null;
  const title = search ? '电脑网页搜索服务地址' : '电脑模型服务地址';
  const [view, setView] = useState(null), [value, setValue] = useState(''), [review, setReview] = useState(null);
  const [notice, setNotice] = useState(''), [busy, setBusy] = useState(false);
  const alive = useRef(false), active = useRef(null);
  useEffect(() => {
    onDraftChange?.({ value, available: connected && !busy && !!view?.writable });
  }, [onDraftChange, value, connected, busy, view?.writable]);
  const run = async change => {
    if (active.current || model.getSnapshot().connectionState !== 'connected') return;
    const controller = new AbortController(); active.current = controller;
    setBusy(true); setNotice('');
    try {
      const next = change ? await endpoint.save(view, change, controller.signal) : await endpoint.read(controller.signal);
      if (alive.current) { setView(next); setValue(''); if (change) setNotice(next.applies === 'restart' ? '已保存，重启电脑上的 DSH 后生效。' : '服务地址已保存到电脑。'); }
    } catch (error) { if (alive.current) { setView(null); setNotice(error.message); } }
    finally { active.current = null; if (alive.current) { setBusy(false); setReview(null); } }
  };
  useEffect(() => { alive.current = true; if (endpoint.supported) void run(null);
    return () => { alive.current = false; active.current?.abort(); };
  }, [endpoint]);
  const prepare = change => {
    if (model.getSnapshot().connectionState !== 'connected') return;
    if (change.op === 'set' && !computerEndpointUrlSchema.safeParse(change.value).success) {
      setNotice('请输入不含账号、密码、查询参数和片段的 HTTP 或 HTTPS 地址。'); return;
    }
    setNotice(''); setReview(change);
  };
  const target = review?.op === 'set' ? new URL(review.value).origin : view?.inheritedOrigin;
  return <section aria-label={t(title)} className="remote-computer-setting">
    <h3>{t(title)}</h3>
    {provider && <p>{t('模型提供方')}：<bdi>{provider}</bdi></p>}
    {search && <p className="remote-muted">{t('网页搜索使用独立服务地址，不改变电脑聊天模型的地址。')}</p>}
    {connected && !endpoint.supported ? <p>{t("请更新电脑远程插件和网关后管理服务地址。")}</p> : <>
      {view && <>
        <p>{view.origin ? <>{t("当前站点：")}<bdi>{view.origin}</bdi></> : t('未单独配置地址，由提供方的模型目录决定。')}</p>
        <p className="remote-muted">{t(view.overridden ? '已单独设置' : '使用电脑默认值')}{view.protocol !== 'provider' && <> · {view.protocol === 'messages' ? 'Messages' : 'Chat Completions'}</>}</p>
        {view.customPath && <p className="remote-muted">{t("当前地址还包含路径，完整地址请在电脑查看。更换时请输入完整的新地址。")}</p>}
        {view.origin?.startsWith('http:') && <p role="status">{t(search ? "HTTP 未加密，电脑发送的 Key 和搜索内容可能被窃听。" : "HTTP 未加密，电脑发送的 Key 和聊天内容可能被窃听。")}</p>}
        {review ? <div role="group" aria-label={t("确认服务地址")} className="remote-endpoint-confirm">
          <p>{!target && review.op === 'unset' ? t('恢复后，电脑 Key 和聊天内容将发送到提供方模型目录决定的地址，可能不同于当前站点。') : <>{t(search ? '确认更改搜索地址？后续网页搜索会把电脑 Key 和搜索内容发送到：' : review.op === 'unset' ? '确认恢复电脑默认地址？后续模型请求会把电脑 Key 和聊天内容发送到：' : '确认更换地址？后续模型请求会把电脑 Key 和聊天内容发送到：')} <bdi>{target}</bdi></>}</p>
          {review.op === 'set' && <p><bdi>{review.value}</bdi></p>}
          {target?.startsWith('http:') && <p>{t("这个地址使用 HTTP，传输未加密。")}</p>}
          <Button variant="primary" disabled={!connected || busy} onClick={() => void run(review)}>{t("确认更改服务地址")}</Button>
          <Button disabled={busy} onClick={() => setReview(null)}>{t("取消更改地址")}</Button>
        </div> : <>
          <label htmlFor={inputId}>{t("新的完整服务地址")}</label>
          <input id={inputId} className="sheet-editor" type="url" autoComplete="off" spellCheck="false" placeholder="https://…" value={value} disabled={!connected || busy || !view.writable} onChange={event => setValue(event.target.value)}/>
          <Button disabled={!connected || busy || !view.writable || !value} onClick={() => prepare({ op: 'set', value })}>{t("核对新地址")}</Button>
          <Button disabled={!connected || busy || !view.writable || !view.overridden} onClick={() => prepare({ op: 'unset' })}>{t("恢复默认服务地址")}</Button>
        </>}
        {!view.writable && <p>{t("电脑设置目前只读。")}</p>}
      </>}
      <Button disabled={!connected || busy} onClick={() => void run(null)}>{t(busy ? '正在处理地址…' : '重新读取服务地址')}</Button>
      {notice && <p role="status">{t(notice)}</p>}
    </>}
  </section>;
}
