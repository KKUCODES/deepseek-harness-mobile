import React, { Component, useState, useSyncExternalStore } from 'react';
import { Button } from '@upstream/ui-primitives/src/Button.tsx';
import { IconChevronRightOutline14, IconCloseOutline16 } from '@upstream/ui-primitives/src/icons/index.tsx';
import { IconButton, Surface } from './Surface.jsx';
import { SurfacePresence } from './motion.jsx';
import { useTranslate } from './locale.jsx';
import { appUpdates, updateError } from '../app-updates.mjs';
import { updatePresentation } from '../update-presentation.mjs';
import { OrdinaryMarkdown } from '../ordinary-rendering.jsx';
import './app-updates.css';

const useUpdates = () => { const service = appUpdates(); return [service, useSyncExternalStore(service.subscribe, service.getSnapshot)]; };
const megabytes = bytes => (bytes / 1024 / 1024).toFixed(1) + ' MB';
class UpdateBoundary extends Component {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() { return this.state.failed ? this.props.fallback : this.props.children; }
}
export function AppUpdatePanel({ onClose }) {
  const t = useTranslate(), [, state] = useUpdates();
  const restarting = ['preparing', 'restarting'].includes(state.resources?.phase);
  const close = () => { if (!restarting) onClose(); };
  return <Surface title={t('软件更新')} onClose={close} className="app-update-sheet">
    <header><h2>{t('软件更新')}</h2><IconButton label={t('关闭窗口')} disabled={restarting} onClick={close}><IconCloseOutline16/></IconButton></header>
    <UpdateBoundary fallback={<p role="alert">{t('更新信息暂时无法显示，请关闭后重试。')}</p>}><UpdateContent/></UpdateBoundary>
  </Surface>;
}
function UpdateContent() {
  const t = useTranslate(), [service, state] = useUpdates(), [notesOpen, setNotesOpen] = useState(false);
  const view = updatePresentation(state), { phase, release, kind } = view;
  const staged = phase === 'staged';
  const titles = { idle: '随时保持最新', checking: '正在检查更新', available: '有更新可用', current: '已是最新版本',
    downloading: '正在下载更新', verifying: '正在校验更新', ready: '更新已准备好', staged: '更新已准备好',
    preparing: '正在保存当前状态', restarting: '正在重新启动', permission: '允许安装后继续', installing: '正在打开系统安装',
    error: '更新未完成', cancelled: '下载已取消', unavailable: '请在 Android App 中检查更新' };
  const labels = { check: phase === 'error' ? '重试' : '检查更新', download: '下载更新', 'resources.download': '下载更新',
    install: '安装更新', 'resources.restart': '重启并应用' };
  const progress = release?.bytes > 0 ? Math.min(100, Math.floor(view.received * 100 / release.bytes)) : 0;
  const version = kind === 'apk' ? release?.version : release ? 'r' + release.revision : view.pending ? 'r' + view.pending : null;
  return <section data-testid="app-updates" className="app-update-content" aria-busy={view.busy}>
    <div className="app-update-current">DSHM <span>{state.currentVersion || '—'}</span></div>
    <div className="app-update-status" data-phase={phase}>
      <div className="app-update-emblem" aria-hidden="true"><svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        {phase === 'current' || staged || phase === 'ready' ? <path d="m5 12 4 4L19 6"/> : phase === 'error' ? <><path d="M12 5v9M12 18v.1"/><circle cx="12" cy="12" r="10"/></> : <><path d="M19 8a8 8 0 1 0 .5 7M19 3v5h-5"/></>}
      </svg></div>
      <h3 role="status" aria-live="polite">{t(titles[phase] ?? titles.error)}</h3>
      {version && <div className="app-update-target"><span>{version}</span>{release?.bytes > 0 && <span>{megabytes(release.bytes)}</span>}</div>}
      {staged && <p className="app-update-hint">{t(state.resources?.restartSupported ? '重启即可使用，聊天和设置保留' : '更新将在下次启动时应用')}</p>}
      {phase === 'ready' && <p className="app-update-hint">{t('保留现有数据')}</p>}
      {phase === 'permission' && <p className="app-update-hint">{t('允许此来源后返回 DSHM，再次点击安装更新。')}</p>}
    </div>
    {phase === 'checking' && <div className="app-update-skeleton" aria-hidden="true"><span/><span/></div>}
    {phase === 'downloading' && release && <div className="app-update-progress">
      <progress max={release.bytes} value={Math.min(view.received, release.bytes)} aria-label={t('下载进度')}/>
      <div><span>{megabytes(view.received)} / {megabytes(release.bytes)}</span><strong>{progress}%</strong></div>
    </div>}
    {view.error && <div className="app-update-error" role="alert">{t(updateError(view.error))}</div>}
    {kind === 'apk' && release?.requiredPluginVersion && release.requiredPluginVersion !== state.requiredPluginVersion &&
      <p className="app-update-pairing">{t('Remote 需电脑插件 {version}', { version: release.requiredPluginVersion })}</p>}
    <div className="app-update-details">
      {release?.notes && <details key={kind + ':' + version} className="app-update-changelog" onToggle={event => setNotesOpen(event.currentTarget.open)}>
        <summary>{t('更新内容')}</summary>
        {notesOpen && <div className="app-update-notes"><UpdateBoundary fallback={<p>{t('更新内容暂时无法显示，请前往发行页查看。')}</p>}>
          <OrdinaryMarkdown text={release.notes} onOpenLink={url => void service.openLink(url)}/>
        </UpdateBoundary></div>}
      </details>}
      <details className="app-update-more"><summary>{t('更多')}</summary>
        <dl><div><dt>{t('应用版本')}</dt><dd>{state.currentVersion || '—'}</dd></div>
          {state.resources && <div><dt>{t('页面资源')}</dt><dd>{state.resources.currentRevision ? 'r' + state.resources.currentRevision : t('APK 内置页面')}</dd></div>}
          {release && <div><dt>{t('更新方式')}</dt><dd>{t(kind === 'resources' ? '页面更新' : 'APK 安装')}</dd></div>}
        </dl>
        <div className="app-update-tools">
          {!view.busy && <Button onClick={() => void service.action('check')}>{t('重新检查')}</Button>}
          <Button onClick={() => void service.action('openRelease')}>{t('前往 GitHub 发行页')}</Button>
          {view.canRecover && !view.busy && <Button onClick={() => void service.action('resources.recover')}>{t('恢复内置页面')}</Button>}
        </div>
      </details>
    </div>
    <footer className="app-update-footer">
      {view.action && <Button variant="primary" className="app-update-primary" onClick={() => void service.action(view.action)}>{t(labels[view.action])}</Button>}
      {view.canCancel && <Button className="app-update-primary" onClick={() => void service.action(kind === 'resources' ? 'resources.cancel' : 'cancel')}>{t('取消')}</Button>}
      {['preparing', 'restarting', 'verifying', 'installing'].includes(phase) && <Button className="app-update-primary" disabled>{t(titles[phase])}</Button>}
    </footer>
  </section>;
}
export function AppUpdateEntry({ onOpen, buttonClass = 'settings-row' }) {
  const t = useTranslate(), [, state] = useUpdates(), [open, setOpen] = useState(false);
  const view = updatePresentation(state);
  const value = view.phase === 'staged' ? '待应用' : view.phase === 'ready' ? '已下载' : view.newerApk || state.resources?.phase === 'available' ? '有新版本' : null;
  return <>
    <button className={buttonClass} onClick={onOpen ?? (() => setOpen(true))}>
      <span className="settings-row-label">{t('软件更新')}</span><span className="settings-row-value">{value ? t(value) : state.currentVersion}</span><IconChevronRightOutline14/>
    </button>
    <SurfacePresence>{open && <AppUpdatePanel onClose={() => setOpen(false)}/>}</SurfacePresence>
  </>;
}
export function AppUpdateNotice() {
  const t = useTranslate(), [, state] = useUpdates();
  const [dismissed, setDismissed] = useState(''), [open, setOpen] = useState(false);
  const view = updatePresentation(state);
  const version = ['available', 'ready', 'staged'].includes(view.phase) ? view.kind === 'apk' ? view.release?.version : 'r' + (view.release?.revision || view.pending) : null;
  return <>
    {version && dismissed !== version && !open && <aside className="app-update-notice" role="status"><span>{t('DSHM {version} 可更新', { version })}</span>
      <Button onClick={() => setOpen(true)}>{t('查看更新')}</Button><IconButton label={t('稍后再说')} onClick={() => setDismissed(version)}><IconCloseOutline16/></IconButton>
    </aside>}
    <SurfacePresence>{open && <AppUpdatePanel onClose={() => { setOpen(false); setDismissed(version); }}/>}</SurfacePresence>
  </>;
}
