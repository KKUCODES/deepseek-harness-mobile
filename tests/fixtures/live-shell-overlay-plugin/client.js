window.__ModuleLoader__.load({ id: '@dsh-mobile/shell-overlay-verification', factory(require) {
  const React = require('react');
  return { inject: ['slots'], apply(ctx) {
    ctx.slots.inject('shell.overlay', () => ctx.slots.register({ name: 'shell.overlay', id: 'dshm-live-overlay' }, ({ sessionId }) => {
      const [count, setCount] = React.useState(0);
      return React.createElement('section', { 'data-testid': 'live-shell-overlay', 'data-session': sessionId ?? 'none',
        style: { width: 600, padding: 8, background: '#edf2ff', color: '#111' } },
        React.createElement('button', { onClick: () => setCount(value => value + 1) }, `浮层计数 ${count}`));
    }));
  } };
} });
