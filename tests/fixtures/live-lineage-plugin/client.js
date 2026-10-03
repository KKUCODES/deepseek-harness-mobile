window.__ModuleLoader__.load({ id: '@dsh-mobile/lineage-ui-verification', factory(require) {
  const React = require('react');
  return { inject: ['slots', 'sessions'], apply(ctx) {
    ctx.slots.inject('conversation.session.header.lineage', () => ctx.slots.register({
      name: 'conversation.session.header.lineage',
    }, function LineageProbe({ sessionId, lineageSessionId, displayTitle, openTitle }) {
      const child = ctx.sessions.list.getSnapshot().byId[lineageSessionId]?.origin === 'subagent';
      return React.createElement('button', {
        'data-testid': 'live-lineage', 'data-session': sessionId, 'data-lineage': lineageSessionId,
        'data-ancestor': String(!!openTitle),
        style: { width: child ? 480 : 32, height: 32, boxSizing: 'border-box', border: '1px solid #aaa', background: '#fff', color: '#111' },
        'aria-label': displayTitle, onClick: openTitle,
      }, child ? displayTitle : '◦');
    }));
  } };
} });
