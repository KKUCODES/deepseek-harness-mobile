import React, { useRef } from 'react';
import { useTranslate } from './locale.jsx';
import { AppBar, ActionCard, Badge, DesignButton, EmptyState, InlineAlert, SkeletonRows, StatusCard, TextField } from './system/Primitives.jsx';
import { DesignIcon } from './system/Icons.jsx';
import halo from './assets/remote/hero-halo.svg';
import scan from './assets/remote/hero-scan.svg';
import dot from './assets/remote/hero-dot.svg';
import arrow from './assets/remote/arrow.svg';
import './remote-connection.css';
import { RemoteDiagnosticEntry, useRemoteDiagnostics } from './RemoteDiagnostics.jsx';
import { diagnosticView } from '../remote-diagnostics.mjs';

/** 只将设计中的矩形转为布局；插画矢量直接引用下载的原稿。 */
export function PairingHero({ compact = false }) {
  return <div className={`dshm-pair-hero${compact ? ' is-compact' : ''}`} aria-hidden="true">
    <span className="pair-halo" style={{ maskImage: `url("${halo}")`, WebkitMaskImage: `url("${halo}")` }}/>
    <span className="pair-monitor-shell"/><span className="pair-monitor-screen"/><span className="pair-monitor-stem"/><span className="pair-monitor-foot"/>
    <span className="pair-assistant"/><span className="pair-assistant-text"/><span className="pair-reply"/><span className="pair-reply-text"/>
    <span className="pair-phone-shell"/><span className="pair-phone-screen"/><span className="pair-scan" style={{ maskImage: `url("${scan}")`, WebkitMaskImage: `url("${scan}")` }}/>
    {[{ left: 111, top: 42 }, { left: 123, top: 38 }, { left: 135, top: 42 }, { left: 111, top: 145 }, { left: 123, top: 149 }, { left: 135, top: 145 }].map(({ left, top }) => <span key={`${left}:${top}`} className="pair-dot" style={{ left: `${left / 342 * 100}%`, top: `${top / 164 * 100}%`, maskImage: `url("${dot}")`, WebkitMaskImage: `url("${dot}")` }}/>)}
    <span className="pair-arrow" style={{ maskImage: `url("${arrow}")`, WebkitMaskImage: `url("${arrow}")` }}/><span className="pair-arrow pair-arrow-back" style={{ maskImage: `url("${arrow}")`, WebkitMaskImage: `url("${arrow}")` }}/>
  </div>;
}

export function RemoteComputerSummary({ connected, connecting = false, onClick, description }) {
  const t = useTranslate();
  const content = <><div className="remote-computer-heading"><DesignIcon name="monitor" size={28}/><strong>{t('我的工作电脑')}</strong><Badge tone={connected ? 'success' : 'neutral'}>{t(connected ? '已连接' : connecting ? '连接中' : '已断开')}</Badge></div>
    {description && <p>{description}</p>}</>;
  return onClick ? <button className="remote-computer-summary" onClick={onClick}>{content}</button> : <div className="remote-computer-summary">{content}</div>;
}

export function RemoteHomeSkeleton() {
  const t = useTranslate();
  return <><section className="remote-home-section"><h2>{t('项目')}</h2><SkeletonRows count={1} label={t('正在读取电脑工作区…')}/></section>
    <section className="remote-home-section"><h2>{t('最近会话')}</h2><SkeletonRows label={t('正在读取电脑会话…')}/></section></>;
}

function BindingDetails({ binding, pending }) {
  const t = useTranslate();
  return <details className="remote-binding-details" open={pending}><summary>{t('设备公钥指纹')}</summary>
    <code data-testid="remote-fingerprint">{binding.fingerprint}</code><p>{binding.origin}</p>
  </details>;
}

export function RemoteConnectionPage({ binding, stage, status, watchApproval = true, busy, error, link, name, pairingServer, onLink, onName, onScan, onPaste, onClaim, onRetry, onRetryRead, onBack, onMore, pasteHint }) {
  const t = useTranslate(), nameInput = useRef(null);
  const diagnostics = useRemoteDiagnostics();
  const failure = diagnostics?.latest && !diagnostics.latest.resolvedAt ? diagnostics.latest : null;
  const detail = failure ? diagnosticView(failure) : null;
  const pending = status === 'pending', reading = stage === 'reading', readError = stage === 'read-error';
  const waiting = pending && watchApproval;
  const connecting = ['connecting', 'negotiating', 'loading'].includes(stage);
  const unpaired = binding && !binding.paired;
  const title = pending ? waiting ? '等待电脑确认' : '配对已暂停' : status === 'invalid' ? '连接授权已失效' : connecting ? '正在连接电脑…' : detail?.title ?? '连接未完成';
  return <main className="app remote-app dshm-design remote-connection" hidden={stage === 'ready'} data-testid="remote-page">
    <AppBar onBack={onBack} backLabel={t('返回普通聊天')} onMore={onMore} moreLabel={t('连接选项')}/>
    <div className={`remote-connection-scroll${unpaired ? ' is-pairing' : ''}`}>
      {!binding ? <div className="remote-connection-content">{error ? <><EmptyState error title={t('连接未完成')}><DesignButton loading={busy} onClick={onRetry}>{t('重新读取')}</DesignButton></EmptyState><InlineAlert>{t(error)}</InlineAlert><RemoteDiagnosticEntry/></> : <StatusCard title={t('正在读取连接信息…')}/>}</div>
        : reading || readError ? <div className="remote-connection-content remote-read-content">
          <RemoteComputerSummary connected onClick={onMore} description={t(readError ? '电脑连接仍然保留' : '正在读取电脑上的项目与会话')}/>
          {reading ? <RemoteHomeSkeleton/> : <><EmptyState error title={t(detail?.title ?? '暂时无法读取会话')} description={t(detail?.descriptionKey ?? '连接仍在，请稍后再试。', detail?.values)}><DesignButton disabled={busy} onClick={onRetryRead}>{t('重试读取')}</DesignButton></EmptyState>
            {error && error !== '连接未完成，请重试。' && <InlineAlert>{t(error)}</InlineAlert>}<RemoteDiagnosticEntry/><DesignButton kind="ghost" disabled={busy} onClick={onRetry}>{t('重新连接')}</DesignButton></>}
        </div> : <>
          <div className={`remote-connection-content${unpaired ? '' : ' remote-status-content'}`}>
            <PairingHero compact={unpaired}/>
            {unpaired ? <>
              <div className="remote-pair-intro"><h1>{t('连接你的电脑')}</h1><p>{t('离开电脑，也能接着推进工作')}</p></div>
              <div className="remote-pair-methods"><ActionCard icon="scan" primary title={t('扫描二维码')} description={t('对准电脑上的配对码')} disabled={busy} onClick={() => onScan('camera')}/>
                <ActionCard icon="image" title={t('从图片识别')} disabled={busy} onClick={() => onScan('image')}/></div>
              <div className="remote-pair-divider"><span/>{t('或使用配对链接')}<span/></div>
              <TextField className="remote-pair-link" label={t('一次性配对链接')} icon="link" value={link} autoComplete="off" autoCapitalize="none" spellCheck={false} placeholder={t('粘贴配对链接')} disabled={busy} onChange={event => onLink(event.target.value)} action={{ label: t('粘贴'), onClick: onPaste }} hint={pasteHint && t(pasteHint)}/>
              <TextField ref={nameInput} className="remote-device-field" label={t('设备名称')} icon="phone" value={name} maxLength={80} disabled={busy} onChange={event => onName(event.target.value)} action={{ label: t('修改设备名称'), icon: 'edit', onClick: () => nameInput.current?.focus() }}/>
              {pairingServer && <p className="remote-pair-server">{t('服务器：{address}', { address: pairingServer })}</p>}
              {pairingServer?.startsWith('http:') && <InlineAlert tone="info">{t('HTTP 连接未加密，建议使用 HTTPS。')}</InlineAlert>}
              {error && <InlineAlert>{t(error)}</InlineAlert>}
              {error && <RemoteDiagnosticEntry/>}
            </> : <>
              <StatusCard state={waiting || connecting ? 'waiting' : 'error'} title={t(title)} description={t(pending ? waiting ? '请在电脑的 DSHM 插件中批准这台手机' : '配对信息已保留，点击继续连接即可恢复。' : connecting ? '正在建立电脑连接，请稍候' : detail?.descriptionKey ?? '可重试连接，或查看诊断详情。', detail?.values)}/>
              {(!pending && !connecting || error) && <RemoteDiagnosticEntry/>}
              <BindingDetails binding={binding} pending={pending}/>
              {binding.origin?.startsWith('http:') && <InlineAlert tone="info">{t('HTTP 连接未加密，凭据及聊天内容可能被窃听或篡改。')}</InlineAlert>}
              {error && error !== '连接未完成，请重试。' && <InlineAlert>{t(error)}</InlineAlert>}
              <span className="dshm-visually-hidden" role="status" data-testid="remote-state">{t(waiting ? '等待批准' : title)}</span>
            </>}
          </div>
          <footer className="remote-connection-actions">
            <DesignButton icon="arrow" loading={busy || connecting || waiting && !error} disabled={unpaired ? !link.trim() || !name.trim() : connecting} onClick={unpaired ? onClaim : onRetry}>{t(unpaired ? '继续配对' : pending ? !watchApproval ? '继续连接' : error ? '重新检查批准状态' : '等待电脑批准' : '重新连接')}</DesignButton>
            <p className="remote-trust-note"><DesignIcon name="lock" size={14}/>{t(unpaired ? '配对信息仅用于连接你的设备' : pending ? '仅在电脑确认后建立连接' : '电脑与 DSH 保持运行时，可以重新连接。')}</p>
          </footer>
        </>}
    </div>
  </main>;
}
