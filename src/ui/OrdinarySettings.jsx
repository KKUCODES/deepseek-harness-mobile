import { useTranslate } from './locale.jsx';
import React, { useEffect, useState, useSyncExternalStore } from 'react';
import { Button } from '@upstream/ui-primitives/src/Button.tsx';
import { IconChevronLeftOutline14, IconChevronRightOutline14, IconCloseOutline16, IconDataOutline16, IconPersonalizationOutline16, IconBrowseOutline16 } from '@upstream/ui-primitives/src/icons/index.tsx';
import { IconButton, Surface } from './Surface.jsx';
import { SurfacePresence } from './motion.jsx';
import { ORDINARY_MODELS } from '../ordinary-models.mjs';
import { decodeBackup } from '../ordinary-backup.mjs';
import { ordinaryError } from '../ordinary-errors.mjs';
import './settings.css';
import { SupportDiagnostics } from './SupportDiagnostics.jsx';

function Row({ title, value, onClick, icon, danger, disabled }) {
  return <button className={`settings-row ${danger ? 'danger' : ''}`} onClick={onClick} disabled={disabled}>{icon}<span className="settings-row-label">{title}</span>{value && <span className="settings-row-value">{value}</span>}<IconChevronRightOutline14/></button>;
}

export function OrdinarySettings({ host, session, state, onBack, registerBack, renderSlot, initialPage = 'home' }) {
  const t = useTranslate();
  const [page, setPage] = useState(initialPage);
  const [sheet, setSheet] = useState(null);
  const [diagnostics, setDiagnostics] = useState(false);
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [stats, setStats] = useState(null);
  const [importData, setImportData] = useState(null);
  const preferences = host.settings.bind({ namespace: 'ordinary-chat' });
  const defaults = useSyncExternalStore(preferences.subscribe, preferences.getSnapshot);
  const themeScope = host.settings.bind({ namespace: 'ui-theme' });
  const theme = useSyncExternalStore(themeScope.subscribe, themeScope.getSnapshot);
  const appearance = useSyncExternalStore(host.appearance.subscribe, host.appearance.getSnapshot);
  const localeScope = host.settings.bind({ namespace: 'locale' });
  const locale = useSyncExternalStore(localeScope.subscribe, localeScope.getSnapshot);
  const defaultModel = ORDINARY_MODELS.find(model => model.id === defaults.value.model);
  const titles = { home: t('设置'), chat: t('普通聊天'), appearance: t('外观与语言'), data: t('本地数据') };
  useEffect(() => registerBack(() => { if (page !== 'home') { setPage('home'); return true; } return false; }), [page, registerBack]);
  useEffect(() => { void session.stats().then(setStats, () => setNotice(t('无法读取存储信息'))); }, [page, session]);
  async function perform(action) {
    if (busy) return;
    setBusy(true); setNotice('');
    try { await action(); setStats(await session.stats()); }
    catch (error) { setNotice(t(ordinaryError(error))); }
    finally { setBusy(false); }
  }
  return <main className="app settings-app ordinary-settings">
    <header className="topbar"><IconButton label={page === 'home' ? t('退出设置') : t('返回设置首页')} onClick={() => page === 'home' ? onBack() : setPage('home')}><IconChevronLeftOutline14 size={22}/></IconButton><strong>{titles[page]}</strong><span className="header-spacer"/></header>
    <section className="settings-scroll" aria-label={t("设置内容")}>
      {notice && <p className="settings-notice" role="status">{notice}</p>}
      {appearance.error && <p className="settings-notice" role="alert">{t('外观与语言尚未同步到 Remote。')} <Button onClick={() => void host.appearance.retry()}>{t('重新同步')}</Button></p>}
      {page === 'home' ? <>
        <h2 className="settings-group-title">{t("这台手机")}</h2><div className="settings-group">
          <Row icon={<IconDataOutline16/>} title={t("普通聊天")} value={state.configured ? t('已配置') : t('未配置 Key')} onClick={() => setPage('chat')}/>
          <Row icon={<IconPersonalizationOutline16/>} title={t("外观与语言")} value={{ system: t('跟随系统'), light: t('浅色'), dark: t('深色') }[theme.value.preference]} onClick={() => setPage('appearance')}/>
          <Row icon={<IconDataOutline16/>} title={t("本地数据")} value={stats ? t('{count} 条聊天', { count: stats.chats }) : t('读取中')} onClick={() => setPage('data')}/>
          <Row title={t('问题诊断')} onClick={() => setDiagnostics(true)}/>
        </div><h2 className="settings-group-title">Remote</h2><div className="settings-group"><Row icon={<IconBrowseOutline16/>} title={t("电脑连接")} onClick={() => perform(session.openRemote)}/><Row title={t("Remote 提醒")} disabled={busy} onClick={() => perform(session.notificationSettings)}/></div>
      </> : page === 'chat' ? <>
        <h2 className="settings-group-title">{t("模型服务")}</h2><div className="settings-group"><Row title="DeepSeek Key" value={state.configured ? t('已配置') : t('未配置')} disabled={busy || state.busy} onClick={() => perform(session.configure)}/><Row title={t("默认模型")} value={defaultModel.label} onClick={() => setSheet('model')}/>{state.configured && <Row title={t("移除 Key")} danger disabled={busy || state.busy} onClick={() => perform(session.configure)}/>}</div>
        <p className="settings-help">{t("使用你自己的 Key，由手机直接连接 DeepSeek。默认模型用于新聊天，已有聊天的模型保持不变。")}</p>
      </> : page === 'appearance' ? <>
        <div className="settings-group"><Row title={t("主题")} value={{ system: t('跟随系统'), light: t('浅色'), dark: t('深色') }[theme.value.preference]} disabled={!host.phonePlugins.enabled('theme')} onClick={() => setSheet('theme')}/><Row title={t("语言")} value={locale.value.preference === 'en' ? 'English' : t('简体中文')} onClick={() => setSheet('language')}/></div>
        <h2 className="settings-group-title">{t("显示效果")}</h2><div className="settings-appearance-sample"><strong>{t("探索未至之境")}</strong><p>{t("有什么想聊的？")}</p><div>{t("发送消息，聊聊你的想法")}</div></div>
        <h2 className="settings-group-title">{t("阅读设置")}</h2><div className="settings-group"><div className="settings-font"><span>{t('字号大小')}</span><Button aria-label={t('减小字号')} disabled={busy || !host.phonePlugins.enabled('theme') || theme.value.fontSize <= 12} onClick={() => perform(() => themeScope.set('fontSize', theme.value.fontSize - 1))}>−</Button><output>{theme.value.fontSize} px</output><Button aria-label={t('增大字号')} disabled={busy || !host.phonePlugins.enabled('theme') || theme.value.fontSize >= 17} onClick={() => perform(() => themeScope.set('fontSize', theme.value.fontSize + 1))}>+</Button></div></div>
      </> : <>
        <div className="settings-storage"><strong>{stats ? (stats.bytes / 1024 / 1024).toFixed(2) : '—'} <small>MB</small></strong><p>{stats ? t('{chats} 条聊天 · {turns} 轮消息 · {drafts} 条草稿', stats) : t('正在读取')} · {t('内容大小')}</p></div>
        <div className="settings-group"><Row title={t("导出聊天备份")} disabled={busy} onClick={() => perform(async () => { await session.saveBackup(); setNotice(t('聊天备份已保存')); })}/><Row title={t("导入聊天备份")} disabled={busy || state.busy} onClick={() => perform(async () => { const value = await session.pickBackup(); const chats = decodeBackup(value.content); setImportData({ ...value, count: chats.length }); setSheet('import'); })}/></div>
        <h2 className="settings-group-title">{t("清理")}</h2><div className="settings-group"><Row title={t("清理临时缓存")} disabled={busy} onClick={() => setSheet('cache')}/><Row title={t("清空本地聊天")} danger disabled={busy || state.busy} onClick={() => setSheet('clear')}/></div>
      </>}
    </section>
    {diagnostics && <SupportDiagnostics read={async () => ({ info: await session.appInfo(), mode: 'ordinary' })} copy={session.copyText} onClose={() => setDiagnostics(false)}/>}
    <SurfacePresence>{sheet && <Surface title={{ model: t('默认模型'), theme: t('主题'), language: t('语言'), import: t('导入聊天'), cache: t('清理临时缓存'), clear: t('清空本地聊天') }[sheet]} onClose={() => { if (!busy) setSheet(null); }}><header><h2>{{ model: t('默认模型'), theme: t('主题'), language: t('语言'), import: t('导入聊天'), cache: t('清理临时缓存'), clear: t('清空本地聊天') }[sheet]}</h2><IconButton label={t("关闭窗口")} disabled={busy} onClick={() => setSheet(null)}><IconCloseOutline16/></IconButton></header>
      {sheet === 'model' ? ORDINARY_MODELS.map(model => <Button className="option" key={model.id} aria-pressed={model.id === defaultModel.id} disabled={busy} onClick={() => perform(async () => { await preferences.set('model', model.id); session.setDefaultModel(model.id); setSheet(null); })}>{model.label}<span>{model.id === defaultModel.id ? t('已选') : ''}</span></Button>)
        : sheet === 'theme' ? [['system', t('跟随系统')], ['light', t('浅色')], ['dark', t('深色')]].map(([id, title]) => <Button className="option" key={id} disabled={busy} aria-pressed={theme.value.preference === id} onClick={() => perform(async () => { await themeScope.set('preference', id); setSheet(null); })}>{title}</Button>)
        : sheet === 'language' ? [['zh', t('简体中文')], ['en', 'English']].map(([id, title]) => <Button className="option" key={id} disabled={busy} aria-pressed={(locale.value.preference ?? 'zh') === id} onClick={() => perform(async () => { await localeScope.set('preference', id); setSheet(null); })}>{title}</Button>)
        : <><p>{sheet === 'import' ? t('备份包含 {count} 条聊天，相同记录会跳过，冲突时不会导入任何记录。', { count: importData?.count }) : sheet === 'clear' ? t('将删除这台手机上的全部普通聊天和草稿，无法撤销。建议先导出备份。') : t('仅清理临时缓存，保留聊天、草稿、Key 和电脑绑定。')}</p><div className="settings-actions"><Button variant="outline" disabled={busy} onClick={() => setSheet(null)}>{t("取消")}</Button><Button variant="primary" disabled={busy || (sheet !== 'cache' && state.busy)} onClick={() => perform(async () => {
          if (sheet === 'import') { const result = await session.import(importData.content); setNotice(t('已导入 {imported} 条，跳过 {skipped} 条重复记录', result)); setImportData(null); }
          else if (sheet === 'clear') { await session.clearHistory(); setNotice(t('普通聊天和草稿已清空')); }
          else { await session.clearCache(); setNotice(t('临时缓存已清理')); }
          setSheet(null);
        })}>{t(sheet === 'import' ? '确认导入' : sheet === 'clear' ? '确认清空' : '确认清理')}</Button></div></>}
      {notice && <p role="status">{notice}</p>}
    </Surface>}</SurfacePresence>
  </main>;
}
