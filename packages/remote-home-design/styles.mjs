// 所有规则都归属于插件根；样式节点随槽卸载，不依赖全局 reset 或宿主私有类。
export const styles = `
.dshm-home-plugin { --dhp-bg:var(--dshm-bg,#fff); --dhp-text:var(--dshm-text,#15171e); --dhp-secondary:var(--dshm-secondary,#626875); --dhp-soft:var(--dshm-subtle,#eef1f7); --dhp-line:var(--dshm-border,#e2e6ee); --dhp-primary:var(--dshm-primary,#405de6); display:flex; flex:1; min-height:0; flex-direction:column; background:var(--dhp-bg); color:var(--dhp-text); font:400 16px/24px "Noto Sans SC",system-ui,sans-serif; }
.dshm-home-plugin button,.dshm-home-plugin input { font:inherit; color:inherit; }
.dshm-home-plugin button { cursor:pointer; }
.dshm-home-plugin button:disabled { cursor:default; opacity:.55; }
.dshm-home-plugin :is(button,input):focus-visible { outline:2px solid var(--dhp-primary); outline-offset:3px; }
.dshm-home-plugin svg { flex:none; }
.dshm-home-plugin .dhp-icon { display:inline-block; flex:none; background:currentColor; mask-size:contain; mask-position:center; mask-repeat:no-repeat; -webkit-mask-size:contain; -webkit-mask-position:center; -webkit-mask-repeat:no-repeat; }
.dshm-home-plugin .dhp-bar { display:grid; grid-template-columns:44px minmax(0,1fr) 44px; min-height:56px; padding:6px 16px; gap:12px; align-items:center; flex:none; }
.dshm-home-plugin .dhp-heading { justify-self:center; max-width:100%; min-width:0; }
.dshm-home-plugin .dhp-bar h1 { margin:0; font-size:18px; line-height:28px; font-weight:500; text-align:center; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.dshm-home-plugin .dhp-bar button,.dshm-home-plugin .dhp-footer>button { display:flex; align-items:center; justify-content:center; width:44px; height:44px; border:0; border-radius:50%; background:var(--dhp-soft); }
/* 电脑图标与标题是同一个入口，点击标题同样进入电脑连接页。 */
.dshm-home-plugin .dhp-bar .dhp-connection { display:inline-flex; align-items:center; justify-content:center; gap:8px; width:auto; height:auto; max-width:100%; min-width:0; margin:0; padding:8px 0; border:0; border-radius:0; background:transparent; color:var(--dhp-secondary); font:inherit; cursor:pointer; }
.dshm-home-plugin .dhp-connection-title { min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; color:var(--dhp-text); font-size:18px; line-height:28px; font-weight:500; }
.dshm-home-plugin .dhp-scroll { flex:1; min-height:0; overflow:auto; overscroll-behavior:contain; padding:16px 24px 24px; display:flex; flex-direction:column; gap:16px; }
.dshm-home-plugin .dhp-scroll h2 { margin:0 0 8px; font-size:16px; line-height:24px; font-weight:500; }
.dshm-home-plugin .dhp-computer { display:block; width:100%; padding:0; border:0; background:transparent; text-align:left; }
.dshm-home-plugin .dhp-computer>span { display:flex; gap:12px; align-items:center; }
.dshm-home-plugin .dhp-computer strong { flex:1; min-width:0; font-size:18px; font-weight:500; overflow-wrap:anywhere; }
.dshm-home-plugin .dhp-computer small { padding:5px 12px; border-radius:99px; background:var(--dhp-soft); font-size:12px; white-space:nowrap; }
.dshm-home-plugin .dhp-computer .is-online { color:var(--dshm-success,#177245); background:var(--dshm-success-soft,#e9f6ee); }
.dshm-home-plugin .dhp-computer p { margin:16px 0 0; font-size:14px; line-height:22px; color:var(--dhp-secondary); }
.dshm-home-plugin .dhp-row { display:flex; align-items:center; gap:12px; width:100%; min-height:76px; padding:16px; border:0; border-radius:12px; background:transparent; text-align:left; }
.dshm-home-plugin .dhp-row:hover:not(:disabled),.dshm-home-plugin .dhp-row:active:not(:disabled) { background:var(--dhp-soft); }
.dshm-home-plugin .dhp-row > .dhp-status { flex:none; display:grid; place-items:center; width:24px; height:24px; }
.dshm-home-plugin .dhp-status .dhp-pulse { width:14px; height:14px; border:1.5px solid #9a9ca4; border-radius:50%; corner-shape:round; animation:dhp-session-pulse 1.2s ease-in-out infinite; }
.dshm-home-plugin .dhp-status .dhp-dot { width:7px; height:7px; border-radius:50%; corner-shape:round; background:#68a774; }
@keyframes dhp-session-pulse { 0%, 100% { opacity:.35; transform:scale(.86); } 50% { opacity:1; transform:scale(1); } }
.dshm-home-plugin .dhp-copy { display:flex; flex:1; min-width:0; flex-direction:column; gap:4px; overflow-wrap:anywhere; }
.dshm-home-plugin .dhp-copy>span { font-size:16px; line-height:24px; }
.dshm-home-plugin .dhp-copy small { font-size:14px; line-height:22px; color:var(--dhp-secondary); }
.dshm-home-plugin .dhp-value { max-width:32%; flex:none; font-size:12px; color:var(--dhp-secondary); }
.dshm-home-plugin .dhp-empty { display:flex; align-items:center; flex-direction:column; gap:12px; padding:40px 16px; text-align:center; color:var(--dhp-secondary); }
.dshm-home-plugin .dhp-footer { display:flex; align-items:center; flex:none; gap:12px; padding:16px 24px max(24px,env(safe-area-inset-bottom)); }
.dshm-home-plugin .dhp-footer label { display:flex; align-items:center; flex:1; min-width:0; gap:12px; padding:0 16px; min-height:52px; border:1px solid var(--dhp-line); border-radius:28px; }
.dshm-home-plugin .dhp-footer input { width:100%; min-width:0; height:48px; padding:0; border:0; background:transparent; }
.dshm-home-plugin .dhp-footer input::placeholder { color:var(--dhp-secondary); opacity:1; }
.dshm-home-plugin .dhp-skeleton i { display:block; height:44px; border-radius:12px; background:var(--dhp-soft); margin:16px 0; }
.dshm-home-plugin .dhp-group { display:flex; flex-direction:column; }
.dshm-home-plugin .dhp-group-row { min-height:76px; }
.dshm-home-plugin .dhp-toggle { display:flex; flex:none; color:var(--dhp-secondary); transition:transform 160ms ease; }
.dshm-home-plugin .dhp-group.is-expanded .dhp-toggle { transform:rotate(90deg); }
.dshm-home-plugin .dhp-group-heading { display:flex; align-items:center; gap:12px; min-height:52px; padding:12px 16px; color:var(--dhp-secondary); }
.dshm-home-plugin .dhp-group-heading span { flex:1; min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.dshm-home-plugin .dhp-group-heading small { flex:none; }
.dshm-home-plugin .dhp-group-sessions { display:flex; flex-direction:column; }
.dshm-home-plugin .dhp-group-sessions .dhp-row { min-height:64px; }
.dshm-home-plugin .dhp-group-empty { margin:0 16px 12px 36px; font-size:14px; line-height:22px; color:var(--dhp-secondary); }
.dshm-home-plugin .dhp-more { display:block; width:100%; min-height:44px; padding:8px 16px 8px 36px; border:0; background:transparent; color:var(--dhp-secondary); font:inherit; font-size:14px; text-align:left; }
@media (prefers-reduced-motion: reduce) { .dshm-home-plugin .dhp-toggle { transition:none; } .dshm-home-plugin .dhp-pulse { animation:none; opacity:1; transform:none; } }
`;
