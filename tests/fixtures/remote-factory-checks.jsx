import React from 'react';
import { apply as applyPreset } from '../../../deepseek-harness/packages/client/ui-agent-preset/src/client/index.ts';

let retainedWorkspaceSelection;
function WidthControls({ container, phase, t, useComposerBlock, selectWorkspace }) {
  const [count, setCount] = React.useState(0);
  const block = useComposerBlock(value => value);
  return <button data-testid="factory-width" data-phase={phase} data-container={container?.hasAttribute('data-conversation-content') ?? false}
    data-block={block?.reason ?? ''} data-locale={typeof t} style={{ position: 'absolute', top: 0, right: 0, zIndex: 10 }}
    onClick={() => { retainedWorkspaceSelection = selectWorkspace; setCount(count + 1); }}>{count}</button>;
}

function CustomViews({ renderSlot, renderSlotChain, sessionId, useSession, useInput }) {
  const [only, setOnly] = React.useState(false);
  const session = useSession(value => value), input = useInput(value => value);
  return <div data-testid="factory-custom-view" data-session={sessionId} data-open={useSession(value => value.openState)} style={{ height: '100%' }}>
    <button style={{ position: 'absolute', top: 30, right: 0, zIndex: 10 }} onClick={() => setOnly(value => !value)}>{only ? '恢复聊天内容' : '仅显示插件内容'}</button>
    {only ? <><p>插件独立内容</p>
      {renderSlotChain('conversation.composer', { sessionId, session }, {
        fallback: <span data-testid="factory-local-chain">局部输入区域</span>, overlay: true,
      })}
      {renderSlot('conversation.composer.bar', { variant: 'composer', disabled: false }, {
        fallback: <span data-testid="factory-local-bar">局部输入框</span>,
      })}
      {renderSlot('conversation.input.dock', { session, input, factoryProbe: true })}
      {renderSlot('conversation.hero.agentPreset', {}, { fallback: <span data-testid="factory-local-preset">局部模式选择</span> })}
    </> : renderSlot('conversation.session', { view: 'chat' })}
  </div>;
}

export function factoryChecks(model) {
  let plugin;
  let sessionPlugin;
  let preset;
  let failureProbe, retainedLoad, loadStarts = 0;
  const pendingReads = [], settlements = [];
  const rejectRead = async () => { pendingReads.shift()(new Error('preset-read-fixture')); await settlements.shift(); };
  return {
    heroWorkspaceRows: () => model.workspaces.getSnapshot().items,
    heroState: () => ({ selected: model.getSnapshot().selected, workspaces: model.workspaces.getSnapshot() }),
    async enableBoundHeroProbe() {
      plugin = model.ctx.plugin({ name: '@fixture/bound-hero', inject: ['slots'], apply(ctx) {
        ctx.slots.register({ name: 'conversation.hero.brand.mark' }, ({ size }) =>
          <span data-testid="bound-brand" data-size={size}>手机品牌</span>);
        ctx.slots.register({ name: 'conversation.hero.workspace' }, ({ open, selectedId, onPick, onClose, useWorkspaces }) => {
          const workspaces = useWorkspaces(value => value);
          return open ? <div role="dialog" aria-label="插件工作区" data-selected={selectedId}>
            {workspaces.items.map(item => <button key={item.workspaceId} onClick={() => onPick(item.workspaceId)}>{item.title}</button>)}
            <button onClick={onClose}>关闭工作区</button>
          </div> : null;
        });
      } });
      await plugin.await();
    },
    async enableDirectFactoryProbe() {
      plugin = model.ctx.plugin({ name: '@fixture/direct-factory', inject: ['slots', 'sidebarRightTabs'], apply(ctx) {
        ctx.sidebarRightTabs.register({ id: '@fixture/direct-factory', kind: 'direct-factory', title: () => '独立工厂',
          guide: [{ id: 'direct-factory', title: () => '独立工厂' }] });
        ctx.slots.register({ name: 'sidebar.right.pane.tab', key: '@fixture/direct-factory',
          children: { 'fixture.direct.scope': { kind: 'single', scope: 'session' } } }, ({ SessionProvider, renderFactorySlot }) => {
          const [reference] = React.useState(() => model.sessions.retain({ parentSessionId: 'one', childSessionId: 'child-chat', mode: 'continuable' }, { source: 'controllerOperation' }));
          React.useEffect(() => () => reference.release(), [reference]);
          return <div style={{ height: 500, width: 340 }} data-testid="direct-factory-host"><SessionProvider session={reference}>
            {renderFactorySlot('conversation.content', { variant: 'embedded', phase: 'active', hero: false }, { slots: { widthControls: WidthControls } })}
          </SessionProvider></div>;
        });
      } });
      await plugin.await();
      model.pluginPanels.openTab('direct-factory');
    },
    directFactoryFocus: () => model.conversationFocus.getSnapshot()?.getSnapshot().selected ?? null,
    setFactoryBlock: (id, reason) => model.ctx.conversation.blocks.set(id, reason ? { reason } : undefined),
    async invokeFactorySelection() {
      try { await retainedWorkspaceSelection('missing-test-workspace'); return 'unexpected-success'; }
      catch (error) { return error.message; }
    },
    async replaceFactorySession() {
      sessionPlugin = model.ctx.plugin({ name: '@fixture/conversation-session', inject: ['slots'], apply(ctx) {
        ctx.slots.register({ name: 'conversation.session', priority: -100 }, ({ sessionId, useSession, useSessionRetainInfo }) =>
          <p data-testid="factory-session-replacement" data-session={sessionId} data-open={useSession(value => value.openState)}
            data-main-count={useSessionRetainInfo(value => value.retainedBy.mainView ?? 0)}>主聊天插件内容</p>);
      } });
      await sessionPlugin.await();
    },
    restoreFactorySession: () => sessionPlugin.dispose(),
    async enablePresetFailureProbe() {
      failureProbe = model.ctx.plugin({ name: '@deepseek-ai/dsh-client-ui-agent-preset', inject: ['slots'], apply(ctx) {
        const load = () => { loadStarts++; return new Promise((_resolve, reject) => { pendingReads.push(reject); }); };
        ctx.slots.register({ name: 'conversation.hero.agentPreset', inject: () => ({ load, select: async () => undefined }) },
          ({ load }) => {
            retainedLoad = load;
            React.useEffect(() => { settlements.push(load()); }, [load]);
            return <span data-testid="preset-failure-probe"/>;
          });
      } });
      await failureProbe.await();
    },
    rejectPresetRead: rejectRead,
    async finishPresetReads() { while (pendingReads.length) await rejectRead(); },
    unloadPresetFailureProbe: () => failureProbe.dispose(),
    async invokeReleasedPresetLoad() { await retainedLoad(); },
    presetLoadStarts: () => loadStarts,
    presetConnection: () => ({ id: model.connection.generation.getSnapshot()?.id, state: model.getSnapshot().connectionState }),
    reconnectPreset: () => model.connection.reconnect(),
    presetPageError: () => model.getSnapshot().error,
    presetOtherError: () => model.fail(new Error('current-chat-fixture')),
    clearPresetError: () => model.publish({ error: null }),
    async enablePresetStage() {
      // 本回放只渲染原 hero；未打开设置页，不模拟其设置写入服务。
      preset = model.ctx.plugin({ name: '@deepseek-ai/dsh-client-ui-agent-preset', inject: ['slots', 'sessions', 'locale', 'remote', 'remote.agentPresets'], apply: applyPreset });
      await preset.await();
    },
    disablePresetStage: () => preset.dispose(),
    retainedSources: id => model.sessions.retainInfo(id).getSnapshot().retainedBy,
    factoryPreset: () => model.sessions.list.getSnapshot().byId['agent-blank'].projectionValues.agentPreset,
    presetPending: () => [...model.agentPresets.pendingSessions],
    async enableFactoryEmptyProbe() {
      plugin = model.ctx.plugin({ name: '@fixture/conversation-empty', inject: ['slots'], apply(ctx) {
        ctx.slots.register({ name: 'sidebar.chat.conversation', priority: -100,
          children: { 'fixture.empty.scope': { kind: 'single', scope: 'session-maybe' } } }, ({ renderFactorySlot, SessionProvider }) =>
          <SessionProvider session={undefined} empty={() => renderFactorySlot('conversation.content', { variant: 'embedded', phase: 'hero', hero: true })}/>);
        ctx.slots.register({ name: 'conversation.hero.brand.mark' }, ({ size }) => <span data-testid="empty-brand" data-size={size}>品牌</span>);
      } });
      await plugin.await();
    },
    factoryWorkspaceCandidate: () => ({ workspaceId: 'factory-test', title: '联调工作区', sessionIds: ['agent-blank'], path: model.sessions.list.getSnapshot().byId['agent-blank'].cwd,
      createdAt: '2026-09-26T00:00:00.000Z', updatedAt: '2026-09-26T00:00:00.000Z' }),
    failFactoryWorkspaceOnce() {
      const open = model.workspaceNavigation.openWorkspace;
      model.workspaceNavigation.openWorkspace = function (id) {
        model.workspaceNavigation.openWorkspace = open;
        return Promise.reject(new Error('测试工作区暂时不可用'));
      };
    },
    failFactoryOpenOnce() {
      const retain = model.sessions.retain;
      model.sessions.retain = function (target, options) {
        if (options?.source === 'controllerOperation') {
          model.sessions.retain = retain;
          throw new Error('factory-open-fixture');
        }
        return retain.call(this, target, options);
      };
    },
    async enableFactoryProbe(custom = false) {
      plugin = model.ctx.plugin({ name: '@fixture/conversation-factory', inject: ['slots'], apply(ctx) {
        if (custom) ctx.slots.register({ name: 'conversation.input.dock', id: 'factory-ownership-check' },
          ({ factoryProbe, sessionId, input, useInput }) => {
            const draft = useInput(value => value.draft);
            return factoryProbe ? <output data-testid="factory-local-dock" data-session={sessionId}
              data-consistent={draft === input.draft}>{draft}</output> : null;
          });
        ctx.slots.register({ name: 'sidebar.chat.conversation', priority: -100 }, ({ renderFactorySlot, useSession }) => {
          const running = useSession(value => value.running);
          return renderFactorySlot('conversation.content', { variant: 'embedded', phase: running ? 'settling' : 'active', hero: false },
            { slots: { widthControls: WidthControls, ...(custom ? { views: CustomViews } : {}) } });
        });
      } });
      await plugin.await();
    },
    disableFactoryProbe: () => plugin.dispose(),
  };
}
