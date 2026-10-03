window.__ModuleLoader__.load({ id: '@dsh-mobile/upgrade-verification', factory(require) {
  const React = require('react');
  return { inject: ['slots'], apply(ctx) {
    ctx.slots.inject('conversation.chat.turnTail', () => ctx.slots.register({
      name: 'conversation.chat.turnTail', id: 'dshm-upgrade-verification',
    }, function UpgradeCard() {
      const [count, setCount] = React.useState(0);
      return React.createElement('section', { 'data-testid': 'live-upgrade-card', 'data-version': '0.0.2' },
        React.createElement('p', null, 'DSHM 升级验证 0.0.2'),
        React.createElement('button', { onClick: () => setCount(count + 1) }, `版本验证 ${count}`));
    }));
  } };
} });
