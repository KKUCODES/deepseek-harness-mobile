import React, { useEffect, useState } from 'react';
import { packHtml } from '@upstream/ui-sidebar-documentpreview/src/client/html/pack.ts';
import { createHtmlDocument } from '@upstream/ui-sidebar-documentpreview/src/client/html/bootstrap.ts';
import { htmlRelatedPath, stageHtml } from '../remote-html.mjs';
import { fileError } from '../remote-files.mjs';
import { Button } from '@upstream/ui-primitives/src/Button.tsx';

import { useTranslate } from './locale.jsx';

export function RemoteHtmlPreview({ document, file, model, onRetry }) {
  const t = useTranslate();
  const [state, setState] = useState(null);
  useEffect(() => {
    const controller = new AbortController(), signal = AbortSignal.any([controller.signal, model.lifetime.signal]);
    let staged;
    setState(null);
    void (async () => {
      try {
        const bundle = await packHtml(document.data, async (reference, requestSignal) => {
          // 原始附件没有目录授权，不能按显示名猜测或读取电脑上的依赖。
          if (file.attachment) throw new Error('remote_attachment_dependency_missing');
          return { data: await model.files.bytes(file.sessionId, htmlRelatedPath(document.absolutePath, reference), requestSignal, { maxBytes: 4 * 1024 * 1024 }) };
        }, signal);
        if (!file.attachment) await model.files.assertVersion(file.sessionId, file.path, document, signal);
        staged = await stageHtml(model.client, createHtmlDocument(bundle), signal);
        if (signal.aborted) staged.dispose(); else setState({ url: staged.url });
      } catch (error) { if (!signal.aborted) setState({ error: error.message === 'remote_attachment_dependency_missing'
        ? '附件缺少引用的脚本或样式，请使用包含完整内容的 HTML 文件。' : fileError(error) }); }
    })();
    return () => { controller.abort(); staged?.dispose(); };
  }, [document, file, model]);
  if (!state) return <p role="status">{t('正在准备网页…')}</p>;
  if (state.error) return <div role="alert"><p>{t(state.error)}</p>
    {onRetry && <Button onClick={onRetry}>{t('重试')}</Button>}
  </div>;
  return <iframe key={state.url} src={state.url} title={t('HTML 文件预览')} sandbox="allow-scripts" referrerPolicy="no-referrer"
    style={{ display: 'block', width: '100%', minHeight: 360, height: '100%', border: 0, background: 'white' }}/>;
}
