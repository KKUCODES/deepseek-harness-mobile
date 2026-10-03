window.__ModuleLoader__.load({ id: '@dsh-mobile/partial-ui-verification', factory(require) {
  const React = require('react');
  return { inject: ['slots'], apply(ctx) {
    // 第二版验证作者声明；原DSH没有此服务时仍能正常加载。
    ctx.inject(['dshmLayout'], mobile => mobile.dshmLayout.configure({ autoFit: false }));
    ctx.slots.inject('conversation.chat.turnTail', () => ctx.slots.register({
      name: 'conversation.chat.turnTail', id: 'dshm-partial-ui-verification',
    }, function VerificationCard({ sessionId, openFile, seq }) {
      const [path, setPath] = React.useState('');
      const [clicked, setClicked] = React.useState(0);
      return React.createElement('section', {
        'data-testid': 'live-partial-card', 'data-session': sessionId, 'data-seq': seq,
        style: { width: 720, boxSizing: 'border-box', padding: 16, border: '1px solid #aaa', background: '#fff', color: '#111' },
      }, React.createElement('p', null, 'DSHM 独立插件验证'),
      React.createElement('input', { 'aria-label': '测试文件路径', value: path, onChange: event => setPath(event.target.value), style: { width: 440 } }),
      React.createElement('button', { disabled: !path, onClick: () => openFile(path) }, '预览测试文件'),
      React.createElement('button', { onClick: () => setClicked(value => value + 1) }, `点击验证 ${clicked}`));
    }));
  } };
} });
