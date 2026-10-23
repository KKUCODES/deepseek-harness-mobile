import React, { Component, useState, useSyncExternalStore } from 'react';
import { Button } from '@upstream/ui-primitives/src/Button.tsx';
import { IconChevronRightOutline14, IconCloseOutline16 } from '@upstream/ui-primitives/src/icons/index.tsx';
import { IconButton, Surface } from './Surface.jsx';
import { SurfacePresence } from './motion.jsx';
import { useTranslate } from './locale.jsx';
import { appUpdates, updateError } from '../app-updates.mjs';
import { OrdinaryMarkdown } from '../ordinary-rendering.jsx';
import './app-updates.css';

const useUpdates = () => { const service = appUpdates(); return [service, useSyncExternalStore(service.subscribe, service.getSnapshot)]; };
const megabytes = bytes => `${(bytes / 1024 / 1024).toFixed(1)} MB`;
class UpdateBoundary extends Component {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() { return this.state.failed ? this.props.fallback : this.props.children; }
}
export function AppUpdatePanel({ onClose }) {
  const t = useTranslate();
  return <Surface title={t('软件更新')} onClose={onClose} className="app-update-sheet">
    <header><h2>{t('软件更新')}</h2><IconButton label={t('关闭窗口')} onClick={onClose}><IconCloseOutline16/></IconButton></header>
    <UpdateBoundary fallback={<p role="alert">{t('更新信息暂时无法显示，请关闭后重试。')}</p>}><UpdateContent/></UpdateBoundary>
  </Surface>;
}
function UpdateContent() {
  const t = useTranslate(), [service, state] = useUpdates(), [notesOpen, setNotesOpen] = useState(false);
  const release = state.release, phase = state.phase;
  const busy = ['checking', 'downloading', 'verifying', 'permission', 'installing'].includes(phase);
  const labels = { idle: '可检查是否有新版本', checking: '正在检查更新…', available: '发现新版本', current: '当前已是最新版本',
    downloading: '正在下载更新…', verifying: '正在校验安装包…', ready: '下载完成，可以安装', permission: '请在系统设置中允许安装',
    installing: '请在系统窗口确认安装', error: '更新未完成', cancelled: '下载已取消', unavailable: '请在 Android App 中检查更新' };
  return <section data-testid="app-updates" className="app-update-content" aria-busy={busy}>
    {release ? <div className="app-update-version">
      <h3>DSHM {release.version}</h3>
      <p className="muted">{t('当前 {version} · {size}', { version: state.currentVersion || '—', size: megabytes(release.bytes) })}</p>
    </div> : <p className="muted">{t('当前版本：{version}', { version: state.currentVersion || '—' })}</p>}
    {phase !== 'available' && <p role="status" aria-live="polite">{t(labels[phase] ?? labels.error)}</p>}
    {phase === 'checking' && <div className="app-update-skeleton" aria-hidden="true"><span/><span/></div>}
    {state.error && <p role="alert">{t(updateError(state.error))}</p>}
    {release && <>
      {release.requiredPluginVersion && release.requiredPluginVersion !== state.requiredPluginVersion &&
        <p className="app-update-pairing">{t('Remote 需电脑插件 {version}', { version: release.requiredPluginVersion })}</p>}
      {release.notes && <details className="app-update-changelog" onToggle={event => setNotesOpen(event.currentTarget.open)}>
        <summary>{t('更新内容')}</summary>
        {notesOpen && <div className="app-update-notes">
          <UpdateBoundary fallback={<p role="alert">{t('更新内容暂时无法显示，请前往发行页查看。')}</p>}>
            <OrdinaryMarkdown text={release.notes} onOpenLink={url => void service.openLink(url)}/>
          </UpdateBoundary>
        </div>}
      </details>}
    </>}
    {phase === 'downloading' && release && <div>
      <progress max={release.bytes} value={Math.min(state.received, release.bytes)} aria-label={t('下载进度')}/>
      <p aria-live="off">{megabytes(state.received)} / {megabytes(release.bytes)} · {Math.floor(state.received * 100 / release.bytes)}%</p>
    </div>}
    {phase === 'ready' && <p className="muted">{t('保留现有数据')}</p>}
    {phase === 'downloading' && <p className="muted">{t('关闭窗口不影响下载')}</p>}
    {phase === 'permission' && <p>{t('允许此来源后返回 DSHM，再次点击安装更新。')}</p>}
    <div className="app-update-actions">
      {!busy && (!release || ['error', 'current'].includes(phase)) && phase !== 'unavailable' && <Button onClick={() => void service.action('check')}>{t(phase === 'error' ? '重新检查' : '检查更新')}</Button>}
      {release && !busy && !['ready', 'current'].includes(phase) && <Button variant="primary" onClick={() => void service.action('download')}>{t(phase === 'error' || phase === 'cancelled' ? '重新下载' : '下载更新')}</Button>}
      {phase === 'ready' && <Button variant="primary" onClick={() => void service.action('install')}>{t('安装更新')}</Button>}
      {['downloading', 'checking', 'verifying'].includes(phase) && <Button variant="outline" onClick={() => void service.action('cancel')}>{t(phase === 'downloading' ? '取消下载' : '取消')}</Button>}
      {phase === 'error' && <Button variant="outline" onClick={() => void service.action('openRelease')}>{t('前往 GitHub 发行页')}</Button>}
    </div>
    {!busy && !['error', 'unavailable'].includes(phase) && <details className="app-update-more">
      <summary>{t('更多')}</summary>
      <div className="app-update-actions">
        {release && !['ready', 'current'].includes(phase) && <Button onClick={() => void service.action('check')}>{t('检查更新')}</Button>}
        <Button onClick={() => void service.action('openRelease')}>{t('前往 GitHub 发行页')}</Button>
      </div>
    </details>}
  </section>;
}
export function AppUpdateEntry({ onOpen, buttonClass = 'settings-row' }) {
  const t = useTranslate(), [, state] = useUpdates(), [open, setOpen] = useState(false);
  const newer = !!state.release && state.release.versionCode > state.currentVersionCode;
  return <>
    <button className={buttonClass} onClick={onOpen ?? (() => setOpen(true))}>
      <span className="settings-row-label">{t('软件更新')}</span>
      <span className="settings-row-value">{newer ? t(state.phase === 'ready' ? '已下载' : '有新版本') : state.currentVersion}</span><IconChevronRightOutline14/>
    </button>
    <SurfacePresence>{open && <AppUpdatePanel onClose={() => setOpen(false)}/>}</SurfacePresence>
  </>;
}
export function AppUpdateNotice() {
  const t = useTranslate(), [, state] = useUpdates();
  const [dismissed, setDismissed] = useState(''), [open, setOpen] = useState(false);
  const version = state.release?.version;
  const visible = version && dismissed !== version && ['available', 'ready'].includes(state.phase);
  return <>
    {visible && !open && <aside className="app-update-notice" role="status"><span>{t('DSHM {version} 可更新', { version })}</span>
      <Button onClick={() => setOpen(true)}>{t('查看更新')}</Button><IconButton label={t('稍后再说')} onClick={() => setDismissed(version)}><IconCloseOutline16/></IconButton>
    </aside>}
    <SurfacePresence>{open && <AppUpdatePanel onClose={() => { setOpen(false); setDismissed(version); }}/>}</SurfacePresence>
  </>;
}
