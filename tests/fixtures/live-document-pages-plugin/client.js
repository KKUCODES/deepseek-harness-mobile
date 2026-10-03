window.__ModuleLoader__.load({ id: '@dsh-mobile/document-pages-verification', factory(require) {
  const React = require('react');
  return { inject: ['slots', 'remote', 'remote.workspaceFiles'], apply(ctx) {
    ctx.slots.inject('conversation.input.overlay', () => ctx.slots.register({
      name: 'conversation.input.overlay', id: 'dshm-document-pages-verification',
    }, function DocumentPagesProbe({ sessionId }) {
      const [result, setResult] = React.useState(null), [pending, setPending] = React.useState(false);
      const controller = React.useRef(null);
      React.useEffect(() => () => controller.current?.abort(), []);
      if (sessionId !== 'session-d4ec40ee-a27c-41fc-a860-b3974434e637') return null;
      const run = async () => {
        const abort = new AbortController(); controller.current?.abort(); controller.current = abort;
        setPending(true); setResult(null);
        const read = (name, range = { offset: 1 }) => ctx.remote.workspaceFiles.read(sessionId,
          `dshm-document-pages-20260926/${name}`, range, abort.signal);
        try {
          const first = await read('正文.txt', { offset: 1, limit: 2 });
          const last = await read('正文.txt', { offset: 3, limit: 2 });
          const defaults = await read('正文.txt');
          let oversized;
          try {
            const reply = await read('escaped.txt');
            oversized = reply.ok ? 'unexpected-success' : reply.error;
          }
          catch (error) { oversized = { code: error.code, message: error.message }; }
          // 超过中继 JSON 帧上限后，同一连接仍应可以进行正常读取。
          const recovered = await read('正文.txt', { offset: 3, limit: 2 });
          if (!abort.signal.aborted) setResult({ first, last, defaults, oversized, recovered });
        } catch (error) {
          if (!abort.signal.aborted) setResult({ error: error.message, code: error.code });
        } finally { if (!abort.signal.aborted) setPending(false); }
      };
      return React.createElement('section', { 'data-testid': 'live-document-pages', style: {
        position: 'absolute', bottom: '100%', width: 300, padding: 12, border: '1px solid #ccc',
        borderRadius: 12, background: '#fff', color: '#111', boxSizing: 'border-box',
      } }, React.createElement('strong', null, 'DSHM 文件分页验收'),
      React.createElement('button', { onClick: run, disabled: pending }, pending ? '读取中' : '读取测试文件'),
      React.createElement('output', { 'data-testid': 'document-page-result', style: {
        display: 'block', maxHeight: 160, overflow: 'auto', overflowWrap: 'anywhere', fontSize: 12,
      } }, result ? JSON.stringify(result) : '等待读取'));
    }));
  } };
} });
