return { inject: ['slots'], apply(ctx) {
  ctx.slots.inject('conversation.session.header.actions', () => ctx.slots.register({
    name: 'conversation.session.header.actions', id: 'dshm-cordis-live-check',
  }, function Probe({ sessionId }) {
    const [result, setResult] = React.useState('验证 Host 调用');
    const [calls, setCalls] = React.useState(0);
    const [failures, setFailures] = React.useState(0);
    const [errorText, setErrorText] = React.useState('');
    const [crashed, setCrashed] = React.useState(false);
    if (sessionId !== 'session-d4ec40ee-a27c-41fc-a860-b3974434e637') return null;
    if (crashed) throw new Error('DSHM_EXPECTED_CLIENT_RENDER_FAILURE');
    return React.createElement('div', null, React.createElement('button', { 'data-testid': 'cordis-live-echo', 'data-host-calls': calls, 'data-host-failures': failures, onClick: async () => {
      try { const value = await host.call('echo', 'DSHM_CORDIS_ECHO'); setResult(value.echoed); setCalls(value.calls); setFailures(value.failures); }
      catch (error) { setResult(error.message); }
    } }, result), React.createElement('button', { 'data-testid': 'cordis-live-failure', 'data-host-error': errorText, title: errorText, onClick: async () => {
      try { await host.call('fail'); setErrorText('UNEXPECTED_SUCCESS'); }
      catch (error) { setErrorText(error.message); }
    } }, errorText ? 'Host 调用失败' : '验证 Host 失败'), React.createElement('button', {
      'data-testid': 'cordis-live-render-failure', onClick: () => setCrashed(true),
    }, '验证局部渲染失败'));
  }));
} };
