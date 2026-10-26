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
.dshm-home-plugin .dhp-bar h1 { margin:0; font-size:18px; line-height:28px; font-weight:500; text-align:center; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.dshm-home-plugin .dhp-bar button,.dshm-home-plugin .dhp-footer>button { display:flex; align-items:center; justify-content:center; width:44px; height:44px; border:0; border-radius:50%; background:var(--dhp-soft); }
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
`;
