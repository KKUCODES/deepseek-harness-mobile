window.__ModuleLoader__.load({ id: '@dsh-mobile/attachment-document-verification', factory(require) {
  const React = require('react');
  return { inject: ['slots', 'documentPreviews'], apply(ctx) {
    ctx.inject(['dshmDocuments'], scope => {
      for (const [mode, title] of [['text-pages', '附件分页验收'], ['bytes-complete', '附件字节验收'], ['renderer', '附件自主读取验收']]) {
        const id = `@dsh-mobile/attachment-document-verification/${mode}`;
        scope.effect(() => scope.documentPreviews.register({ id, title: () => title, extensions: ['txt'], loading: mode }));
        scope.slots.inject('sidebar.right.tab.document', () => scope.slots.register({ name: 'sidebar.right.tab.document', key: id }, function Probe({ content, resourceAddress, useTabInfo, useResource }) {
          const { tab } = useTabInfo(), metadata = useResource(resourceAddress);
          const [value, setValue] = React.useState(null);
          React.useEffect(() => {
            if (content.kind !== 'renderer') return;
            const controller = new AbortController(), signal = AbortSignal.any([controller.signal, tab.signal]);
            void scope.dshmDocuments.readBytes(resourceAddress, signal).then(result => {
              if (!signal.aborted) {
                setValue(result.ok ? new TextDecoder().decode(result.value.data) : result.error.message);
                if (result.ok) content.loaded(result.value.version);
              }
            });
            return () => controller.abort();
          }, [content.kind, content.revision, resourceAddress, tab.signal]);
          return React.createElement('output', { 'data-testid': 'live-attachment-document-result',
            style: { display: 'block', width: 720, padding: 16, boxSizing: 'border-box', whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', fontSize: 18 } }, JSON.stringify({
            kind: content.kind, address: resourceAddress, tabAddress: tab.contentId, source: metadata.value?.source,
            text: content.kind === 'bytes' ? new TextDecoder().decode(content.data) : content.text ?? value,
          }, null, 2));
        }));
      }
    });
  } };
} });
