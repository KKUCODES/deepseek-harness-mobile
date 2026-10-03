window.__ModuleLoader__.load({ id: '@dsh-mobile/workspace-drafts-verification', factory(require) {
  const React = require('react');
  const { createSnapshotStore } = require('@deepseek-ai/dsh-client-store');
  return { inject: ['slots', 'uiWorkspace', 'sessions'], apply(ctx) {
    const result = createSnapshotStore({ status: 'idle' });
    ctx.slots.inject('conversation.session.header.actions', () => ctx.slots.register({ name: 'conversation.session.header.actions', id: 'workspace-drafts-check' },
      ({ sessionId, useWorkspaces }) => {
        const workspaces = useWorkspaces(value => value.items);
        const state = React.useSyncExternalStore(result.subscribe, result.getSnapshot);
        return React.createElement(React.Fragment, null, React.createElement('button', { 'data-testid': 'workspace-drafts-prepare', 'data-state': JSON.stringify(state), 'data-session': sessionId,
          disabled: state.status === 'pending', onClick: async () => {
            result.set({ status: 'pending' });
            try {
              const source = workspaces.find(item => item.title === 'DSHM 草稿交接 source');
              const target = workspaces.find(item => item.title === 'DSHM 草稿交接 target');
              if (!source || !target) throw new Error('测试工作区尚未登记');
              const before = new Set(ctx.sessions.list.getSnapshot().ids);
              const from = await ctx.uiWorkspace.connectWorkspace(source.workspaceId);
              const to = await ctx.uiWorkspace.connectWorkspace(target.workspaceId);
              result.set({ status: 'ready', from, to, created: [from, to].filter(id => !before.has(id)) });
              ctx.uiWorkspace.openSession(from);
            } catch (error) { result.set({ status: 'error', error: error.message }); }
          } }, '准备草稿交接验证'), state.status === 'ready' && React.createElement(React.Fragment, null,
            React.createElement('button', { onClick: () => ctx.uiWorkspace.openSession(state.from) }, '打开源测试聊天'),
            React.createElement('button', { onClick: () => ctx.uiWorkspace.openSession(state.to) }, '打开目标测试聊天')));
      }));
  } };
} });
