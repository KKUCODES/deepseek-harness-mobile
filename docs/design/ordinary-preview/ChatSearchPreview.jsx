import React, { useEffect, useMemo, useRef, useState } from 'react';
import { IconSearchOutline16, IconCloseOutline16 } from '@upstream/ui-primitives/src/icons/index.tsx';
import { searchChats } from './chat-search.mjs';

function MatchText({ text, query }) {
  const index = text.toLocaleLowerCase().indexOf(query.trim().toLocaleLowerCase());
  if (index < 0 || !query.trim()) return text;
  const end = index + query.trim().length;
  return <>{text.slice(0, index)}<mark>{text.slice(index, end)}</mark>{text.slice(end)}</>;
}

export function ChatSearchPreview({ chats, onClose, onSelect, IconButton }) {
  const [query, setQuery] = useState('');
  const input = useRef(null);
  const results = useMemo(() => searchChats(chats, query), [chats, query]);
  useEffect(() => {
    // 抽屉卸载会恢复入口焦点，等它完成后再聚焦搜索输入。
    const frame = requestAnimationFrame(() => input.current?.focus());
    const escape = event => { if (event.key === 'Escape') { event.preventDefault(); onClose(); } };
    window.addEventListener('keydown', escape);
    return () => { cancelAnimationFrame(frame); window.removeEventListener('keydown', escape); };
  }, [onClose]);
  return <main className="app chat-search-page" aria-label="聊天搜索">
    <section className={`chat-search-content ${!query.trim() || !results.length ? 'is-empty' : ''}`} aria-label="搜索结果">
      {!query.trim() ? <div className="chat-search-empty"><span className="chat-search-symbol"><IconSearchOutline16 size={28}/></span><h1>搜索聊天</h1><p>查找标题或聊天内容</p></div>
        : !results.length ? <div className="chat-search-empty" role="status"><span className="chat-search-symbol"><IconSearchOutline16 size={28}/></span><h1>没有找到相关聊天</h1><p>换个关键词试试</p></div>
        : <><h1 className="chat-search-heading">聊天<span role="status">{results.length} 条结果</span></h1><div className="chat-search-results">{results.map(({ chat, snippet }) => <button className="chat-search-result" key={chat.id} onClick={() => onSelect(chat)}><span className="chat-search-result-icon"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M21 11.5a9 9 0 0 1-9 9 10 10 0 0 1-4-.9L3 21l1.4-4.7a9 9 0 1 1 16.6-4.8Z"/></svg></span><span className="chat-search-result-text"><strong><MatchText text={chat.title} query={query}/></strong><span><MatchText text={snippet} query={query}/></span></span></button>)}</div></>}
    </section>
    <form className="chat-search-bar" role="search" onSubmit={event => { event.preventDefault(); input.current?.blur(); }}>
      <label className="chat-search-input"><IconSearchOutline16 size={22}/><input ref={input} aria-label="搜索聊天" placeholder="搜索" value={query} onChange={event => setQuery(event.target.value)} autoComplete="off" autoCapitalize="off" spellCheck={false} enterKeyHint="search"/>{query && <IconButton label="清除搜索" type="button" className="icon-button chat-search-clear" onClick={() => { setQuery(''); input.current?.focus(); }}><span className="chat-search-clear-disc"><IconCloseOutline16 size={14}/></span></IconButton>}</label>
      <IconButton label="关闭搜索" className="icon-button chat-search-close" onClick={onClose}><IconCloseOutline16 size={24}/></IconButton>
    </form>
  </main>;
}
