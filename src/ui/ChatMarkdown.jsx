import React, { useEffect, useMemo, useState } from 'react';
import { MarkdownText } from '@upstream/ui-primitives/src/markdown/MarkdownText.tsx';
import { MarkdownDelegateProvider, useMarkdownDelegate } from '@upstream/ui-primitives/src/markdown/MarkdownDelegate.tsx';
import { markdownLabels } from '@upstream/ui-chat/src/client/markdown-labels.ts';
import { zh } from '@upstream/locale/src/locales/zh.ts';
import { en } from '@upstream/locale/src/locales/en.ts';
import { useLocale, useTranslate } from './locale.jsx';

// 手机端没有桌面文件拖拽目标；图片显示与失败提示不依赖拖拽动作。
const noFileDrag = {
  async prepare() { return { start: () => false, release() {} }; },
  reportFailure() {},
};

/** 两种聊天和Markdown预览共用原DSH渲染器、工具栏与文案，仅连接手机语言和导航。 */
export function ChatMarkdown({ text, streaming, onOpenLink, onOpenFile, fileMentions, images }) {
  const locale = useLocale(), t = useTranslate();
  const inherited = useMarkdownDelegate();
  const [revision, setRevision] = useState(0);
  // 只有可能含图片的正文才订阅缓存变化，避免纯文字消息随每次图片完成重画。
  const hasImages = useMemo(() => typeof text === 'string' && /!\[[^\]]*\]/.test(text), [text]);
  // 图片读取完成或失败后更新原解析器的图片能力身份，正文不动，只重新解析图片目标。
  useEffect(() => {
    if (!images || !hasImages) return undefined;
    // 原Markdown只在流式结束后解析图片；草稿渲染不触发会话文件读取。
    if (!streaming) images.prefetch(text);
    return images.subscribe(() => setRevision(value => value + 1));
  }, [images, text, streaming, hasImages]);
  const labels = useMemo(() => markdownLabels(key => (locale?.startsWith('en') ? en : zh)[key]), [locale]);
  const fileImages = useMemo(() => images ? {
    resolve: destination => images.resolve(destination),
    fileDrag: noFileDrag,
    labels: {
      open: t('打开图片'),
      loading: t('正在加载图片…'),
      failed: t('图片加载失败'),
      dialog: t('原图预览'),
      close: t('关闭原图预览'),
    },
  } : undefined, [images, revision, t]);
  // 普通聊天/更新说明的显式处理优先；Remote继承统一外链能力，文件仍由当前会话指定。
  return <MarkdownDelegateProvider openExternalLink={onOpenLink ?? inherited.openExternalLink} openFile={onOpenFile} fileImages={fileImages}>
    <MarkdownText text={text} streaming={streaming} labels={labels} fileMentions={fileMentions}/>
    {!streaming && images && hasImages && images.canRetry(text) && <button type="button" className="remote-markdown-image-retry" onClick={() => images.retry(text)}>{t('重试加载图片')}</button>}
  </MarkdownDelegateProvider>;
}
