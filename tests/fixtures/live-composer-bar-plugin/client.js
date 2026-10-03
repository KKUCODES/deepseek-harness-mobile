window.__ModuleLoader__.load({ id: '@dsh-mobile/composer-bar-verification', factory(require) {
  const React = require('react');
  return { inject: ['slots'], apply(ctx) {
    ctx.slots.inject('conversation.composer.bar', () => ctx.slots.register({ name: 'conversation.composer.bar' },
      ({ sessionId, useInput, inputActions, variant, blocked, disabled }) => {
        const draft = useInput(value => value.draft);
        // 仅验证同一草稿读写，测试包不提供发送按钮，不产生模型请求。
        return React.createElement('section', { 'data-testid': 'live-composer-bar', 'data-session': sessionId, 'data-variant': variant,
          style: { width: 600, padding: 20, boxSizing: 'border-box', background: '#f5f6f7', color: '#111' } },
        React.createElement('label', null, '插件草稿', React.createElement('input', {
          'aria-label': '插件草稿', value: draft, disabled: disabled || !!blocked,
          style: { width: '100%', boxSizing: 'border-box' }, onChange: event => inputActions.setDraft(event.target.value),
        })));
      }));
    ctx.slots.inject('conversation.input.dock', () => ctx.slots.register({ name: 'conversation.input.dock', id: 'bar-verification' },
      ({ sessionId, session, input, useInput }) => React.createElement('output', {
        'data-testid': 'live-input-dock', 'data-session': sessionId, 'data-phase': session.openState,
        'data-consistent': useInput(value => value.draft) === input.draft,
      }, input.draft)));
  } };
} });
