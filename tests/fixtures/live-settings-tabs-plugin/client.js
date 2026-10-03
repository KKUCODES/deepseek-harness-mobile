window.__ModuleLoader__.load({ id: '@dsh-mobile/settings-tabs-verification', factory(require) {
  const React = require('react');
  return { inject: ['slots'], apply(ctx) {
    ctx.slots.inject('settings.onboarding', () => {
      const disposers = ['last', 'first', 'silent'].map((id, index) => ctx.slots.register({
        name: 'settings.onboarding', id: `dshm-${id}`, order: [20, 10, 0][index],
      }, owner => {
        React.useEffect(() => { if (id === 'silent') owner.complete(); }, [owner.complete]);
        if (id === 'silent') return null;
        return React.createElement('section', { 'data-testid': `live-onboarding-${id}`, 'data-session': owner.sessionId ?? 'none' },
          React.createElement('button', { onClick: owner.complete }, `完成引导 ${id}`),
          React.createElement('button', { onClick: () => { owner.openSection('models'); owner.complete(); } }, `打开模型设置 ${id}`),
          React.createElement('button', { onClick: () => { owner.openSection('dshm-section'); owner.complete(); } }, `打开设置 ${id}`));
      }));
      return () => disposers.forEach(dispose => dispose());
    });
    ctx.slots.inject('settings.section', () => ctx.slots.register({ name: 'settings.section', id: 'dshm-section', label: 'DSHM 设置导航验证', order: 90 },
      ({ sessionId, close }) => {
        const [draft, setDraft] = React.useState('');
        return React.createElement('section', { 'data-testid': 'live-settings-section', 'data-session': sessionId ?? 'none', style: { width: 600 } },
          React.createElement('input', { 'aria-label': '设置页测试草稿', value: draft, onChange: event => setDraft(event.target.value) }),
          React.createElement('button', { onClick: close }, '完成设置页验证'));
      }));
    for (const [id, label, order] of [['one', '验证一', 100], ['two', '验证二', 101]]) {
      ctx.slots.inject('settings.plugins.tab', () => ctx.slots.register({ name: 'settings.plugins.tab', id: `dshm-${id}`, label, order },
        ({ sessionId }) => {
          const [count, setCount] = React.useState(0);
          return React.createElement('section', { 'data-testid': `live-settings-${id}`, 'data-session': sessionId ?? 'none', style: { width: 600 } },
            React.createElement('p', null, '插件设置局部界面'),
            React.createElement('button', { onClick: () => setCount(value => value + 1) }, `设置计数 ${count}`));
        }));
    }
  } };
} });
