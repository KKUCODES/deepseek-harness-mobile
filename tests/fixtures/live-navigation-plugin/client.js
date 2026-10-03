window.__ModuleLoader__.load({ id: '@dsh-mobile/navigation-ui-verification', factory(require) {
  const React = require('react');
  const { createSnapshotStore } = require('@deepseek-ai/dsh-client-store');
  return { inject: ['slots', 'uiWorkspace', 'sessions'], apply(ctx) {
    const state = createSnapshotStore({ source: null, prepared: null, forked: null, created: [], status: 'ready' });
    const merge = patch => state.set({ ...state.getSnapshot(), ...patch });
    const rememberNew = (id, before) => {
      if (!before.has(id)) merge({ created: [...new Set([...state.getSnapshot().created, id])] });
    };
    ctx.slots.inject('conversation.session.header.actions', () => ctx.slots.register({
      name: 'conversation.session.header.actions', id: 'navigation-verification',
    }, ({ sessionId, useWorkspaces }) => {
      const value = React.useSyncExternalStore(state.subscribe, state.getSnapshot);
      const workspace = useWorkspaces(snapshot => snapshot.items.find(item => item.title === 'DSH-TEST'));
      const run = async (name, action) => {
        merge({ status: 'pending' });
        try {
          if (!state.getSnapshot().source) merge({ source: sessionId });
          await action(); merge({ status: name });
        } catch (error) { merge({ status: `error:${error.message}` }); }
      };
      const button = (name, action) => React.createElement('button', { disabled: value.status === 'pending' || !workspace,
        onClick: () => { void run(name, action); } }, name);
      const api = ctx.uiWorkspace;
      return React.createElement('section', { 'data-testid': 'live-navigation', 'data-session': sessionId,
        'data-state': JSON.stringify(value) },
      button('准备测试聊天', async () => {
        const before = new Set(ctx.sessions.list.getSnapshot().ids);
        const id = await api.connectWorkspace(workspace.workspaceId); rememberNew(id, before); merge({ prepared: id });
      }),
      button('打开测试工作区', async () => {
        const before = new Set(ctx.sessions.list.getSnapshot().ids);
        await api.openWorkspace(workspace.workspaceId, id => { rememberNew(id, before); merge({ opened: id }); });
      }),
      button('返回测试来源', () => api.openSession(state.getSnapshot().source)),
      button('开始工作区聊天', () => api.startSession(workspace.workspaceId)),
      button('分支测试来源', async () => {
        const before = new Set(ctx.sessions.list.getSnapshot().ids);
        await api.forkSession(state.getSnapshot().source);
        const id = ctx.sessions.list.getSnapshot().ids.find(id => !before.has(id));
        if (!id) throw new Error('未找到测试分支');
        rememberNew(id, before); merge({ forked: id });
      }),
      button('归档测试分支', () => api.archiveSession(state.getSnapshot().forked)),
      button('恢复测试分支', () => api.unarchiveSession(state.getSnapshot().forked)),
      button('检查目录限制', async () => {
        let rejected = 0;
        for (const invoke of [() => api.pickDirectory(), () => api.listDirectory(), () => api.createDirectory('/', 'unused')]) {
          try { await invoke(); } catch (error) { if (error.code === 'remote_directory_navigation_disabled') rejected++; else throw error; }
        }
        if (rejected !== 3) throw new Error('目录限制未生效');
      }));
    }));
  } };
} });
