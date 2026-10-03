window.__ModuleLoader__.load({ id: '@dsh-mobile/model-footer-verification', factory(require) {
  const React = require('react');
  return { inject: ['slots'], apply(ctx) {
    for (const key of ['llm-deepseek', 'llm-pi-ai']) ctx.slots.inject('settings.models.provider-card', () => ctx.slots.register({ name: 'settings.models.provider-card', key },
      ({ sessionId, provider, configured, keyConfigured }) => React.createElement('section', {
        'data-testid': 'live-provider-card', 'data-session': sessionId ?? 'none', 'data-provider': provider.provider,
        'data-configured': String(configured), 'data-key': String(keyConfigured), 'data-active': String(provider.active),
        'data-namespace': provider.settingsNs, 'data-path': JSON.stringify(provider.settingsPath),
      }, React.createElement('p', null, `${provider.displayName} · ${configured ? '已配置' : '未配置'} · ${keyConfigured ? '已保存Key' : '未保存Key'}`),
      React.createElement('input', { 'aria-label': '提供方扩展草稿', defaultValue: '' }))));
    ctx.slots.inject('settings.models.footer', () => ctx.slots.register({ name: 'settings.models.footer', id: 'dshm-live-model-footer' }, ({ sessionId }) => {
      const [count, setCount] = React.useState(0);
      return React.createElement('section', { 'data-testid': 'live-model-footer', 'data-session': sessionId ?? 'none', style: { width: 600 } },
        React.createElement('p', null, '模型设置局部扩展验证'),
        React.createElement('button', { onClick: () => setCount(value => value + 1) }, `扩展计数 ${count}`));
    }));
  } };
} });
