import React, { useEffect, useRef, useState } from 'react';
import { Button } from '@upstream/ui-primitives/src/Button.tsx';
import { useTranslate } from './locale.jsx';
import { RemoteComputerKey } from './RemoteComputerKey.jsx';
import { RemoteProviderCard } from './RemoteProviderCard.jsx';
import { RemoteModelFields } from './RemoteModelFields.jsx';
import { RemoteModelCapabilities } from './RemoteModelCapabilities.jsx';
import { formatCapacity, parseCapacity } from '../../../deepseek-harness/packages/client/ui-settings-models/src/client/DeepSeekModelsEditor.tsx';
import { RemoteModelProbe } from './RemoteModelProbe.jsx';

const blankModel = () => ({ id: '', name: '', contextWindow: '', maxTokens: '' });
const modelPayload = row => ({ id: row.id.trim(), ...(row.name.trim() ? { name: row.name.trim() } : {}),
  ...Object.fromEntries(['contextWindow', 'maxTokens'].flatMap(key => row[key].trim() ? [[key, parseCapacity(row[key])]] : [])),
  ...(row.advanced?.input === undefined ? {} : { input: row.advanced.input }),
});

export function RemoteProviderCreation({ model, service, onCreated }) {
  const t = useTranslate(), [view, setView] = useState(null), [draft, setDraft] = useState(null), [review, setReview] = useState(false);
  const [busy, setBusy] = useState(false), [notice, setNotice] = useState('');
  const active = useRef(null), alive = useRef(false);
  useEffect(() => { alive.current = true; return () => { alive.current = false; active.current?.abort(); }; }, [service]);
  if (!service?.supported || !service.permitted) return null;
  const modelsPayload = () => service.modelRowsSupported ? draft.modelRows.map(modelPayload) : draft.models.split('\n').map(id => id.trim()).filter(Boolean);
  const run = async writing => {
    if (active.current) return;
    const controller = new AbortController(); active.current = controller; setBusy(true); setNotice('');
    try {
      const value = draft && { kind: draft.kind, provider: draft.provider.trim(), name: draft.name.trim(), useKey: draft.useKey,
        ...(draft.kind === 'custom' ? { api: draft.api, baseURL: draft.baseURL.trim(), models: modelsPayload() } : {}) };
      const next = writing ? await service.save(view, value, controller.signal) : await service.read(controller.signal);
      if (!alive.current || controller.signal.aborted) return;
      setView(next); setReview(false);
      if (!writing) setDraft({ kind: next.available.length ? 'catalog' : 'custom', provider: next.available[0]?.provider ?? '',
        name: '', useKey: next.keyAvailable, api: next.protocols[0], baseURL: '', models: '', modelRows: [blankModel()] });
    } catch (error) { if (alive.current && !controller.signal.aborted) { setNotice(error.message); setReview(false); } }
    finally { if (active.current === controller) active.current = null; if (alive.current) setBusy(false); }
  };
  const change = (key, value) => { setDraft(previous => ({ ...previous, [key]: value })); setReview(false); };
  const payload = draft && { kind: draft.kind, provider: draft.provider.trim(), name: draft.name.trim(), useKey: draft.useKey,
    ...(draft.kind === 'custom' ? { api: draft.api, baseURL: draft.baseURL.trim(), models: modelsPayload() } : {}) };
  const valid = !!view && !!payload && service.writeOperation(view, payload).success;
  return <section className="remote-provider-creation" aria-label={t('新增模型提供方')}>
    {!view && <Button disabled={busy} onClick={() => void run(false)}>{t(busy ? '正在读取…' : '新增模型提供方')}</Button>}
    {view?.created ? <>
      <p role="status">{t(view.applies === 'restart' ? '已保存，重启电脑上的 DSH 后生效。' : '已保存到电脑。')} <bdi>{view.created.provider}</bdi></p>
      {view.created.useKey && <RemoteComputerKey model={model} service={model.providerSettings.forProvider(view.created.provider).key}/>}
      <RemoteProviderCard model={model} provider={view.created.provider}/>
      <Button onClick={() => onCreated(view.created.provider)}>{t('查看提供方设置')}</Button>
    </> : view && draft && <>
      {!view.writable && <p role="status">{t('电脑设置目前只读。')}</p>}
      <fieldset className="remote-provider-creation-form" disabled={busy || !view.writable}>
        <label>{t('提供方来源')}<select className="sheet-editor" value={draft.kind} onChange={event => {
          setDraft(value => ({ ...value, kind: event.target.value, provider: event.target.value === 'catalog' ? view.available[0]?.provider ?? '' : '' })); setReview(false);
        }}><option value="custom">{t('自定义服务')}</option>{view.available.length > 0 && <option value="catalog">{t('电脑支持的提供方')}</option>}</select></label>
        {draft.kind === 'catalog' ? <label>{t('选择内置提供方')}<select className="sheet-editor" value={draft.provider} onChange={event => change('provider', event.target.value)}>
          {view.available.map(row => <option key={row.provider} value={row.provider}>{row.name}</option>)}</select></label> : <>
          <label>{t('提供方标识')}<input className="sheet-editor" value={draft.provider} maxLength={256} placeholder="my-provider" onChange={event => change('provider', event.target.value)}/></label>
          <p className="remote-muted">{t('使用小写字母开头，可包含数字和短横线，不能与已有提供方重复。')}</p>
          <label>{t('服务协议')}<select className="sheet-editor" value={draft.api} onChange={event => change('api', event.target.value)}>
            {view.protocols.map(api => <option key={api}>{api}</option>)}</select></label>
          <label>{t('服务地址')}<input className="sheet-editor" value={draft.baseURL} placeholder="https://…" maxLength={2048} onChange={event => change('baseURL', event.target.value)}/></label>
          {service.modelRowsSupported ? <>
            <RemoteModelProbe model={model} baseURL={draft.baseURL} api={draft.api} rows={draft.modelRows}
              disabled={busy || !view.writable} onAdopt={candidates => change('modelRows', [
                ...draft.modelRows.filter(row => row.id.trim() || row.name.trim() || row.contextWindow.trim() || row.maxTokens.trim() || row.advanced),
                ...candidates.map(row => ({ id: row.id, name: row.name ?? '',
                  contextWindow: row.contextWindow === undefined ? '' : formatCapacity(row.contextWindow),
                  maxTokens: row.maxTokens === undefined ? '' : formatCapacity(row.maxTokens),
                  ...(row.inputModalities ? { advanced: { input: row.inputModalities } } : {}),
                })),
              ])}/>
            {draft.modelRows.map((row, index) => <div className="remote-provider-model-row" key={index}>
              <RemoteModelFields row={row} position={index + 1} disabled={busy || !view.writable}
                onChange={next => change('modelRows', draft.modelRows.map((value, at) => at === index ? next : value))}/>
              <RemoteModelCapabilities inputOnly value={row.advanced} position={index + 1} disabled={busy || !view.writable}
                onChange={advanced => change('modelRows', draft.modelRows.map((value, at) => at === index ? { ...value, advanced } : value))}/>
              <Button onClick={() => change('modelRows', draft.modelRows.filter((_, at) => at !== index))}>{t('移除模型')}</Button>
            </div>)}
            <Button disabled={draft.modelRows.length >= 1000} onClick={() => change('modelRows', [...draft.modelRows, blankModel()])}>{t('添加模型')}</Button>
          </> : <label>{t('模型 ID（每行一个）')}<textarea className="sheet-editor" value={draft.models} onChange={event => change('models', event.target.value)}/></label>}
        </>}
        <label>{t('显示名称（可选）')}<input className="sheet-editor" value={draft.name} maxLength={256} onChange={event => change('name', event.target.value)}/></label>
        <label className="remote-provider-creation-key"><input type="checkbox" checked={draft.useKey} disabled={!view.keyAvailable} onChange={event => change('useKey', event.target.checked)}/>{t('使用 API Key，创建后在原生窗口配置')}</label>
      </fieldset>
      {draft.kind === 'catalog' && draft.provider && <RemoteProviderCard model={model} provider={draft.provider}/>}
      {review && <div role="group" aria-label={t('确认新增提供方')}>
        <p><bdi>{payload.name || payload.provider}</bdi> ({payload.provider})</p>
        <p>{t('电脑会将此提供方的聊天请求发送到以下服务：')}</p>
        <p className="remote-path">{payload.kind === 'custom' ? payload.baseURL : t('由电脑内置模型目录决定。')}</p>
        {payload.kind === 'custom' && payload.baseURL.startsWith('http:') && <p>{t('HTTP 连接未加密，建议使用 HTTPS。')}</p>}
        {payload.useKey && <p>{t('将建立独立 Key 配置，保存提供方后再填写。')}</p>}
        <Button disabled={busy || !valid || !view.writable} onClick={() => void run(true)}>{t(busy ? '正在处理…' : '确认新增')}</Button>
      </div>}
      {!review && <Button disabled={busy || !valid || !view.writable} onClick={() => setReview(true)}>{t('核对提供方')}</Button>}
      <Button disabled={busy} onClick={() => { setView(null); setDraft(null); setNotice(''); setReview(false); }}>{t('取消')}</Button>
      <Button disabled={busy} onClick={() => void run(false)}>{t('重新读取设置')}</Button>
    </>}
    {notice && <p role="status">{t(notice)}</p>}
  </section>;
}
