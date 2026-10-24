import React, { useMemo, useState } from 'react';
import { OrdinaryMarkdown } from '../ordinary-rendering.jsx';
import { markdownPages } from '../remote-markdown-pages.mjs';
import { Button } from '@upstream/ui-primitives/src/Button.tsx';
import { useTranslate } from './locale.jsx';

/** 单条大回复也不能产生无限 DOM；分页位置属于手机呈现元数据，不修改插件或电脑记录。 */
export function RemoteLongMarkdown({ text, streaming, memory, contentKey, ...props }) {
  const t = useTranslate();
  const pages = useMemo(() => text?.length > 16000 ? markdownPages(text) : null, [text]);
  const [selected, setSelected] = useState(() => memory?.get(contentKey) ?? null);
  if (!pages) return <OrdinaryMarkdown text={text} streaming={streaming} {...props}/>;
  const index = Math.min(selected ?? (streaming ? pages.length - 1 : 0), pages.length - 1);
  const select = value => {
    setSelected(value);
    if (memory && contentKey) {
      memory.delete(contentKey); memory.set(contentKey, value);
      if (memory.size > 128) memory.delete(memory.keys().next().value);
    }
  };
  return <div className="remote-long-content">
    <div className="remote-history-navigation" aria-label={t('长内容分页')}>
      <Button disabled={!index} onClick={() => select(index - 1)}>{t('上一段')}</Button>
      <span role="status">{t('第 {page} / {total} 段', { page: index + 1, total: pages.length })}</span>
      <Button disabled={index === pages.length - 1} onClick={() => select(index + 1)}>{t('下一段')}</Button>
    </div>
    <OrdinaryMarkdown text={pages[index]} streaming={streaming && index === pages.length - 1} {...props}/>
  </div>;
}
