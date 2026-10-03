window.__ModuleLoader__.load({ id: '@dsh-mobile/header-ui-verification', factory(require) {
  const React = require('react');
  return { inject: ['slots'], apply(ctx) {
    const labels = { leading: '前置', actions: '操作', utilities: '工具', corner: '角落' };
    for (const part of ['leading', 'actions', 'utilities', 'corner']) {
      ctx.slots.inject(`conversation.session.header.${part}`, () => ctx.slots.register({
        name: `conversation.session.header.${part}`, id: `dshm-header-${part}`,
      }, function HeaderProbe({ sessionId, useSession }) {
        const running = useSession(value => value.running);
        const [clicks, setClicks] = React.useState(0);
        return React.createElement('button', {
          'data-testid': `live-header-${part}`, 'data-session': sessionId, 'data-running': String(running),
          style: { width: part === 'actions' ? 720 : 200, height: 44, boxSizing: 'border-box', border: '1px solid #aaa', background: '#fff', color: '#111' },
          onClick: () => setClicks(value => value + 1),
        }, `标题${labels[part]}验证 ${clicks}`);
      }));
    }
  } };
} });
