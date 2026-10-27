import React, { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { Button } from '@upstream/ui-primitives/src/Button.tsx';
import { IconCheckOutline16, IconChevronLeftOutline14, IconChevronDownOutline14, IconCloseOutline16, IconEllipsisOutline16, IconFolderClose16, IconNewChatOutline16, IconSearchOutline16 } from '@upstream/ui-primitives/src/icons/index.tsx';
import { Surface, IconButton } from './Surface.jsx';
import { useLocale, useTranslate } from './locale.jsx';
import { RemoteComposer } from './RemoteComposer.jsx';
import { RemoteBoundHero, RemoteActivePreset } from './RemoteConversationHero.jsx';
import { UserMessage } from './ChatMessage.jsx';
import { ChatMarkdown } from './ChatMarkdown.jsx';
import { unwrap } from '../remote-model.mjs';
import { responseFailures } from '../remote-response-errors.mjs';
import { RemoteMessage, RemoteFiles, fileSize, contentText } from './RemoteMessage.jsx';
import { RemoteHistoryList } from './RemoteHistoryList.jsx';
import { RemoteChatFrame } from './RemoteChatFrame.jsx';
import { useRemoteScrollFollow } from '../use-remote-scroll-follow.mjs';
import { RemoteDiagnosticEntry } from './RemoteDiagnostics.jsx';
import { DefaultRemoteHome } from './DefaultRemoteHome.jsx';
import { RemoteQueue } from './RemoteQueue.jsx';
import { RemoteFilePreview } from './RemoteFilePreview.jsx';
import { RemoteImages, RemoteLocalImage } from './RemoteImages.jsx';
import { RemoteChangesPreview } from './RemoteDiff.jsx';
import { RemoteCommand } from './RemoteCommand.jsx';
import { RemoteToolDetail } from './RemoteToolDetail.jsx';
import { commandAt, commandDetails } from '../remote-commands.mjs';
import { turnForkAnchor } from '../remote-forks.mjs';
import { RemotePluginList, RemoteComputerPlugins, RemotePluginSettings } from './RemotePlugins.jsx';
import { RemoteSettings } from './RemoteSettings.jsx';
import { PanelSurface } from '../remote-plugin-panels.jsx';
import { RemoteSettingsOnboarding } from './RemoteSettingsOnboarding.jsx';
import { RemotePluginPanels, RemoteHeaderExtensions, RemoteHeaderTitle, RemoteHeaderAncestors, RemoteComposerExtension, RemoteRunningStatus, RemoteHomeExtension } from '../remote-plugin-slots.jsx';
import { RemoteSkillPicker } from './RemoteSkills.jsx';
import { RemoteReferencePicker } from './RemoteReferences.jsx';
import { referenceSources } from '../remote-references.mjs';
import { RemotePermissionPicker } from './RemotePermissions.jsx';
import { RemoteAgentPresetLabel, RemoteAgentPresetPicker } from './RemoteAgentPresets.jsx';
import { RemoteGoalPanel, RemoteGoalSummary } from './RemoteGoal.jsx';
import { RemoteJobs } from './RemoteJobs.jsx';
import { RemoteJobOutput } from './RemoteJobOutput.jsx';
import { RemoteLiveJobOutput } from './RemoteLiveJobOutput.jsx';
import { RemoteSchedules } from './RemoteSchedules.jsx';
import { RemotePlanMode } from './RemotePlanMode.jsx';
import { planModeLabel } from '../remote-plan-mode.mjs';
import { subagentAccess, subagentReadError, SUBAGENT_MODEL_READ_ONLY } from '../remote-subagents.mjs';
import { RemoteSubagents } from './RemoteSubagents.jsx';
import { RemoteWorkspaceManager } from './RemoteWorkspaces.jsx';
import { RemoteSessionExport } from './RemoteSessionExport.jsx';
import { RemoteDesktopApps } from './RemoteDesktopApps.jsx';
import { RemoteInputExtensions } from '../remote-plugin-slots.jsx';
import { RemoteOfflineStatus } from './RemoteOfflineStatus.jsx';
import { loadEarlierHistory } from '../remote-history-position.mjs';
import { loadRemoteHistory } from '../remote-history.mjs';
import { observeRemoteReadingContext } from '../remote-reading-context.mjs';
import { RemoteMainConversationBody, RemoteMainConversationFrame } from '../remote-sidebar-chat.jsx';
import { SurfacePresence, useSceneMotion, RemoteFlowMotion } from './motion.jsx';
import { createChatFlowMotion } from '@dshm/chat-presentation';
import { dismissRemotePortalModal } from '../remote-modals.mjs';

export function RemoteWorkspace({ model, onBack, onConnection, embedded = false, renderConversation }) {
  const t = useTranslate();
  const locale = useLocale();
  const state = useSyncExternalStore(model.subscribeView, model.getSnapshot);
  const focused = useSyncExternalStore(model.conversationFocus.subscribe, model.conversationFocus.getSnapshot);
  const visibleModel = focused ?? model;
  const visibleState = useSyncExternalStore(visibleModel.subscribeView, visibleModel.getSnapshot);
  const composerActive = embedded ? focused === model : !focused;
  const [workspace, setWorkspace] = useState(() => model.workspaceResume?.workspace ?? null), [sheet, setSheet] = useState(null), [query, setQuery] = useState(() => model.workspaceResume?.query ?? '');
  const [search, setSearch] = useState(null), [searchAttempt, retrySearch] = useState(0);
  const [settingsTarget, setSettingsTarget] = useState({ id: 'models', revision: 0 });
  const [notice, setNotice] = useState(''), [actionBusy, setBusy] = useState(false);
  const [cordisTarget, setCordisTarget] = useState(null);
  const [inputBusy, setInputBusy] = useState(false);
  const busy = actionBusy || inputBusy || model.draftTransfers.has(state.selected);
  const [notificationStatus, setNotificationStatus] = useState('connecting');
  useEffect(() => {
    if (embedded) return;
    let active = true;
    const refresh = () => void model.client.call('notifications.status').then(value => {
      if (active) setNotificationStatus(value.status);
    }).catch(() => { if (active) setNotificationStatus('error'); });
    refresh(); window.addEventListener('dshm-notification-status', refresh);
    return () => { active = false; window.removeEventListener('dshm-notification-status', refresh); };
  }, [model, embedded]);
  const [archived, setArchived] = useState(() => model.workspaceResume?.archived ?? false), [title, setTitle] = useState('');
  useEffect(() => {
    model.workspaceResume = undefined;
    const capture = () => ({ workspace, archived, query });
    model.captureWorkspace = capture;
    return () => { if (model.captureWorkspace === capture) delete model.captureWorkspace; };
  }, [model, workspace, archived, query]);
  const [file, setFile] = useState(null);
  const [command, setCommand] = useState(() => model.commandResume?.target ?? null);
  const [jobOutput, setJobOutput] = useState(() => model.jobOutputResume?.target ?? null);
  const { scroll, bottom, attachScroll, onScroll, followBottom, followingTail, returnToBottom } = useRemoteScrollFollow(`${state.selected}:${state.selectionRevision}`);
  const homeReading = useRef(new Map());
  const scene = useRef(null);
  useSceneMotion(scene, state.selected ?? `workspace:${workspace ?? ''}`, state.selected ? 2 : workspace ? 1 : 0);
  // 手机没有桌面InputFoldDriver；rc.2要求显式null，旧reserve合同忽略该返回值。
  const [flowMotion] = useState(() => createChatFlowMotion?.(() => null, active => {
    if (scroll.current) scroll.current.style.overflowAnchor = active ? 'none' : '';
  }));
  useEffect(() => () => flowMotion?.clear(), [flowMotion]);
  const historyRequest = useRef(null);
  const filePicker = useRef(null), imagePicker = useRef(null), pickerSession = useRef(null);
  const editor = useRef(null);
  useEffect(() => {
    if (embedded) return;
    const sessionId = visibleState.connectionState === 'connected' && !sheet && !file && !command && !jobOutput ? visibleState.selected ?? null : null;
    return observeRemoteReadingContext(document, sessionId, value => {
      void model.client.call('notifications.context', { sessionId: value }).catch(() => {});
    });
  }, [model, embedded, visibleState.selected, visibleState.connectionState, sheet, file, command, jobOutput]);
  const act = useCallback(async action => {
    if (busy) return;
    setBusy(true); setNotice('');
    try { return await action(); } catch (error) { setNotice(error.message); } finally { setBusy(false); }
  }, [busy]);
  const selected = state.selected, chat = state.list?.byId[selected];
  const connected = state.connectionState === 'connected';
  const loadOlder = async () => {
    if (!connected || busy || state.session?.loadingOlder || historyRequest.current || !scroll.current) return;
    const container = scroll.current, reference = model.reference;
    const generation = model.connection.generation.getSnapshot(), request = {};
    const isCurrent = () => historyRequest.current === request && scroll.current === container && model.reference === reference && model.connection.generation.getSnapshot() === generation;
    historyRequest.current = request; bottom.current = false; setNotice('');
    try {
      // 分页仅锁住自己的按钮；用户离开时由原会话引用释放来取消请求。
      await new Promise(resolve => setTimeout(resolve, 0));
      if (isCurrent()) await loadEarlierHistory({ container, load: () => loadRemoteHistory(reference.binding, { isCurrent }), isCurrent });
    } catch (error) { if (isCurrent()) setNotice(t(error.message)); }
    finally { if (historyRequest.current === request) historyRequest.current = null; }
  };
  const connectionLabel = connected ? '已连接电脑' : state.connectionState === 'connecting' ? '正在连接电脑…' : '电脑连接已断开';
  const childAccess = subagentAccess(state);
  const modelReadOnly = !!childAccess.address;
  const modelSheetTitle = modelReadOnly ? '当前模型' : '选择模型';
  const sheetTitle = { desktopApps: '在电脑应用中打开', new: '选择工作区', models: modelSheetTitle, menu: 'Remote 选项', attachments: '附件', rename: '重命名聊天', plugins: '电脑插件', pluginSettings: '插件设置', workspaces: '管理工作区', references: '引用文件或聊天', skills: '选择技能', permissions: '会话权限', agentPresets: 'Agent 模式', plan: '计划模式', goal: '当前目标', jobs: '后台任务', schedules: '定时任务', subagents: '子会话', export: '导出会话日志' }[sheet];
  const attachments = state.attachments[selected] ?? [];
  const attachmentsPending = attachments.some(item => item.state !== 'ready');
  const canStop = childAccess.canStop && state.session?.running && !(state.drafts[selected] ?? '').trim() && !attachments.length;
  const pick = input => { pickerSession.current = selected; input.current.click(); };
  const upload = event => {
    const files = [...(event.target.files ?? [])], sessionId = pickerSession.current;
    const image = event.target === imagePicker.current;
    event.target.value = ''; setSheet(null);
    // 选择器打开后仍绑定原会话，切换页面不会把文件发给另一个会话。
    if (sessionId) void act(() => Promise.all(files.map(file => model.upload(file, sessionId, { image }))));
  };
  const selection = state.model ? state.model.next ?? state.catalog?.default : null;
  const groups = state.catalog?.groups ?? [];
  const currentModel = groups.find(group => group.id === selection?.provider)?.models.find(item => item.id === selection?.model);
  const modelName = currentModel?.name ?? selection?.model ?? t('正在读取模型…');
  const modelUnavailable = selection && state.catalog?.routableProviders?.includes(selection.provider) === false;
  const phrase = query.trim();
  // 结果只属于本次查询；下一次 effect 启动前也不显示旧查询的命中。
  const currentSearch = search?.query === phrase ? search : null;
  const snippets = new Map((currentSearch?.items ?? []).map(item => [item.sessionId, item.snippet]));
  const searching = !!phrase && (!currentSearch || currentSearch.loading);
  const rows = (state.list?.ids ?? []).map(id => state.list.byId[id]).filter(item =>
    !item.blank && !!state.workspaces?.archivedSessionIds.includes(item.id) === archived &&
    (!workspace || state.workspaces?.items.find(item => item.workspaceId === workspace)?.sessionIds.includes(item.id)) &&
    (!phrase || item.displayTitle.toLocaleLowerCase().includes(phrase.toLocaleLowerCase()) || snippets.has(item.id)));
  const homeKey = JSON.stringify([workspace, archived, phrase]);
  // 只交付首页投影和白名单操作；插件不会拿到 RemoteModel、凭据或任意 RPC 通道。
  const home = { apiVersion: 1, t, locale, view: {
    key: homeKey, scrollTop: homeReading.current.get(homeKey) ?? 0,
    title: workspace ? state.workspaces.items.find(item => item.workspaceId === workspace)?.title ?? 'Remote' : 'Remote',
    workspace, query, archived, ready: !!state.ready, busy, connection: state.connectionState,
    workspaces: (state.workspaces?.items ?? []).map(item => ({ id: item.workspaceId, title: item.title })),
    sessions: rows.map(item => ({ id: item.id, title: item.displayTitle, running: item.running, updatedAt: item.updatedAt, snippet: snippets.get(item.id) })),
    searching, searchError: currentSearch?.error ? currentSearch.error === 'disabled'
      ? '电脑尚未开启聊天内容搜索，当前仅搜索标题。' : '聊天内容搜索失败，当前仅显示标题匹配。请检查电脑连接后重试。' : null,
    hasMore: !!currentSearch?.hasMore,
  }, actions: {
    back: () => { if (!busy) workspace ? setWorkspace(null) : onBack(); },
    menu: () => setSheet('menu'), connection: onConnection,
    workspace: id => { if (state.workspaces?.items.some(item => item.workspaceId === id)) setWorkspace(id); },
    session: id => { if (!model.getSnapshot().selected && model.getSnapshot().connectionState === 'connected'
      && rows.some(item => item.id === id)) void act(() => model.select(id)); },
    query: value => { if (typeof value === 'string') setQuery(value); }, retrySearch: () => retrySearch(value => value + 1),
    newSession: () => { if (model.getSnapshot().connectionState === 'connected' && !busy) setSheet('new'); },
    readScroll: () => homeReading.current.get(homeKey) ?? 0,
    rememberScroll: top => {
      if (!Number.isFinite(top)) return;
      homeReading.current.set(homeKey, Math.max(0, top));
      if (homeReading.current.size > 32) homeReading.current.delete(homeReading.current.keys().next().value);
    },
  } };
  // 原投影保留未变节点的身份；稳定回调让新输出和草稿编辑不重画全部历史。
  const openFile = useCallback((path, options) => { if (selected) {
    if (model.documentPreviews) setCommand(null);
    setFile({ sessionId: selected, path, line: options?.line });
  } }, [selected, model]);
  const openAttachment = useCallback(value => { if (selected) {
    if (model.documentPreviews) setCommand(null);
    setFile({ ...value, sessionId: selected });
  } }, [selected, model]);
  const openChanges = useCallback(value => { if (selected) {
    // 原文档窗口使用可交互的插件 portal；先收起工具详情的模态层，避免其把新窗口置于 inert 背景。
    if (model.documentPreviews && value.diffs || model.reviewPreview && value.seq !== undefined) setCommand(null);
    setFile({ ...value, sessionId: selected });
  } }, [selected, model]);
  const openCommand = useCallback((nodeId, callId) => setCommand({ sessionId: selected, nodeId, callId }), [selected]);
  const forkTurn = useCallback(nodeId => void act(() => model.forkTurn(nodeId, selected)), [act, model, selected]);
  const renderContent = useCallback((text, streaming, options) => <ChatMarkdown text={text} streaming={streaming} onOpenFile={openFile} fileMentions={options?.fileMentions}/>, [openFile]);
  useEffect(() => {
    const controller = new AbortController();
    setSearch(null);
    if (!phrase || selected || !state.ready) return () => controller.abort();
    if (!connected) { setSearch({ query: phrase, loading: false, items: [], error: 'offline' }); return () => controller.abort(); }
    setSearch({ query: phrase, loading: true, items: [] });
    const timer = setTimeout(() => { void model.sessions.search(phrase, controller.signal).then(result => {
      if (!controller.signal.aborted) setSearch({ ...unwrap(result), query: phrase, loading: false });
    }).catch(error => { if (!controller.signal.aborted) setSearch({ query: phrase, loading: false, items: [],
      error: /SESSION_QUERY_SEARCH_DISABLED|session search is disabled/.test(error.message) ? 'disabled' : 'failed' }); }); }, 180);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [phrase, model, selected, searchAttempt, state.ready, state.connectionState]);
  useEffect(() => { historyRequest.current = null; setFile(null); setCommand(current => current?.sessionId === selected ? current : null); setJobOutput(current => current?.sessionId === selected ? current : null); setSheet(null); }, [selected, state.selectionRevision]);
  useEffect(() => {
    if (embedded || !state.notificationNavigation) return;
    setSheet(null); setFile(null); setCommand(null); setJobOutput(null);
    if (model.pluginPanels.isExpanded()) model.pluginPanels.toggleExpanded();
  }, [model, embedded, state.notificationNavigation]);
  useEffect(() => { if (workspace && state.workspaces?.phase === 'ready' && !state.workspaces.items.some(item => item.workspaceId === workspace)) setWorkspace(null); }, [workspace, state.workspaces]);
  useEffect(() => {
    if (!cordisTarget) return;
    if (selected !== cordisTarget) { setCordisTarget(null); return; }
    if (!state.session) return;
    setCordisTarget(null);
    if (state.session.openError) return;
    try { model.pluginPanels.openTab('guide'); } catch (error) { setNotice(error.message); }
  }, [model, selected, state.session, cordisTarget]);
  useEffect(() => {
    // 会话更新和尺寸变化共用一帧，避免同一批事件重复强制布局。
    followBottom();
  }, [state.conversation, state.session, state.events, followBottom]);
  useEffect(() => {
    if (embedded) return;
    const back = () => {
      if (model.pluginSettingsBack?.()) return true;
      if (model.pluginGlobalBack?.()) return true;
      if (model.pluginPanelBack?.()) return true;
      if (dismissRemotePortalModal(document)) return true;
      if (model.pluginPanels?.isExpanded()) { model.pluginPanels.toggleExpanded(); return true; }
      if (jobOutput) { setJobOutput(null); setSheet('jobs'); } else if (command) setCommand(null); else if (file) setFile(null); else if (sheet === 'pluginManager') setSheet('plugins'); else if (sheet) setSheet(null); else if (selected) void act(() => model.back()); else if (workspace) setWorkspace(null); else return false; return true;
    };
    // 列表进入会话会先经过忙碌态；解除后必须刷新 act，避免系统返回一直被旧状态拦住。
    window.dshmHandleBack = back;
    return () => { delete window.dshmHandleBack; };
  }, [model, embedded, file, command, jobOutput, sheet, selected, workspace, act]);
  const navigation = <>
    <header className="topbar remote-topbar"><IconButton label={t("返回")} disabled={busy} onClick={() => selected ? void act(() => model.back()) : workspace ? setWorkspace(null) : onBack()}><IconChevronLeftOutline14/></IconButton>
      <div className="remote-heading">{selected ? <RemoteHeaderTitle model={model} title={chat?.displayTitle ?? '聊天'}/> : <strong>{workspace ? state.workspaces.items.find(item => item.workspaceId === workspace)?.title : 'Remote'}</strong>}</div>
      <IconButton label={t("Remote 选项")} disabled={busy} onClick={() => setSheet('menu')}><IconEllipsisOutline16/></IconButton></header>
    {selected && <><RemoteHeaderAncestors model={model}/><RemoteHeaderExtensions/></>}
  </>;
  const status = <>
    {(notice || state.error) && <div className="remote-error" role="alert">{t(responseFailures[notice || state.error] ?? (notice || state.error))}<RemoteDiagnosticEntry failure={notice || state.error}/></div>}
    <RemoteOfflineStatus model={model}/>
    {!!state.endpointRecoveries?.length && <p className="remote-offline-status" role="status">
      {t('有服务地址保存结果尚未确认，请打开对应设置重新读取地址。')}
    </p>}
    {!embedded && state.cordisApprovals?.length > 0 && <div className="remote-cordis-notice" role="status">
      <span>{t('有插件等待你确认运行')} · {state.cordisApprovals.length}</span>
      <Button disabled={!connected || busy || (!!selected && !state.session)} onClick={() => void act(async () => {
        setSheet(null);
        if (selected) model.pluginPanels.openTab('guide');
        else {
          const target = state.cordisApprovals[0].agentId;
          await model.select(target);
          if (model.getSnapshot().selected === target) setCordisTarget(target);
        }
      })}>{t('查看请求')}</Button>
    </div>}
    {state.draftErrors?.[selected] && <div className="remote-error" role="alert"><p>{t(state.draftErrors[selected])}</p>
      {Object.hasOwn(state.drafts, selected) && <Button onClick={() => model.writeDraft(selected, state.drafts[selected], state.draftEditors?.[selected])}>{t("重试保存草稿")}</Button>}</div>}
    {state.attachmentDraftErrors?.[selected] && <div className="remote-error" role="alert"><p>{t(state.attachmentDraftErrors[selected])}</p>
      <Button onClick={() => void model.saveAttachmentDrafts(selected)}>{t("重试保存附件")}</Button></div>}
    {selected && <RemoteActivePreset><RemoteAgentPresetLabel model={model} onOpen={() => setSheet('agentPresets')}/></RemoteActivePreset>}
    {selected && childAccess.address && <div className="remote-agent-mode"><Button disabled={busy} onClick={() => void act(() => model.back())}>{t("返回父会话")}</Button><span>{childAccess.address.mode === 'one-shot' ? '一次性子任务' : '子会话'}</span></div>}
  </>;
  const header = <>{navigation}{status}</>;
  const conversation = <>{header}
    <RemoteChatFrame scroll={{ followingTail, returnToBottom: () => { flowMotion?.cancelInput?.(); returnToBottom(); } }}>
    <section className="conversation" ref={attachScroll} aria-label={t("聊天内容")} onScroll={onScroll}>
      {!state.session?.openError && <RemoteBoundHero model={model} state={state} onPreset={() => setSheet('agentPresets')}/>}
      <div className="messages">
        {!state.session && <p role="status">{t("正在读取聊天记录…")}</p>}
        {state.session?.openError && <><p role="alert">{t(subagentReadError(state.session.openError))}</p>
          <Button disabled={!connected || busy || state.subagentServiceAvailable === false && !!childAccess.address}
            onClick={() => void act(() => model.select(state.selectedTarget, { trail: state.selectionTrail }))}>{t('重试读取')}</Button></>}
        {state.session?.hasMore && <Button data-history-loader disabled={!connected || busy || state.session.loadingOlder} onClick={() => void loadOlder()}>{t("加载更早的消息")}</Button>}
        <RemoteHistoryList key={`${selected}:${state.selectionRevision}`} conversation={state.conversation} container={scroll}
          following={bottom} sessionKey={selected} reading={model.reading} target={state.selectedTarget} resume={model.readingResume}
          renderNode={node => <RemoteMessage key={node.key} node={node} renderContent={renderContent} openFile={openFile} openAttachment={openAttachment} openChanges={openChanges} openCommand={openCommand}
            onFork={forkTurn} forkDisabled={!connected || busy || turnForkAnchor(state.conversation, node.key) === null}/>}/>
        {state.inbox?.['next-step']?.map(item => <UserMessage key={item.id} attachments={<RemoteFiles content={item.content} openAttachment={openAttachment}/>}>{contentText(item.content)}<small className="muted">{t("等待引导…")}</small></UserMessage>)}
        {state.session?.pendingSubmissions.filter(item => item.placement !== 'queued').map(item => <UserMessage key={item.requestId} attachments={<RemoteFiles pending={item.attachments} openAttachment={openAttachment}/>}>{item.text}<small className="muted">{t("正在发送…")}</small></UserMessage>)}
        <RemoteRunningStatus/>
      </div>
    </section>
    </RemoteChatFrame>
  </>;
  return <RemoteFlowMotion.Provider value={flowMotion}>{!embedded && <RemoteSettingsOnboarding model={model} openSection={id => {
    setSettingsTarget(before => ({ id, revision: before.revision + 1 })); setSheet('settings');
  }}/>}<RemoteImages key={selected ?? 'home'} model={model} sessionId={selected}><main ref={scene} data-chat-motion="" className={`app remote-app${embedded ? ' remote-embedded-app' : ''}`} data-testid={embedded ? 'remote-sidebar-conversation' : 'remote-workspace'}>
    {selected && !embedded && <RemotePluginPanels/>}
    {!selected ? <>{status}<RemoteHomeExtension home={home} fallback={<DefaultRemoteHome home={home}/>}/></> : <RemoteMainConversationFrame enabled={!embedded}>
      <div className="remote-conversation-view">{renderConversation ? renderConversation(conversation)
        : <RemoteMainConversationBody>{conversation}</RemoteMainConversationBody>}</div>
      <RemoteQueue key={selected} state={state} model={model} openAttachment={openAttachment}/>
      {(state.plan?.active || state.plan?.pending) && <div className="remote-agent-mode"><Button aria-label={t("查看计划模式")} onClick={() => setSheet('plan')}>{t(state.plan.pending ? planModeLabel(state.plan) : '计划模式')}</Button></div>}
      {model.goals.available && <RemoteGoalSummary goals={model.goals} onOpen={() => setSheet('goal')}/>}
      {attachments.length > 0 && <div className="remote-pending-files" aria-label={t("待发送附件")}>{attachments.map(item => <div className="remote-file" key={item.id}>
        {item.kind === 'image' && <RemoteLocalImage source={item.source}/>}
        <span className="remote-file-info"><strong>{item.name}</strong><small role="status">{item.state === 'uploading' ? '正在准备附件…' : item.state === 'error' ? item.error || '附件准备失败，请重试' : item.state === 'uncertain' ? '发送结果未知，请核对聊天记录后移除' : item.state === 'restored' ? '已恢复本机原件，重新准备后即可发送' : `${item.kind === 'image' ? '待发送图片' : '已上传'} · ${fileSize(item.bytes)}`}</small>
        {['restored', 'error'].includes(item.state) && item.source && <Button disabled={busy} onClick={() => void act(() => model.prepareAttachment(item.id))}>{t("重新准备附件")}</Button>}</span>
        <IconButton label={`${item.state === 'uploading' ? '取消上传' : '移除附件'} ${item.name}`} disabled={busy} onClick={() => model.removeAttachment(item.id)}><IconCloseOutline16/></IconButton>
      </div>)}</div>}
      <input ref={filePicker} type="file" hidden multiple onChange={upload}/><input ref={imagePicker} type="file" hidden multiple accept="image/*" onChange={upload}/>
      {childAccess.message && <div className="remote-agent-mode" role="status">{t(childAccess.message)}
        {childAccess.canStop && state.session?.running && !childAccess.canSend && <Button disabled={busy} onClick={() => void act(() => model.stop())}>{t("停止生成")}</Button>}
      </div>}
      {composerActive && <RemoteComposerExtension>{childAccess.address?.mode !== 'one-shot' && <RemoteComposer key={`${selected}:${model.selection}:${model.connection.generation.getSnapshot()?.id}:${connected}`} model={model} attachments={attachments} onAdmissionChange={setInputBusy} editorRef={editor} value={state.drafts[selected] ?? ''} onChange={value => model.draft(value)} IconButton={IconButton}
        label={t('消息')} placeholder={t('发消息，聊聊你的想法')} attachLabel={t('添加附件')}
        onPickFiles={childAccess.address ? undefined : () => pick(filePicker)}
        filePickerDisabled={!connected || actionBusy || !childAccess.canSend || attachmentsPending || !state.session || state.session.openState !== 'open'}
        overlay={<><RemoteInputExtensions/>{(state.draftSaving?.[selected] || state.attachmentDraftSaving?.[selected]) && <span className="remote-draft-saving" role="status">{t("正在保存草稿…")}</span>}</>}
        onSend={() => void act(() => canStop ? model.stop() : model.send())}
        stopping={canStop} hasAttachments={attachments.length > 0} sendLabel={t(state.session?.running ? (canStop ? '停止生成' : '加入队列') : '发送消息')}
        disabled={!connected || busy || !childAccess.canSend || attachmentsPending || !state.session || state.session.openState !== 'open'} onAttach={() => setSheet('attachments')} keepExpanded={!!sheet}
        toolbar={focused => <Button className="model" aria-label={t(modelReadOnly ? '查看模型，当前 {model}' : '选择模型，当前 {model}', { model: modelName })} tabIndex={focused ? 0 : -1} aria-hidden={!focused} onClick={() => { setSheet('models'); void model.modelCatalog.load().catch(() => {}); }}><span>{modelName}</span><IconChevronDownOutline14/></Button>}/>}</RemoteComposerExtension>}
    </RemoteMainConversationFrame>}
    <SurfacePresence>{sheet === 'pluginManager' && <RemoteComputerPlugins model={model} onClose={() => setSheet('plugins')}/>}</SurfacePresence>
    <SurfacePresence>{sheet === 'settings' && <PanelSurface open title={t('电脑设置')} model={model} role="dialog" priority={80}
      backKey="pluginSettingsBack" className="remote-settings-panel" onClose={() => setSheet(null)}>
      <header><h2>{t('电脑设置')}</h2><IconButton label={t('关闭窗口')} onClick={() => setSheet(null)}><IconCloseOutline16/></IconButton></header>
      <div className="remote-settings-body"><RemoteSettings model={model} navigation={settingsTarget} onClose={() => setSheet(null)}/></div>
    </PanelSurface>}</SurfacePresence>
    <SurfacePresence>{sheet && sheet !== 'pluginManager' && sheet !== 'settings' && <Surface phoneTheme title={t(sheet === 'pending' ? '待处理' : sheetTitle)} onClose={() => setSheet(null)}>
      <header><h2>{t(sheet === 'pending' ? '待处理' : sheet === 'settings' ? '电脑设置' : sheetTitle)}</h2><IconButton label={t("关闭窗口")} onClick={() => setSheet(null)}><IconCloseOutline16/></IconButton></header>
      {sheet === 'pending' && <>
        {!model.transport.capabilities?.taskPendingNotifications ? <p role="status">{t("当前电脑不支持汇总待处理事项，请在对应聊天中处理请求。")}</p>
          : state.taskNotifications?.status !== 'listening' ? <p role="status">{t(state.taskNotifications?.status === 'error' ? '待处理事项同步失败，请重试。' : connected ? '正在同步待处理事项…' : '电脑连接已断开，恢复连接后将重新同步。')}</p>
          : !(state.pendingNotices?.length) ? <p className="muted">{t("暂时没有需要处理的事项")}</p>
          : state.pendingNotices.map(item => <Button className="option" key={item.eventId} disabled={busy || !connected} onClick={() => void act(async () => { await model.select(item.sessionId); setSheet(null); })}><span>{state.list?.byId[item.sessionId]?.displayTitle ?? '聊天'}</span><span>{t(item.kind === 'approval' ? '需要批准' : '需要回答')}</span></Button>)}
        {notificationStatus !== 'listening' && <p role="status">{t(['connecting', 'retrying'].includes(notificationStatus) ? '正在恢复手机提醒连接…' : '手机提醒暂时不可用，你仍可在聊天中处理请求。')}</p>}
        {connected && model.transport.capabilities?.taskNotifications && (state.taskNotifications?.status === 'error' || notificationStatus !== 'listening') && <Button onClick={() => void act(async () => { model.restartTaskNotifications(); const value = await model.client.call('notifications.restart'); setNotificationStatus(value.status); })}>{t("重新同步提醒")}</Button>}
      </>}
      {sheet === 'subagents' && <RemoteSubagents key={selected} model={model} state={state} onOpenAside={() => setSheet(null)}/>}
      {sheet === 'plan' && <RemotePlanMode key={selected} model={model} sessionId={selected}/>}
      {sheet === 'schedules' && <RemoteSchedules key={selected} model={model} sessionId={selected}/>}
      {sheet === 'jobs' && <RemoteJobs key={selected} model={model} sessionId={selected} onOpenOutput={target => { setSheet(null); setJobOutput(target); }}/>}
      {sheet === 'goal' && <RemoteGoalPanel key={selected} goals={model.goals} sessionId={selected}/>}
      {sheet === 'agentPresets' && <RemoteAgentPresetPicker key={selected} model={model} sessionId={selected}/>}
      {sheet === 'permissions' && <RemotePermissionPicker key={selected} model={model} sessionId={selected}/>}
      {sheet === 'references' && <RemoteReferencePicker key={selected} model={model} sessionId={selected} connected={connected}
        onPick={() => { setSheet(null); requestAnimationFrame(() => editor.current?.focus()); }}/>}
      {sheet === 'skills' && <RemoteSkillPicker key={selected} skills={model.skills} sessionId={selected}
        onPick={(name, sessionId) => { try { model.skills.insert(name, sessionId); setSheet(null); requestAnimationFrame(() => editor.current?.focus()); } catch (error) { setNotice(error.message); } }}
        onSource={path => { setSheet(null); openFile(path); }}/>}
      {sheet === 'plugins' && <><Button className="option" onClick={() => setSheet('pluginManager')}>{t('管理电脑插件')}</Button><Button className="option" onClick={() => setSheet('pluginSettings')}>{t('插件设置')}</Button><Button className="option" onClick={() => { setSheet(null); model.globalPanels.controller.toggleSidebar(); }}>{t('插件页面')}</Button><RemotePluginList plugins={state.plugins} layout={model.pluginSlots.layout}/></>}
      {sheet === 'pluginSettings' && <RemotePluginSettings model={model}/>}
      {sheet === 'workspaces' && <RemoteWorkspaceManager model={model}/>}
      {sheet === 'export' && <RemoteSessionExport key={selected} model={model} sessionId={selected}/>}
      {sheet === 'desktopApps' && <RemoteDesktopApps key={selected} model={model} sessionId={selected}/>}
      {sheet === 'new' && state.workspaces?.items.map(item => <Button key={item.workspaceId} className="option" disabled={!connected || busy} onClick={() => void act(async () => { await model.create(item.workspaceId); setSheet(null); })}>{item.title}</Button>)}
      {sheet === 'models' && <>
        {modelReadOnly && <p role="status">{t(SUBAGENT_MODEL_READ_ONLY)}</p>}
        {state.catalogStatus === 'loading' && <p role="status">{t("正在读取电脑上的模型…")}</p>}
        {state.catalogError && <p role="alert">无法读取模型列表：{state.catalogError}</p>}
        {state.catalogError && <Button onClick={() => model.modelCatalog.refresh()}>{t("重新读取模型")}</Button>}
        {!modelReadOnly && state.session?.running && <p className="muted">{t("回复进行中，结束后可切换模型。")}</p>}
        {modelUnavailable && <p role="alert">{t(modelReadOnly ? '电脑暂时无法使用当前模型，请检查电脑配置。' : '电脑暂时无法使用当前模型，请选择其他模型或检查电脑配置。')}</p>}
        {state.catalog?.failures?.map(failure => <p role="status" key={failure.id}>{failure.name}：{failure.message}</p>)}
        {groups.map(group => <section key={group.id}><h3>{group.name}</h3>{group.models.map(item => <Button className="option" key={item.id} disabled={modelReadOnly || busy || state.session?.openState !== 'open' || state.session?.running || state.catalogStatus !== 'ready'} aria-pressed={selection?.provider === group.id && selection?.model === item.id} onClick={() => void act(async () => { await model.chooseModel({ provider: group.id, model: item.id }); setSheet(null); })}>{item.name}{selection?.provider === group.id && selection?.model === item.id && <IconCheckOutline16/>}</Button>)}</section>)}
        {currentModel?.reasoning && <section><h3>{t("思考强度")}</h3>{currentModel.reasoning.efforts.map(effort => <Button key={effort.id} className="option" disabled={modelReadOnly || busy || state.session?.openState !== 'open' || state.session?.running || state.catalogStatus !== 'ready'} aria-pressed={(selection?.reasoningEffort ?? currentModel.reasoning.defaultEffort) === effort.id} onClick={() => void act(async () => { await model.chooseModel({ ...selection, reasoningEffort: effort.id }); setSheet(null); })}>{effort.name}{(selection?.reasoningEffort ?? currentModel.reasoning.defaultEffort) === effort.id && <IconCheckOutline16/>}</Button>)}</section>}
      </>}
      {sheet === 'menu' && <><Button className="option" onClick={() => { setSheet(null); onConnection(); }}>{t("电脑连接")}</Button><Button className="option" onClick={() => setSheet('plugins')}>{t("电脑插件")}</Button><Button className="option" disabled={!connected || busy} onClick={() => setSheet('new')}>{t("新建聊天")}</Button>
        <Button className="option" onClick={() => setSheet('workspaces')}>{t("管理工作区")}</Button>
        <Button className="option" onClick={() => { setSettingsTarget(before => ({ id: 'models', revision: before.revision + 1 })); setSheet('settings'); }}>{t("电脑设置")}</Button>
        {/* 选择先发布 sessionId，引用 ready 后才挂载面板；不能只凭 ID 调用原控制器。 */}
        {selected && <Button className="option" disabled={!state.session} onClick={() => { setSheet(null); model.pluginPanels.openTab('guide'); }}>{t('插件面板')}</Button>}
        {model.transport.capabilities?.taskPendingNotifications === true && <Button className="option" onClick={() => setSheet('pending')}>{t('待处理')}{state.taskNotifications?.status === 'listening' && state.pendingNotices?.length > 0 ? `（${state.pendingNotices.length}）` : ''}</Button>}
        <Button className="option" disabled={busy} onClick={() => void act(() => model.client.call('notifications.settings'))}>{t("Remote 提醒")}</Button>
        <Button className="option" disabled={busy} onClick={() => void act(async () => { await model.client.call('appearance.settings'); setSheet(null); })}>{t('外观与语言')}</Button>
        {selected && modelReadOnly && <Button className="option" onClick={() => { setSheet('models'); void model.modelCatalog.load().catch(() => {}); }}>{t("当前模型")}</Button>}
        {selected && state.permission && model.permissions.available && <Button className="option" onClick={() => setSheet('permissions')}>{t("会话权限")}</Button>}
        {selected && model.agentPresets.available && <Button className="option" onClick={() => setSheet('agentPresets')}>{t("Agent 模式")}</Button>}
        {selected && <Button className="option" onClick={() => setSheet('plan')}>{t("计划模式")}</Button>}
        {selected && model.goals.available && <Button className="option" onClick={() => setSheet('goal')}>{t("当前目标")}</Button>}
        {selected && <Button className="option" onClick={() => setSheet('jobs')}>{t("后台任务")}</Button>}
        {selected && <Button className="option" onClick={() => setSheet('subagents')}>{t("子会话")}</Button>}
        {selected && <Button className="option" onClick={() => setSheet('schedules')}>{t("定时任务")}</Button>}
        {selected && <Button className="option" onClick={() => setSheet('export')}>{t("导出会话日志")}</Button>}
        {selected && model.transport.capabilities?.desktopApps === true && <Button className="option" onClick={() => setSheet('desktopApps')}>{t('在电脑应用中打开')}</Button>}
        {selected && model.commandActions?.available('feedback') && <Button className="option" disabled={busy} onClick={() => void act(async () => { await model.commandActions.open('feedback'); setSheet(null); })}>{t("会话反馈")}</Button>}
        {selected ? <><Button className="option" onClick={() => { setTitle(chat?.displayTitle ?? ''); setSheet('rename'); }}>{t("重命名聊天")}</Button>
          <Button className="option" disabled={busy || state.session?.running} onClick={() => void act(async () => { await model.fork(); setSheet(null); })}>{t("在新聊天中分支")}</Button>
          <Button className="option" disabled={busy} onClick={() => void act(async () => { await model.archive(!state.workspaces.archivedSessionIds.includes(selected)); setSheet(null); })}>{t(state.workspaces?.archivedSessionIds.includes(selected) ? '取消归档' : '归档聊天')}</Button></> : <Button className="option" onClick={() => { setArchived(!archived); setSheet(null); }}>{t(archived ? '查看最近聊天' : '查看已归档聊天')}</Button>}
        <Button className="option" onClick={() => void act(() => model.sessions.refresh())}>{t("刷新会话")}</Button></>}
      {sheet === 'rename' && <><input className="sheet-editor" aria-label={t("聊天名称")} value={title} onChange={event => setTitle(event.target.value)}/><Button variant="primary" disabled={busy || !title.trim()} onClick={() => void act(async () => { await model.rename(title); setSheet(null); })}>{t("保存名称")}</Button></>}
      {sheet === 'attachments' && <><Button className="option" onClick={() => pick(imagePicker)}>{t("从相册选择")}</Button>{!childAccess.address && <Button className="option" onClick={() => pick(filePicker)}>{t("选择文件")}</Button>}{!childAccess.address && Object.values(referenceSources(model)).some(Boolean) && <Button className="option" onClick={() => setSheet('references')}>{t('引用文件或聊天')}</Button>}{model.skills.available && <Button className="option" onClick={() => setSheet('skills')}>{t("选择技能")}</Button>}</>}
    </Surface>}</SurfacePresence>
    <SurfacePresence key={`file:${selected}`}>{file && (file.seq !== undefined ? <RemoteChangesPreview file={file} model={model} onClose={() => setFile(null)} onCurrent={(path, index) => setFile({ sessionId: file.sessionId, path, desktopSource: { source: 'changes', seq: file.seq, index } })}/>
      : <RemoteFilePreview file={file} model={model} onClose={() => setFile(null)}/>)}</SurfacePresence>
    {childAccess.address?.mode === 'one-shot' && <RemoteInputExtensions key={selected}/>}
    <SurfacePresence key={`command:${selected}`}>{command && command.sessionId === selected && (commandDetails(commandAt(state, command))
      ? <RemoteCommand model={model} target={command} tool={commandAt(state, command)} sessionCwd={state.workspaces?.items.find(item => item.sessionIds.includes(selected))?.path} onClose={() => setCommand(null)}/>
      : <RemoteToolDetail tool={commandAt(state, command)} renderContent={renderContent} openFile={openFile} openAttachment={openAttachment} openChanges={openChanges}
        openCommand={callId => openCommand(command.nodeId, callId)} onClose={() => setCommand(null)}/>)}</SurfacePresence>
    <SurfacePresence key={`job:${selected}`}>{jobOutput && jobOutput.sessionId === selected && (jobOutput.independent
      ? <RemoteLiveJobOutput key={`${jobOutput.sessionId}:${jobOutput.id}:${jobOutput.startedAt}`} model={model} target={jobOutput} onClose={() => { setJobOutput(null); setSheet('jobs'); }}/>
      : <RemoteJobOutput key={`${jobOutput.sessionId}:${jobOutput.id}:${jobOutput.startedAt}`} model={model} target={jobOutput} onClose={() => { setJobOutput(null); setSheet('jobs'); }}/>) }</SurfacePresence>
  </main></RemoteImages></RemoteFlowMotion.Provider>;
}
