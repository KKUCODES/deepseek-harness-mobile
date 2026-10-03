import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Button } from '@upstream/ui-primitives/src/Button.tsx';
import { FishLogo } from '@upstream/ui-primitives/src/FishLogo.tsx';
import { IconChevronLeftOutline14, IconChevronDownOutline14, IconCloseOutline16, IconEditOutline16, IconSearchOutline16, IconFolderOpenOutline16, IconFolderClose16, IconEllipsisOutline16, IconBrowseOutline16 } from '@upstream/ui-primitives/src/icons/index.tsx';
import './remote.css';
import { RemoteChatPreview } from './RemoteChatPreview.jsx';
import { advanceSession, createSession, sessionStatus } from './remote-chat-demo.mjs';

// 仅供页面审阅：不读取真实配对链接，不调用网关、电脑或模型。
const demoLink = 'dshm://preview-pair';
const computerName = 'DESKTOP-GMCSCPA';
function ComputerIcon() {
  return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="4" y="4" width="16" height="12" rx="2"/><path d="M3 17h18l1 3H2l1-3Z"/></svg>;
}
const workspaces = [{ id: 'mobile', name: 'DSH Mobile', note: '手机端与远程连接' }, { id: 'notes', name: '个人笔记', note: '阅读与日常整理' }, { id: 'site', name: '个人网站', note: '页面与内容维护' }];
const initialTasks = [
  { id: 'approval', title: '调整手机端输入框', workspace: 'mobile', status: 'attention', label: '等待批准', summary: '需要你确认本次文件修改。', time: '刚刚', archived: false },
  { id: 'question', title: '整理本周读书笔记', workspace: 'notes', status: 'attention', label: '等待回答', summary: '你希望按书籍还是主题整理？', time: '2 分钟前', archived: false },
  { id: 'running', title: '检查远程连接恢复', workspace: 'mobile', status: 'running', label: '进行中', summary: '正在检查断线后的任务状态。', time: '5 分钟前', archived: false },
  { id: 'queued', title: '补充首页空状态', workspace: 'site', status: 'running', label: '排队中', summary: '等待当前任务释放执行位置。', time: '8 分钟前', archived: false },
  { id: 'done', title: '优化项目说明', workspace: 'mobile', status: 'other', label: '已完成', summary: '说明已整理，等待你查看结果。', time: '今天 09:41', archived: false },
  { id: 'failed', title: '更新网站依赖', workspace: 'site', status: 'other', label: '执行失败', summary: '下载依赖时连接中断。', time: '昨天', archived: false },
  { id: 'archive', title: '整理旧版页面记录', workspace: 'notes', status: 'other', label: '已完成', summary: '旧版记录已整理。', time: '周一', archived: true },
];
const pairErrors = {
  expired: ['链接已过期', '回到电脑的 DSH 插件页生成新链接，再试一次。'],
  used: ['链接已被领取', '一次性链接不能重复使用，请在电脑上生成新链接。'],
  rejected: ['电脑未批准连接', '请与电脑端确认后，使用新链接重新配对。'],
  uncertain: ['暂未收到配对结果', '先检查状态，避免重复领取同一条链接。'],
};

export function RemotePreview({ visible, onBack, onOpenPlugins, settingsRequest, onStateChange, Surface, IconButton }) {
  const [connection, setConnection] = useState('unpaired');
  const [view, setView] = useState('list');
  const [sheet, setSheet] = useState(null);
  const [link, setLink] = useState('');
  const [linkError, setLinkError] = useState('');
  const [rawTasks, setTasks] = useState(initialTasks);
  const [sessions, setSessions] = useState(() => Object.fromEntries(initialTasks.map(task => [task.id, createSession(task)])));
  const tasks = rawTasks.map(task => ({ ...task, ...(sessions[task.id] ? sessionStatus(sessions[task.id]) : {}) }));
  const chatPositions = useRef({});
  const [load, setLoad] = useState('ready');
  const [query, setQuery] = useState('');
  const [workspaceFilter, setWorkspaceFilter] = useState('all');
  const [archive, setArchive] = useState(false);
  const [statusFilter, setStatusFilter] = useState('all');
  const [selected, setSelected] = useState(null);
  const [workspace, setWorkspace] = useState(null);
  const [newDraft, setNewDraft] = useState('');
  const [noWorkspaces, setNoWorkspaces] = useState(false);
  const [updated, setUpdated] = useState('刚刚');
  const [notice, setNotice] = useState('');
  const timer = useRef(null);
  const list = useRef(null);
  const listPosition = useRef(0);
  const online = connection === 'online';
  const hasSnapshot = ['online', 'offline', 'reconnecting'].includes(connection);
  const task = tasks.find(item => item.id === selected);
  const shown = tasks.filter(item => item.archived === archive && (statusFilter === 'all' || item.status === statusFilter) && (workspaceFilter === 'all' || item.workspace === workspaceFilter) && `${item.title} ${item.summary}`.toLowerCase().includes(query.trim().toLowerCase()));
  const workspaceName = id => workspaces.find(item => item.id === id)?.name || '';
  const statusName = statusFilter === 'attention' ? '等我处理' : statusFilter === 'running' ? '正在进行' : '其他任务';
  const filtered = query.trim() || workspaceFilter !== 'all' || statusFilter !== 'all';
  const showProjects = workspaceFilter === 'all' && !query.trim() && !archive && statusFilter === 'all';

  useEffect(() => () => clearTimeout(timer.current), []);
  useEffect(() => { onStateChange(connection); }, [connection, onStateChange]);
  useEffect(() => {
    if (!settingsRequest) return;
    setSheet(null);
    if (settingsRequest.action === 'scenario') scenario(settingsRequest.value);
    else if (settingsRequest.action === 'connection') { clearTimeout(timer.current); setConnection(settingsRequest.value); }
    else if (settingsRequest.action === 'reconnect') connect();
    else if (settingsRequest.action === 'unbind') { clearTimeout(timer.current); setConnection('unpaired'); setView('list'); setSelected(null); setLink(''); }
    else if (settingsRequest.action === 'open' && settingsRequest.value && hasSnapshot) { setSelected(settingsRequest.value); openView('task'); }
  }, [settingsRequest]);
  useEffect(() => {
    if (!online) setSessions(current => Object.fromEntries(Object.entries(current).map(([id, session]) => [id, advanceSession(session, { type: 'model-disconnected' })])));
  }, [online]);
  useEffect(() => { if (!notice) return; const id = setTimeout(() => setNotice(''), 2800); return () => clearTimeout(id); }, [notice]);
  useLayoutEffect(() => { if (view === 'list' && list.current) list.current.scrollTop = listPosition.current; }, [view]);
  function later(action) { clearTimeout(timer.current); timer.current = setTimeout(action, 650); }
  function openView(next) { if (view === 'list' && list.current) listPosition.current = list.current.scrollTop; setView(next); }
  function back() { if (document.activeElement?.tagName === 'TEXTAREA') { document.activeElement.blur(); return; } if (sheet) setSheet(null); else if (view !== 'list') setView('list'); else if (workspaceFilter !== 'all') setWorkspaceFilter('all'); else onBack(); }
  function clearFilters() { setQuery(''); setWorkspaceFilter('all'); setStatusFilter('all'); }
  function chooseProject(id) { setWorkspaceFilter(id); setQuery(''); setStatusFilter('all'); setArchive(false); if (list.current) list.current.scrollTop = 0; }
  function refresh() { if (!online) return; setLoad('loading'); later(() => { setLoad('ready'); setUpdated('刚刚'); }); }
  function connect() { setConnection(connection === 'unavailable' ? 'connecting' : 'reconnecting'); later(() => { setConnection('online'); setLoad('ready'); setUpdated('刚刚'); }); }
  function claim() {
    if (link.trim() !== demoLink) { setLinkError('请使用下方示例链接。此预览不领取真实配对链接。'); return; }
    setLinkError(''); setConnection('waiting');
  }
  function startNew() { if (!online) return; setWorkspace(null); setNewDraft(''); openView('new'); }
  function createTask() {
    if (!online || !workspace || !newDraft.trim()) return;
    const item = { id: crypto.randomUUID(), title: newDraft.trim().split('\n')[0].slice(0, 40), workspace, status: 'running', label: '排队中', summary: '任务已加入队列，等待开始。', time: '刚刚', archived: false };
    setSessions(current => ({ ...current, [item.id]: createSession(item, newDraft.trim()) }));
    setTasks(current => [item, ...current]); setLoad('ready'); setArchive(false); clearFilters(); setSelected(item.id); setView('task'); setNewDraft('');
  }
  function scenario(name) {
    clearTimeout(timer.current); setSheet(null); setView('list'); setNotice(''); setLinkError('');
    if (name === 'online') { setConnection('online'); setLoad('ready'); clearFilters(); setArchive(false); setNoWorkspaces(false); }
    else if (['loading', 'empty', 'error'].includes(name)) { setConnection('online'); setLoad(name); if (name === 'loading') later(() => setLoad('ready')); }
    else if (name === 'no-workspaces') { setConnection('online'); setNoWorkspaces(true); setWorkspace(null); setNewDraft(''); setView('new'); }
    else setConnection(name);
  }

  useEffect(() => {
    if (!online || !visible) return;
    const id = setInterval(() => setSessions(current => {
      let changed = false;
      const next = Object.fromEntries(Object.entries(current).map(([key, session]) => { const value = advanceSession(session, { type: 'tick', online: true }); if (value !== session) changed = true; return [key, value]; }));
      return changed ? next : current;
    }), 500);
    return () => clearInterval(id);
  }, [online, visible]);
  function updateSession(id, action) { setSessions(current => ({ ...current, [id]: advanceSession(current[id], action) })); }

  const title = view === 'new' ? '新建远程聊天' : view === 'task' ? task?.title || '远程聊天' : workspaceFilter !== 'all' && hasSnapshot ? workspaceName(workspaceFilter) : 'Remote';
  return <main hidden={!visible} className="app remote-app" onKeyDown={event => { if (event.key === 'Escape' && !sheet && !['INPUT', 'TEXTAREA'].includes(event.target.tagName)) { event.preventDefault(); back(); } }}>
    <header className="topbar remote-topbar">
      <IconButton label={view !== 'list' ? '返回任务列表' : workspaceFilter !== 'all' && hasSnapshot ? '返回Remote首页' : '返回普通聊天'} onClick={back}><IconChevronLeftOutline14 size={22}/></IconButton>
      <div className="remote-heading"><strong>{title}</strong></div>
      <IconButton label="更多选项" onClick={() => setSheet('menu')}><IconEllipsisOutline16 size={22}/></IconButton>
    </header>

    {!hasSnapshot ? <section className="remote-scroll connect-page" aria-label="电脑连接">
      <div className="connection-symbol"><IconBrowseOutline16 size={30}/></div>
      {connection === 'unpaired' ? <><h1>把电脑上的任务带在身边</h1><p>查看进度、继续聊天。使用 Remote 时，请保持电脑和 DSH 运行。</p>
        <ol className="pair-steps"><li>在电脑打开 DSH Mobile 插件</li><li>生成一次性配对链接</li><li>在手机打开链接，再由电脑批准</li></ol>
        <Button variant="outline" className="remote-primary" onClick={() => setConnection('pairing')}>连接电脑</Button>
        </>
      : connection === 'pairing' ? <><h1>连接电脑</h1><p>粘贴电脑生成的一次性链接，或扫描二维码。</p><label className="remote-field">配对链接<input aria-label="配对链接" value={link} onChange={event => { setLink(event.target.value); setLinkError(''); }} placeholder="粘贴配对链接" autoComplete="off"/></label>{linkError && <p role="alert" className="remote-error">{linkError}</p>}
        <Button variant="outline" className="remote-primary" disabled={!link.trim()} onClick={claim}>继续配对</Button><div className="remote-actions"><Button onClick={() => { setLink(demoLink); setLinkError(''); }}>使用示例链接</Button><Button onClick={() => setSheet('scan')}>扫码连接</Button></div><p className="preview-note">配对预览 · 请使用示例链接</p></>
      : connection === 'waiting' ? <><h1>等待电脑批准</h1><p>在电脑的插件页核对这台手机，再批准连接。</p><div className="device-card"><strong>我的 Android 手机</strong><span>配对至 · 我的电脑</span><small>示例指纹 · 7A 2C 91 B8（非真实凭据）</small></div><p className="muted" role="status">批准前不会显示电脑任务</p><Button variant="outline" onClick={() => setSheet('scenes')}>演示电脑批准结果</Button><Button onClick={onBack}>先去普通聊天</Button></>
      : pairErrors[connection] ? <><h1>{pairErrors[connection][0]}</h1><p role="alert">{pairErrors[connection][1]}</p><Button variant="outline" onClick={() => { setLink(''); setConnection(connection === 'uncertain' ? 'waiting' : 'pairing'); }}>{connection === 'uncertain' ? '检查配对状态' : '使用新链接'}</Button></>
      : connection === 'connecting' ? <><h1>正在连接电脑</h1><p role="status">连接成功后读取任务，请稍候…</p><Button onClick={onBack}>先去普通聊天</Button></>
      : <><h1>{connection === 'revoked' ? '连接授权已失效' : '暂时连接不上电脑'}</h1><p role="alert">{connection === 'revoked' ? '请在电脑生成新链接并重新批准这台手机。' : '检查手机网络，以及电脑和 DSH 是否正在运行。'}</p><Button variant="outline" onClick={() => connection === 'revoked' ? (setLink(''), setConnection('pairing')) : connect()}>{connection === 'revoked' ? '重新配对' : '重新连接'}</Button><Button onClick={onBack}>回到普通聊天</Button></>}
    </section> : <>
      <button className={`connection-strip ${online ? '' : 'is-offline'}`} onClick={() => setSheet('computer')} aria-label={`查看电脑连接状态，${online ? '电脑已连接' : '电脑离线'}`}><span className={`connection-dot ${online ? 'online' : ''}`}/><ComputerIcon/><strong>{computerName}</strong>{!online && <span className="connection-time">{connection === 'reconnecting' ? '重连中…' : '离线'}</span>}</button>
      {!online && <div className="offline-banner" role="status"><span>保留上次内容（更新：{updated}），暂时无法发送或新建。</span><Button disabled={connection === 'reconnecting'} onClick={connect}>重连</Button></div>}
      {view === 'list' ? <>
        <section ref={list} className="remote-scroll task-list" aria-label="电脑任务列表" aria-busy={load === 'loading'}>
          {showProjects && <section className="remote-projects" aria-label="项目"><h2>项目</h2><button className="project-row" onClick={() => list.current.querySelector('.recent-tasks').scrollIntoView({ block: 'start' })}><ComputerIcon/><span>聊天</span></button>{!noWorkspaces && workspaces.map(item => <button key={item.id} className="project-row" onClick={() => chooseProject(item.id)}><IconFolderClose16 size={22}/><span>{item.name}</span></button>)}</section>}
          <section className="recent-tasks" aria-label="最近聊天"><div className="recent-heading"><h2>{query.trim() ? '搜索结果' : archive ? '已归档' : statusFilter !== 'all' ? statusName : '最近'}</h2>{(filtered || archive) && <Button className="reset-task-filters" onClick={() => { clearFilters(); setArchive(false); }}>清除筛选</Button>}</div>
          {load === 'loading' ? <div className="list-state" role="status"><span className="loading-dot"/><h2>正在读取任务</h2><p>获取电脑上的最新状态…</p></div>
          : load === 'error' ? <div className="list-state"><h2>任务暂时无法读取</h2><p>连接仍在，请稍后重试。</p><Button variant="outline" disabled={!online} onClick={refresh}>重新读取</Button></div>
          : load === 'empty' || shown.length === 0 ? <div className="list-state"><IconBrowseOutline16 size={30}/><h2>{load === 'empty' ? '还没有电脑任务' : filtered ? '没有找到相关任务' : archive ? '暂无归档任务' : '暂无当前任务'}</h2><p>{filtered ? '换个关键词或查看所有工作区。' : '可以在已有工作区开启新的聊天。'}</p></div>
          : shown.map(item => <button key={item.id} className="task-row" aria-label={`${item.title}，${item.label}`} onClick={() => { setSelected(item.id); openView('task'); }}><strong>{item.title}</strong><span className="task-time">{item.time}</span></button>)}
          </section>
        </section>
        <div className="remote-bottom-bar"><label className="remote-search"><IconSearchOutline16 size={21}/><input aria-label="搜索电脑任务" placeholder="搜索聊天" value={query} onChange={event => setQuery(event.target.value)}/>{query && <IconButton label="清除任务搜索" onClick={() => setQuery('')}><IconCloseOutline16/></IconButton>}</label><IconButton variant="primary" label="新建远程聊天" className="icon-button remote-create" disabled={!online} onClick={startNew}><IconEditOutline16 size={23}/></IconButton></div>
      </> : view === 'new' ? <>
        <section className={`remote-scroll new-remote ${workspace ? 'has-workspace' : ''}`} aria-label="新建远程聊天"><div className="remote-welcome"><div className="remote-welcome-intro"><FishLogo size={38}/><h1>在电脑上继续探索</h1></div><Button variant="outline" className="workspace-picker" disabled={!online} onClick={() => setSheet('workspace')}><IconFolderOpenOutline16/>{workspace ? workspaceName(workspace) : '在项目中工作'}<IconChevronDownOutline14/></Button><p>{workspace ? '任务会在这个工作区中开始。' : '选择这次聊天使用的工作区。'}</p></div></section>
        {workspace && <form className="remote-draft" onSubmit={event => { event.preventDefault(); createTask(); }}><label htmlFor="remote-draft">交给电脑的任务</label><textarea id="remote-draft" rows={3} value={newDraft} onChange={event => setNewDraft(event.target.value)} placeholder="描述你想完成的事"/><Button type="submit" variant="outline" disabled={!online || !newDraft.trim()}>开始聊天</Button></form>}
      </> : task && <RemoteChatPreview key={task.id} task={task} session={sessions[task.id]} dispatch={action => updateSession(task.id, action)} online={online} workspaceName={workspaceName(task.workspace)} Surface={Surface} IconButton={IconButton} positions={chatPositions} onOtherTask={setSelected} otherTask={tasks.find(item => item.id !== task.id && item.status === 'attention')} onConnection={setConnection} onNotice={setNotice}/>}
    </>}
    {notice && <div className="toast" role="status">{notice}</div>}
    {sheet && <Surface title={sheet === 'menu' ? '更多选项' : sheet === 'scenes' ? '预览场景' : sheet === 'workspace' ? '选择工作区' : sheet === 'filter' ? '筛选工作区' : sheet === 'scan' ? '扫码连接' : '电脑连接'} onClose={() => setSheet(null)}><div className="sheet-handle"/><header><h2>{sheet === 'menu' ? '更多选项' : sheet === 'scenes' ? '预览场景' : sheet === 'workspace' ? '选择工作区' : sheet === 'filter' ? '筛选工作区' : sheet === 'scan' ? '扫码连接' : computerName}</h2><IconButton label="关闭窗口" onClick={() => setSheet(null)}><IconCloseOutline16/></IconButton></header>
      {sheet === 'menu' ? <>{view === 'task' && task && <Button className="option" disabled={!online} onClick={() => { setTasks(current => current.map(item => item.id === task.id ? { ...item, archived: !item.archived } : item)); setSheet(null); setView('list'); setNotice(task.archived ? '聊天已恢复' : '聊天已归档'); }}>{task.archived ? '恢复到当前任务' : '归档任务'}</Button>}{hasSnapshot && view === 'list' && <><div className="remote-menu-filters">{[['all','全部聊天'],['attention','等我处理'],['running','正在进行'],['other','其他任务']].map(([id,label]) => <Button key={id} aria-pressed={statusFilter === id} className="option" onClick={() => { setStatusFilter(id); setArchive(false); setSheet(null); }}>{label}{statusFilter === id && <span>已选</span>}</Button>)}</div><Button className="option" aria-pressed={archive} onClick={() => { setArchive(v => !v); setStatusFilter('all'); setSheet(null); }}>{archive ? '查看当前聊天' : '查看已归档'}</Button><Button className="option" onClick={() => setSheet('filter')}>筛选工作区</Button><Button className="option" disabled={!online || load === 'loading'} onClick={() => { refresh(); setSheet(null); }}>刷新任务</Button></>}<Button className="option" disabled={!hasSnapshot} onClick={() => { setSheet(null); onOpenPlugins({ online }); }}>电脑插件</Button><Button className="option" onClick={() => setSheet('scenes')}>预览场景</Button></>
      : sheet === 'scenes' ? <><p className="muted">仅切换内存中的示例。不会连接电脑、修改权限或发送任务。</p><div className="scenario-grid">{[['unpaired','未绑定'],['waiting','等待批准'],['online','电脑已批准 / 已连接'],['expired','链接过期'],['used','链接已用'],['rejected','电脑拒绝'],['uncertain','配对结果未知'],['unavailable','首次连接失败'],['offline','使用中断线'],['revoked','授权失效'],['loading','正在加载'],['empty','没有任务'],['error','读取失败'],['no-workspaces','没有工作区']].map(([id,label]) => <Button key={id} variant="outline" onClick={() => scenario(id)}>{label}</Button>)}</div></>
      : sheet === 'scan' ? <><p>将二维码放入取景框。</p><p className="muted">扫码预览 · 不启用摄像头</p><Button variant="outline" onClick={() => { setConnection('waiting'); setSheet(null); }}>演示扫描成功</Button></>
      : sheet === 'filter' || sheet === 'workspace' ? <><p className="muted">{sheet === 'filter' ? '按电脑上已有的工作区查看任务。' : '选择要开始聊天的工作区。'}</p>{sheet === 'workspace' && noWorkspaces ? <div className="list-state"><h3>电脑上还没有工作区</h3><p>请先在电脑 DSH 中创建，再刷新列表。</p><Button variant="outline" disabled={!online} onClick={() => setNotice('还没有工作区，请先在电脑上创建。')}>刷新工作区</Button></div> : <>{sheet === 'filter' && <Button className="option" onClick={() => { setWorkspaceFilter('all'); setSheet(null); }}>所有工作区{workspaceFilter === 'all' && <span>已选</span>}</Button>}{workspaces.map(item => <Button className="option workspace-option" key={item.id} disabled={sheet === 'workspace' && !online} onClick={() => { if (sheet === 'filter') setWorkspaceFilter(item.id); else setWorkspace(item.id); setSheet(null); }}><IconFolderOpenOutline16/><span><strong>{item.name}</strong><small>{item.note}</small></span>{(sheet === 'filter' ? workspaceFilter : workspace) === item.id && <span>已选</span>}</Button>)}</>}</>
      : <><div className="device-card"><strong>{computerName}</strong><span>{online ? '已连接' : '连接中断'}</span><small>最近更新：{updated}</small></div><p>电脑和 DSH 需要保持运行。普通聊天不受电脑连接状态影响。</p>{!online && <Button variant="outline" disabled={connection === 'reconnecting'} onClick={() => { connect(); setSheet(null); }}>重新连接</Button>}<Button onClick={() => setSheet('scenes')}>查看连接状态演示</Button></>}
    </Surface>}
  </main>;
}
