window.__ModuleLoader__.load({ id: '@dsh-mobile/input-api-verification', factory(require) {
  const React = require('react');
  return { inject: ['slots', 'conversation', 'sessions'], apply(ctx) {
    const testSession = 'session-d4ec40ee-a27c-41fc-a860-b3974434e637';
    const inputFor = () => ctx.conversation.input.for(ctx.sessions.scope(testSession));
    ctx.effect(() => () => ctx.conversation.blocks.set(testSession, undefined));
    ctx.slots.inject('conversation.input.overlay', () => ctx.slots.register({
      name: 'conversation.input.overlay', id: 'dshm-input-api-verification',
    }, function InputProbe({ sessionId, useInput, inputActions, useConversation }) {
      const input = useInput(state => state);
      const conversation = useConversation(state => state);
      // 仅在专用联调聊天提供可见按钮，无自动写入、发送或网络请求。
      if (sessionId !== testSession || !input || !inputActions) return null;
      return React.createElement('section', { 'data-testid': 'live-input-probe', style: {
        position: 'absolute', bottom: '100%', width: 300, padding: 12, border: '1px solid #ccc',
        borderRadius: 12, background: '#fff', color: '#111', boxSizing: 'border-box',
      } },
      React.createElement('strong', null, 'DSHM 会话接口验收'),
      React.createElement('output', { 'data-testid': 'live-conversation-state' }, conversation.activeTargets.has('chat') ? 'CHAT_READY' : 'CHAT_WAITING'),
      React.createElement('output', { 'data-testid': 'live-input-draft', style: { display: 'block', overflowWrap: 'anywhere' } }, input.draft),
      React.createElement('button', { onClick: () => inputActions.setDraft(`${input.draft} PLUGIN_INPUT_OK`) }, '插件追加草稿'),
      React.createElement('button', { onClick: () => inputFor().focus() }, '插件聚焦输入'),
      React.createElement('button', { onClick: () => inputFor().notify('info', '会话提示验证成功') }, '插件显示提示'),
      React.createElement('button', { onClick: () => ctx.conversation.blocks.set(sessionId, { reason: '插件暂时停止输入（验证）' }) }, '插件暂停输入'),
      React.createElement('button', { onClick: () => ctx.conversation.blocks.set(sessionId, undefined) }, '插件恢复输入'));
    }));
  } };
} });
