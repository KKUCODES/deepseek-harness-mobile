import { useTranslate } from './locale.jsx';
import React, { useEffect, useState, useSyncExternalStore } from 'react';
import { Button } from '@upstream/ui-primitives/src/Button.tsx';
import { Switch } from '@upstream/ui-primitives/src/Switch.tsx';
import { IconChevronLeftOutline14, IconChevronRightOutline14, IconCloseOutline16, IconCordisPluginOutline14, IconPlusOutline16, IconSearchOutline16 } from '@upstream/ui-primitives/src/icons/index.tsx';
import { IconButton, Surface } from './Surface.jsx';
import { PHONE_PLUGIN_CATALOG } from '../phone-plugins.mjs';
import { ordinaryError } from '../ordinary-errors.mjs';
import './plugins.css';

export function PhonePluginsPage({ host, onBack, onRemote, renderSlot, registerBack }) {
  const t = useTranslate();
  const state = useSyncExternalStore(host.phonePlugins.state.subscribe, host.phonePlugins.state.getSnapshot);
  const [selected, setSelected] = useState(null);
  const [catalog, setCatalog] = useState(false);
  const [query, setQuery] = useState('');
  const [sheet, setSheet] = useState(null);
  const [error, setError] = useState('');
  const promptScope = host.ordinaryInput.promptSettings;
  const [prompts, setPrompts] = useState([]);
  const current = PHONE_PLUGIN_CATALOG.find(plugin => plugin.id === selected);
  const record = state.record[selected];
  const busy = !!state.busy;
  const back = () => { if (selected) { setSelected(null); return true; } if (catalog) { setCatalog(false); return true; } return false; };
  useEffect(() => registerBack(back), [selected, catalog, registerBack]);
  async function change(action) {
    setError('');
    try { await host.phonePlugins.change(selected, action); setSheet(null); }
    catch (failure) { setError(t(ordinaryError(failure))); }
  }
  return <main className="app plugins-app">
    <header className="topbar"><IconButton label={t("返回")} onClick={() => { if (!back()) onBack(); }}><IconChevronLeftOutline14 size={22}/></IconButton><strong className="plugin-page-title">{(current ? t(current.name) : null) ?? (catalog ? t('安装插件') : t('插件'))}</strong><span className="header-spacer"/></header>
    {!current && <div className="plugin-tabs" role="tablist"><button role="tab" aria-selected="true">{t("手机")}</button><button role="tab" aria-selected="false" onClick={() => { void onRemote(); }}>{t("电脑")}</button></div>}
    <section className="plugin-scroll" aria-label={t("手机插件")}>
      {(error || state.error) && <p role="alert" className="plugin-result is-error">{error || t(ordinaryError(state.error))}</p>}
      {current ? <>
        <div className="plugin-detail-heading"><span className="plugin-symbol"><IconCordisPluginOutline14 size={24}/></span><h1>{t(current.name)} <small>{record.installed ? record.version : current.version}</small></h1><code>{current.source}</code><p>{t(current.description)}</p></div>
        <div className="plugin-actions">{record.installed ? <><Button variant="outline" disabled={busy} onClick={() => setSheet('uninstall')}>{t("卸载")}</Button><label className="plugin-enabled">{record.enabled ? t('已启用') : t('已停用')}<Switch label={t('启用{name}', { name: t(current.name) })} checked={record.enabled} disabled={busy} onChange={() => change(record.enabled ? 'disable' : 'enable')}/></label></> : <Button variant="primary" disabled={busy} onClick={() => change('install')}>{t("安装")}</Button>}</div>
        {record.installed && <div className="plugin-actions"><Button variant="outline" disabled={busy || record.version === current.version} onClick={() => change('update')}>{record.version === current.version ? t('已是最新版本') : t('更新至 {version}', { version: current.version })}</Button>{current.configurable && <Button variant="outline" disabled={!record.enabled || busy} onClick={() => { setPrompts(structuredClone(promptScope.getSnapshot().value.prompts)); setSheet('settings'); }}>{t("设置")}</Button>}</div>}
        <section className="plugin-section"><h2>{t("功能与来源")}</h2><p>{t(current.capabilities)}</p><p className="muted">{t("随 App 提供的手机兼容版本。插件随 App 升级，设置和启停状态会保留。")}</p></section>
      </> : <><p className="plugin-location">{t("这台手机 · 普通聊天")}</p><div className="plugin-list-tools"><label className="plugin-search"><IconSearchOutline16/><input aria-label={t("搜索插件")} placeholder={t("搜索插件")} value={query} onChange={event => setQuery(event.target.value)}/></label>{!catalog && <IconButton label={t("安装插件")} onClick={() => setCatalog(true)}><IconPlusOutline16/></IconButton>}</div>
        <div className="plugin-section-heading"><h2>{catalog ? t('可安装的手机插件') : t('已安装')}</h2></div><div className="plugin-list">{PHONE_PLUGIN_CATALOG.filter(plugin => (catalog || state.record[plugin.id].installed) && `${t(plugin.name)} ${plugin.source}`.toLowerCase().includes(query.trim().toLowerCase())).map(plugin => <button key={plugin.id} className="plugin-row" onClick={() => { setError(''); setSelected(plugin.id); }}><span className="plugin-symbol"><IconCordisPluginOutline14 size={22}/></span><span className="plugin-row-main"><strong>{t(plugin.name)}</strong><span>{t(plugin.description)}</span><small className={state.record[plugin.id].enabled ? 'plugin-running' : ''}>{!state.record[plugin.id].installed ? t('未安装') : state.record[plugin.id].enabled ? t('运行中') : t('已停用')}</small></span><IconChevronRightOutline14/></button>)}</div>
      </>}
    </section>
    {sheet && <Surface title={sheet === 'uninstall' ? t('卸载插件') : t('插件设置')} onClose={() => setSheet(null)}><header><h2>{sheet === 'uninstall' ? t('卸载 {name}', { name: t(current.name) }) : t(current.name)}</h2><IconButton label={t("关闭窗口")} onClick={() => setSheet(null)}><IconCloseOutline16/></IconButton></header>
      {sheet === 'uninstall' ? <><p>{t("卸载后该插件停止运行，聊天记录和插件设置会保留。")}</p><Button variant="primary" disabled={busy} onClick={() => change('uninstall')}>{t("确认卸载")}</Button></> : current.id === 'theme' ? renderSlot('settings.general.item', {}) : <>
        {prompts.map((prompt, index) => <div className="prompt-field" key={index}><label>{t("触发词")}<input value={prompt.name} onChange={event => setPrompts(rows => rows.map((item, i) => i === index ? { ...item, name: event.target.value } : item))}/></label><label>{t("名称")}<input value={prompt.label} onChange={event => setPrompts(rows => rows.map((item, i) => i === index ? { ...item, label: event.target.value } : item))}/></label><label>{t("提示词")}<textarea value={prompt.value} onChange={event => setPrompts(rows => rows.map((item, i) => i === index ? { ...item, value: event.target.value } : item))}/></label><Button onClick={() => setPrompts(rows => rows.filter((_, i) => i !== index))}>{t("移除这条提示词")}</Button></div>)}
        <Button disabled={prompts.length >= 30} onClick={() => setPrompts(rows => [...rows, { name: `prompt${rows.length + 1}`, label: t('新提示词'), value: '' }])}>{t("添加提示词")}</Button><Button variant="primary" onClick={async () => { try { await promptScope.set('prompts', prompts); setSheet(null); } catch { setError(t('保存失败：触发词需唯一且不含空格，名称和提示词不能为空。')); } }}>{t("保存")}</Button>
      </>}
      {error && <p role="alert">{error}</p>}
    </Surface>}
  </main>;
}
