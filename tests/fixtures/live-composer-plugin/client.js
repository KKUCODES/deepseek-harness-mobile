window.__ModuleLoader__.load({ id: '@dsh-mobile/composer-ui-verification', factory(require) {
  const React = require('react');
  return { inject: ['slots', 'uiSession'], apply(ctx) {
    const publish = ctx.uiSession.registerPendingInteraction(() => 20);
    const releases = new Map();
    const finish = sessionId => { releases.get(sessionId)?.(); releases.delete(sessionId); };
    ctx.effect(() => () => { for (const release of releases.values()) release(); releases.clear(); });
    // 只由测试员点击触发插件自己的本地交互；无远端审批、消息提交或配置写入。
    ctx.slots.inject('conversation.session.header.actions', () => ctx.slots.register({
      name: 'conversation.session.header.actions', id: 'composer-verification',
    }, ({ sessionId }) => React.createElement('button', {
      'data-testid': 'live-composer-start', 'data-session': sessionId,
      onClick: () => {
        finish(sessionId);
        releases.set(sessionId, publish({ key: crypto.randomUUID(), kind: 'dshm-composer-check', sessionId,
          finish: () => finish(sessionId) }, async () => { releases.delete(sessionId); }));
      },
    }, '测试插件输入区')));
    ctx.slots.inject('conversation.composer', () => ctx.slots.register({
      name: 'conversation.composer', id: 'composer-verification', priority: -100,
      select: ({ sessionId, session, pendingInteraction }) => session && pendingInteraction?.sessionId === sessionId
        && pendingInteraction.kind === 'dshm-composer-check' ? pendingInteraction : null,
    }, ({ matched, sessionId, useInput }) => React.createElement('section', {
      'data-testid': 'live-composer-panel', 'data-session': sessionId,
      style: { width: 600, padding: 24, boxSizing: 'border-box', background: '#f5f6f7', color: '#111', borderRadius: 16 },
    }, React.createElement('h3', null, '插件局部输入区'),
    React.createElement('p', { 'data-testid': 'live-composer-draft' }, useInput(value => value.draft)),
    React.createElement('button', { onClick: matched.finish }, '完成插件输入'))));
  } };
} });
