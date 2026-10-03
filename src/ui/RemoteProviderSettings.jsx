import React, { useEffect, useId, useRef, useState, useSyncExternalStore } from 'react';
import { Button } from '@upstream/ui-primitives/src/Button.tsx';
import { useTranslate } from './locale.jsx';
import { RemoteComputerEndpoint } from './RemoteComputerEndpoint.jsx';
import { RemoteProviderModels } from './RemoteProviderModels.jsx';
import { RemoteComputerKey } from './RemoteComputerKey.jsx';
import { RemoteProviderModelEditor } from './RemoteProviderModelEditor.jsx';
import { RemoteModelCompat } from './RemoteModelCompat.jsx';
import { RemoteProviderRemoval } from './RemoteProviderRemoval.jsx';
import { RemoteProviderCreation } from './RemoteProviderCreation.jsx';
import { RemoteProviderCard } from './RemoteProviderCard.jsx';
import { compatTemplateDraft, compatPayload } from '../model-compat-draft.mjs';

const definitions = {
  displayName: { label: '提供方名称', type: 'text' },
  defaultContextWindow: { label: '默认上下文容量（Token）', min: 1 },
  defaultMaxTokens: { label: '默认输出容量（Token）', min: 1 },
  streamIdleTimeoutMs: { label: '等待输出超时（毫秒）', min: 0, step: 'any' },
  timeoutMs: { label: '请求超时（毫秒）', min: 0 },
  cacheRetention: { label: '缓存保留', choices: [['none', '不保留'], ['short', '短期'], ['long', '长期']] },
  transport: { label: '连接方式', choices: [['sse', 'SSE'], ['websocket', 'WebSocket'], ['websocket-cached', 'WebSocket（缓存）'], ['auto', '自动']] },
};

function ProviderForm({ model, settings, generation, onRemoved }) {
  const t = useTranslate();
  const formId = useId();
  const [view, setView] = useState(null), [draft, setDraft] = useState({}), [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [stale, setStale] = useState(false);
  const [keyConfirm, setKeyConfirm] = useState(false);
  const [protocolDraft, setProtocolDraft] = useState(null), [protocolConfirm, setProtocolConfirm] = useState(false);
  const [endpointDraft, setEndpointDraft] = useState({ value: '', available: false });
  const [compat, setCompat] = useState({}), [templates, setTemplates] = useState({}), [compatDirty, setCompatDirty] = useState(false);
  const active = useRef(null), lifetime = useRef(null);
  const run = async writing => {
    if (active.current || !lifetime.current || lifetime.current.signal.aborted) return;
    const controller = lifetime.current; active.current = controller;
    setBusy(true); setNotice(''); setKeyConfirm(false); setProtocolConfirm(false);
    try {
      const next = writing === 'key' ? await settings.prepareKey(view, controller.signal) : writing ? await settings.save(view, { edits: Object.values(draft),
        ...(compatDirty ? { compat: compatPayload(compat, templates) } : {}),
        ...(protocolDraft === null ? {} : { protocolChange: { value: protocolDraft, confirmed: true } }) }, controller.signal) : await settings.read(controller.signal);
      if (controller.signal.aborted) return;
      setView(next); setStale(false); setDraft({}); setProtocolDraft(null);
      setCompat(next.compat?.overrides ?? {}); setTemplates(compatTemplateDraft(next.compat?.overrides)); setCompatDirty(false);
      if (writing) setNotice(next.applies === 'restart' ? '已保存，重启电脑上的 DSH 后生效。' : '已保存到电脑。');
    } catch (error) {
      if (!controller.signal.aborted) { setStale(settings.view !== view); setNotice(error.message); }
    }
    finally { if (active.current === controller) active.current = null; if (!controller.signal.aborted) setBusy(false); }
  };
  useEffect(() => {
    const controller = new AbortController(); lifetime.current = controller;
    setView(null); setStale(false); setDraft({}); setProtocolDraft(null); setProtocolConfirm(false); void run(false);
    return () => { controller.abort(); };
  }, [settings, generation]);
  const change = (key, edit) => setDraft(value => ({ ...value, [key]: edit }));
  return <div className="remote-provider-form">
    <RemoteProviderModels model={model} provider={settings.provider}/>
    <RemoteProviderModelEditor service={settings.models} probe={{ baseURL: endpointDraft.value, api: protocolDraft ?? view?.protocol?.value,
      disabled: busy || stale || !view?.writable || !endpointDraft.available }}/>
    <RemoteProviderModelEditor service={settings.overrides} probe={{ baseURL: endpointDraft.value, api: protocolDraft ?? view?.protocol?.value,
      disabled: busy || stale || !view?.writable || !endpointDraft.available }}/>
    <p className="remote-muted">{t('默认容量用于模型未声明容量时的回退，不会覆盖模型自身的上限。')}</p>
    {view && <form onSubmit={event => { event.preventDefault(); if (stale) return; if (protocolDraft !== null) setProtocolConfirm(true); else void run(true); }}>
      {!view.writable && <p role="status">{t('电脑设置目前只读。')}</p>}
      {view.protocol && <label>{t('服务协议')}<select className="sheet-editor" disabled={busy || !view.writable}
        value={protocolDraft ?? view.protocol.value ?? ''} onChange={event => {
          setProtocolDraft(event.target.value === view.protocol.value ? null : event.target.value); setProtocolConfirm(false);
        }}>
        {!view.protocol.value && <option value="" disabled>{t('选择服务协议')}</option>}
        {view.protocol.choices.map(value => <option key={value} value={value}>{value}</option>)}
      </select></label>}
      {view.fields.map(field => {
        const definition = definitions[field.key], edit = draft[field.key], disabled = busy || !view.writable;
        const value = edit?.op === 'set' ? edit.value : field.value ?? '';
        const id = `${formId}-provider-setting-${field.key}`;
        return <div className="remote-computer-setting" key={field.key}>
          <label htmlFor={id}>{t(definition.label)}</label>
          {definition.choices ? <select id={id} className="sheet-editor" value={value} disabled={disabled}
            onChange={event => change(field.key, { op: 'set', key: field.key, value: event.target.value })}>
            <option value="" disabled>{t('电脑默认')}</option>
            {definition.choices.map(([key, label]) => <option key={key} value={key}>{t(label)}</option>)}
          </select> : <input id={id} className="sheet-editor" type={definition.type ?? 'number'} min={definition.min}
            maxLength={definition.type === 'text' ? 256 : undefined} step={definition.step ?? '1'} value={value} disabled={disabled}
            onChange={event => change(field.key, { op: 'set', key: field.key,
              value: definition.type === 'text' || event.target.value === '' ? event.target.value : Number(event.target.value) })}/>}
          <div className="remote-setting-meta"><small>{t(edit?.op === 'unset' ? '保存后恢复电脑默认值' : field.overridden ? '已单独设置' : '使用电脑默认值')}</small>
            <Button type="button" disabled={disabled || (!field.overridden && !edit)} onClick={() => change(field.key, { op: 'unset', key: field.key })}>{t('恢复默认')}</Button>
          </div>
        </div>;
      })}
      {view.compat && <RemoteModelCompat provider value={compat} templates={templates} position={t('提供方')} disabled={busy || !view.writable}
        onChange={value => { setCompat(value); setCompatDirty(true); }}
        onTemplate={(key, text) => { setTemplates(value => ({ ...value, [key]: text })); setCompatDirty(true); }}/>}
      {protocolConfirm && protocolDraft !== null && <div role="group" aria-label={t('确认服务协议更改')}>
        <p>{t('后续请求将使用新的服务协议，请确认它与当前服务地址匹配。')}</p>
        <p><bdi>{view.protocol?.value ?? t('未设置')}</bdi> → <bdi>{protocolDraft}</bdi></p>
        <Button type="button" disabled={busy || stale || !view.writable} onClick={() => void run(true)}>{t('确认保存协议')}</Button>
        <Button type="button" disabled={busy} onClick={() => setProtocolConfirm(false)}>{t('取消')}</Button>
      </div>}
      <Button type="submit" variant="primary" disabled={busy || stale || !view.writable || (!Object.keys(draft).length && !compatDirty && protocolDraft === null)}>{t('保存到电脑')}</Button>
    </form>}
    <Button disabled={busy} onClick={() => void run(false)}>{t(busy ? '正在处理…' : '重新读取设置')}</Button>
    {(!!Object.keys(draft).length || compatDirty || protocolDraft !== null) && <p className="remote-muted">{t('重新读取会放弃未保存的修改。')}</p>}
    {notice && <p role="status">{t(notice)}</p>}
    <RemoteComputerEndpoint model={model} service={settings.endpoint} onDraftChange={setEndpointDraft}/>
    {view?.keySetupAvailable && settings.keySetupSupported ? <section className="remote-computer-setting" aria-label={t('启用提供方 API Key')}>
      <h3>{t('电脑提供方 Key')}</h3>
      <p>{t('此提供方尚未设置单独的 API Key。')}</p>
      <p className="remote-muted">{t('启用后将改用单独填写的 API Key；保存 Key 前此提供方可能无法聊天。')}</p>
      {(Object.keys(draft).length > 0 || compatDirty || protocolDraft !== null) && <p>{t('请先保存或放弃上方未保存的设置。')}</p>}
      {keyConfirm && <div role="group" aria-label={t('确认启用 API Key')}>
        <p>{t('模型提供方')}：<bdi>{settings.provider}</bdi></p>
        <p>{t('将建立独立 Key 配置，保存提供方后再填写。')}</p>
        <Button disabled={busy || stale || !view.writable || Object.keys(draft).length > 0 || compatDirty || protocolDraft !== null} onClick={() => void run('key')}>{t('确认启用 API Key')}</Button>
        <Button disabled={busy} onClick={() => setKeyConfirm(false)}>{t('取消')}</Button>
      </div>}
      {!keyConfirm && <Button disabled={busy || stale || !view.writable || Object.keys(draft).length > 0 || compatDirty || protocolDraft !== null} onClick={() => setKeyConfirm(true)}>{t('启用 API Key')}</Button>}
    </section> : view && <RemoteComputerKey model={model} service={settings.key}/>}
    <RemoteProviderRemoval service={settings.removal} onRemoved={onRemoved}/>
    <RemoteProviderCard model={model} provider={settings.provider}/>
  </div>;
}

export function RemoteProviderSettings({ model }) {
  const t = useTranslate(), state = useSyncExternalStore(model.subscribeView, model.getSnapshot);
  const settings = model.providerSettings, generation = model.connection.generation.getSnapshot()?.id;
  const connected = state.connectionState === 'connected';
  const [opened, setOpened] = useState(false), [providers, setProviders] = useState(null), [selected, setSelected] = useState('');
  const [notice, setNotice] = useState(''), [refreshing, setRefreshing] = useState(false);
  const [visited, setVisited] = useState([]);
  const [creationVersion, setCreationVersion] = useState(0);
  const afterRefresh = useRef(''), refresh = useRef(() => {}), settled = useRef(Promise.resolve());
  const allowed = opened && connected && settings.permitted && settings.supported;
  useEffect(() => {
    setProviders(null); setSelected(''); setVisited([]); setNotice(''); setRefreshing(false);
    if (!allowed) return;
    let alive = true, active = null, revision = 0, reread = false;
    const load = () => {
      if (!alive) return;
      if (active) { reread = true; return; }
      const controller = new AbortController(), started = revision, previous = settled.current;
      active = controller; setRefreshing(true); setNotice('');
      settled.current = (async () => {
        // 连接切换先等旧请求释放服务锁；目录刷新不重新挂载仍存在的提供方表单。
        await previous;
        if (!alive) return;
        try {
          const result = await settings.read(controller.signal);
          if (alive && started === revision) {
            setProviders(result.providers);
            setVisited(current => current.filter(id => result.providers.some(row => row.provider === id)));
            const preferred = afterRefresh.current; afterRefresh.current = '';
            setSelected(current => result.providers.some(row => row.provider === (preferred || current)) ? preferred || current : '');
          }
        } catch (error) { if (alive && started === revision) setNotice(error.message); }
        finally {
          if (alive) {
            active = null;
            if (reread) { reread = false; queueMicrotask(load); }
            else setRefreshing(false);
          }
        }
      })();
    };
    const invalidate = () => { revision++; load(); };
    refresh.current = invalidate;
    const offs = ['settings/document-updated', 'llm/adapters-updated'].map(event => model.remote.$on(event, invalidate));
    load();
    return () => { alive = false; active?.abort(); refresh.current = () => {}; offs.forEach(off => off()); };
  }, [allowed, generation, settings, model]);
  useEffect(() => {
    if (selected) setVisited(current => current.includes(selected) ? current : [...current, selected]);
  }, [selected]);
  if (!settings.permitted) return null;
  return <section className="remote-provider-settings" aria-label={t('其他模型提供方')}>
    <Button disabled={!connected} onClick={() => setOpened(value => !value)} aria-expanded={opened}>{t('其他模型提供方')}</Button>
    {opened && (!settings.supported ? <p role="status">{t('请更新电脑远程插件和网关后使用电脑设置。')}</p> : connected && <>
      {!providers && !notice && <p role="status">{t('正在读取…')}</p>}
      {providers?.length === 0 && <p role="status">{t('电脑尚未配置其他模型提供方。')}</p>}
      {!!providers?.length && <label>{t('模型提供方')}<select className="sheet-editor" value={selected} onChange={event => setSelected(event.target.value)}>
        <option value="">{t('选择提供方')}</option>{providers.map(row => <option key={row.provider} value={row.provider}>{row.name}</option>)}
      </select></label>}
      {/* 查看已有提供方只隐藏新增草稿；完成新增后释放它，允许下一次创建。 */}
      <div hidden={!!selected} inert={selected ? '' : undefined}>
        <RemoteProviderCreation key={`${generation}:${creationVersion}`} model={model} service={settings.creation}
          onCreated={provider => { setCreationVersion(value => value + 1); afterRefresh.current = provider; refresh.current(); }}/>
      </div>
      {/* 切换目录只隐藏已打开的表单，保留各自草稿；移除、收权或换连接时释放。 */}
      {visited.map(provider => <div key={`${generation}:${provider}`} hidden={selected !== provider} inert={selected !== provider ? '' : undefined}>
        <ProviderForm model={model} generation={generation} settings={settings.forProvider(provider)}
          onRemoved={() => { setVisited(current => current.filter(id => id !== provider)); setSelected(''); refresh.current(); }}/>
      </div>)}
      {notice && <p role="status">{t(notice)}</p>}
      <Button disabled={refreshing} onClick={() => refresh.current()}>{t('刷新提供方')}</Button>
    </>)}
  </section>;
}
