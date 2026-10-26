import { isProfileDshVersion } from './remote-dsh-version.mjs';
import { MobileInterfacePlugins, REMOTE_HOME_SLOT } from './mobile-interface-plugins.mjs';
import { phonePluginsFor, PhonePluginHost } from './phone-plugins.mjs';
import './ui/system/system.css';
import { RemoteMarkdownLinks } from './remote-markdown-links.jsx';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { SlotRegistry } from '../../deepseek-harness/packages/client/ui-renderer/src/client/registry.ts';
import { createSlotRenderer } from '../../deepseek-harness/packages/client/ui-renderer/src/client/scoped-slots.tsx';
import { apply as installSessionScope } from '../../deepseek-harness/packages/client/ui-session/src/client/index.ts';
import { EMPTY_CHAT_SNAPSHOT } from '../../deepseek-harness/packages/client/ui-chat/src/client/contract/snapshot.ts';
import { useTurnDataValue } from '../../deepseek-harness/packages/client/ui-chat/src/client/chat/use-turn-data.ts';
import { LocaleRuntime, COMMON_NS } from '../../deepseek-harness/packages/client/locale/src/client/index.ts';
import { zh, en } from '../../deepseek-harness/packages/client/locale/src/locales/index.ts';
import { zh as chatZh, en as chatEn, NS as chatNS } from '../../deepseek-harness/packages/client/ui-chat/src/client/locale.ts';
import { zh as conversationZh, en as conversationEn, NS as conversationNS } from '../../deepseek-harness/packages/client/ui-conversation/src/client/locales.ts';
import { MobilePluginLayout, pluginIdentity } from './mobile-plugin-layout.mjs';
import { MobilePluginFrame } from './ui/MobilePluginFrame.jsx';
import { nativeToolSlot, NativeToolFrame } from './remote-tool-typography.jsx';
import { isRemoteDocumentComposition } from './remote-document-previews.jsx';
import { nativePanelSlot } from './remote-panel-layout.mjs';
import { IconEllipsisOutline16 } from '@upstream/ui-primitives/src/icons/index.tsx';
import { RemoteDesktopAppAction } from './ui/RemoteDesktopAppAction.jsx';
import { installRemoteWorkflow } from './remote-workflow-slots.jsx';
import { installRemoteCommandActions } from './remote-command-actions.jsx';
import { syncFeedbackSlot } from './remote-feedback-sync.mjs';
import { installRemotePluginSettings } from './remote-plugin-settings.jsx';
import { installRemoteModelOnboarding } from './remote-model-onboarding.jsx';
import { RemotePluginImageUrls, inlineImage } from './remote-images.mjs';
import { RemoteInlineImage, RemoteLocalImage } from './ui/RemoteImages.jsx';
import { ChatNodeSeat } from '../../deepseek-harness/packages/client/ui-chat/src/client/chat/ChatNodeSeat.tsx';
import { TurnProcessNodeView } from '../../deepseek-harness/packages/client/ui-chat/src/client/chat/TurnProcessNodeView.tsx';
import { createChatStore } from '../../deepseek-harness/packages/client/ui-chat/src/client/stores.ts';
import { closingFileMentions } from './remote-changes.mjs';
import { useTranslate } from './ui/locale.jsx';
import { installRemotePluginPanels } from './remote-plugin-panels.jsx';
import { RemoteInputBindings } from './remote-input-bindings.mjs';
import { ConversationController } from '../../deepseek-harness/packages/client/ui-conversation/src/client/service.ts';
import { ComposerBlockRegistry } from '../../deepseek-harness/packages/client/ui-conversation/src/client/input/blocks.ts';
import { conversationPhase } from '../../deepseek-harness/packages/client/ui-conversation/src/client/contract/snapshot.ts';
import { sessionLineage, openLineageAncestor } from './remote-lineage.mjs';
import { createSnapshotStore } from '@deepseek-ai/dsh-client-store';
import { installRemoteSidebarChat, isRemoteSidebarComposition, remoteSidebarHost } from './remote-sidebar-chat.jsx';
import { remoteFactoryCaller } from './remote-factory-callers.jsx';
import { workspaceLabel } from '@upstream/ui-conversation/src/client/skeleton/EmptyHero.tsx';
import { installRemoteInteractionPlugins } from './remote-interaction-plugins.jsx';
import { installRemoteCordisApprovals } from './remote-cordis-approvals.mjs';
import { originalComponent, rememberComponentAdapter } from './remote-component-identity.mjs';
import { installRemoteGlobalPanels, RemoteGlobalPanels } from './remote-global-panels.jsx';
import { RemoteToolCancellationTree } from './remote-tool-cancellation.jsx';
import { NativePanelFrame } from './ui/NativePanelFrame.jsx';
import { Button } from '@upstream/ui-primitives/src/Button.tsx';
import { chatPresentation, chatNodeHooks, chatNodeBottom, chatSeatProps, ChatRunningStatus } from '@dshm/chat-presentation';
import { runningTurnStartTime } from './remote-running-status.mjs';
import { RemotePresetDefaults } from './remote-preset-defaults.mjs';
import { installRemoteConfigForms } from '@dshm/config-forms';
import { agentPresetText } from './remote-agent-presets.mjs';
import { useLocale } from './ui/locale.jsx';

const PluginSlots = createContext(null);
const ConversationSlots = createContext(null);
export const useRemoteConversationModel = () => useContext(PluginSlots)?.model;
export const useRemoteSessionProvider = () => useContext(PluginSlots)?.SessionProvider;
export const useRemoteConversationLayout = () => useContext(ConversationSlots);

export function RemoteConversationSlots({ renderSlot, renderSlotChain, SessionProvider, hero, sessionId,
  selectWorkspace, useWorkspaces, useSessions, children }) {
  const workspaces = useWorkspaces(value => value);
  const cwd = useSessions(value => value.byId[sessionId]?.cwd);
  const current = workspaces.items.find(item => item.sessionIds.includes(sessionId));
  const workspaceTitle = current?.title ?? (workspaces.phase !== 'ready' && cwd ? workspaceLabel(cwd) : undefined);
  const [workspacePickerOpen, setWorkspacePickerOpen] = React.useState(false);
  const value = useMemo(() => ({ renderSlot, renderSlotChain, SessionProvider, hero, sessionId,
    selectWorkspace, workspaceTitle, workspaceId: current?.workspaceId, workspacePickerOpen, setWorkspacePickerOpen,
    requiresWorkspace: sessionId === undefined || (hero && workspaceTitle === undefined) }),
  [renderSlot, renderSlotChain, SessionProvider, hero, sessionId, selectWorkspace, workspaceTitle, current?.workspaceId, workspacePickerOpen]);
  return <ConversationSlots.Provider value={value}>{children}</ConversationSlots.Provider>;
}

function useConversationHost() {
  const host = useContext(PluginSlots), owner = useContext(ConversationSlots);
  return useMemo(() => host && owner ? { ...host, ...owner } : null, [host, owner]);
}

/** 订阅原轮数据；最终回复到达后仍可能补上关闭记录或交付信息。 */
export function useRemoteFileMentions(node, openFile, label) {
  const host = useContext(PluginSlots);
  const turn = ['turn', 'step'].includes(node.location?.kind) ? node.location.turn : undefined;
  const tail = useTurnDataValue(turn?.data, 'turn-tail');
  const deliverables = useTurnDataValue(turn?.data, 'deliverables');
  const provider = host?.model.ctx.get('chatFileMentions');
  const reference = host?.reference;
  return useMemo(() => {
    if (turn?.status !== 'closed' || node.data.finalNode === undefined
      || tail?.closing?.finalNode.seq !== node.data.finalNode.seq) return undefined;
    const owner = { turn, seq: node.data.finalNode.seq, openFile };
    return provider ? provider.forClosing(owner, reference?.sessionId) : closingFileMentions(owner, label);
  }, [turn, node.data.finalNode, tail, deliverables, provider, reference, openFile, label]);
}

class MobileSlotRegistry extends SlotRegistry {
  constructor(ctx, layout, model) { super(ctx); this.rootOwner = ctx.fiber; this.layout = layout; this.model = model; }
  onEntryError(listener) {
    return super.onEntryError((slot, entry, error, info) => {
      const component = originalComponent(entry.component);
      // 原ledger先用真实条目隔离故障；仅通知观察者时还原组件，不改变退位/卸载身份。
      listener(slot, component === entry.component ? entry : { ...entry, component }, error, info);
    });
  }
  registerFactory(options, component) {
    return super.registerFactory(options, remoteFactoryCaller(component, this.model));
  }
  register(options, component) {
    const declared = component;
    const register = (settings, Component) => super.register(settings,
      rememberComponentAdapter(remoteFactoryCaller(Component, this.model), declared));
    if (options.name === 'root' && this.ctx.fiber !== this.rootOwner) throw new Error('DSHM owns the root page; plugins must register partial UI slots');
    const sidebar = options.name === 'sidebar.right.pane.tab' && remoteSidebarHost(component, this.model);
    if (sidebar) return register(options, sidebar);
    const id = pluginIdentity(this.ctx), layout = this.layout;
    if (id === '@deepseek-ai/dsh-client-ui-settings-general' && options.name === 'settings.general.item'
      && options.id === 'developer-tools' && this.model.codingTools) {
      const scope = this.model.codingTools, Original = component;
      component = props => <RemoteCodingToolsRow {...props} scope={scope} Component={Original}/>;
    }
    // 原主题行写Remote内存设置；改用手机同一权威入口，不能产生第二套外观偏好。
    if (id === '@deepseek-ai/dsh-client-ui-theme' && options.name === 'settings.general.item') {
      if (options.id === 'font-size') return () => {};
      if (options.id === 'appearance') {
        const model = this.model;
        component = () => <PhoneAppearanceSettings model={model}/>;
      }
    }
    if (id === '@deepseek-ai/dsh-client-ui-tool' && options.name === 'conversation.chat.node' && options.key === 'tool-call') {
      const Original = component;
      component = props => <RemoteToolCancellationTree {...props} Component={Original}/>;
    }
    // 手机已有可操作的模式标签；仅保留这一原条目的手机实现，其他同槽扩展照常注册。
    if (id === '@deepseek-ai/dsh-client-ui-agent-preset'
      && options.name === 'conversation.session.header.actions' && options.id === 'agent-preset') return () => {};
    if (id === '@deepseek-ai/dsh-client-ui-agent-preset' && options.name === 'settings.section'
      && options.id === 'agent-presets' && isProfileDshVersion(this.model.transport.capabilities?.dshVersion)) {
      const defaults = new RemotePresetDefaults(this.model), inject = options.inject, Original = component;
      let face;
      options = { ...options, inject: (...args) => {
        const current = inject(...args);
        face ??= defaults.bind(current);
        return { ...current, ...face, startCreatorDraft: current.startCreatorDraft };
      } };
      component = props => <LatestPresetSection {...props} Component={Original} defaults={defaults}/>;
      this.ctx.effect(() => () => defaults.dispose(), 'DSHM: preset default settings scope');
    }
    // 日志使用手机已接通的原生保存入口；原按钮直接访问桌面 HTTP 下载地址。
    if (id === '@deepseek-ai/dsh-session-log-export'
      && options.name === 'conversation.session.header.utilities' && options.id === 'session-log-download') return () => {};
    // 当前目标已有手机摘要及完整操作窗口，避免输入停靠区再显示同一个内置目标条。
    if (id === '@deepseek-ai/dsh-client-ui-goal'
      && options.name === 'conversation.input.dock' && options.id === 'goal') return () => {};
    // 手机只查看命令结果，不因打开聊天而恢复桌面交互终端。
    if (id === '@deepseek-ai/dsh-client-ui-sidebar-terminal'
      && options.name === 'conversation.session.header.actions' && options.id === id) return () => {};
    if (id === '@deepseek-ai/dsh-client-ui-message-feedback' && options.name === 'conversation.chat.assistant-actions' && options.id === 'feedback') {
      options = syncFeedbackSlot(options, this.model);
    }
    // 页面级手机布局不参与桌面局部组件的等比缩放。
    if (options.name === REMOTE_HOME_SLOT) return register(options, component);
    if (!id || this.ctx.fiber === this.rootOwner || isRemoteSidebarComposition(options, component)
      || isRemoteDocumentComposition(options, component)) return register(options, component);
    if (id === '@deepseek-ai/dsh-client-ui-agent-preset' && options.name === 'conversation.hero.agentPreset') {
      const Original = component, model = this.model;
      component = props => <GuardedPresetSeat {...props} Component={Original} model={model}/>;
    }
    // 官方工具行按手机宽度排版；长错误不能按桌面整行宽度缩成几像素。
    if (nativeToolSlot(this.ctx, options)) {
      const Native = props => <NativeToolFrame>{React.createElement(remoteFactoryCaller(component, this.model), props)}</NativeToolFrame>;
      return super.register(options, rememberComponentAdapter(Native, declared));
    }
    const nativePanel = nativePanelSlot(this.ctx, options);
    if (nativePanel) {
      const Native = props => <NativePanelFrame view={nativePanel} flow={options.name.startsWith('settings.')}>
        {React.createElement(remoteFactoryCaller(component, this.model), props)}
      </NativePanelFrame>;
      return super.register(options, rememberComponentAdapter(Native, declared));
    }
    // 在插件本体适配调用入口，外层仅负责尺寸，不重复包装工厂调用。
    const Framed = props => <MobilePluginFrame id={id} layout={layout} floating={options.name === 'conversation.input.overlay'}
      viewportOverlay={options.name === 'sidebar.footer.action'} shellOverlay={options.name === 'shell.overlay'}
      inline={id === '@deepseek-ai/dsh-client-ui-message-feedback' && options.name === 'conversation.chat.assistant-actions'}
      fill={options.name === 'sidebar.chat.conversation'}>{React.createElement(remoteFactoryCaller(component, this.model), props)}</MobilePluginFrame>;
    return super.register(options, rememberComponentAdapter(Framed, declared));
  }
}

function PhoneAppearanceSettings({ model }) {
  const t = useTranslate();
  return <Button variant="outline" onClick={() => void model.client.call('appearance.settings').catch(error => model.fail(error))}>{t('外观与语言')}</Button>;
}

function RemoteCodingToolsRow({ scope, Component, ...props }) {
  const t = useTranslate(), state = useSyncExternalStore(scope.subscribe, scope.getSnapshot);
  return <>
    <fieldset disabled={!state.writable || state.busy} style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}><Component {...props}/></fieldset>
    {state.error && <p role="alert">{t(state.error)}</p>}
    <Button variant="outline" disabled={state.busy} onClick={() => void scope.refresh()}>{t('重新读取设置')}</Button>
    <Button variant="outline" disabled={!state.writable || state.busy} onClick={() => void scope.unset('enabled')}>{t('恢复默认')}</Button>
  </>;
}

function LatestPresetSection({ Component, defaults, ...props }) {
  const t = useTranslate();
  const state = useSyncExternalStore(defaults.scope.subscribe, defaults.scope.getSnapshot);
  return <>
    {state.error && <p role="alert">{state.error}
      <Button variant="outline" disabled={state.busy} onClick={() => void props.load()}>{t('重新读取设置')}</Button>
    </p>}
    {!state.error && !state.busy && state.status === 'ready' && !state.writable && <p role="status">{t('电脑设置目前只读。')}</p>}
    <Component {...props}/>
    <LatestPresetDirectory controller={defaults.directory} useAgentPresetSection={props.useAgentPresetSection}/>
    <LatestPresetManagement controller={defaults.management} useAgentPresetSection={props.useAgentPresetSection} load={props.load}/>
  </>;
}

function LatestPresetDirectory({ controller, useAgentPresetSection }) {
  const t = useTranslate(), locale = useLocale();
  const state = useSyncExternalStore(controller.subscribe, controller.getSnapshot);
  const rows = useAgentPresetSection(value => value.rows);
  const [selected, setSelected] = useState('');
  useEffect(() => () => controller.clear(), [controller]);
  useEffect(() => {
    if (selected && !rows.some(row => row.id === selected)) { setSelected(''); controller.clear(); }
  }, [rows, selected, controller]);
  if (!controller.supported || !rows.length) return null;
  return <section className="remote-preset-directory" aria-label={t('预设配置位置')}>
    <label>{t('选择预设')}
      <select aria-label={t('选择预设')} value={selected} onChange={event => { controller.clear(); setSelected(event.target.value); }}>
        <option value="">{t('选择预设')}</option>
        {rows.map(row => <option key={row.id} value={row.id}>{agentPresetText(row, locale).name}</option>)}
      </select>
    </label>
    <Button variant="outline" disabled={!selected || !controller.permitted || state.busy} onClick={() => void controller.read(selected)}>{t('查看配置位置')}</Button>
    {state.value && <div role="status">
      <p>{t('该模式的修改会保存到电脑的此配置文件。')}</p>
      <code>{state.value.documentPath}</code>
    </div>}
    {state.error && <p role="alert">{t(state.error)}</p>}
  </section>;
}

function LatestPresetManagement({ controller, useAgentPresetSection, load }) {
  const t = useTranslate(), locale = useLocale();
  const state = useSyncExternalStore(controller.subscribe, controller.getSnapshot);
  const rows = useAgentPresetSection(value => value.rows);
  const [selected, setSelected] = useState(''), [id, setId] = useState(''), [name, setName] = useState(''), [confirming, setConfirming] = useState(false);
  useEffect(() => () => controller.clear(), [controller]);
  useEffect(() => { if (selected && !rows.some(row => row.id === selected)) { setSelected(''); if (!state.result) controller.clear(); } }, [rows, selected, controller, state.result]);
  useEffect(() => { if (!state.view) setConfirming(false); }, [state.view]);
  const save = async operation => { if (await operation()) { setConfirming(false); await load(); } };
  if (!controller.supported || !rows.length) return null;
  const valid = /^[a-z0-9][a-z0-9-]{0,127}$/.test(id) && name.trim().length > 0 && name.trim().length <= 256 && !/[\x00-\x1f\x7f]/.test(name);
  return <section className="remote-preset-directory remote-preset-management" aria-label={t('复制与删除模式')}>
    <label>{t('管理模式')}
      <select aria-label={t('管理模式')} value={selected} disabled={state.busy} onChange={event => { controller.clear(); setConfirming(false); setSelected(event.target.value); }}>
        <option value="">{t('选择预设')}</option>
        {rows.map(row => <option key={row.id} value={row.id}>{agentPresetText(row, locale).name}</option>)}
      </select>
    </label>
    <Button variant="outline" disabled={!selected || !controller.permitted || state.busy} onClick={() => { setConfirming(false); void controller.read(selected); }}>{t('读取模式信息')}</Button>
    {state.view && <fieldset disabled={state.busy || !controller.permitted}>
      <legend>{t('复制为新模式')}</legend>
      <label>{t('新模式标识')}<input aria-label={t('新模式标识')} value={id} maxLength={128} onChange={event => setId(event.target.value)} autoCapitalize="none" spellCheck={false}/></label>
      <p>{t('使用小写字母、数字和连字符。')}</p>
      <label>{t('新模式名称')}<input aria-label={t('新模式名称')} value={name} maxLength={256} onChange={event => setName(event.target.value)}/></label>
      <Button variant="outline" disabled={!state.view.canCopy || !valid} onClick={() => void save(() => controller.copy(id, name))}>{t('复制模式')}</Button>
      {state.view.canDelete ? <>
        <Button variant="outline" onClick={() => setConfirming(true)}>{t('删除模式')}</Button>
        {confirming && <div role="group" aria-label={t('确认删除模式')}>
          <p>{t('删除后不能用于新聊天，已有聊天保留原模式。')}</p>
          {state.view.defaultAfterDelete && <p>{t('新聊天将恢复电脑默认模式。')} <code>{state.view.defaultAfterDelete}</code></p>}
          <Button variant="outline" onClick={() => setConfirming(false)}>{t('取消')}</Button>
          <Button onClick={() => void save(() => controller.remove(true))}>{t('确认删除模式')}</Button>
        </div>}
      </> : <p>{t('此模式来自电脑基础配置，不能在这里删除。')}</p>}
    </fieldset>}
    {state.error && <p role="alert">{t(state.error)}</p>}
    {state.result && <p role="status">{t(state.result.copied ? '模式已复制到电脑。' : '模式已删除，已有聊天保留。')}</p>}
  </section>;
}

function GuardedPresetSeat({ Component, model, ...props }) {
  const { sessionId, load, select } = props;
  const seat = useMemo(() => {
    const scope = { active: true };
    const run = async (action, report) => {
      if (!scope.active || model.lifetime.signal.aborted) return;
      const request = model.sessionView.request, generation = model.connection.generation.getSnapshot();
      const current = () => scope.active && !model.lifetime.signal.aborted
        && model.sessionView.request === request && model.connection.generation.getSnapshot() === generation;
      try { return await model.agentPresets.runSeat(sessionId, action); }
      // 错误属于发起它的页面与连接；换页、重连或卸载不能把迟到失败写进新页面。
      catch (error) { if (current()) return report(error); }
    };
    return { scope, callbacks: {
      load: () => run(load, error => model.fail(error)),
      select: id => run(() => select(id), error => error.message),
    } };
  }, [model, sessionId, load, select]);
  useEffect(() => { seat.scope.active = true; return () => { seat.scope.active = false; }; }, [seat]);
  return <Component {...props} {...seat.callbacks}/>;
}

function MobileSlotRoot({ children, reference, renderSlot, renderSlotChain, renderFactorySlot, SessionProvider, model, rootModel }) {
  const value = useMemo(() => ({ reference, renderSlot, renderSlotChain, renderFactorySlot, SessionProvider, model }), [reference, renderSlot, renderSlotChain, renderFactorySlot, SessionProvider, model]);
  return <PluginSlots.Provider value={value}>{children}
    {model === rootModel && <RemoteGlobalPanels model={model} renderSlot={renderSlot} SessionProvider={SessionProvider}/>}
    {/* 全局插槽只挂载一次，且不继承当前聊天；切换主/旁栏不会重复创建插件浮层。 */}
    {model === rootModel && <div className="remote-shell-overlays" data-shell-overlay>
      <SessionProvider session={undefined} empty={() => renderSlot('shell.overlay', {})}/>
    </div>}
  </PluginSlots.Provider>;
}

/** 只安装局部插槽和真实会话作用域；不创建另一套会话，也不安装桌面 root/layout。 */
export function installRemotePluginSlots(model) {
  const { ctx } = model;
  model.conversationFocus = createSnapshotStore(null);
  const layout = new MobilePluginLayout(ctx, localStorage);
  const slots = new MobileSlotRegistry(ctx, layout, model);
  slots.install(createSlotRenderer());
  slots.provideRoot({ hooks: { workspaces: model.workspaces } });
  // 使用原语言运行时的独立组合模式；不把手机显示语言写入电脑设置。
  const locale = new LocaleRuntime(ctx);
  locale.register(COMMON_NS, { zh, en });
  locale.register(chatNS, { zh: chatZh, en: chatEn });
  // 原工具与图片组件共用 conversation 文案，手机不挂载原桌面组合页。
  locale.register(conversationNS, { zh: conversationZh, en: conversationEn });
  locale.setLocale(document.documentElement.lang.startsWith('zh') ? 'zh' : 'en');
  ctx.provide('locale', locale);
  slots.installLocale(locale);
  installSessionScope(ctx);
  const inputs = model.inputBindings = new RemoteInputBindings(model);
  const blocks = model.composerBlocks = new ComposerBlockRegistry();
  // 仅复用会话作用域的公开服务；手机提交和附件仍沿既有 RemoteModel 路径。
  new ConversationController(ctx, { input: inputs, blocks, maxConcurrentFileUploads: 4 });
  ctx.uiSession.provide({ hooks: ['conversation', 'input'], props: ['inputActions'], resolve(binding) {
    const input = inputs.forBinding(binding);
    return { hooks: { conversation: model.conversations.binding(binding).snapshot, input: input.state }, props: { inputActions: input.actions } };
  } });
  const chats = new WeakMap();
  const images = new WeakMap();
  const imageLoader = reference => {
    const binding = reference.binding;
    let cache = images.get(binding);
    if (!cache) {
      cache = new RemotePluginImageUrls(model, reference.sessionId);
      images.set(binding, cache);
      binding.ctx.effect(() => () => { cache.dispose(); images.delete(binding); });
    }
    return cache.load;
  };
  ctx.uiSession.provide({ hooks: ['chat'], keyedHooks: ['chatNode', 'chatNodeProcess', ...(chatNodeBottom ? ['chatNodeBottom'] : [])], resolve(binding) {
    let source = chats.get(binding);
    if (!source) {
      const target = model.conversations.binding(binding).target('chat');
      source = { getSnapshot: () => target.getSnapshot() ?? EMPTY_CHAT_SNAPSHOT, subscribe: listener => target.subscribe(listener) };
      chats.set(binding, source);
    }
    return { hooks: { chat: source }, keyedHooks: {
      chatNode: key => source.getSnapshot().nodes.source(key),
      chatNodeProcess: key => source.getSnapshot().nodes.processSource(key),
      ...(chatNodeBottom ? { chatNodeBottom: key => source.getSnapshot().nodes.bottomSource(key) } : {}),
    } };
  } });
  slots.register({ name: 'root', children: {
    [REMOTE_HOME_SLOT]: { kind: 'single', scope: 'root' },
    'dshm.chat.node': { kind: 'single', scope: 'session' },
    'dshm.chat.running': { kind: 'single', scope: 'session' },
    'dshm.sidebar': { kind: 'single', scope: 'session' },
    'sidebar.footer.action': { kind: 'list', scope: 'root' },
    'settings.models.footer': { kind: 'list', scope: 'root' },
    'dshm.plugin-settings': { kind: 'single', scope: 'root' },
    'settings.section': { kind: 'list', scope: 'root' },
    'settings.onboarding': { kind: 'list', scope: 'root' },
    'settings.models.provider-card': { kind: 'keyed', scope: 'root' },
    'shell.overlay': { kind: 'list', scope: 'root' },
    'sidebar.panellist': { kind: 'list', scope: 'root' },
    // 仅渲染明确选择的插件管理局部页；不安装桌面布局或选择其他 main 面板。
    main: { kind: 'keyed', scope: 'root' },
    'conversation.chat.turnTail': { kind: 'list', scope: 'session' },
    'conversation.chat.assistant-actions': { kind: 'list', scope: 'session' },
    'conversation.input.overlay': { kind: 'list', scope: 'session' },
    'conversation.session.header.leading': { kind: 'single', scope: 'session' },
    'conversation.session.header.actions': { kind: 'list', scope: 'session' },
    'conversation.session.header.utilities': { kind: 'list', scope: 'session' },
    'conversation.session.header.corner': { kind: 'single', scope: 'session' },
    'conversation.session.header.lineage': { kind: 'single', scope: 'session' },
    'conversation.message.images': { kind: 'single', scope: 'session' },
    'conversation.chat.node': { kind: 'keyed', scope: 'session', inject: {
      hooks: chatNodeHooks ?? { turnData: (_standard, data) => key => useTurnDataValue(data, key) },
    } },
  } }, MobileSlotRoot);
  installRemoteGlobalPanels(model);
  installRemoteWorkflow(model, layout);
  installRemoteCommandActions(model);
  installRemotePluginSettings(model);
  installRemoteModelOnboarding(model);
  installRemotePluginPanels(model);
  installRemoteCordisApprovals(model);
  installRemoteSidebarChat(model);
  const configForms = installRemoteConfigForms?.(model);
  slots.register({ name: 'dshm.chat.node', store: createChatStore(), locale: chatNS,
    ...(chatPresentation ? { inject: () => ({ hooks: { presentation: chatPresentation } }) } : {}),
  }, MobileChatNodeSeat);
  slots.register({ name: 'dshm.chat.running', locale: chatNS, inject: () => ({ model }) }, MobileChatRunningStatus);
  const registry = phonePluginsFor('remote');
  const controller = model.interfacePlugins = new MobileInterfacePlugins(ctx, () => registry.catalog, { autoStart: false });
  const runtime = model.interfaceHost = new PhonePluginHost(registry, entry => async enabled => {
    if (entry.group !== REMOTE_HOME_SLOT) throw Error('incompatible');
    if (enabled) {
      await controller.select(entry.id);
      const state = controller.getSnapshot();
      if (state.status !== 'active') throw Error(state.error ?? 'load');
    } else if (controller.getSnapshot().selected === entry.id) await controller.select(null);
  });
  const offInterface = controller.subscribe(() => {
    const state = controller.getSnapshot();
    if (state.status === 'failed' && state.selected) void runtime.fail(state.selected, state.error ?? 'render').catch(() => {});
  });
  void runtime.ready.catch(() => controller.fail('storage'));
  ctx.effect(() => () => { offInterface(); return runtime.dispose(); }, 'DSHM: remote plugin runtime');
  // 可选首页加载期间仍显示默认界面，不阻塞会话和审批服务。
  const ready = Promise.all([installRemoteInteractionPlugins(model), ...(configForms ? [configForms.await()] : [])]);
  return { layout, locale, imageLoader, ready, render: props => slots.renderSlot('root', { model, ...props, rootModel: model }) };
}

export function RemotePluginPanels() {
  const host = useContext(PluginSlots);
  if (!host?.reference) return null;
  const { SessionProvider, renderSlot, reference } = host;
  return <SessionProvider session={reference}>{renderSlot('dshm.sidebar', {
    footer: renderSlot('sidebar.footer.action', { wide: true }),
  })}</SessionProvider>;
}

/** 独立于消息节点：尚无首段输出时也显示原会话的活动状态，主聊天与旁栏共用。 */
function MobileChatRunningStatus({ model, useSession, useChat, t }) {
  const running = useSession(state => state.running && state.openState === 'open');
  const timeline = useChat(snapshot => snapshot.timeline);
  const connected = useSyncExternalStore(model.subscribeView, () => model.getSnapshot().connectionState) === 'connected';
  if (!running || !connected) return null;
  return <div className="remote-running-status">
    {ChatRunningStatus ? <ChatRunningStatus startTime={runningTurnStartTime(timeline)} t={t}/>
      : <div data-chat-running role="status" aria-live="polite">{t('chat.deepDiving')}</div>}
  </div>;
}

export function RemoteRunningStatus() {
  const host = useContext(PluginSlots);
  if (!host?.reference) return null;
  const { SessionProvider, renderSlot, reference } = host;
  return <SessionProvider session={reference}>{renderSlot('dshm.chat.running', {})}</SessionProvider>;
}

/** 主视图保留既有引用，工厂只负责内容呈现，不另建会话或输入状态机。 */
export function RemoteMainFactory({ children }) {
  const host = useContext(PluginSlots);
  if (!host?.reference) return children;
  return <MainFactoryOccurrence host={host}/>;
}

function MainFactoryOccurrence({ host }) {
  const { SessionProvider, reference, renderFactorySlot } = host;
  const state = useSyncExternalStore(host.model.subscribeView, host.model.getSnapshot);
  const source = host.model.conversations.binding(reference.binding).snapshot;
  // 工厂只依赖聊天阶段，正文仍由原节点订阅更新；避免每条事件遍历整棵聊天树。
  const shell = useSyncExternalStore(source.subscribe, () => {
    const session = reference.binding.session.getSnapshot(), conversation = source.getSnapshot();
    return session && conversation ? conversationPhase(session, conversation) : 'blank';
  });
  const session = state.session;
  const summaryBlank = state.list?.byId[reference.sessionId]?.blank;
  const settling = shell === 'blank' && session?.openState === 'loading' && summaryBlank !== true
    || session?.subagent?.address.mode === 'continuable' && session.subagent.parentAvailable === undefined;
  const hero = shell === 'blank' && (session?.openState === 'open' || summaryBlank === true);
  const phase = settling ? 'settling' : hero ? 'hero' : 'active';
  return <SessionProvider session={reference}>{renderFactorySlot('conversation.content', { variant: 'main', phase, hero })}</SessionProvider>;
}

/** 原链式选择器负责接管与优先级；隐藏而不卸载默认输入，保留草稿与附件。 */
export function RemoteComposerExtension({ children }) {
  const host = useConversationHost();
  return host?.reference ? <ComposerChain host={host}>{children}</ComposerChain> : children;
}

/** 替换的只是输入框呈现；编辑器与提交状态机由外层 RemoteComposer 持有。 */
export function RemoteComposerBar({ children, input, blocked, disabled, placeholder }) {
  const host = useConversationHost();
  if (!host?.reference) return children;
  return <ComposerBar host={host} input={input} blocked={blocked} disabled={disabled} placeholder={placeholder}>{children}</ComposerBar>;
}

/** 无会话入口复用同一插槽所有者，并明确清除外层聊天作用域。 */
export function RemoteEmptyComposerBar({ children, ...owner }) {
  const host = useConversationHost();
  if (!host) return children;
  const { SessionProvider, renderSlot } = host;
  return <SessionProvider session={undefined} empty={() => renderSlot('conversation.composer.bar', owner, { fallback: children })}/>;
}

export function RemoteHeroPreset({ children = null, unbound = false }) {
  const host = useConversationHost();
  if (!host) return children;
  const { SessionProvider, renderSlot, reference } = host;
  const render = () => renderSlot('conversation.hero.agentPreset', {}, { fallback: children });
  return unbound ? <SessionProvider session={undefined} empty={render}/>
    : <SessionProvider session={reference}>{render()}</SessionProvider>;
}

function ComposerBar({ host, input, blocked, disabled, placeholder, children }) {
  const { model, reference, SessionProvider, renderSlot } = host;
  const state = useSyncExternalStore(model.subscribeView, model.getSnapshot);
  const session = state.session;
  const hero = host.hero;
  const owner = { variant: hero ? 'hero' : 'composer', disabled, blocked,
    placeholder: host.requiresWorkspace ? placeholder : blocked?.reason ?? placeholder,
    ...(host.requiresWorkspace ? { workspacePickerOpen: host.workspacePickerOpen,
      onRequestWorkspace: () => host.setWorkspacePickerOpen(true) } : {}) };
  // 离线时不挂载可写插件控件；同一输入状态机继续持有草稿和引用。
  if (state.connectionState !== 'connected') return children;
  return <SessionProvider session={reference}>
    {session && renderSlot('conversation.input.dock', { session, input })}
    {renderSlot('conversation.composer.bar', owner, { fallback: children })}
  </SessionProvider>;
}

function ComposerChain({ host, children }) {
  const { model, reference, SessionProvider, renderSlotChain } = host;
  const state = useSyncExternalStore(model.subscribeView, model.getSnapshot);
  const status = model.ctx.uiSession.sessionStatus;
  const statuses = useSyncExternalStore(status.subscribe, status.getSnapshot);
  const owner = { sessionId: reference.sessionId, session: state.session,
    pendingInteraction: statuses.get(reference.sessionId)?.pendingInteraction };
  return <SessionProvider session={reference}>{renderSlotChain('conversation.composer', owner, {
    fallback: children, overlay: true, fallbackOnly: state.connectionState !== 'connected',
  })}</SessionProvider>;
}

/** 标题操作仍用原会话作用域；放在手机标题下方，避免挤占返回与更多按钮。 */
export function RemoteHeaderExtensions() {
  const host = useContext(PluginSlots);
  if (!host?.reference) return null;
  const { SessionProvider, renderSlot, reference } = host;
  return <SessionProvider session={reference}>
    <div className="remote-header-extensions">
      {renderSlot('conversation.session.header.leading', {})}
      {renderSlot('conversation.session.header.actions', {})}
      {renderSlot('conversation.session.header.utilities', {})}
      <RemoteDesktopAppAction model={host.model} sessionId={reference.sessionId}/>
      {renderSlot('conversation.session.header.corner', {})}
    </div>
  </SessionProvider>;
}

/** 当前标题与祖先均沿用原 lineage owner；手机导航外壳保持独立。 */
export function RemoteHeaderTitle({ model, title }) {
  const host = useContext(PluginSlots);
  const state = useSyncExternalStore(model.subscribeView, model.getSnapshot);
  const fallback = <strong>{title}</strong>;
  if (!host?.reference) return fallback;
  const { SessionProvider, renderSlot, reference } = host;
  const child = state.list?.byId[reference.sessionId]?.origin === 'subagent';
  const owner = { lineageSessionId: reference.sessionId, displayTitle: title };
  return <SessionProvider session={reference}><div className="remote-heading-content">
    {child ? renderSlot('conversation.session.header.lineage', owner, { fallback })
      : <>{fallback}{renderSlot('conversation.session.header.lineage', owner, { fallback: null })}</>}
  </div></SessionProvider>;
}

export function RemoteHeaderAncestors({ model }) {
  const host = useContext(PluginSlots);
  const state = useSyncExternalStore(model.subscribeView, model.getSnapshot);
  const t = useTranslate();
  const ancestors = sessionLineage(state.list, state.selected).slice(0, -1);
  if (!host?.reference || !ancestors.length) return null;
  const { SessionProvider, renderSlot, reference } = host;
  return <SessionProvider session={reference}><nav className="remote-header-ancestors" aria-label={t('父级会话')}>
    {ancestors.map(item => {
      const openTitle = () => { void openLineageAncestor(model, reference, item.id).catch(error => model.fail(error)); };
      const fallback = <button type="button" disabled={state.connectionState !== 'connected'} onClick={openTitle}>{item.displayTitle}</button>;
      return <div className="remote-header-ancestor" key={item.id}>
        {item.subagent ? renderSlot('conversation.session.header.lineage', {
          lineageSessionId: item.id, displayTitle: item.displayTitle, openTitle,
        }, { fallback }) : fallback}
      </div>;
    })}
  </nav></SessionProvider>;
}

/** 复用原节点可见性和按会话保存的折叠状态，只替换最终内容的手机回退布局。 */
function MobileChatNodeSeat({ node, dispatchNode, children, useSession, ...props }) {
  const historyIncomplete = useSession(snapshot => snapshot.hasMore);
  const t = useTranslate();
  const renderNode = useCallback((name, owner, options) => {
    const content = dispatchNode(name, owner, {
      ...options,
      fallback: owner.node.kind === 'turn-process'
        ? <TurnProcessNodeView node={owner.node} turnProcess={owner.turnProcess} t={props.t}/>
        : React.cloneElement(children, { turnProcess: owner.turnProcess }),
    });
    if (owner.node.kind !== 'tool-call') return content;
    return <div className="remote-tool-entry">{content}
      {/* 保留独立的工具详情入口，放在行尾，避免每条记录多占一行。 */}
      <button type="button" className="remote-tool-inspect" data-tool-details aria-label={t('工具详情')} title={t('工具详情')}
        onClick={() => owner.inspectCall(owner.node.data.root.callId)}><IconEllipsisOutline16/></button>
    </div>;
  }, [dispatchNode, children, props.t, t]);
  return <ChatNodeSeat {...props} {...chatSeatProps} nodeKey={node.key} historyIncomplete={historyIncomplete} compactTranscript renderSlot={renderNode}/>;
}

function MessageImagesFallback({ images, openAttachment }) {
  return <div className="remote-files">{images.map((source, index) => {
    if (source.preview) return <RemoteLocalImage key={index} preview={{ previewUrl: source.preview.url, name: source.preview.name }}/>;
    const image = inlineImage({ type: 'image', attachment: source.attachment });
    return image ? <RemoteInlineImage key={index} image={image} label={source.label ?? '图片'} openAttachment={openAttachment}/> : null;
  })}</div>;
}

/** 所有原节点经过同一个 keyed-slot；无注册项时保留 DSHM 默认排版。 */
export function RemoteNodeExtension({ node, openFile, openAttachment, openCommand, children }) {
  const host = useContext(PluginSlots);
  const t = useTranslate();
  if (!host?.reference) return children;
  const { SessionProvider, renderSlot, reference, model } = host;
  if (node.kind === 'remote-changes' && model.deliverablesPreview) return null;
  const current = () => {
    if (model.reference !== reference) throw new Error('聊天已切换，请在当前聊天中操作。');
  };
  const loadImage = model.pluginSlots.imageLoader(reference);
  const openSkill = name => {
    void (async () => {
      current(); await model.skills.load(); current();
      const skill = model.skills.getSnapshot().items.find(item => item.name === name);
      if (!skill?.path) throw new Error('技能列表已变化，请重新打开后选择。');
      openFile(skill.path);
    })().catch(error => { if (model.reference === reference) model.publish({ error: error.message }); });
  };
  return <SessionProvider session={reference}>
    {renderSlot('dshm.chat.node', { node, openSkill, loadImage, dispatchNode: renderSlot, children,
      renderMessageImages: owner => renderSlot('conversation.message.images', { ...owner, loadImage }, {
        fallback: <MessageImagesFallback {...owner} openAttachment={openAttachment}/>,
      }),
      fileMentions: owner => {
        const provider = model.ctx.get('chatFileMentions');
        return provider ? provider.forClosing(owner, reference.sessionId)
          : closingFileMentions(owner, path => t('打开文件：{path}', { path }));
      },
      openFile: (...args) => { current(); return openFile(...args); },
      inspectCall: callId => { current(); return openCommand(callId); },
      cwd: model.getSnapshot().list?.byId[reference.sessionId]?.cwd,
      forkAt: seq => {
        current();
        return model.fork(seq);
      },
    })}
  </SessionProvider>;
}

export function RemotePluginScope({ model, children }) {
  const state = useSyncExternalStore(model.subscribeView, model.getSnapshot);
  // retain() 的 reference 在 ready 之前没有 binding；此时不得交给原 SessionProvider。
  const reference = state.session ? model.reference : undefined;
  return <RemoteMarkdownLinks model={model}>{model.pluginSlots.render({ reference, children, model })}</RemoteMarkdownLinks>;
}

/** 只替换首页席位；原会话、审批、插件作用域始终归宿主管理。 */
export function RemoteHomeExtension({ home, fallback }) {
  const host = useContext(PluginSlots);
  const controller = host?.model.interfacePlugins;
  const state = useSyncExternalStore(controller?.subscribe ?? emptySubscribe, controller?.getSnapshot ?? defaultInterface);
  let content = fallback;
  if (host && state.status === 'active') {
    const { SessionProvider, renderSlot } = host;
    content = <SessionProvider session={undefined} empty={() => renderSlot(REMOTE_HOME_SLOT, { home }, { fallback })}/>;
  }
  return <div className="dshm-phone-colors dshm-phone-surface" data-dshm-surface="remote.home">{content}</div>;
}
const emptySubscribe = () => () => {};
const defaultInterfaceValue = { status: 'default' };
const defaultInterface = () => defaultInterfaceValue;

/** 每个当前会话只挂载一次；只读子会话也需要原插件的反馈弹窗。 */
export function RemoteInputExtensions() {
  const host = useContext(PluginSlots);
  if (!host?.reference) return null;
  const { SessionProvider, renderSlot, reference } = host;
  return <SessionProvider session={reference}>{renderSlot('conversation.input.overlay', {})}</SessionProvider>;
}

export function RemotePluginManagerExtension({ fallback }) {
  const host = useContext(PluginSlots);
  return host ? host.renderSlot('main', {}, { entryKey: 'plugins', fallback }) : fallback;
}

export function RemotePluginSettingsExtension() {
  const host = useContext(PluginSlots);
  if (!host) return null;
  const { SessionProvider, renderSlot } = host;
  return <SessionProvider session={undefined} empty={() => renderSlot('dshm.plugin-settings', {})}/>;
}

export function RemoteSettingsSectionExtension({ id, onClose, active = true }) {
  const host = useContext(PluginSlots);
  const alive = useRef(false), current = useRef();
  current.current = { active, onClose };
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  if (!host) return null;
  const { SessionProvider, renderSlot } = host;
  const close = () => { if (alive.current && current.current.active) current.current.onClose(); };
  return <SessionProvider session={undefined} empty={() => renderSlot('settings.section', { close }, { only: id })}/>;
}

export function RemoteSettingsOnboardingExtension({ id, complete, openSection }) {
  const host = useContext(PluginSlots);
  if (!host) return null;
  const { SessionProvider, renderSlot } = host;
  return <SessionProvider session={undefined} empty={() => renderSlot('settings.onboarding', { stepId: id, complete, openSection }, { only: id })}/>;
}

/** 模型设置扩展沿原空 owner/root scope，不携带当前聊天或敏感设置。 */
export function RemoteModelSettingsExtensions() {
  const host = useContext(PluginSlots);
  if (!host) return null;
  const { SessionProvider, renderSlot } = host;
  return <SessionProvider session={undefined} empty={() => renderSlot('settings.models.footer', {})}/>;
}

export function RemoteProviderCardExtension({ view }) {
  const host = useContext(PluginSlots);
  if (!host) return null;
  const { SessionProvider, renderSlot } = host;
  return <SessionProvider session={undefined} empty={() => renderSlot('settings.models.provider-card', view, { entryKey: view.provider.settingsNs })}/>;
}

/** 原反馈与手机分支共用操作行；功能型 turnTail 扩展仍独立呈现。 */
export function RemoteTurnExtensions({ node, openFile, children }) {
  const host = useContext(PluginSlots);
  const closing = node.data.closing;
  const actions = extra => closing && <div className="reply-actions remote-turn-actions" data-turn-tail={node.data.turn}>{extra}{children}</div>;
  if (!host || !host.reference || !['turn', 'step'].includes(node.location?.kind)) return actions(null);
  const { SessionProvider, renderSlot, reference } = host;
  const owner = { turn: node.location.turn, seq: closing?.finalNode.seq ?? node.data.seq, openFile };
  return <SessionProvider session={reference}>
    {renderSlot('conversation.chat.turnTail', owner)}
    {actions(closing?.finalNode.messageId !== undefined && renderSlot('conversation.chat.assistant-actions', { messageId: closing.finalNode.messageId }))}
  </SessionProvider>;
}
