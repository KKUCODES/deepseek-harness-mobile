import React, { useEffect, useState, useSyncExternalStore } from 'react';
import { Button } from '@upstream/ui-primitives/src/Button.tsx';
import { Switch } from '@upstream/ui-primitives/src/Switch.tsx';
import { IconChevronLeftOutline14, IconChevronRightOutline14, IconCloseOutline16, IconCordisPluginOutline14, IconPlusOutline16, IconSearchOutline16 } from '@upstream/ui-primitives/src/icons/index.tsx';
import { IconButton, Surface } from './Surface.jsx';
import { SurfacePresence } from './motion.jsx';
import { pluginStatus } from '../phone-plugin-catalog.mjs';
import { phonePluginSettings } from './PhonePluginSettings.jsx';
import { ordinaryError } from '../ordinary-errors.mjs';
import { useTranslate } from './locale.jsx';
import './plugins.css';

export function PhonePluginsPage({ host, onBack, onRemote, renderSlot, registerBack }) {
  const t = useTranslate(), registry = host.phonePlugins;
  const state = useSyncExternalStore(registry.state.subscribe, registry.state.getSnapshot);
  const [selected, setSelected] = useState(null), [catalog, setCatalog] = useState(false), [query, setQuery] = useState('');
  const [sheet, setSheet] = useState(null), [error, setError] = useState('');
  const current = registry.catalog.find(entry => entry.id === selected), record = state.record[selected];
  const busy = !!state.busy || !state.ready || !!current && !registry.canManage(current);
  const Settings = (host.pluginSettings ?? phonePluginSettings)[current?.settings];
  const status = current && pluginStatus(record, state.runtime[current.id]);
  const back = () => { if (selected) { setSelected(null); return true; } if (catalog) { setCatalog(false); return true; } return false; };
  useEffect(() => registerBack(back), [selected, catalog, registerBack]);
  useEffect(() => { void registry.start().catch(() => setError(t('无法读取手机插件设置，请重新打开插件页。'))); }, [registry]);
  async function change(action) {
    setError('');
    try { await registry.change(selected, action); setSheet(null); }
    catch (failure) { setError(t(ordinaryError(failure))); }
  }
  async function importPackage() {
    setError('');
    try { await registry.importPackage(); }
    catch (failure) { if (failure.message !== 'picker_canceled') setError(t(ordinaryError(failure))); }
  }
  async function restore() {
    setError('');
    try { await registry.restore(selected); setSheet(null); }
    catch (failure) { setError(t(ordinaryError(failure))); }
  }
  return <main className="app plugins-app">
    <header className="topbar"><IconButton label={t('返回')} onClick={() => { if (!back()) onBack(); }}><IconChevronLeftOutline14 size={22}/></IconButton><strong className="plugin-page-title">{current ? t(current.name) : catalog ? t('安装插件') : t('插件')}</strong><span className="header-spacer"/></header>
    {!current && <div className="plugin-tabs" role="tablist"><button role="tab" aria-selected="true">{t('手机')}</button><button role="tab" aria-selected="false" onClick={() => void onRemote()}>{t('电脑')}</button></div>}
    <section className="plugin-scroll" aria-label={t('手机插件')}>
      {(error || state.error) && <p role="alert" className="plugin-result is-error">{error || t(ordinaryError(state.error))}</p>}
      {current ? <>
        <div className="plugin-detail-heading"><span className="plugin-symbol"><IconCordisPluginOutline14 size={24}/></span><h1>{t(current.name)} <small>{record.installed ? record.version : current.version}</small></h1><code>{current.source ?? current.id}</code><p>{t(current.description)}</p></div>
        <div className="plugin-actions">{record.installed ? <><Button variant="outline" disabled={busy} onClick={() => setSheet('uninstall')}>{t('卸载')}</Button><label className="plugin-enabled">{t(record.enabled ? '已启用' : '已停用')}<Switch label={t('启用{name}', { name: t(current.name) })} checked={record.enabled} disabled={busy} onChange={() => change(record.enabled ? 'disable' : 'enable')}/></label></> : <Button variant="primary" disabled={busy || status === '正在停止…' || status === '卸载失败'} onClick={() => current.preinstalled ? setSheet('restore') : current.external ? importPackage() : change('install')}>{t(current.preinstalled ? '恢复安装' : current.external ? '从文件安装' : '安装')}</Button>}</div>
        <p role="status" className={status === '运行中' ? 'plugin-running' : ''}>{t(status)}</p>
        {record.installed && !current.external && <div className="plugin-actions">
          <Button variant="outline" disabled={busy || record.version === current.version} onClick={() => change('update')}>{record.version === current.version ? t('已是最新版本') : t('更新至 {version}', { version: current.version })}</Button>
          {Settings && <Button variant="outline" disabled={busy || status !== '运行中'} onClick={() => setSheet('settings')}>{t('设置')}</Button>}
        </div>}
        {['加载失败', '停止失败', '卸载失败'].includes(status) && <Button disabled={busy} onClick={() => change('retry')}>{t('重试')}</Button>}
        {status === '待加载' && <p className="muted">{t('将在对应页面加载，启用不代表已经运行。')}</p>}
        {['加载失败', '停止失败', '卸载失败'].includes(status) && <p role="alert">{t('插件操作未完成，请重试；默认界面仍可使用。')}</p>}
        {current.external && <Button variant="outline" disabled={busy} onClick={importPackage}>{t(record.installed ? '从文件更新' : '从文件安装')}</Button>}
        {!registry.canManage(current) && <p>{t('更新 App 后可管理')}</p>}
        <section className="plugin-section"><h2>{t('功能与来源')}</h2><p>{t(current.capabilities)}</p><p className="muted">{current.preinstalled ? t('App 提供预装版本 {version}，支持从文件独立更新。', { version: current.preinstalledVersion }) : t(current.external ? '外部安装的手机插件，可独立更新。仅安装你信任的插件。' : '随 App 提供的手机兼容版本。插件随 App 升级，设置和启停状态会保留。')}</p></section>
      </> : <>
        <p className="plugin-location">{t('这台手机')}</p>
        <div className="plugin-list-tools"><label className="plugin-search"><IconSearchOutline16/><input aria-label={t('搜索插件')} placeholder={t('搜索插件')} value={query} onChange={event => setQuery(event.target.value)}/></label>{!catalog && <IconButton label={t('安装插件')} onClick={() => setCatalog(true)}><IconPlusOutline16/></IconButton>}</div>
        <div className="plugin-section-heading"><h2>{catalog ? t('可安装的手机插件') : t('已安装')}</h2></div>
        {state.installerApi === 1 && registry.host === 'ordinary' && <div className="plugin-actions"><Button variant="outline" disabled={busy} onClick={importPackage}>{t('从文件安装')}</Button></div>}
        <div className="plugin-list">{registry.catalog.filter(entry => (catalog || state.record[entry.id].installed) && `${t(entry.name)} ${entry.source ?? entry.id}`.toLowerCase().includes(query.trim().toLowerCase())).map(entry => {
          const status = pluginStatus(state.record[entry.id], state.runtime[entry.id]);
          return <button key={entry.id} className="plugin-row" onClick={() => { setError(''); setSelected(entry.id); }}><span className="plugin-symbol"><IconCordisPluginOutline14 size={22}/></span><span className="plugin-row-main"><strong>{t(entry.name)}</strong><span>{t(entry.description)}</span><small className={status === '运行中' ? 'plugin-running' : ''}>{t(status)}</small></span><IconChevronRightOutline14/></button>;
        })}</div>
      </>}
    </section>
    <SurfacePresence>{sheet && current && <Surface title={t(sheet === 'uninstall' ? '卸载插件' : sheet === 'restore' ? '恢复安装' : '插件设置')} onClose={() => setSheet(null)}>
      <header><h2>{sheet === 'uninstall' ? t('卸载 {name}', { name: t(current.name) }) : t(current.name)}</h2><IconButton label={t('关闭窗口')} onClick={() => setSheet(null)}><IconCloseOutline16/></IconButton></header>
      {sheet === 'uninstall' ? <><p>{t('卸载后该插件停止运行，聊天记录和插件设置会保留。')}</p><Button variant="primary" disabled={busy} onClick={() => change('uninstall')}>{t('确认卸载')}</Button></> : sheet === 'restore' ? <><p>{t('将安装 App 提供的版本 {version}，聊天和设置会保留。', { version: current.preinstalledVersion })}</p><Button variant="primary" disabled={busy} onClick={restore}>{t('确认恢复安装')}</Button></> : Settings && <Settings host={host} renderSlot={renderSlot} onDone={() => setSheet(null)}/>}
      {error && <p role="alert">{error}</p>}
    </Surface>}</SurfacePresence>
  </main>;
}
