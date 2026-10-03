window.__ModuleLoader__.load({ id: '@dsh-mobile/main-factory-verification', factory(require) {
  const React = require('react');
  return { inject: ['slots'], apply(ctx) {
    let restore;
    function Replacement({ sessionId, useSession, useSessionRetainInfo }) {
      return React.createElement('div', { 'data-testid': 'live-main-replacement', 'data-session': sessionId,
        'data-open': useSession(value => value.openState),
        'data-main-count': useSessionRetainInfo(value => value.retainedBy.mainView ?? 0) },
        React.createElement('p', null, '主聊天插件内容'),
        React.createElement('button', { onClick: () => { restore?.(); restore = undefined; } }, '恢复正文'));
    }
    ctx.slots.inject('conversation.session.header.actions', () => ctx.slots.register({ name: 'conversation.session.header.actions', id: 'main-factory-probe' },
      ({ sessionId }) => React.createElement('button', { 'data-testid': 'live-main-replace', 'data-session': sessionId,
        onClick: () => { restore?.(); restore = ctx.slots.register({ name: 'conversation.session', priority: -100 }, Replacement); } }, '验证主聊天内容替换')));
  } };
} });
