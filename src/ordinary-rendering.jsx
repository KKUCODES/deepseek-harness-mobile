import React, { useMemo } from 'react';
import { MarkdownText } from '@upstream/ui-primitives/src/markdown/MarkdownText.tsx';
import { MarkdownDelegateProvider, useMarkdownDelegate } from '@upstream/ui-primitives/src/markdown/MarkdownDelegate.tsx';
import { useTranslate } from './ui/locale.jsx';

export function OrdinaryMarkdown({ text, streaming, onOpenLink, onOpenFile, fileMentions }) {
  const t = useTranslate();
  const inherited = useMarkdownDelegate();
  // 上游以 labels 身份保留增量解析缓存；仅语言改变时重新创建，避免每次流更新重排全部历史。
  const labels = useMemo(() => ({ code: { copyLabel: t('复制代码'), copiedLabel: t('已复制') }, footnotes: t('参考') }), [t]);
  // 普通聊天/更新说明的显式处理优先；Remote统一外链能力向内继承，文件入口仍由当前调用者指定。
  return <MarkdownDelegateProvider openExternalLink={onOpenLink ?? inherited.openExternalLink} openFile={onOpenFile}><MarkdownText text={text} streaming={streaming} labels={labels} fileMentions={fileMentions}/></MarkdownDelegateProvider>;
}
export const inject = ['slots'];
export function apply(ctx) {
  ctx.slots.inject('ordinary.message.content', () => ctx.slots.register({ name: 'ordinary.message.content' },
    OrdinaryMarkdown));
}
