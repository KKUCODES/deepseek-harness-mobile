window.__ModuleLoader__.load({ id: '@dsh-mobile/interaction-verification', factory(require) {
  const React = require('react');
  const { Modal } = require('@deepseek-ai/dsh-client-ui-primitives');
  return { inject: ['slots'], apply(ctx) {
    ctx.slots.inject('conversation.session.header.utilities', () => ctx.slots.register({ name: 'conversation.session.header.utilities', id: 'verify-interaction' },
      function Verification({ sessionId, useSessions }) {
        const title = useSessions(value => value.byId[sessionId]?.title);
        const [open, setOpen] = React.useState(false);
        if (!['DSHM Remote 联调提示', 'DSHM 电脑端对照测试询问'].includes(title)) return null;
        return React.createElement('div', { 'data-testid': 'live-interactions', 'data-session': sessionId },
          React.createElement('button', { onClick: () => setOpen(true) }, '打开通知验证弹窗'),
          React.createElement(Modal, { open, onClose: () => setOpen(false), title: '通知验证弹窗', closeLabel: '关闭通知验证弹窗' }, '验证原插件弹窗遮挡时的提醒'));
      }));
  } };
} });
