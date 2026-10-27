import React, { useMemo } from 'react';
import { MarkdownText } from '@upstream/ui-primitives/src/markdown/MarkdownText.tsx';
import { MarkdownDelegateProvider, useMarkdownDelegate } from '@upstream/ui-primitives/src/markdown/MarkdownDelegate.tsx';
import { markdownLabels } from '@upstream/ui-chat/src/client/markdown-labels.ts';
import { zh } from '@upstream/locale/src/locales/zh.ts';
import { en } from '@upstream/locale/src/locales/en.ts';
import { useLocale } from './locale.jsx';

/** 两种聊天和Markdown预览共用原DSH渲染器、工具栏与文案，仅连接手机语言和导航。 */
export function ChatMarkdown({ text, streaming, onOpenLink, onOpenFile, fileMentions }) {
  const locale = useLocale();
  const inherited = useMarkdownDelegate();
  // labels身份也是原增量解析缓存的键，不能随每个流式片段重新创建。
  const labels = useMemo(() => markdownLabels(key => (locale?.startsWith('en') ? en : zh)[key]), [locale]);
  // 普通聊天/更新说明的显式处理优先；Remote继承统一外链能力，文件仍由当前会话指定。
  return <MarkdownDelegateProvider openExternalLink={onOpenLink ?? inherited.openExternalLink} openFile={onOpenFile}>
    <MarkdownText text={text} streaming={streaming} labels={labels} fileMentions={fileMentions}/>
  </MarkdownDelegateProvider>;
}
