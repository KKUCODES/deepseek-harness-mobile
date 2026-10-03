window.__ModuleLoader__.load({ id: '@dsh-mobile/document-ui-verification', factory(require) {
  const React = require('react');
  const session = 'session-d4ec40ee-a27c-41fc-a860-b3974434e637';
  const directory = 'dshm-document-ui-20260926/';
  const address = name => `dsh-resource://file/session/${session}/${directory}${encodeURIComponent(name)}`;
  return { inject: ['slots', 'documentPreviews', 'sidebarRight', 'remote', 'remote.workspaceFiles'], apply(ctx) {
    for (const [mode, title] of [['text-pages', '分页测试'], ['bytes-complete', '字节测试'], ['renderer', '自主读取测试']]) {
      const id = `@dsh-mobile/document-ui-verification/${mode}`;
      ctx.effect(() => ctx.documentPreviews.register({ id, title: () => title, extensions: ['dshmdoc'], loading: mode, wrap: true }));
      ctx.slots.inject('sidebar.right.tab.document', () => ctx.slots.register({ name: 'sidebar.right.tab.document', key: id }, function DocumentProbe({ content, resourceAddress, useTabInfo }) {
        const { tab } = useTabInfo();
        const [result, setResult] = React.useState(null), [count, setCount] = React.useState(0);
        React.useEffect(() => {
          if (content.kind !== 'renderer') return;
          const controller = new AbortController(), signal = AbortSignal.any([controller.signal, tab.signal]);
          void ctx.remote.workspaceFiles.read(session, directory + 'custom.dshmdoc', { offset: 1, limit: 1 }, signal).then(reply => {
            if (!signal.aborted) { setResult(reply); if (reply.ok) content.loaded(reply.value.version); }
          });
          return () => controller.abort();
        }, [content.kind, content.revision, tab.signal]);
        return React.createElement('section', { 'data-testid': 'live-document-renderer', style: { width: 720 } },
          React.createElement('output', { 'data-testid': 'document-renderer-result' }, JSON.stringify({
            kind: content.kind, address: resourceAddress, tabAddress: tab.contentId, sessionId: session,
            lines: content.pages?.reduce((sum, page) => sum + page.lines, 0), eof: content.eof,
            bytes: content.data?.byteLength, first: content.text?.split('\n')[0], result,
          })), React.createElement('button', { onClick: () => setCount(value => value + 1) }, `计数 ${count}`));
      }));
    }
    ctx.slots.inject('conversation.input.overlay', () => ctx.slots.register({ name: 'conversation.input.overlay', id: 'document-ui-probe' }, ({ sessionId }) => {
      if (sessionId !== session) return null;
      return React.createElement('section', { 'data-testid': 'live-document-opener', style: { position: 'absolute', bottom: '100%', background: 'white', padding: 12 } },
        ...['custom.dshmdoc', 'readme.md', 'image.svg', 'missing.txt', 'page.html', 'document.pdf', 'document.docx'].map(name => React.createElement('button', {
          key: name, onClick: () => ctx.sidebarRight.openResource(address(name)),
        }, `预览 ${name}`)));
    }));
    ctx.slots.inject('conversation.chat.turnTail', () => ctx.slots.register({ name: 'conversation.chat.turnTail', id: 'document-link-probe' }, ({ sessionId, openFile }) =>
      sessionId === session ? React.createElement('button', { onClick: () => openFile(directory + 'custom.dshmdoc', { line: 5001 }) }, '聊天文件定位') : null));
  } };
} });
