import React, { createContext, memo, useContext, useEffect, useLayoutEffect, useState, useSyncExternalStore } from 'react';
import { registerSidebarChat, subagentChatAddress, SidebarChatTab, ConversationSlotPanel } from '@upstream/ui-subagent/src/client/sidebar-chat/index.tsx';
import { NS, zh, en } from '@upstream/ui-subagent/src/client/locales.ts';
import { RemoteConversationModel } from './remote-conversation-model.mjs';
import { RemotePluginScope, RemoteMainFactory, RemoteConversationSlots, useRemoteSessionProvider } from './remote-plugin-slots.jsx';
import { useScopeBinding, maybeObservableHook } from '@upstream/ui-renderer/src/client/bindings.tsx';
import { RemoteWorkspace } from './ui/RemoteWorkspace.jsx';
import { RemoteEmptyConversation } from './ui/RemoteEmptyConversation.jsx';
import { RemotePanelActive, RemotePanelIdentity } from './remote-plugin-panels.jsx';
import { captureConversationResume } from './remote-resume.mjs';
import { installRemoteSubagentLineage } from './remote-subagent-lineage.jsx';
import { NS as conversationNS } from '@upstream/ui-conversation/src/client/locales.ts';

const ConversationBody = createContext(null);
const MainConversationFrame = createContext(null);
const ConversationViews = createContext(null);
const EmbeddedConversationView = createContext(null);
const ABSENT_BLOCK = { getSnapshot: () => undefined, subscribe: () => () => {} };

/** 任意已注册调用者都在原 FactoryOutlet 之前取得当前 SessionProvider。 */
export function RemoteConversationFactoryHost({ model, children }) {
  const binding = useScopeBinding();
  const address = maybeObservableHook(binding.hooks.session)(state => state.subagent?.address);
  const SessionProvider = useRemoteSessionProvider();
  const mainBody = useContext(MainConversationFrame), view = useContext(EmbeddedConversationView);
  if (mainBody !== null || view !== null || binding.key === undefined) return children;
  if (!SessionProvider) throw new Error('Remote conversation requires the mobile slot scope');
  return <EmbeddedConversationScope model={model} sessionId={binding.key} address={address} SessionProvider={SessionProvider}>
    {current => <EmbeddedConversationView.Provider value={current}>{children}</EmbeddedConversationView.Provider>}
  </EmbeddedConversationScope>;
}

/** 原资源仍持有入口引用；导航模型移到工厂外，使所有注入随当前会话重新绑定。 */
export function remoteSidebarHost(component, model) {
  if (component !== SidebarChatTab) return undefined;
  return function MobileSidebarChatTab({ useResource, useTabInfo, SessionProvider, renderSlot }) {
    const { tab } = useTabInfo();
    const resource = useResource(tab.contentId);
    return <div data-sidebar-chat="">
      {resource.value && <EmbeddedConversationScope model={model} sessionId={resource.value.reference.sessionId}
        address={resource.value.address} SessionProvider={SessionProvider}>
        {view => <EmbeddedConversationView.Provider value={view}>{renderSlot('sidebar.chat.conversation', {})}</EmbeddedConversationView.Provider>}
      </EmbeddedConversationScope>}
    </div>;
  };
}

export function RemoteMainConversationFrame({ children, enabled }) {
  if (!enabled) return children;
  return <MainConversationFrame.Provider value={children}>
    <RemoteMainFactory>{children}</RemoteMainFactory>
  </MainConversationFrame.Provider>;
}

export function RemoteMainConversationBody({ children }) {
  const Views = useContext(ConversationViews);
  return Views ? <ConversationBody.Provider value={children}><Views/></ConversationBody.Provider> : children;
}

// 这两个受控组合只承载手机自己的聊天，不属于需要按桌面宽度缩放的插件内容。
export const isRemoteSidebarComposition = (options, component) =>
  options.name === 'sidebar.right.pane.tab' && component === SidebarChatTab
  || options.name === 'sidebar.chat.conversation' && component === ConversationSlotPanel;

/** 原资源与标签保留；手机的 factory 直接组合自身聊天界面。 */
export function installRemoteSidebarChat(model) {
  const { ctx } = model;
  ctx.locale.register(NS, { zh, en });
  installRemoteSubagentLineage(model);
  ctx.inject(['resources', 'sidebarRightTabs'], scope => registerSidebarChat(scope, ctx.locale.bind(NS)));
  ctx.slots.registerFactory({ name: 'conversation.content', scope: 'session-maybe', locale: conversationNS,
    children: {
      'conversation.session': { kind: 'single', scope: 'session' },
      'conversation.composer': { kind: 'chain', scope: 'session' },
      'conversation.composer.bar': { kind: 'single', scope: 'session-maybe' },
      'conversation.input.dock': { kind: 'list', scope: 'session' },
      'conversation.hero.brand.mark': { kind: 'single', scope: 'root' },
      'conversation.hero.workspace': { kind: 'single', scope: 'root' },
      'conversation.hero.agentPreset': { kind: 'single', scope: 'session-maybe' },
    },
    slots: { views: { scope: 'session' }, widthControls: { scope: 'root' } },
    inject: sessionId => ({ model,
      hooks: { composerBlock: sessionId === undefined ? ABSENT_BLOCK : model.composerBlocks.storeFor(sessionId) },
      selectWorkspace: workspaceId => {
      const view = model.conversationFocus.getSnapshot() ?? model;
      if (sessionId !== undefined && view.getSnapshot().selected !== sessionId)
        return Promise.reject(new Error('聊天已变化，请重新打开工作区选择。'));
      return model.workspaceNavigation.selectWorkspace(workspaceId, sessionId);
    } }),
  }, MobileConversationContent);
  ctx.slots.register({ name: 'conversation.session' }, SidebarConversation);
  model.openChildAside = (id, view = model) => {
    const state = view.getSnapshot(), parentSessionId = state.selected;
    const entry = state.list?.subagentsByParent[parentSessionId]?.entries.find(item => item.id === id && item.kind === 'child');
    model.sessionFor(view);
    if (!entry) throw new Error('子会话已变化，请刷新后重试。');
    ctx.sidebarRight.openResource(subagentChatAddress({ parentSessionId, childSessionId: id, mode: entry.mode }), { kind: 'subagentchat', preferNewPane: true });
  };
}

function DefaultConversationView({ renderSlot }) { return renderSlot('conversation.session', {}); }
function NoWidthControls() { return null; }

/** 原工厂的默认内容及每个实例的局部控件，始终组合手机自己的聊天页。 */
function MobileConversationContent(props) {
  const { sessionId, variant, phase, useFactorySlot } = props;
  const Views = useFactorySlot('views', DefaultConversationView);
  const WidthControls = useFactorySlot('widthControls', NoWidthControls);
  const [container, setContainer] = useState(null);
  const mainFrame = useContext(MainConversationFrame);
  const embeddedView = useContext(EmbeddedConversationView);
  const body = mainFrame !== null
    ? <ConversationViews.Provider value={Views}>{mainFrame}</ConversationViews.Provider>
    : sessionId === undefined
    ? <RemoteEmptyConversation {...props}/>
    : embeddedView !== null
    ? <EmbeddedConversationContent view={embeddedView} Views={Views}/>
    : <MissingConversationScope/>;
  return <RemoteConversationSlots {...props}><div ref={setContainer}
    className={`remote-embedded-conversation${mainFrame !== null ? ' remote-main-conversation' : ''}`} data-conversation-content=""
    data-content-variant={variant} data-content-phase={phase}>
    {body}
    <WidthControls container={container} phase={phase}/>
  </div></RemoteConversationSlots>;
}

function MissingConversationScope() {
  throw new Error('Remote conversation factory was called without its navigation host');
}

function EmbeddedConversationScope({ model, sessionId, address, SessionProvider, children }) {
  const identity = useContext(RemotePanelIdentity);
  const key = identity?.key, signal = identity?.signal;
  // React 可先构造替代视图再清理旧视图；此时快照仍由旧 reader 持有。
  const [resume] = useState(() => identity && (model.panelMemory.readers.get(key)?.() ?? model.panelMemory.pending.get(key)));
  const [view] = useState(() => new RemoteConversationModel(model));
  const state = useSyncExternalStore(view.subscribeView, view.getSnapshot);
  const [ready, setReady] = useState(!resume);
  const [attempt, setAttempt] = useState(0);
  const panelActive = useContext(RemotePanelActive);
  const active = identity ? panelActive : true;
  useEffect(() => {
    let alive = true;
    void view.select(resume?.selectedTarget ?? resume?.selected ?? address ?? sessionId,
      { trail: resume?.selectionTrail ?? [] }).then(() => {
      if (!alive) return;
      if (resume && view.getSnapshot().selected === resume.selected) {
        view.workspaceResume = resume.workspace;
        view.commandResume = resume.command; view.jobOutputResume = resume.jobOutput;
      }
      setReady(true);
    }).catch(error => { if (alive) { view.fail(error); setReady(true); } });
    return () => { alive = false; };
  }, [view, sessionId, address?.parentSessionId, address?.childSessionId, address?.mode, attempt]);
  useLayoutEffect(() => {
    if (ready && key !== undefined) return model.panelMemory.observe(key, () => captureConversationResume(view), signal);
  }, [model, view, key, signal, ready]);
  useEffect(() => () => view.dispose(), [view]);
  useLayoutEffect(() => {
    if (!active) return;
    model.conversationFocus.set(view);
    return () => { if (model.conversationFocus.getSnapshot() === view) model.conversationFocus.set(null); };
  }, [active, model, view]);
  if (!ready || !state.session) return state.error
    ? <div className="remote-error" role="alert">{state.error}<button type="button" onClick={() => {
      view.publish({ error: null }); setReady(false); setAttempt(value => value + 1);
    }}>重新读取聊天</button></div>
    : <p role="status">正在读取聊天记录…</p>;
  return <RemotePluginScope model={view}><SessionProvider session={view.reference}>
    {children(view)}
  </SessionProvider></RemotePluginScope>;
}

// 原工厂仍逐条接收状态；聊天正文仅由自己的合并订阅刷新，保留局部 Views 变更。
const EmbeddedConversationContent = memo(function EmbeddedConversationContent({ view, Views }) {
  const close = () => { if (view.pluginPanels.isExpanded()) view.pluginPanels.toggleExpanded(); };
  return <RemoteWorkspace model={view} embedded onBack={close} onConnection={close}
    renderConversation={body => <ConversationBody.Provider value={body}><Views/></ConversationBody.Provider>}/>;
});

function SidebarConversation() {
  const body = useContext(ConversationBody);
  if (!body) throw new Error('conversation.session requires a conversation.content occurrence');
  return <div className="remote-conversation-body" data-remote-chat-content="">{body}</div>;
}
