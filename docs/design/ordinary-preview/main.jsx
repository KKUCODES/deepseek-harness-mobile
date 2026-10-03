import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Button } from '@upstream/ui-primitives/src/Button.tsx';
import { FishLogo } from '@upstream/ui-primitives/src/FishLogo.tsx';
import { IconPanelLeftOutline16, IconNewChatOutline16, IconSearchOutline16, IconCordisPluginOutline14, IconSettingsOutline16, IconBrowseOutline16, IconCloseOutline16, IconChevronDownOutline14, IconCopyOutline16, IconRefreshOutline16, IconBranchOutline16, IconThinkOutline14 } from '@upstream/ui-primitives/src/icons/index.tsx';
import { PreviewComposer } from './PreviewComposer.jsx';
import messageStyle from '@upstream/ui-chat/src/client/chat/MessageItem.module.css';
import sidebarStyle from '@upstream/ui-sidebar/src/client/SidebarRoot.module.css';
import '@upstream/ui-theme/src/styles/base.css';
import '@upstream/ui-theme/src/styles/design-platform.css';
import '@upstream/ui-theme/src/styles/gradient-shadow-text.css';
import '@upstream/ui-theme/src/styles/corner-shape.css';
import './style.css';
import { RemotePreview } from './RemotePreview.jsx';
import { PluginManagementPreview } from './PluginManagementPreview.jsx';
import { SettingsPreview } from './SettingsPreview.jsx';
import { ChatSearchPreview } from './ChatSearchPreview.jsx';

// 独立设计预览：只使用内存中的示例，不接触验证 App 的历史、Key 或远程授权。
const samples = [
  { id: 'trip', title: '周末去海边走走', group: '今天', messages: [{ role: 'user', text: '周末想去海边走走，帮我整理一个轻松的出行清单。' }, { role: 'assistant', text: '可以把行程留得宽松一点，把时间留给散步和看海。\n\n出门前带上水、防晒、帽子和一件薄外套。选一双适合步行的鞋，傍晚到海边，找个喜欢的地方等日落。\n\n不用排满景点，留一段随意走走的时间就很好。', thought: '先考虑短途出行与海边天气，再保留足够的自由活动时间。' }] },
  { id: 'reading', title: '整理这一周的读书笔记', group: '昨天', messages: [{ role: 'user', text: '读书笔记可以怎么整理？' }, { role: 'assistant', text: '每篇笔记保留三部分：书里的观点、自己的理解、一个可以实践的小行动。\n\n回顾时优先看自己的理解，而不只是摘录。' }] },
  { id: 'ideas', title: '把一个想法说清楚', group: '昨天', messages: [{ role: 'user', text: '怎样更清楚地表达一个想法？' }, { role: 'assistant', text: '先说你想解决什么问题，再说你的办法，最后用一个具体例子说明。' }] },
];
const draftHome = { id: 'home', title: '新聊天', messages: [] };
const labels = { 附件: '选择要添加的照片或文件。' };

function IconButton({ label, children, ...props }) {
  return <Button className="icon-button" aria-label={label} title={label} {...props}>{children}</Button>;
}

function Surface({ kind, title, onClose, children, className = '' }) {
  const ref = useRef(null);
  useEffect(() => {
    const before = document.activeElement;
    ref.current.showModal();
    return () => { before?.focus?.(); };
  }, []);
  return <dialog ref={ref} className={`${kind === 'drawer' ? 'drawer' : 'sheet'} ${className}`} aria-label={title}
    onKeyDown={event => { if (event.key === 'Escape') event.stopPropagation(); }}
    onCancel={event => { event.preventDefault(); onClose(); }}
    onClick={event => { if (event.target === event.currentTarget) { const r = event.currentTarget.getBoundingClientRect(); if (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom) onClose(); } }}>
    {children}
  </dialog>;
}

function App() {
  const [mode, setMode] = useState('ordinary');
  const [pluginEntry, setPluginEntry] = useState({ target: 'phone', origin: 'ordinary' });
  const [defaultModel, setDefaultModel] = useState('DeepSeek');
  const [remoteState, setRemoteState] = useState('unpaired');
  const [remoteRequest, setRemoteRequest] = useState(null);
  const [chats, setChats] = useState(samples);
  const [active, setActive] = useState(draftHome);
  const [drafts, setDrafts] = useState({});
  const [drawer, setDrawer] = useState(false);
  const [sheet, setSheet] = useState(null);
  const [preferences, setPreferences] = useState({});
  const model = preferences[active.id]?.model || 'DeepSeek';
  const thinking = preferences[active.id]?.thinking ?? true;
  const [notice, setNotice] = useState('');
  const scroll = useRef(null);
  const positions = useRef({});
  const draft = drafts[active.id] || '';
  const empty = active.messages.length === 0;

  useEffect(() => { if (scroll.current) scroll.current.scrollTop = positions.current[active.id] || 0; }, [active.id]);
  useEffect(() => { if (!notice) return; const timer = setTimeout(() => setNotice(''), 3500); return () => clearTimeout(timer); }, [notice]);
  function select(chat) {
    if (scroll.current) positions.current[active.id] = scroll.current.scrollTop;
    setActive(chat); setMode('ordinary'); setDrawer(false); 
    if (chat.id === 'home' && !drafts.home?.trim()) setPreferences(current => ({ ...current, home: { model: defaultModel, thinking: true } }));
  }
  function setModel(value) { setPreferences(current => ({ ...current, [active.id]: { model: value, thinking } })); }
  function setThinking(update) { setPreferences(current => ({ ...current, [active.id]: { model, thinking: update(thinking) } })); }
  function saveChat(chat) {
    setChats(current => [chat, ...current.filter(c => c.id !== chat.id)]);
    setPreferences(current => ({ ...current, [chat.id]: { model, thinking } }));
    setActive(chat);
  }
  function send() {
    if (!draft.trim()) return;
    const id = active.id === 'home' ? crypto.randomUUID() : active.id;
    saveChat({ ...active, id, title: empty ? draft.trim().split('\n')[0].slice(0, 36) : active.title, group: '今天', messages: [...active.messages, { role: 'user', text: draft.trim() }, { role: 'assistant', text: '示例回复：可以，我们一起把这个想法梳理清楚。' }] });
    setDrafts(current => ({ ...current, [active.id]: '', [id]: '' }));
    requestAnimationFrame(() => { if (scroll.current) scroll.current.scrollTop = scroll.current.scrollHeight; });
  }
  function openPlugins(target, origin, online) { setPluginEntry({ target, origin, online }); setMode('plugins'); }
  function remoteCommand(action, value) { setRemoteRequest({ action, value, id: crypto.randomUUID() }); }
  function openEntry(title) { setDrawer(false); if (title === 'Remote') setMode('remote'); else if (title === '插件') openPlugins('phone', 'ordinary'); else if (title === '设置') setMode('settings'); else setSheet(title); }

  return <><main className="app" hidden={mode !== 'ordinary'}>
    <header className="topbar">
      <IconButton label="打开侧边抽屉" aria-expanded={drawer} aria-haspopup="dialog" onClick={() => setDrawer(true)}><IconPanelLeftOutline16 size={20}/></IconButton>
      <IconButton label="新聊天" onClick={() => select(draftHome)}><IconNewChatOutline16 size={20}/></IconButton>
    </header>
    <section ref={scroll} className={`conversation ${empty ? 'is-empty' : ''}`} aria-label="聊天内容">
      {empty ? <div className="welcome"><div className="welcome-title"><FishLogo size={34}/><h1>探索未至之境</h1></div><p>有什么想聊的？</p></div> : <div className="messages"><div className="sample-label">交互预览 · 示例聊天</div>{active.messages.map((message, index) => message.role === 'user'
        ? <div key={index} className={messageStyle.userRow}><div className={messageStyle.userStack}><div className={messageStyle.bubble}>{message.text}</div></div></div>
        : <article key={index} className="reply">{message.thought && <details><summary><IconThinkOutline14/>思考过程<IconChevronDownOutline14/></summary><p className="thought">{message.thought}</p></details>}<div className="reply-text">{message.text}</div><div className="reply-actions">
          <IconButton label="复制回复" onClick={async () => { try { await navigator.clipboard.writeText(message.text); setNotice('已复制回复'); } catch { setNotice('无法访问剪贴板，请选择文字复制'); } }}><IconCopyOutline16/></IconButton>
          <IconButton label="重新生成" onClick={() => setNotice('预览模式暂不支持重新生成')}><IconRefreshOutline16/></IconButton>
          <IconButton label="从此继续新聊天" onClick={() => { const chat = { id: crypto.randomUUID(), title: `${active.title} · 分支`, group: '今天', messages: active.messages.slice(0, index + 1) }; saveChat(chat); setNotice('已开启新聊天，原聊天保留'); }}><IconBranchOutline16/></IconButton>
        </div></article>)}</div>}
    </section>
    <PreviewComposer value={draft} onChange={value => setDrafts(current => ({ ...current, [active.id]: value }))} onSend={send} onAttach={() => setSheet('附件')} IconButton={IconButton} keepExpanded={sheet === '附件' || sheet === '模型'} companionRef={scroll} toolbar={focused => <>
      <Button className="model" tabIndex={focused ? 0 : -1} aria-hidden={!focused} onClick={() => setSheet('模型')} aria-label={`选择模型，当前 ${model}`}><span>{model}</span><IconChevronDownOutline14/></Button>
      <IconButton label={thinking ? '关闭深度思考' : '开启深度思考'} tabIndex={focused ? 0 : -1} aria-hidden={!focused} aria-pressed={thinking} className={`icon-button thinking ${thinking ? 'thinking-on' : ''}`} onClick={() => setThinking(v => !v)}><IconThinkOutline14 size={18}/></IconButton>
    </>}/>
    {notice && <div role="status" className="toast">{notice}</div>}
    {drawer && <Surface kind="drawer" title="侧边导航" onClose={() => { setDrawer(false);  }}>
      <nav className={`${sidebarStyle.root} drawer-content`} aria-label="侧边导航">
        <div className="drawer-brand"><FishLogo size={27}/><strong>DSHM</strong><span>预览版</span><IconButton label="搜索聊天" onClick={() => { setDrawer(false); setMode('search'); }}><IconSearchOutline16 size={22}/></IconButton></div>
        <Button className="nav-row" icon={<IconBrowseOutline16/>} onClick={() => openEntry('Remote')}>Remote</Button>
        <Button className="nav-row" icon={<IconCordisPluginOutline14 size={18}/>} onClick={() => openEntry('插件')}>插件</Button>
        <div className="history-heading"><span>聊天记录</span><span className="muted">示例</span></div>
        <div className="history" aria-label="最近聊天">
          {drafts.home?.trim() && <button className={`history-row ${active.id === 'home' ? 'selected' : ''}`} onClick={() => select(draftHome)}><span>新聊天</span><small>草稿</small></button>}
          {chats.length === 0 ? <p className="no-results">还没有聊天记录</p> : ['今天', '昨天'].map(group => { const rows = chats.filter(chat => chat.group === group); return rows.length > 0 && <section key={group}><h2>{group}</h2>{rows.map(chat => <button key={chat.id} className={`history-row ${active.id === chat.id ? 'selected' : ''}`} aria-current={active.id === chat.id ? 'page' : undefined} onClick={() => select(chat)}><span>{chat.title}</span>{drafts[chat.id]?.trim() && <small>草稿</small>}</button>)}</section>; })}
        </div>
        <Button className="nav-row settings" icon={<IconSettingsOutline16/>} onClick={() => openEntry('设置')}>设置</Button>
      </nav>
    </Surface>}
    {sheet && <Surface title={sheet} onClose={() => setSheet(null)}><div className="sheet-handle"/><header><h2>{sheet === '模型' ? '选择模型' : sheet}</h2><IconButton label="关闭窗口" onClick={() => setSheet(null)}><IconCloseOutline16/></IconButton></header>
      {sheet === '模型' ? <>{['DeepSeek', 'DeepSeek · 快速'].map(name => <Button key={name} className="option" aria-pressed={model === name} onClick={() => { setModel(name); setSheet(null); }}>{name}<span>{model === name ? '已选' : ''}</span></Button>)}</> : <><p>{labels[sheet]}</p>{sheet === '附件' && <div className="attachment-options"><Button variant="outline" onClick={() => setNotice('预览模式暂不支持选择照片')}>从相册选择</Button><Button variant="outline" onClick={() => setNotice('预览模式暂不支持选择文件')}>选择文件</Button></div>}</>}
    </Surface>}
  </main>{mode === 'search' && <ChatSearchPreview chats={chats} onClose={() => { setMode('ordinary'); setDrawer(true); }} onSelect={select} IconButton={IconButton}/>}<RemotePreview visible={mode === 'remote'} onBack={() => setMode('ordinary')} settingsRequest={remoteRequest} onStateChange={setRemoteState} onOpenPlugins={({ online }) => openPlugins('computer', 'remote', online)} Surface={Surface} IconButton={IconButton}/><PluginManagementPreview visible={mode === 'plugins'} entry={pluginEntry} remoteState={remoteState} onConnectionScenario={value => remoteCommand('connection', value)} onOpenRemote={() => setMode('remote')} onBack={() => setMode(pluginEntry.origin)} Surface={Surface} IconButton={IconButton}/><SettingsPreview visible={mode === 'settings'} onBack={() => setMode('ordinary')} Surface={Surface} IconButton={IconButton} defaultModel={defaultModel} onDefaultModel={setDefaultModel} chats={chats} hasDrafts={Object.values(drafts).some(value => value.trim())} onHistory={setChats} onClearHistory={() => { setChats([]); setDrafts({}); setPreferences({ home: { model: defaultModel, thinking: true } }); setActive(draftHome); positions.current = {}; }} remoteState={remoteState} onRemoteCommand={remoteCommand} onOpenRemote={taskId => { remoteCommand('open', taskId); setMode('remote'); }}/></>;
}

createRoot(document.getElementById('root')).render(<App/>);
