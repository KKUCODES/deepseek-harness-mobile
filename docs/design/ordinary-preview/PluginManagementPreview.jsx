import React, { useEffect, useReducer, useRef, useState } from 'react';
import { Button } from '@upstream/ui-primitives/src/Button.tsx';
import { Switch } from '@upstream/ui-primitives/src/Switch.tsx';
import { IconChevronLeftOutline14, IconChevronRightOutline14, IconCloseOutline16, IconCordisPluginOutline14, IconEllipsisOutline16, IconPlusOutline16, IconSearchOutline16 } from '@upstream/ui-primitives/src/icons/index.tsx';
import { createPluginDemo, pluginCatalog, pluginBlock, pluginState, targetNames } from './plugin-demo.mjs';
import './plugins-preview.css';

export function PluginManagementPreview({ visible, entry, onBack, remoteState, onConnectionScenario, onOpenRemote, Surface, IconButton }) {
  const [state, dispatch] = useReducer(pluginState, undefined, createPluginDemo);
  const [target, setTarget] = useState('phone');
  const [selected, setSelected] = useState(null);
  const [catalog, setCatalog] = useState(false);
  const [queries, setQueries] = useState({ phone: '', computer: '' });
  const [sheet, setSheet] = useState(null);
  const [draft, setDraft] = useState('');
  const [load, setLoad] = useState('ready');
  const [failNext, setFailNext] = useState(false);
  const timer = useRef(null);
  const positions = useRef({});
  const scroll = useRef(null);
  const current = pluginCatalog.find(item => item.id === selected);
  const record = state[target][selected];
  const busy = Boolean(state.pending);
  const query = queries[target];
  const shown = pluginCatalog.filter(item => (catalog || state[target][item.id]) && `${item.name} ${item.package}`.toLowerCase().includes(query.toLowerCase().trim()));
  const blocked = current ? pluginBlock(state, target, current, record ? 'save' : 'install') : '';
  const outcome = state.result?.target === target ? state.result : null;
  const computerBound = ['online', 'offline', 'reconnecting'].includes(remoteState);
  const title = selected ? current.name : catalog ? '安装插件' : '插件';

  useEffect(() => { if (visible) { setTarget(entry.target); setSelected(null); setCatalog(false); setSheet(null); setLoad('ready'); } }, [entry]);
  useEffect(() => () => clearTimeout(timer.current), []);
  useEffect(() => {
    dispatch({ type: 'environment', change: { online: remoteState === 'online', ...(!computerBound ? { permission: false } : {}) } });
    if (!computerBound && target === 'computer') { setSelected(null); setSheet(null); }
  }, [remoteState, computerBound, target]);
  useEffect(() => {
    if (!state.pending) return;
    const token = state.pending.token;
    const id = setTimeout(() => dispatch({ type: 'finish', token }), 700);
    return () => clearTimeout(id);
  }, [state.pending]);
  useEffect(() => { if (!selected && scroll.current) scroll.current.scrollTop = positions.current[`${target}-${catalog}`] || 0; }, [selected, target, catalog]);
  function open(id) { positions.current[`${target}-${catalog}`] = scroll.current.scrollTop; setSelected(id); scroll.current.scrollTop = 0; dispatch({ type: 'clear-result' }); }
  function back() { if (selected) setSelected(null); else if (catalog) setCatalog(false); else onBack(); }
  useEffect(() => {
    const onKey = event => { if (visible && !sheet && event.key === 'Escape') { event.preventDefault(); back(); } };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [visible, sheet, selected, catalog, onBack]);
  function chooseTarget(next) { positions.current[`${target}-${catalog}`] = scroll.current.scrollTop; setTarget(next); setLoad('ready'); clearTimeout(timer.current); }
  function run(action, value) {
    if (busy || pluginBlock(state, target, current, action)) return;
    dispatch({ type: 'begin', target, id: selected, action, value, token: crypto.randomUUID(), fail: failNext });
    setFailNext(false); setSheet(null);
  }
  function refresh() { setLoad('loading'); clearTimeout(timer.current); timer.current = setTimeout(() => { setLoad('ready'); dispatch({ type: 'clear-result' }); }, 700); }
  function scene(value) {
    setSheet(null); dispatch({ type: 'clear-result' });
    if (value === 'failure') setFailNext(true);
    else if (value === 'offline') onConnectionScenario('offline');
    else if (value === 'readonly') { onConnectionScenario('online'); dispatch({ type: 'environment', change: { permission: false } }); }
    else if (value === 'allowed') { onConnectionScenario('online'); dispatch({ type: 'environment', change: { permission: true } }); }
    else { setSelected(null); setCatalog(false); if (value === 'empty') dispatch({ type: 'empty', target }); else if (value === 'loading') refresh(); else setLoad('error'); }
  }
  function status(item) {
    const installed = state[target][item.id];
    if (!item.targets.includes(target)) return '需要电脑能力';
    if (item.incompatible) return '版本不兼容';
    if (item.missing) return '缺少依赖';
    if (!installed) return '可安装';
    return installed.enabled ? '运行中' : '已停用';
  }

  return <main hidden={!visible} className="app plugins-app">
    <header className="topbar remote-topbar"><IconButton label={selected ? '返回插件列表' : catalog ? '返回已安装插件' : '退出插件管理'} onClick={back}><IconChevronLeftOutline14 size={22}/></IconButton><strong className="plugin-page-title">{title}</strong><IconButton label="插件预览场景" onClick={() => setSheet('scenes')}><IconEllipsisOutline16 size={22}/></IconButton></header>
    {!selected && <div className="plugin-tabs" role="tablist" aria-label="插件运行位置">{Object.entries(targetNames).map(([id, name]) => <button key={id} role="tab" aria-selected={target === id} onClick={() => chooseTarget(id)}>{name}插件</button>)}</div>}
    <section ref={scroll} className="plugin-scroll" aria-label="插件管理内容" aria-busy={busy || load === 'loading'}>
      <p className="plugin-location">{target === 'phone' ? '在这台手机运行 · 普通聊天' : !computerBound ? '尚未连接电脑' : `我的电脑 · ${state.online ? '已连接' : '离线 · 显示上次内容'}`}</p>
      {target === 'computer' && computerBound && (!state.online || !state.permission) && <div className="plugin-banner"><strong>{!state.online ? '电脑离线' : '目前只能查看'}</strong><p>{!state.online ? '请恢复电脑和 DSH 的连接。离线时不能修改插件。' : '管理电脑插件需要单独授权，请在电脑端允许这台手机管理插件。'}</p><Button variant="outline" onClick={() => setSheet('access')}>{!state.online ? '连接帮助' : '如何获得权限'}</Button></div>}
      {failNext && <p className="plugin-banner" role="status">预览场景：下一次操作将失败。</p>}
      {outcome && <div className={`plugin-result ${outcome.error ? 'is-error' : ''}`} role={outcome.error ? 'alert' : 'status'}>{outcome.text}<Button onClick={() => dispatch({ type: 'clear-result' })} aria-label="关闭操作提示"><IconCloseOutline16/></Button></div>}
      {busy && state.pending.target === target && <p role="status" className="plugin-banner">正在处理…</p>}
      {target === 'computer' && !computerBound ? <div className="plugin-empty"><h2>连接电脑后查看插件</h2><p>连接电脑后，即可查看电脑上安装的插件。</p><Button variant="outline" onClick={onOpenRemote}>前往 Remote 连接</Button></div> : current ? <>
        <div className="plugin-detail-heading"><div className="plugin-symbol"><IconCordisPluginOutline14 size={28}/></div><h1>{current.name} <small>{record?.version || current.latest}</small></h1><code>{current.package}</code><p>{current.description}</p></div>
        <div className="plugin-actions">{record ? <><Button variant="outline" disabled={busy || Boolean(pluginBlock(state, target, current, 'uninstall'))} onClick={() => setSheet('uninstall')}>卸载</Button><div className="plugin-enabled"><span>{status(current)}</span><Switch checked={record.enabled} label={`启用${current.name}`} disabled={busy || Boolean(pluginBlock(state, target, current, record.enabled ? 'disable' : 'enable'))} onChange={next => run(next ? 'enable' : 'disable')}/></div></> : <Button variant="primary" disabled={busy || Boolean(blocked)} onClick={() => setSheet('install')}>安装到{targetNames[target]}</Button>}</div>
        {blocked && <p className="plugin-banner">{blocked}</p>}
        <section className="plugin-section"><h2>能力与适用范围</h2><p>{current.capability}</p><p className="muted">{current.targets.map(id => `${targetNames[id]}插件`).join(' / ')}</p><p className="muted">请仅安装你信任的插件。</p></section>
        {record && current.latest !== record.version && <section className="plugin-section"><h2>可更新至 {current.latest}</h2><p>优化提示词菜单，保留现有设置。</p><Button variant="outline" disabled={busy || Boolean(blocked)} onClick={() => setSheet('update')}>查看更新</Button></section>}
        {record && <section className="plugin-section"><h2>包含的组件 <small>共 1 个</small></h2><div className="plugin-component"><IconCordisPluginOutline14/><div><strong>{current.component}</strong><span>{status(current)}</span></div></div>{current.setting && <Button className="option" disabled={busy} onClick={() => { setDraft(record.setting); setSheet('settings'); }}>插件设置<IconChevronRightOutline14/></Button>}</section>}
      </> : <>
        <div className="plugin-list-tools"><label className="plugin-search"><IconSearchOutline16/><input aria-label="搜索插件" placeholder="搜索插件" value={query} onChange={event => setQueries(previous => ({ ...previous, [target]: event.target.value }))}/>{query && <button aria-label="清除插件搜索" onClick={() => setQueries(previous => ({ ...previous, [target]: '' }))}><IconCloseOutline16/></button>}</label>{!catalog && <IconButton label="安装插件" onClick={() => { setCatalog(true); setLoad('ready'); setQueries(previous => ({ ...previous, [target]: '' })); }}><IconPlusOutline16 size={22}/></IconButton>}</div>
        <div className="plugin-section-heading"><h2>{catalog ? '可安装' : '已安装'}</h2><span>{shown.length}</span></div>
        {catalog && <p className="muted">选择插件，查看功能和支持的设备。</p>}
        {load === 'loading' ? <div className="plugin-empty" role="status">正在读取插件…</div> : load === 'error' ? <div className="plugin-empty"><h2>暂时无法读取插件</h2><p>上次设置仍然保留，请稍后重试。</p><Button variant="outline" onClick={refresh}>重新读取</Button></div> : shown.length ? <div className="plugin-list">{shown.map(item => <button className="plugin-row" key={item.id} onClick={() => open(item.id)} aria-label={`查看${item.name}`}><span className="plugin-symbol"><IconCordisPluginOutline14 size={23}/></span><span className="plugin-row-main"><strong>{item.name}</strong><span>{item.description}</span><small className={state[target][item.id]?.enabled && !item.missing ? 'plugin-running' : ''}>{status(item)}{state[target][item.id] && item.latest !== state[target][item.id].version ? ' · 可更新' : ''}</small></span><IconChevronRightOutline14/></button>)}</div> : <div className="plugin-empty"><h2>{query ? '没有找到相关插件' : '还没有安装插件'}</h2><p>{query ? '试试插件名称或包名。' : `添加适用于${targetNames[target]}的扩展。`}</p>{!query && <Button variant="outline" onClick={() => setCatalog(true)}>浏览插件</Button>}</div>}
      </>}
      
    </section>
    {sheet && <Surface title={sheet === 'scenes' ? '插件预览场景' : sheet === 'settings' ? '插件设置' : sheet === 'access' ? '电脑管理权限' : `${{ install: '安装', update: '更新', uninstall: '卸载' }[sheet]}插件`} onClose={() => setSheet(null)} className="plugin-sheet"><div className="sheet-handle"/><header><h2>{sheet === 'scenes' ? '插件预览场景' : sheet === 'settings' ? '插件设置' : sheet === 'access' ? '电脑管理权限' : `${{ install: '安装', update: '更新', uninstall: '卸载' }[sheet]}${current.name}`}</h2><IconButton label="关闭插件窗口" onClick={() => setSheet(null)}><IconCloseOutline16/></IconButton></header>
      {sheet === 'scenes' ? <><p className="muted">以下仅切换演示数据，不授予真实权限。</p><div className="scenario-grid">{[['allowed', '电脑已授权'], ['readonly', '电脑未授权'], ['offline', '电脑离线'], ['loading', '正在加载'], ['error', '读取失败'], ['empty', '当前端无插件'], ['failure', '下次操作失败']].map(([id, name]) => <Button key={id} variant="outline" disabled={busy && ['empty', 'loading', 'error'].includes(id)} onClick={() => scene(id)}>{name}</Button>)}</div></>
      : sheet === 'access' ? <><p>在电脑的 DSH Mobile 管理入口核对这台手机，再授予插件管理权限。普通连接授权不包含安装、更新或修改插件。</p><p className="muted">获得授权后，点击下方按钮检查状态。</p><Button variant="outline" onClick={() => { setSheet(null); refresh(); }}>重新检查状态</Button></>
      : sheet === 'settings' ? <form onSubmit={event => { event.preventDefault(); run('save', draft); }}><p className="muted">{current.name} · 保存到{targetNames[target]}</p><label className="plugin-field">{current.setting}{current.options ? <select value={draft} disabled={Boolean(blocked)} onChange={event => setDraft(event.target.value)}>{current.options.map(option => <option key={option}>{option}</option>)}</select> : <textarea rows={3} maxLength={200} value={draft} disabled={Boolean(blocked)} onChange={event => setDraft(event.target.value)}/>}</label>{blocked && <p role="status">{blocked}</p>}<div className="plugin-actions"><Button variant="outline" onClick={() => setSheet(null)}>取消</Button><Button type="submit" variant="primary" disabled={busy || Boolean(blocked) || !draft.trim() || draft === record.setting}>保存设置</Button></div></form>
      : <><p>{sheet === 'uninstall' ? `将从${targetNames[target]}移除${current.name}和本插件设置，不删除聊天记录。另一端的同名插件不受影响。` : `将${sheet === 'install' ? '安装' : '更新'}到${targetNames[target]}，版本 ${current.latest}。`}</p>{sheet !== 'uninstall' && <><p>{current.capability}</p><p className="muted">来源：预览目录 · 不会实际安装</p></>}<div className="plugin-actions"><Button variant="outline" onClick={() => setSheet(null)}>取消</Button><Button variant="primary" disabled={busy || Boolean(pluginBlock(state, target, current, sheet))} onClick={() => run(sheet)}>{sheet === 'uninstall' ? '确认卸载' : sheet === 'update' ? '确认更新' : '确认安装'}</Button></div></>}
    </Surface>}
  </main>;
}
