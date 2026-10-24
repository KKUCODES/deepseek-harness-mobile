import React, { useMemo, useState } from 'react';
import { markdownPages } from '../remote-markdown-pages.mjs';
import { Button } from '@upstream/ui-primitives/src/Button.tsx';
import { useTranslate } from './locale.jsx';

const positions = new WeakMap();
/** 给统一节点席位提供呈现副本；原日志、会话、插件状态和文件定位仍使用原节点。 */
export function RemotePagedNode({ owner, session, render }) {
  const t = useTranslate(), node = owner.node;
  const pages = useMemo(() => {
    if (node.kind !== 'assistant-step') return null;
    const blocks = node.data.blocks ?? [];
    if (!blocks.some(block => typeof block.text === 'string' && block.text.length > 16000) && blocks.length <= 12) return null;
    return blocks.flatMap(block => typeof block.text === 'string' && block.text.length > 8000
      ? markdownPages(block.text).map(text => ({ ...block, text })) : [block]);
  }, [node]);
  let memory = positions.get(session);
  if (!memory) { memory = new Map(); positions.set(session, memory); }
  const memoryKey = `${node.key}:${owner.groupPart ?? 'all'}`;
  const [selected, setSelected] = useState(() => memory.get(memoryKey) ?? null);
  if (!pages) return render(owner);
  const visible = pages.filter(block => owner.groupPart === 'reasoning' ? block.kind === 'reasoning'
    : owner.groupPart === 'response' ? block.kind !== 'reasoning' : true);
  if (!visible.length) return null;
  const index = Math.max(0, Math.min(selected ?? (node.data.status === 'running' ? visible.length - 1 : 0), visible.length - 1));
  const select = value => {
    setSelected(value); memory.delete(memoryKey); memory.set(memoryKey, value);
    if (memory.size > 128) memory.delete(memory.keys().next().value);
  };
  const view = { ...owner, node: { ...node, data: { ...node.data, blocks: [visible[index]] } } };
  return <div className="remote-long-content">
    <div className="remote-history-navigation" aria-label={t('长内容分页')}>
      <Button disabled={!index} onClick={() => select(index - 1)}>{t('上一段')}</Button>
      <span role="status">{t('第 {page} / {total} 段', { page: index + 1, total: visible.length })}</span>
      <Button disabled={index === visible.length - 1} onClick={() => select(index + 1)}>{t('下一段')}</Button>
    </div>
    {render(view)}
  </div>;
}
