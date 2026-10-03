window.__ModuleLoader__.load({ id: '@dsh-mobile/global-panel-verification', factory(require) {
  const React = require('react');
  return { inject: ['slots', 'layout', 'sidebarRight'], apply(ctx) {
    ctx.slots.inject('sidebar.panellist', () => ctx.slots.register({ name: 'sidebar.panellist', id: 'dshm-live-global', label: '独立插件页面' }, () => React.createElement('span', null, 'P')));
    ctx.slots.inject('main', () => ctx.slots.register({ name: 'main', key: 'dshm-live-global' }, ({ sessionId, usePanelInfo }) => {
      const [count, setCount] = React.useState(0), current = usePanelInfo(value => value.activePanelId);
      return React.createElement('section', { 'data-testid': 'live-global-panel', 'data-session': sessionId ?? 'none', 'data-current': current },
        React.createElement('p', null, '这是电脑插件提供的局部页面。'),
        React.createElement('button', { onClick: () => setCount(value => value + 1) }, `页面计数 ${count}`),
        React.createElement('button', { onClick: () => ctx.layout.selectPanel(null) }, '插件返回聊天'),
        React.createElement('button', { onClick: () => ctx.sidebarRight.openTab('guide') }, '打开底层旁栏'),
        React.createElement('button', { onClick: () => { if (ctx.sidebarRight.isExpanded()) ctx.sidebarRight.toggleExpanded(); } }, '关闭底层旁栏'));
    }));
  } };
} });
