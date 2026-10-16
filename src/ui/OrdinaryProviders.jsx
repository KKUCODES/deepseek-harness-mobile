import React, { useEffect, useState } from 'react';
import { Button } from '@upstream/ui-primitives/src/Button.tsx';
import { IconChevronLeftOutline14 } from '@upstream/ui-primitives/src/icons/index.tsx';
import { IconButton, Surface } from './Surface.jsx';
import { SurfacePresence } from './motion.jsx';
import { ordinaryError } from '../ordinary-errors.mjs';
import { useTranslate } from './locale.jsx';

const blankModel = () => ({ id: '', label: '', vision: false, thinking: 'none', tokenField: 'max_tokens', sampling: false });
const blankProvider = () => ({ name: '', baseURL: '', models: [blankModel()] });

export function OrdinaryProviders({ session, state, onBack, registerBack }) {
  const t = useTranslate();
  const [draft, setDraft] = useState(null);
  const [remove, setRemove] = useState(null);
  const [notice, setNotice] = useState('');
  const [saving, setSaving] = useState(false);
  const busy = saving || state.busy;
  const current = state.providers.find(provider => provider.id === draft?.id);
  const back = () => { if (saving) return; if (remove) setRemove(null); else if (draft) { setDraft(null); setNotice(''); } else onBack(); };
  useEffect(() => registerBack(() => { back(); return true; }), [saving, draft, remove, registerBack]);
  const perform = async action => {
    if (busy) return;
    setSaving(true); setNotice('');
    try { await action(); }
    catch (error) { setNotice(t(ordinaryError(error))); }
    finally { setSaving(false); }
  };
  const edit = (field, value) => setDraft(before => ({ ...before, [field]: value }));
  const editModel = (index, field, value) => setDraft(before => ({ ...before, models: before.models.map((model, i) => i === index ? { ...model, [field]: value } : model) }));
  return <main className="app settings-app ordinary-settings">
    <header className="topbar"><IconButton label={draft ? t('返回模型服务') : t('返回普通聊天设置')} disabled={saving} onClick={back}><IconChevronLeftOutline14 size={22}/></IconButton><strong>{draft ? draft.builtin ? 'DeepSeek' : t(draft.id ? '编辑供应商' : '添加供应商') : t('模型服务')}</strong><span className="header-spacer"/></header>
    <section className="settings-scroll provider-settings" aria-label={t('模型服务设置')}>
      {notice && <p className="settings-notice" role="status">{notice}</p>}
      {!draft ? <>
        <p className="settings-help">{t('使用自己的 Key，由手机直接连接所选模型服务。')}</p>
        <div className="settings-group">{state.providers.map(provider => <button className="settings-row" key={provider.id} disabled={saving} onClick={() => { setDraft(structuredClone(provider)); setNotice(''); }}>
          <span className="settings-row-label"><strong>{provider.name}</strong><small className="provider-address">{provider.baseURL}</small></span><span className="settings-row-value">{t(provider.configured ? '已配置' : '未配置 Key')}</span>
        </button>)}</div>
        <div className="settings-actions"><Button variant="primary" disabled={busy || state.providers.length >= 31} onClick={() => setDraft(blankProvider())}>{t('添加供应商')}</Button></div>
      </> : draft.builtin ? <>
        <p className="settings-help">{draft.baseURL}</p><p>{t('原有 DeepSeek 配置和聊天继续保留。')}</p>
        <Button variant="primary" disabled={busy} onClick={() => perform(() => session.configure('deepseek'))}>{t(current?.configured ? '管理 Key' : '配置 Key')}</Button>
        <h2 className="settings-group-title">{t('可用模型')}</h2>{draft.models.map(model => <p key={model.id}>{model.label}</p>)}
        <p className="settings-help">{t('使用中转站时，请添加独立供应商并填写它的 API 地址和 Key。')}</p>
      </> : <form onSubmit={event => { event.preventDefault(); void perform(async () => { await session.saveProvider(draft); setDraft(null); }); }}>
        <label className="settings-field">{t('供应商名称')}<input autoComplete="off" required maxLength={80} disabled={busy} value={draft.name} onChange={event => edit('name', event.target.value)}/></label>
        <label className="settings-field">{t('API 地址')}<input type="url" required inputMode="url" autoCapitalize="none" autoComplete="off" spellCheck={false} placeholder="https://example.com/v1" maxLength={2048} disabled={busy || current?.configured} value={draft.baseURL} onChange={event => edit('baseURL', event.target.value)}/></label>
        <p className="settings-help">{t('支持 OpenAI Chat Completions 兼容格式。填写 HTTPS 基础地址，不含 /chat/completions。')}</p>
        {current?.configured && <p className="settings-help">{t('更换 API 地址前，请在管理 Key 中移除旧 Key，再编辑地址。')}</p>}
        {current && <Button type="button" variant="outline" disabled={busy} onClick={() => perform(() => session.configure(current.id))}>{t(current.configured ? '管理 Key' : '配置 Key')}</Button>}
        {!current && <p className="settings-help">{t('保存供应商后，在原生密码窗口配置 Key。')}</p>}
        <h2 className="settings-group-title">{t('模型')}</h2>
        {draft.models.map((model, index) => <fieldset className="provider-model" key={index} disabled={busy}>
          <legend>{t('模型 {count}', { count: index + 1 })}</legend>
          <label className="settings-field">{t('模型 ID')}<input required autoCapitalize="none" autoComplete="off" spellCheck={false} maxLength={200} value={model.id} onChange={event => editModel(index, 'id', event.target.value)}/></label>
          <label className="settings-field">{t('显示名称')}<input maxLength={80} value={model.label} onChange={event => editModel(index, 'label', event.target.value)}/></label>
          <label className="provider-check"><input type="checkbox" checked={model.vision} onChange={event => editModel(index, 'vision', event.target.checked)}/>{t('支持图片输入')}</label>
          <details><summary>{t('兼容设置')}</summary>
            <label className="settings-field">{t('思考参数')}<select value={model.thinking} onChange={event => editModel(index, 'thinking', event.target.value)}><option value="none">{t('不发送')}</option><option value="thinking">thinking.type</option><option value="reasoning_effort">reasoning_effort</option></select></label>
            {model.thinking === 'reasoning_effort' && <p className="settings-help">{t('开启时发送自定义思考强度，关闭时使用服务端默认思考。')}</p>}
            <label className="settings-field">{t('输出上限参数')}<select value={model.tokenField} onChange={event => editModel(index, 'tokenField', event.target.value)}><option value="max_tokens">max_tokens</option><option value="max_completion_tokens">max_completion_tokens</option></select></label>
            <label className="provider-check"><input type="checkbox" checked={model.sampling} onChange={event => editModel(index, 'sampling', event.target.checked)}/>{t('发送随机性参数')}</label>
            <p className="settings-help">{t('按服务文档选择能力；默认不发送思考或随机性参数，输出上限留空时沿用服务端设置。')}</p>
          </details>
          <Button type="button" variant="outline" disabled={draft.models.length === 1} onClick={() => edit('models', draft.models.filter((_, i) => i !== index))}>{t('移除模型')}</Button>
        </fieldset>)}
        <div className="settings-actions"><Button type="button" variant="outline" disabled={busy || draft.models.length >= 50} onClick={() => edit('models', [...draft.models, blankModel()])}>{t('添加模型')}</Button><Button type="submit" variant="primary" disabled={busy}>{t('保存')}</Button>{current && <Button type="button" disabled={busy} onClick={() => setRemove(current)}>{t('删除供应商')}</Button>}</div>
      </form>}
    </section>
    <SurfacePresence>{remove && <Surface title={t('删除供应商')} onClose={() => { if (!saving) setRemove(null); }}><h2>{t('删除供应商')}</h2><p>{t('将删除此供应商的配置和 Key，聊天记录保留。相关聊天需要重新选择模型后才能发送。')}</p><div className="settings-actions"><Button disabled={saving} onClick={() => setRemove(null)}>{t('取消')}</Button><Button variant="primary" disabled={busy} onClick={() => perform(async () => { await session.removeProvider(remove); setRemove(null); setDraft(null); })}>{t('确认删除')}</Button></div>{notice && <p role="alert">{notice}</p>}</Surface>}</SurfacePresence>
  </main>;
}
