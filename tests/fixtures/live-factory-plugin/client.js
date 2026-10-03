window.__ModuleLoader__.load({ id: '@dsh-mobile/conversation-factory-verification', factory(require) {
  const React = require('react');
  const { createSnapshotStore } = require('@deepseek-ai/dsh-client-store');
  return { inject: ['slots', 'sessions', 'uiWorkspace', 'conversation', 'sidebarRightTabs', 'sidebarRight'], apply(ctx) {
    const blocked = new Set();
    ctx.effect(() => () => { for (const id of blocked) ctx.conversation.blocks.set(id, undefined); });
    const mode = createSnapshotStore(false);
    const empty = createSnapshotStore(false);
    const prepared = createSnapshotStore({ status: 'idle' });
    function WidthControls({ container, phase, t, useWorkspaces, useComposerBlock }) {
      const block = useComposerBlock(value => value);
      const custom = React.useSyncExternalStore(mode.subscribe, mode.getSnapshot);
      const preparation = React.useSyncExternalStore(prepared.subscribe, prepared.getSnapshot);
      const workspace = useWorkspaces(value => value.items.find(item => item.title === 'DSH-TEST'));
      return React.createElement(React.Fragment, null, React.createElement('button', { 'data-testid': 'live-factory-controls', 'data-container': !!container?.hasAttribute('data-conversation-content'),
        'data-phase': phase, 'data-block': block?.reason ?? '', 'data-locale': typeof t, style: { position: 'absolute', top: 0, right: 0, zIndex: 20 },
        onClick: () => mode.set(!custom) }, custom ? '恢复默认视图' : '切换测试视图'),
        React.createElement('button', { 'data-testid': 'live-factory-empty', 'data-before': JSON.stringify(ctx.sessions.list.getSnapshot().ids),
          style: { position: 'absolute', top: 60, right: 0, zIndex: 20 }, onClick: () => empty.set(true) }, '打开无会话界面'),
        React.createElement('button', { 'data-testid': 'live-preset-prepare', 'data-state': JSON.stringify(preparation),
          style: { position: 'absolute', top: 90, right: 0, zIndex: 20 }, disabled: !workspace || preparation.status === 'pending',
          onClick: async () => {
            prepared.set({ status: 'pending' }); let ref;
            try {
              const before = new Set(ctx.sessions.list.getSnapshot().ids);
              const id = await ctx.uiWorkspace.connectWorkspace(workspace.workspaceId);
              ref = ctx.sessions.retain(id, { source: 'controllerOperation' });
              const binding = await ref.ready;
              prepared.set({ status: 'ready', id, created: !before.has(id), preset: binding.session.projections.faceOf('agentPreset').getSnapshot() });
            } catch (error) { prepared.set({ status: 'error', error: error.message }); }
            finally { ref?.release(); }
          } }, '读取测试空会话'));
    }
    function Views({ sessionId, useSession, renderSlot }) {
      const [only, setOnly] = React.useState(false);
      return React.createElement('div', { 'data-testid': 'live-factory-views', 'data-session': sessionId,
        'data-open': useSession(value => value.openState), style: { height: '100%' } },
        React.createElement('button', { style: { position: 'absolute', top: 30, right: 0, zIndex: 20 },
          onClick: () => setOnly(value => !value) }, only ? '恢复聊天内容' : '仅显示插件内容'),
        only ? React.createElement('p', null, '插件独立内容') : renderSlot('conversation.session', { view: 'chat' }));
    }
    ctx.sidebarRightTabs.register({ id: '@dsh-mobile/direct-factory', kind: 'direct-factory', title: () => '独立工厂验证' });
    function DirectContent({ address, SessionProvider, renderFactorySlot }) {
      const [reference] = React.useState(() => ctx.sessions.retain(address, { source: 'controllerOperation' }));
      React.useEffect(() => () => reference.release(), [reference]);
      const custom = React.useSyncExternalStore(mode.subscribe, mode.getSnapshot);
      return React.createElement('div', { 'data-testid': 'live-direct-factory-host', style: { height: Math.max(300, innerHeight - 135), width: 340 } },
        React.createElement(SessionProvider, { session: reference }, renderFactorySlot('conversation.content', { variant: 'embedded', phase: 'active', hero: false },
          { slots: { widthControls: WidthControls, ...(custom ? { views: Views } : {}) } })));
    }
    ctx.slots.register({ name: 'sidebar.right.pane.tab', key: '@dsh-mobile/direct-factory',
      children: { 'verification.direct.scope': { kind: 'single', scope: 'session' } } },
      props => React.createElement(DirectContent, { ...props, address: props.useTabInfo().tab.navigation.params.address }));
    ctx.slots.inject('conversation.session.header.actions', () => ctx.slots.register({ name: 'conversation.session.header.actions', id: 'direct-factory-open' },
      ({ sessionId }) => {
        const [error, setError] = React.useState('');
        return React.createElement('button', { 'data-testid': 'live-direct-factory-open', 'data-error': error, onClick: async () => {
          try {
            await ctx.sessions.refreshSubagents(sessionId);
            const child = ctx.sessions.list.getSnapshot().subagentsByParent[sessionId]?.entries.find(item => item.kind === 'child' && item.mode === 'continuable');
            if (!child) throw new Error('没有可用测试子会话');
            ctx.sidebarRight.openTab('direct-factory', { params: { address: { parentSessionId: sessionId, childSessionId: child.id, mode: child.mode } } });
          } catch (failure) { setError(failure.message); }
        } }, '独立工厂验证');
      }));
    ctx.slots.inject('conversation.session.header.actions', () => ctx.slots.register({ name: 'conversation.session.header.actions', id: 'empty-inspector' },
      ({ sessionId, useSession, useWorkspaces, useSessions, useSessionRetainInfo }) => React.createElement('span', { 'data-testid': 'live-empty-session', 'data-session': sessionId,
        'data-main-count': useSessionRetainInfo(value => value.retainedBy.mainView ?? 0),
        'data-preset': useSessions(value => value.byId[sessionId]?.projectionValues?.agentPreset),
        'data-blank': useSession(value => value.blank),
        'data-workspace': useWorkspaces(value => value.items.find(item => item.sessionIds.includes(sessionId))?.title) })));
    ctx.slots.inject('conversation.session.header.actions', () => ctx.slots.register({ name: 'conversation.session.header.actions', id: 'factory-block-probe' },
      ({ sessionId }) => React.createElement('button', { 'data-testid': 'live-factory-block', 'data-session': sessionId,
        onClick: () => {
          if (blocked.has(sessionId)) { blocked.delete(sessionId); ctx.conversation.blocks.set(sessionId, undefined); }
          else { blocked.add(sessionId); ctx.conversation.blocks.set(sessionId, { reason: `测试暂停:${sessionId}` }); }
        } }, '切换测试输入暂停')));
    ctx.slots.inject('conversation.hero.brand.mark', () => ctx.slots.register({ name: 'conversation.hero.brand.mark' },
      ({ size }) => React.createElement('span', { 'data-testid': 'live-empty-brand', 'data-size': size }, '◈')));
    ctx.slots.inject('conversation.hero.workspace', () => ctx.slots.register({ name: 'conversation.hero.workspace' },
      ({ open, selectedId, onPick, onClose, useWorkspaces }) => {
        const workspaces = useWorkspaces(value => value);
        return open ? React.createElement('section', { role: 'dialog', 'aria-label': '选择工作区',
          'data-testid': 'live-hero-workspaces', 'data-selected': selectedId,
          style: { width: 320, padding: 12, background: '#f5f6f7', color: '#111', boxSizing: 'border-box' } },
        workspaces.items.map(item => React.createElement('button', { key: item.workspaceId,
          style: { display: 'block', padding: 8 }, onClick: () => onPick(item.workspaceId) }, item.title)),
        React.createElement('button', { onClick: onClose }, '取消选择')) : null;
      }));
    ctx.slots.inject('sidebar.chat.conversation', () => ctx.slots.register({ name: 'sidebar.chat.conversation', priority: -100,
      children: { 'verification.empty.scope': { kind: 'single', scope: 'session-maybe' } } },
      ({ renderFactorySlot, SessionProvider }) => {
        const custom = React.useSyncExternalStore(mode.subscribe, mode.getSnapshot);
        const unbound = React.useSyncExternalStore(empty.subscribe, empty.getSnapshot);
        if (unbound) return React.createElement(SessionProvider, { session: undefined,
          empty: () => renderFactorySlot('conversation.content', { variant: 'embedded', phase: 'hero', hero: true }) });
        return renderFactorySlot('conversation.content', { variant: 'embedded', phase: 'active', hero: false },
          { slots: { widthControls: WidthControls, ...(custom ? { views: Views } : {}) } });
      }));
  } };
} });
