import React from 'react';

export function navigationChecks(model) {
  let plugin;
  return {
    async enableNavigationProbe() {
      plugin = model.ctx.plugin({ name: '@fixture/navigation', inject: ['slots', 'uiWorkspace'], apply(ctx) {
        ctx.slots.register({ name: 'conversation.session.header.actions', id: 'navigation' }, ({ useWorkspaces }) => {
          const workspaces = useWorkspaces(value => value);
          return <button data-testid="navigation-probe" data-workspace-phase={workspaces.phase}
            onClick={() => ctx.uiWorkspace.openSession('two')}>插件打开聊天</button>;
        });
      } });
      await plugin.await();
    },
    disableNavigationProbe: () => plugin.dispose(),
  };
}
