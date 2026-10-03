import React, { useCallback, useEffect, useState, useSyncExternalStore } from 'react';
import { LazyPdfBody } from '@upstream/ui-sidebar-documentpreview/src/client/pdf/LazyPdfBody.tsx';
import { createPdfStore } from '@upstream/ui-sidebar-documentpreview/src/client/pdf/store.ts';
import { zh, en } from '@upstream/ui-sidebar-documentpreview/src/client/pdf/locales.ts';

import { useLocale } from './locale.jsx';

/** 手机文件窗口提供原 PDF 组件需要的页码状态和生命周期，不创建电脑侧边栏。 */
export function RemotePdfPreview({ data, address, signal }) {
  const locale = useLocale();
  const translate = useCallback((key, values = {}) => (locale?.startsWith('en') ? en : zh)[key].replace(/\{(\w+)\}/g, (_, name) => values[name] ?? ''), [locale]);
  const [owner] = useState(() => {
    const controller = new AbortController(), store = createPdfStore().create();
    const tab = { id: address, signal: AbortSignal.any([controller.signal, signal]) };
    const retained = new Set();
    return {
      controller, tab, actions: store.actions,
      useStore: selector => selector(useSyncExternalStore(store.subscribe, store.getSnapshot)),
      retainTab: (id, lifetime) => {
        if (retained.has(id)) return;
        retained.add(id);
        const forget = () => { store.actions.forget(id); retained.delete(id); };
        if (lifetime.aborted) forget(); else lifetime.addEventListener('abort', forget, { once: true });
      },
    };
  });
  useEffect(() => () => owner.controller.abort(), [owner]);
  const useTabInfo = useCallback(() => ({ tab: owner.tab }), [owner]);
  return <LazyPdfBody content={{ kind: 'bytes', data }} resourceAddress={address} t={translate}
    useTabInfo={useTabInfo} useStore={owner.useStore} actions={owner.actions} retainTab={owner.retainTab}/>;
}
