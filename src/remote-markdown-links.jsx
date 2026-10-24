import React, { useCallback, useEffect, useRef, useState } from 'react';
import { MarkdownDelegateProvider } from '@upstream/ui-primitives/src/markdown/MarkdownDelegate.tsx';
import { MarkdownDelegateProvider as SdkMarkdownDelegateProvider } from '@deepseek-ai/dsh-client-ui-primitives';
import { Button } from '@upstream/ui-primitives/src/Button.tsx';
import { Surface } from './ui/Surface.jsx';
import { useTranslate } from './ui/locale.jsx';

const failures = {
  invalid_link: '该链接不是有效的 HTTP 或 HTTPS 网页地址。',
  browser_unavailable: '未找到可打开网页的浏览器，请安装或启用浏览器后重试。',
};

/** 聊天、原内置文件渲染器和旧预览共享同一能力；网页不进入带桥的WebView。 */
export function RemoteMarkdownLinks({ model, children }) {
  const t = useTranslate(), [failure, setFailure] = useState(null);
  const alive = useRef(true);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  const openExternalLink = useCallback(url => {
    void model.client.call('links.open', { url }).catch(error => {
      if (alive.current) setFailure(failures[error.message] ?? '无法打开网页，请稍后重试。');
    });
  }, [model.client]);
  // 自有正文复用源码组件，原内置面板复用已发布SDK；两者的React上下文需接入同一处理函数。
  return <SdkMarkdownDelegateProvider openExternalLink={openExternalLink}><MarkdownDelegateProvider openExternalLink={openExternalLink}>
    {children}
    {failure && <Surface title={t('无法打开链接')} onClose={() => setFailure(null)}>
      <h2>{t('无法打开链接')}</h2><p role="alert">{t(failure)}</p>
      <Button onClick={() => setFailure(null)}>{t('知道了')}</Button>
    </Surface>}
  </MarkdownDelegateProvider></SdkMarkdownDelegateProvider>;
}
