import { RequestOptions } from './ui/RequestOptions.jsx';
import { writeClipboard } from './ordinary-clipboard.mjs';
import { useTranslate } from './ui/locale.jsx';
import React, { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { Button } from '@upstream/ui-primitives/src/Button.tsx';
import { FishLogo } from '@upstream/ui-primitives/src/FishLogo.tsx';
import { IconPanelLeftOutline16, IconNewChatOutline16, IconSearchOutline16, IconCordisPluginOutline14, IconSettingsOutline16, IconBrowseOutline16, IconCloseOutline16, IconChevronDownOutline14, IconCopyOutline16, IconRefreshOutline16, IconBranchOutline16, IconThinkOutline14, IconEllipsisOutline16 } from '@upstream/ui-primitives/src/icons/index.tsx';
import { UserMessage, AssistantMessage } from './ui/ChatMessage.jsx';
import sidebarStyle from '@upstream/ui-sidebar/src/client/SidebarRoot.module.css';
import { OrdinarySession } from './ordinary-session.mjs';
import { OrdinaryComposer } from './ordinary-composer.jsx';
import { ORDINARY_MODELS, chatPreferences, isActiveTurn } from './ordinary-models.mjs';
import { ordinaryError } from './ordinary-errors.mjs';
import { Surface, IconButton } from './ui/Surface.jsx';
import { ChatSearch } from './ui/ChatSearch.jsx';
import { PhonePluginsPage } from './ui/PhonePlugins.jsx';
import { OrdinarySettings } from './ui/OrdinarySettings.jsx';
import { SurfacePresence } from './ui/motion.jsx';


export function OrdinaryApp({ host, renderSlot, SessionProvider }) {
  const t = useTranslate();
  const [session] = useState(() => new OrdinarySession());
  const state = useSyncExternalStore(session.subscribe, session.getSnapshot);
  const plugins = useSyncExternalStore(host.phonePlugins.state.subscribe, host.phonePlugins.state.getSnapshot);
  const [drawer, setDrawer] = useState(false);
  const [page, setPage] = useState('chat');
  const [appearanceRequest, setAppearanceRequest] = useState(0);
  const [sheet, setSheet] = useState(null);
  const [edit, setEdit] = useState('');
  const [notice, setNotice] = useState('');
  const [limit, setLimit] = useState(30);
  const [attachmentView, setAttachmentView] = useState(null);
  const scroll = useRef(null);
  const nearBottom = useRef(true);
  const positions = useRef(new Map());
  const nestedBack = useRef(null);
  const registerBack = useCallback(handler => { nestedBack.current = handler; return () => { if (nestedBack.current === handler) nestedBack.current = null; }; }, []);
  const chat = state.chat;
  const turns = chat?.turns ?? [];
  const preferences = chat ? chatPreferences(chat) : state.homePreferences;
  const model = ORDINARY_MODELS.find(value => value.id === preferences.model);
  const ownBusy = state.busy && state.owner === chat?.id;
  const renderMessage = (text, streaming) => plugins.record.rendering.enabled && plugins.record.rendering.installed
    ? renderSlot('ordinary.message.content', { text, streaming, onOpenLink: url => act(() => session.openLink(url)) }) : <div className="reply-text">{text}</div>;
  const act = async action => {
    try { return await action(); } catch (error) { setNotice(t(ordinaryError(error))); }
  };
  useEffect(() => { session.setDefaultModel(host.settings.bind({ namespace: 'ordinary-chat' }).getSnapshot().value.model); void session.start(); return () => { void session.dispose(); }; }, [session, host]);
  useEffect(() => {
    const openAppearance = () => {
      if (!window.dshmOpenAppearance) return;
      delete window.dshmOpenAppearance;
      setDrawer(false); setSheet(null); setPage('appearance');
      setAppearanceRequest(value => value + 1);
    };
    window.addEventListener('dshm-open-appearance', openAppearance);
    openAppearance();
    return () => window.removeEventListener('dshm-open-appearance', openAppearance);
  }, []);
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(''), 4500);
    return () => clearTimeout(timer);
  }, [notice]);
  useEffect(() => {
    setLimit(30);
    const position = positions.current.get(chat?.id) ?? Infinity;
    if (scroll.current) scroll.current.scrollTop = position;
    nearBottom.current = !Number.isFinite(position);
  }, [chat?.id]);
  useEffect(() => {
    if (nearBottom.current && scroll.current) scroll.current.scrollTop = scroll.current.scrollHeight;
  }, [turns.at(-1)?.content, turns.at(-1)?.reasoning, turns.length]);
  useEffect(() => {
    const back = () => {
      const dialog = document.querySelector('dialog[open]');
      if (dialog) { dialog.dispatchEvent(new Event('cancel', { cancelable: true })); return true; }
      if (nestedBack.current?.()) return true;
      if (page !== 'chat') { setPage('chat'); if (page === 'search') setDrawer(true); return true; }
      return false;
    };
    const key = event => { if (event.key === 'Escape' && !event.defaultPrevented && !document.querySelector('dialog[open]') && back()) event.preventDefault(); };
    window.dshmHandleBack = back;
    window.addEventListener('keydown', key);
    return () => { delete window.dshmHandleBack; window.removeEventListener('keydown', key); };
  }, [page, sheet, drawer, attachmentView]);
  const choose = id => act(async () => { await session.select(id); setDrawer(false); setPage('chat'); });
  const copy = text => act(async () => { if (!await writeClipboard(text)) throw new Error('clipboard_failed'); setNotice(t('已复制')); });
  function manage(kind, index) { setSheet({ kind, index }); setEdit(kind === 'rename' ? chat.title : kind === 'edit' ? turns[index].prompt : ''); }
  const fork = (count, draft = '', send = false, attachments = []) => act(async () => {
    await session.branch(chat.id, count, draft, attachments);
    setSheet(null);
    if (send) await session.send();
  });

  if (page === 'plugins') return <PhonePluginsPage host={host} onBack={() => setPage('chat')} onRemote={() => act(session.openRemote)} renderSlot={renderSlot} registerBack={registerBack}/>;
  if (page === 'settings' || page === 'appearance') return <OrdinarySettings key={appearanceRequest} initialPage={page === 'appearance' ? 'appearance' : 'home'} host={host} session={session} state={state} onBack={() => setPage('chat')} renderSlot={renderSlot} registerBack={registerBack}/>;
  if (page === 'search') return <ChatSearch search={session.search} onClose={() => { setPage('chat'); setDrawer(true); }} onSelect={choose}/>;
  return <main className="app ordinary-app" data-testid="ordinary-product">
    <header className="topbar">
      <IconButton label={page === 'chat' ? t('打开侧边抽屉') : t('返回聊天')} onClick={() => page === 'chat' ? setDrawer(true) : setPage('chat')}><IconPanelLeftOutline16 size={20}/></IconButton>
      {page !== 'chat' && <strong>{page === 'settings' ? t('设置') : t('手机插件')}</strong>}
      {page === 'chat' ? <div className="header-actions">{chat && <IconButton label={t("聊天选项")} onClick={() => setSheet({ kind: 'chat' })}><IconEllipsisOutline16/></IconButton>}<IconButton label={t("新聊天")} onClick={() => act(session.newChat)}><IconNewChatOutline16 size={20}/></IconButton></div> : <span className="header-spacer"/>}
    </header>
    {state.error && <div role="alert" className="ordinary-error">{t(ordinaryError(state.error))}<IconButton label={t("关闭提示")} onClick={() => session.clearError()}><IconCloseOutline16/></IconButton></div>}
    {!state.ready ? <p role="status" className="no-results">{t("正在读取聊天记录…")}</p> : page === 'chat' ? <>
      <section ref={scroll} className={`conversation ${!turns.length ? 'is-empty' : ''}`} aria-label={t("聊天内容")} onScroll={event => {
        const element = event.currentTarget;
        nearBottom.current = element.scrollHeight - element.scrollTop - element.clientHeight < 80;
        positions.current.set(chat?.id, element.scrollTop);
      }}>
        {!turns.length ? <div className="welcome"><div className="welcome-title"><FishLogo size={34}/><h1>{t("探索未至之境")}</h1></div><p>{t("有什么想聊的？")}</p></div> : <div className="messages">
          {turns.length > limit && <Button onClick={() => { const height = scroll.current.scrollHeight; setLimit(value => value + 30); requestAnimationFrame(() => { scroll.current.scrollTop += scroll.current.scrollHeight - height; }); }}>{t("加载更早的消息")}</Button>}
          {turns.slice(-limit).map((turn, visibleIndex) => {
            const index = turns.length - Math.min(limit, turns.length) + visibleIndex;
            return <React.Fragment key={turn.requestId}>
              <UserMessage attachments={!!turn.attachments?.length && <div className="message-attachments">{turn.attachments.map(item => <button key={item.id} onClick={() => setAttachmentView(item)}>{item.kind === 'image' && <img src={item.data} alt={item.name}/>}<span>{item.name}</span></button>)}</div>} actions={<Button className="message-edit" disabled={state.busy} onClick={() => manage('edit', index)}>{t("编辑")}</Button>}>{turn.prompt}</UserMessage>
              <AssistantMessage content={turn.content} reasoning={turn.reasoning} active={isActiveTurn(turn)} error={turn.error && t(ordinaryError(turn.error))} renderContent={renderMessage} actions={<>
                  <IconButton label={t("复制回复")} disabled={!turn.content} onClick={() => copy(turn.content)}><IconCopyOutline16/></IconButton>
                  <IconButton label={turn.status === 'completed' ? t('重新生成') : t('重试回复')} disabled={state.busy} onClick={() => fork(index, turn.prompt, true, turn.attachments)}><IconRefreshOutline16/></IconButton>
                  <IconButton label={t("从此继续新聊天")} disabled={state.busy} onClick={() => fork(index + 1)}><IconBranchOutline16/></IconButton>
                  <Button disabled={!turn.content} onClick={() => act(() => session.share(turn.content))}>{t("分享")}</Button>
                </>}/>
            </React.Fragment>;
          })}
        </div>}
      </section>
      {!state.configured && <div className="key-prompt"><Button onClick={() => act(session.configure)}>{t("配置 DeepSeek Key")}</Button></div>}
      {!!chat?.attachments?.length && <div className="draft-attachments" aria-label={t("待发送附件")}>{chat.attachments.map(item => <div key={item.id}><button onClick={() => setAttachmentView(item)}>{item.name}</button><IconButton label={t('移除附件 {name}', { name: item.name })} onClick={() => act(() => session.removeAttachment(item.id))}><IconCloseOutline16/></IconButton></div>)}</div>}
      <OrdinaryComposer chatId={chat?.id ?? 'new'} draft={state.draft} editDraft={value => { void act(() => session.editDraft(value)); }} busy={false}
        runtime={host.ordinaryInput} renderSlot={renderSlot} SessionProvider={SessionProvider} mobile={{ IconButton, label: t('消息'), placeholder: t('发消息，聊聊你的想法'), attachLabel: t('添加附件'),
          onSend: () => { nearBottom.current = true; if (ownBusy) session.stop(); else void act(session.send.bind(session)); },
          stopping: ownBusy, sendLabel: ownBusy ? t('停止生成') : t('发送消息'), disabled: state.busy && !ownBusy,
          hasAttachments: !!chat?.attachments?.length,
          onAttach: () => setSheet({ kind: 'attachments' }), keepExpanded: !!sheet, companionRef: scroll,
          toolbar: focused => <><Button className="model" tabIndex={focused ? 0 : -1} aria-hidden={!focused} onClick={() => setSheet({ kind: 'models' })} aria-label={t('选择模型，当前 {model}', { model: model.label })}><span>{model.label}</span><IconChevronDownOutline14/></Button>
            <IconButton label={preferences.thinking ? t('关闭深度思考') : t('开启深度思考')} tabIndex={focused ? 0 : -1} aria-hidden={!focused} aria-pressed={preferences.thinking} className={`icon-button thinking ${preferences.thinking ? 'thinking-on' : ''}`} onClick={() => act(() => session.preferences({ thinking: !preferences.thinking }))}><IconThinkOutline14 size={18}/></IconButton></>,
        }}/>
    </> : null}
    <SurfacePresence>{drawer && <Surface kind="drawer" title={t("侧边导航")} onClose={() => setDrawer(false)}><nav className={`${sidebarStyle.root} drawer-content`} aria-label={t("侧边导航")}>
      <div className="drawer-brand"><FishLogo size={27}/><strong>DSHM</strong><IconButton label={t("搜索聊天")} onClick={() => { setDrawer(false); setPage('search'); }}><IconSearchOutline16 size={22}/></IconButton></div>
      <Button className="nav-row" icon={<IconBrowseOutline16/>} onClick={() => { setDrawer(false); act(session.openRemote); }}>Remote</Button>
      <Button className="nav-row" icon={<IconCordisPluginOutline14 size={18}/>} onClick={() => { setDrawer(false); setPage('plugins'); }}>{t("插件")}</Button>
      <div className="history-heading">{t("聊天记录")}</div><div className="history" aria-label={t("最近聊天")}>
        {!state.items.length && <p className="no-results">{t("还没有聊天记录")}</p>}
        {state.items.map(item => <button key={item.id} className={`history-row ${chat?.id === item.id ? 'selected' : ''}`} onClick={() => choose(item.id)}><span>{item.title}</span>{item.draft && <small>{t("草稿")}</small>}</button>)}
        {state.next && <Button onClick={() => act(session.more)}>{t("加载更多")}</Button>}
      </div><Button className="nav-row settings" icon={<IconSettingsOutline16/>} onClick={() => { setDrawer(false); setPage('settings'); }}>{t("设置")}</Button>
    </nav></Surface>}</SurfacePresence>
    <SurfacePresence>{sheet && <Surface title={{ models: t('选择模型'), options: t('回复设置'), chat: t('聊天选项'), rename: t('重命名'), edit: t('编辑消息'), clear: t('清空本地聊天'), delete: t('删除聊天'), attachments: t('附件'), import: t('导入聊天') }[sheet.kind]} onClose={() => setSheet(null)}>
      <div className="sheet-handle"/><header><h2>{{ models: t('选择模型'), options: t('回复设置'), chat: chat?.title, rename: t('重命名'), edit: t('编辑消息'), clear: t('清空本地聊天'), delete: t('删除聊天'), attachments: t('附件'), import: t('导入聊天') }[sheet.kind]}</h2><IconButton label={t("关闭窗口")} onClick={() => setSheet(null)}><IconCloseOutline16/></IconButton></header>
      {sheet.kind === 'models' && ORDINARY_MODELS.map(value => <Button key={value.id} className="option" aria-pressed={value.id === model.id} onClick={() => act(async () => { await session.preferences({ model: value.id }); setSheet(null); })}>{value.label}<span>{value.id === model.id ? t('已选') : ''}</span></Button>)}
      {sheet.kind === 'chat' && <><Button className="option" onClick={() => manage('rename')}>{t("重命名")}</Button><Button className="option" disabled={ownBusy} onClick={() => setSheet({ kind: 'delete' })}>{t("删除聊天")}</Button></>}
      {['rename', 'edit'].includes(sheet.kind) && <><textarea className="sheet-editor" aria-label={sheet.kind === 'rename' ? t('聊天名称') : t('编辑消息')} value={edit} maxLength={sheet.kind === 'rename' ? 200 : 100000} onChange={event => setEdit(event.target.value)}/><p className="muted">{sheet.kind === 'edit' ? t('发送后会开启分支，原聊天保留。') : ''}</p><Button variant="primary" disabled={!edit.trim() || state.busy} onClick={() => sheet.kind === 'rename' ? act(async () => { await session.rename(chat.id, edit); setSheet(null); }) : fork(sheet.index, edit, true, turns[sheet.index].attachments)}>{sheet.kind === 'rename' ? t('保存') : t('发送')}</Button></>}
      {['delete', 'clear'].includes(sheet.kind) && <><p>{sheet.kind === 'clear' ? t('将删除这台手机上的全部普通聊天与草稿。') : t('这条聊天及草稿将从手机删除。')}{t('此操作无法撤销。')}</p><Button variant="primary" disabled={state.busy} onClick={() => act(async () => { if (sheet.kind === 'clear') await session.clearHistory(); else await session.remove(chat.id); setSheet(null); })}>{t("确认删除")}</Button></>}
      {sheet.kind === 'models' && <Button className="option" onClick={() => setSheet({ kind: 'options' })}>{t('回复设置')}</Button>}
      {sheet.kind === 'options' && <RequestOptions value={preferences.requestOptions} thinking={preferences.thinking} onSave={async requestOptions => { await session.preferences({ requestOptions }); setSheet(null); }}/>}
      {sheet.kind === 'attachments' && <><p>{t("支持 JPEG、PNG、GIF、WebP 图片和 UTF-8 文本文件。图片最多 4 MB，每条消息最多 4 个附件；图片理解需使用 DeepSeek Flash。")}</p><div className="attachment-options"><Button variant="outline" onClick={() => act(async () => { await session.pickAttachment('photo'); setSheet(null); })}>{t("从相册选择")}</Button><Button variant="outline" onClick={() => act(async () => { await session.pickAttachment('file'); setSheet(null); })}>{t("选择文件")}</Button></div></>}
    </Surface>}</SurfacePresence>
    <SurfacePresence>{attachmentView && <Surface title={attachmentView.name} onClose={() => setAttachmentView(null)}><header><h2>{attachmentView.name}</h2><IconButton label={t("关闭附件")} onClick={() => setAttachmentView(null)}><IconCloseOutline16/></IconButton></header><p className="muted">{attachmentView.mime} · {Math.ceil(attachmentView.size / 1024)} KB</p>{attachmentView.kind === 'image' ? <img className="attachment-image" src={attachmentView.data} alt={attachmentView.name}/> : <pre className="attachment-text">{attachmentView.text}</pre>}</Surface>}</SurfacePresence>
    {notice && <div role="status" className="toast">{notice}</div>}
    {renderSlot('shell.overlay', {})}
  </main>;
}
