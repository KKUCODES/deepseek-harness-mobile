import React, { useEffect, useRef, useState } from 'react';
import { Button } from '@upstream/ui-primitives/src/Button.tsx';
import { formatCapacity, parseCapacity } from '../../../deepseek-harness/packages/client/ui-settings-models/src/client/DeepSeekModelsEditor.tsx';
import { useTranslate } from './locale.jsx';
import { RemoteModelCapabilities } from './RemoteModelCapabilities.jsx';
import { RemoteModelCompat } from './RemoteModelCompat.jsx';
import { compatTemplateDraft, compatPayload } from '../model-compat-draft.mjs';
import { RemoteModelFields } from './RemoteModelFields.jsx';
import { RemoteModelCandidates } from './RemoteModelCandidates.jsx';
import { RemoteModelProbe } from './RemoteModelProbe.jsx';

const editable = row => ({ ...row, name: row.name ?? '', contextWindow: row.contextWindow === undefined ? '' : formatCapacity(row.contextWindow),
  maxTokens: row.maxTokens === undefined ? '' : formatCapacity(row.maxTokens),
  compatTemplates: compatTemplateDraft(row.compat) });
const payload = row => ({ ...(row.source ? { source: row.source } : {}), id: row.id,
  ...(row.name ? { name: row.name } : {}),
  ...Object.fromEntries(['contextWindow', 'maxTokens'].flatMap(field => row[field].trim() ? [[field, parseCapacity(row[field])]] : [])),
  ...(row.advanced === undefined ? {} : { advanced: row.advanced }),
  ...(row.compat === undefined && !Object.keys(row.compatTemplates ?? {}).length ? {} : { compat: compatPayload(row.compat, row.compatTemplates) }),
});

export function RemoteProviderModelEditor({ service, probe }) {
  const t = useTranslate(), [opened, setOpened] = useState(false);
  const overrides = service.scope === 'overrides';
  const title = service.official ? '编辑 DeepSeek 模型清单' : overrides ? '编辑内置模型覆盖' : '编辑模型清单';
  const [view, setView] = useState(null), [rows, setRows] = useState([]), [dirty, setDirty] = useState(false);
  const [reset, setReset] = useState(false), [busy, setBusy] = useState(false), [notice, setNotice] = useState('');
  const [candidates, setCandidates] = useState(null);
  const [stale, setStale] = useState(false);
  const lifetime = useRef(null), active = useRef(null);
  const dirtyRef = useRef(dirty), revision = useRef(0), refresh = useRef(() => {});
  dirtyRef.current = dirty;
  const run = async (writing, automatic = false) => {
    const controller = lifetime.current;
    if (!controller || controller.signal.aborted || active.current) return;
    if (writing && stale) return;
    if (automatic && dirtyRef.current) { setStale(true); return; }
    const started = revision.current;
    active.current = controller; setBusy(true); setNotice('');
    try {
      const next = writing ? await service.save(view, reset ? { op: 'unset' } : { op: 'set', rows: rows.map(payload) }, controller.signal)
        : await service.read(controller.signal);
      if (controller.signal.aborted) return;
      if (!writing && started !== revision.current) return;
      if (automatic && dirtyRef.current) { setStale(true); return; }
      setView(next); setRows(next.rows.map(editable)); setDirty(false); setReset(false);
      dirtyRef.current = false; setStale(false);
      setCandidates(null);
      if (writing) setNotice(next.applies === 'restart' ? '已保存，重启电脑上的 DSH 后生效。' : '已保存到电脑。');
    } catch (error) { if (!controller.signal.aborted) { if (!writing && !automatic) setView(null); setNotice(error.message); } }
    finally {
      if (active.current === controller) active.current = null;
      if (!controller.signal.aborted) {
        setBusy(false);
        if (started !== revision.current) queueMicrotask(() => refresh.current());
      }
    }
  };
  refresh.current = () => { if (opened && service.supported) void run(false, true); };
  useEffect(() => {
    if (!opened || !service.supported) return;
    const controller = new AbortController(); lifetime.current = controller;
    const invalidate = () => {
      revision.current++;
      setCandidates(null);
      if (dirtyRef.current) setStale(true);
      if (!active.current) refresh.current();
    };
    const offs = ['settings/document-updated', 'llm/adapters-updated'].map(event => service.model.remote.$on(event, invalidate));
    setView(null); setRows([]); setDirty(false); dirtyRef.current = false; setStale(false);
    setReset(false); setCandidates(null); void run(false);
    return () => { controller.abort(); offs.forEach(off => off()); if (active.current === controller) active.current = null; };
  }, [service, opened]);
  const blocked = overrides && view?.blockedByModels;
  const disabled = busy || !view?.writable || reset || blocked;
  const discover = async () => {
    const controller = lifetime.current;
    if (!controller || controller.signal.aborted || active.current) return;
    active.current = controller; setBusy(true); setNotice(''); setCandidates(null);
    const started = revision.current;
    try {
      const result = await service.discovery.read(controller.signal);
      if (!controller.signal.aborted && started === revision.current) setCandidates(result.rows);
    } catch (error) { if (!controller.signal.aborted) setNotice(error.message); }
    finally {
      if (active.current === controller) active.current = null;
      if (!controller.signal.aborted) {
        setBusy(false);
        if (started !== revision.current) queueMicrotask(() => refresh.current());
      }
    }
  };
  const adopt = chosen => {
    if (disabled || !chosen.length || rows.length + chosen.length > 1000) return;
    // 覆盖只填模型ID，避免把目录默认值物化成用户覆盖；清单可带入发现的公开能力。
    setRows(current => [...current, ...chosen.map(row => editable(overrides ? { id: row.id } : {
      id: row.id, name: row.name, contextWindow: row.contextWindow, maxTokens: row.maxTokens,
      ...(row.inputModalities ? { advanced: { input: row.inputModalities } } : {}),
    }))]);
    setDirty(true); setCandidates(null);
  };
  return <section className="remote-provider-model-editor" aria-label={t(title)}>
    <Button aria-expanded={opened} onClick={() => setOpened(value => !value)}>{t(title)}</Button>
    {opened && (!service.supported ? <p role="status">{t('请更新电脑远程插件和网关后使用电脑设置。')}</p> : <>
      <p className="remote-muted">{t(overrides ? '只调整内置目录中的指定模型，其他模型保持。填写目录中的模型 ID；这里只编辑用户覆盖，移除后保留电脑基础配置。' : '这份清单会替换提供方的内置目录。恢复默认会移除电脑上的用户覆盖。')}</p>
      <p className="remote-muted">{t('容量留空时沿用电脑默认值，支持 K、M；其他模型设置保持原值。')}</p>
      {view && !view.writable && <p role="status">{t('电脑设置目前只读。')}</p>}
      {blocked && <p role="status">{t('当前使用自定义模型清单，请在模型清单中调整；恢复内置目录后可使用单个模型覆盖。')}</p>}
      {probe && <RemoteModelProbe model={service.model} provider={service.provider} baseURL={probe.baseURL} api={probe.api}
        rows={rows} disabled={disabled || stale || probe.disabled} onAdopt={adopt}/>}
      {service.discovery?.supported && <>
        <Button disabled={disabled} onClick={() => void discover()}>{t('获取可用模型')}</Button>
        <p className="remote-muted">{t('使用电脑已保存的提供方配置获取目录，选择后加入草稿，保存后生效。')}</p>
        {candidates && <RemoteModelCandidates candidates={candidates} rows={rows} disabled={disabled} onAdopt={adopt}/>}
      </>}
      {reset ? <p role="status">{t('保存后恢复电脑默认值')}</p> : rows.map((row, index) => <div className="remote-provider-model-row" key={row.source ?? index}>
        <RemoteModelFields row={row} position={index + 1} disabled={disabled}
          onChange={next => { setRows(current => current.map((item, at) => at === index ? next : item)); setDirty(true); }}/>
        {view.advancedEditable && <RemoteModelCapabilities inputOnly={service.official} value={row.advanced} position={index + 1} disabled={disabled}
          onChange={advanced => { setRows(current => current.map((item, at) => at === index ? { ...item, advanced } : item)); setDirty(true); }} />}
        {view.compatEditable && <RemoteModelCompat value={row.compat} templates={row.compatTemplates} position={index + 1} disabled={disabled}
          onChange={compat => { setRows(current => current.map((item, at) => at === index ? { ...item, compat } : item)); setDirty(true); }}
          onTemplate={(key, text) => { setRows(current => current.map((item, at) => at === index ? { ...item, compatTemplates: { ...item.compatTemplates, [key]: text } } : item)); setDirty(true); }} />}
        <Button disabled={disabled} onClick={() => { setRows(current => current.filter((_, at) => at !== index)); setDirty(true); }}>{t(overrides ? '移除用户覆盖' : '移除模型')}</Button>
      </div>)}
      {view && !reset && rows.length === 0 && <p>{t(service.official ? '模型清单为空，保存后不提供可选模型。' : overrides ? '没有单独设置的用户覆盖。' : '未单独列出模型，将使用提供方内置目录（若有）。')}</p>}
      <Button disabled={disabled || rows.length >= 1000} onClick={() => { setRows(current => [...current, editable({ id: '' })]); setDirty(true); }}>{t(overrides ? '添加模型覆盖' : '添加模型')}</Button>
      <Button disabled={busy || !view?.writable || !view.overridden || reset} onClick={() => { setReset(true); setDirty(true); }}>{t(overrides ? '恢复默认模型覆盖' : '恢复默认模型清单')}</Button>
      <Button variant="primary" disabled={busy || stale || !view?.writable || !dirty || (blocked && !reset)} onClick={() => void run(true)}>{t(overrides ? '保存模型覆盖' : '保存模型清单')}</Button>
      <Button disabled={busy} onClick={() => void run(false)}>{t(overrides ? '重新读取模型覆盖' : '重新读取模型清单')}</Button>
      {dirty && <p className="remote-muted">{t('重新读取会放弃未保存的修改。')}</p>}
      {stale && <p role="status">{t('电脑设置已变化。你的修改已保留，请重新读取设置后核对。')}</p>}
      {busy && <p role="status">{t('正在处理…')}</p>}
      {notice && <p role="status">{t(notice)}</p>}
    </>)}
  </section>;
}
