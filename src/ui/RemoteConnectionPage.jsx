import React, { createContext, useContext, useMemo } from 'react';
import { Button } from '@upstream/ui-primitives/src/Button.tsx';
import { IconChevronLeftOutline14, IconEllipsisOutline16 } from '@upstream/ui-primitives/src/icons/index.tsx';
import { IconButton } from './Surface.jsx';
import { useLocale, useTranslate } from './locale.jsx';
import { RemoteDiagnosticEntry, useRemoteDiagnostics } from './RemoteDiagnostics.jsx';
import { diagnosticView } from '../remote-diagnostics.mjs';
import { RemoteInterfaceSurface } from '../remote-interface-host.jsx';
import { REMOTE_CONNECTION_SLOT } from '../phone-plugin-catalog.mjs';

// 表单值只归原连接控制器持有；公开页面得到可放置的宿主表单，不拿配对链接或原生桥。
const ConnectionFields = createContext(null);
function PairingFields() {
  const p = useContext(ConnectionFields), t = useTranslate();
  return <div data-connection-fields>
    <label className="remote-field">{t('配对链接')}<input data-connection-field="link" type="text" autoComplete="off" autoCapitalize="none" spellCheck={false}
      aria-label={t('一次性配对链接')} value={p.link} disabled={p.busy} onChange={event => p.onLink(event.target.value)}/></label>
    <Button disabled={p.busy} onClick={p.onPaste}>{t('粘贴')}</Button>
    {p.pasteHint && <p role="status">{t(p.pasteHint)}</p>}
    <label className="remote-field">{t('设备名称')}<input data-connection-field="name" aria-label={t('设备名称')} value={p.name} maxLength={80} disabled={p.busy} onChange={event => p.onName(event.target.value)}/></label>
  </div>;
}
function BindingIdentity() {
  const { binding, status } = useContext(ConnectionFields), t = useTranslate();
  return binding?.paired && <details className="device-card" data-connection-identity open={status === 'pending'}><summary>{t('设备公钥指纹')}</summary>
    <strong>{binding.origin}</strong><code data-testid="remote-fingerprint">{binding.fingerprint}</code></details>;
}

/** .11的默认连接布局保留当前配对、粘贴、读取重试和诊断能力。 */
export function DefaultRemoteConnection({ connection: { view, actions, parts, t } }) {
  return <div className="remote-home-surface" data-testid="remote-connection-default">
    <header className="topbar remote-topbar"><IconButton label={t('返回普通聊天')} onClick={actions.back}><IconChevronLeftOutline14/></IconButton>
      <div className="remote-heading"><strong>Remote</strong></div><IconButton label={t('连接选项')} onClick={actions.menu}><IconEllipsisOutline16/></IconButton></header>
    <section className="remote-scroll connect-page">
      <h1>{view.title}</h1><p role="status" data-testid="remote-state">{view.description}</p>
      {view.unpaired ? <><div className="remote-pair-actions"><Button disabled={view.busy} onClick={actions.scanCamera}>{t('扫描二维码')}</Button><Button disabled={view.busy} onClick={actions.scanImage}>{t('从图片识别')}</Button></div>{parts.fields}</> : parts.identity}
      {view.server && <p>{t('服务器：{address}', { address: view.server })}</p>}
      {view.insecure && <p>{t(view.unpaired ? 'HTTP 连接未加密，建议使用 HTTPS。' : 'HTTP 连接未加密，凭据及聊天内容可能被窃听或篡改。')}</p>}
      {view.error && <p className="remote-error" role="alert">{view.error}</p>}
      {parts.diagnostics}
      {view.paired === null && view.error && <Button disabled={view.busy} onClick={actions.retry}>{t('重新读取')}</Button>}
      {view.readError && <Button disabled={view.busy} onClick={actions.retryRead}>{t('重试读取')}</Button>}
      {view.paired !== null && !view.reading && <Button variant="primary" disabled={view.actionDisabled} onClick={actions.primary}>{view.actionLabel}</Button>}
    </section>
  </div>;
}

export function RemoteConnectionPage(props) {
  const { interfaceUI, binding, stage, status, busy, error, link, name, pairingServer, watchApproval = true } = props;
  const t = useTranslate(), locale = useLocale(), diagnostics = useRemoteDiagnostics();
  const failure = diagnostics?.latest && !diagnostics.latest.resolvedAt ? diagnosticView(diagnostics.latest) : null;
  const unpaired = !!binding && !binding.paired, pending = status === 'pending', waiting = pending && watchApproval;
  const connecting = ['connecting', 'negotiating', 'loading'].includes(stage), reading = stage === 'reading', readError = stage === 'read-error';
  const title = !binding ? '正在读取连接信息…' : unpaired ? '连接你的电脑' : reading ? '正在读取电脑会话…' : readError ? failure?.title ?? '暂时无法读取会话'
    : pending ? waiting ? '等待电脑确认' : '配对已暂停' : status === 'invalid' ? '连接授权已失效' : connecting ? '正在连接电脑…' : failure?.title ?? '连接未完成';
  const description = unpaired ? '在电脑 DSH 的 Mobile 插件中生成二维码或配对链接，扫描或粘贴后连接。' : reading ? '正在读取电脑上的项目与会话'
    : readError ? failure?.descriptionKey ?? '连接仍在，请稍后再试。' : pending ? waiting ? '请在电脑的 DSHM 插件中批准这台手机' : '配对信息已保留，点击继续连接即可恢复。'
      : connecting ? '正在建立电脑连接，请稍候' : failure?.descriptionKey ?? '电脑与 DSH 保持运行时，可以重新连接。';
  const actionDisabled = !!busy || (unpaired ? !link.trim() || !name.trim() : connecting || waiting && !error);
  const view = Object.freeze({ phase: stage, status, paired: binding ? !!binding.paired : null, unpaired, pending, waiting, connecting, reading, readError, busy: !!busy,
    title: t(title), description: t(description, failure?.values), error: error ? t(error) : null,
    server: pairingServer ?? binding?.origin ?? null, insecure: (pairingServer ?? binding?.origin)?.startsWith('http:') ?? false,
    actionDisabled, actionLabel: t(unpaired ? '继续配对' : pending ? !watchApproval ? '继续连接' : error ? '重新检查批准状态' : '等待电脑批准' : '重新连接') });
  const actions = { back: props.onBack, menu: props.onMore, scanCamera: () => { if (!busy && unpaired) props.onScan('camera'); }, scanImage: () => { if (!busy && unpaired) props.onScan('image'); },
    primary: () => { if (!actionDisabled) (unpaired ? props.onClaim : props.onRetry)(); }, retry: () => { if (!busy) props.onRetry(); }, retryRead: () => { if (!busy && readError) props.onRetryRead(); } };
  const parts = useMemo(() => Object.freeze({ fields: <PairingFields/>, identity: <BindingIdentity/>, diagnostics: <RemoteDiagnosticEntry/> }), []);
  const connection = { apiVersion: 1, locale, t, view, actions, parts };
  const fallback = <DefaultRemoteConnection connection={connection}/>;
  return <main className="app remote-app dshm-phone-colors dshm-phone-surface" hidden={stage === 'ready'} data-testid="remote-page">
    <ConnectionFields.Provider value={props}>{stage !== 'ready' && (interfaceUI ? <RemoteInterfaceSurface host={interfaceUI} surface={REMOTE_CONNECTION_SLOT} owner={{ connection }} fallback={fallback}/> : fallback)}</ConnectionFields.Provider>
  </main>;
}
