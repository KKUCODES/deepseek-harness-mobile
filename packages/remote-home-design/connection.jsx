import React from 'react';
import back from './assets/back.svg';
import more from './assets/more.svg';
import halo from './assets/hero-halo.svg';
import scan from './assets/hero-scan.svg';
import dot from './assets/hero-dot.svg';
import arrow from './assets/arrow.svg';

// 原连接稿资产和几何保留在独立包，所有样式限定连接页根。
const css = `
.dhc { display:flex;flex:1;min-height:0;flex-direction:column;background:var(--dshm-bg);color:var(--dshm-text);font:400 16px/1.5 system-ui,sans-serif; }
.dhc button { font:inherit;cursor:pointer;color:inherit; }.dhc button:disabled { opacity:.5;cursor:default; }
.dhc button:focus-visible { outline:2px solid var(--dshm-primary);outline-offset:2px; }
.dhc header { display:grid;grid-template-columns:44px 1fr 44px;align-items:center;gap:12px;padding:6px 16px;min-height:56px;flex:none; }.dhc header strong { text-align:center;font-size:18px; }
.dhc .dhc-icon { width:44px;height:44px;border:0;border-radius:50%;background:var(--dshm-subtle);display:grid;place-items:center; }.dhc .dhc-icon span { width:24px;height:24px;display:block;background:currentColor;mask:var(--icon) center/contain no-repeat;-webkit-mask:var(--icon) center/contain no-repeat; }
.dhc .dhc-scroll { flex:1;min-height:0;overflow:auto;overscroll-behavior:contain;display:flex;flex-direction:column; }
.dhc .dhc-content { display:flex;flex:1 0 auto;flex-direction:column;gap:16px;padding:16px 24px;width:100%;max-width:528px;margin:auto; }.dhc .dhc-content.is-status { justify-content:center; }
.dhc h1 { font-size:24px;line-height:32px;margin:0;text-align:center; }.dhc p { margin:0;color:var(--dshm-secondary);overflow-wrap:anywhere; }.dhc .dhc-description { text-align:center;font-size:14px; }
.dhc .dhc-button { width:100%;min-height:48px;border:1px solid var(--dshm-border);border-radius:12px;padding:12px 16px;background:var(--dshm-subtle);text-align:center; }.dhc .dhc-primary { background:var(--dshm-primary);color:var(--dshm-on-primary);border-color:transparent; }
.dhc footer { flex:none;display:flex;flex-direction:column;gap:8px;padding:12px 24px max(24px,env(safe-area-inset-bottom));width:100%;max-width:528px;margin:auto; }.dhc footer p { text-align:center;font-size:12px; }
.dhc [data-connection-fields] { display:flex;flex-direction:column;gap:12px; }.dhc [data-connection-fields] label { display:flex;flex-direction:column;gap:8px;font-size:14px;color:var(--dshm-secondary); }
.dhc [data-connection-field] { width:100%;min-height:52px;border:1px solid var(--dshm-border);border-radius:12px;padding:12px;color:var(--dshm-text);background:var(--dshm-bg);font:inherit; }.dhc [data-connection-fields]>button { min-height:40px;border-radius:10px; }
.dhc [data-connection-identity] { border:1px solid var(--dshm-border);border-radius:12px;padding:12px; }.dhc [data-connection-identity] code,.dhc [data-connection-identity] strong { display:block;overflow-wrap:anywhere;font-size:14px; }.dhc .dhc-alert { border-radius:12px;padding:12px;background:var(--dshm-error-soft);color:var(--dshm-error);font-size:14px; }
.dhc .dhc-loading { height:16px;margin-block:12px;border-radius:8px;background:var(--dshm-subtle);animation:dhc-pulse 1s ease-in-out infinite alternate; }
.dhc .dhc-hero { position:relative;width:100%;max-width:342px;aspect-ratio:342/164;margin-inline:auto;flex:none; }.dhc .dhc-hero.is-compact { max-width:284px; }.dhc .dhc-hero>* { position:absolute;display:block; }
.dhc .dhc-hero :is(.halo,.scan,.dot,.arrow) { mask-size:100% 100%;mask-repeat:no-repeat;-webkit-mask-size:100% 100%;-webkit-mask-repeat:no-repeat;background:var(--dshm-primary); }
.dhc .dhc-hero .halo { left:20.175%;top:3.659%;width:63.743%;height:92.683%;background:var(--dshm-subtle); }
.dhc .monitor-shell { left:42.398%;top:13.415%;width:49.123%;height:67.073%;background:var(--dshm-border);border-radius:12px; }.dhc .monitor-screen { left:44.152%;top:17.073%;width:45.614%;height:53.659%;background:var(--dshm-bg);border-radius:8px; }
.dhc .monitor-stem { left:63.743%;top:80.488%;width:5.848%;height:7.317%;background:var(--dshm-border); }.dhc .monitor-foot { left:55.556%;top:87.805%;width:22.222%;height:3.659%;background:var(--dshm-border); }
.dhc .assistant { left:52.047%;top:28.659%;width:30.994%;height:15.854%;background:var(--dshm-primary);border-radius:8px; }.dhc .assistant-text { left:55.848%;top:34.146%;width:21.053%;height:2.439%;background:var(--dshm-on-primary); }
.dhc .hero-reply { left:49.123%;top:49.39%;width:22.807%;height:12.805%;background:var(--dshm-subtle);border-radius:8px; }.dhc .reply-text { left:52.339%;top:54.268%;width:13.45%;height:1.829%;background:var(--dshm-muted); }
.dhc .phone-shell { left:9.064%;top:21.341%;width:19.006%;height:74.39%;background:var(--dshm-border);border-radius:12px; }.dhc .phone-screen { left:10.526%;top:24.39%;width:16.082%;height:68.293%;background:var(--dshm-bg);border-radius:8px; }.dhc .scan { left:13.743%;top:48.171%;width:9.942%;height:20.732%; }.dhc .dot { width:.877%;height:1.829%; }.dhc .arrow { left:31.579%;top:39.634%;width:8.187%;height:17.073%; }.dhc .arrow.is-back { top:60.366%;transform:rotate(180deg); }
@keyframes dhc-pulse { from {opacity:.4} to {opacity:1} } @media(prefers-reduced-motion:reduce){.dhc .dhc-loading{animation:none}}
`;
function Hero({ compact }) {
  const mask = url => ({ maskImage: `url("${url}")`, WebkitMaskImage: `url("${url}")` });
  return <div className={`dhc-hero${compact ? ' is-compact' : ''}`} aria-hidden="true"><span className="halo" style={mask(halo)}/>
    {['monitor-shell','monitor-screen','monitor-stem','monitor-foot','assistant','assistant-text','hero-reply','reply-text','phone-shell','phone-screen'].map(name => <span className={name} key={name}/>)}
    <span className="scan" style={mask(scan)}/>{[[111,42],[123,38],[135,42],[111,145],[123,149],[135,145]].map(([left,top]) => <span className="dot" key={`${left}:${top}`} style={{...mask(dot),left:`${left/342*100}%`,top:`${top/164*100}%`}}/>)}
    <span className="arrow" style={mask(arrow)}/><span className="arrow is-back" style={mask(arrow)}/></div>;
}
export function RemoteConnection({ connection: { view, actions, parts, t } }) {
  return <div className="dhc" data-testid="remote-connection-plugin"><style>{css}</style>
    <header><button className="dhc-icon" aria-label={t('返回普通聊天')} onClick={actions.back}><span style={{'--icon':`url("${back}")`}}/></button><strong>Remote</strong><button className="dhc-icon" aria-label={t('连接选项')} onClick={actions.menu}><span style={{'--icon':`url("${more}")`}}/></button></header>
    <div className="dhc-scroll"><section className={`dhc-content${view.unpaired ? '' : ' is-status'}`}>
      {!view.reading && !view.readError && <Hero compact={view.unpaired}/>}
      <h1>{view.title}</h1><p className="dhc-description" role="status" data-testid="remote-state">{view.description}</p>
      {view.unpaired ? <><button className="dhc-button dhc-primary" disabled={view.busy} onClick={actions.scanCamera}>{t('扫描二维码')}</button><button className="dhc-button" disabled={view.busy} onClick={actions.scanImage}>{t('从图片识别')}</button>{parts.fields}</> : parts.identity}
      {view.reading && <div aria-label={t('正在读取电脑会话…')}>{[0,1,2].map(i=><div className="dhc-loading" key={i}/>)}</div>}
      {view.error && <p className="dhc-alert" role="alert">{view.error}</p>}{parts.diagnostics}
      {view.paired === null && view.error && <button className="dhc-button" disabled={view.busy} onClick={actions.retry}>{t('重新读取')}</button>}
      {view.server && <p>{t('服务器：{address}',{address:view.server})}</p>}
      {view.insecure && <p>{t(view.unpaired ? 'HTTP 连接未加密，建议使用 HTTPS。' : 'HTTP 连接未加密，凭据及聊天内容可能被窃听或篡改。')}</p>}
      {view.readError && <button className="dhc-button dhc-primary" disabled={view.busy} onClick={actions.retryRead}>{t('重试读取')}</button>}
    </section>{view.paired !== null && !view.reading && <footer><button className="dhc-button dhc-primary" disabled={view.actionDisabled} onClick={actions.primary}>{view.actionLabel}</button><p>{t(view.pending ? '仅在电脑确认后建立连接' : '配对信息仅用于连接你的设备')}</p></footer>}</div>
  </div>;
}
