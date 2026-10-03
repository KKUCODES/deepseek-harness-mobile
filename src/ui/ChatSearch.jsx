import { useTranslate } from './locale.jsx';
import React, { useEffect, useRef, useState } from 'react';
import { IconSearchOutline16, IconCloseOutline16 } from '@upstream/ui-primitives/src/icons/index.tsx';
import { IconButton } from './Surface.jsx';

function Match({ text, query }) {
  const index = text.toLocaleLowerCase().indexOf(query.trim().toLocaleLowerCase());
  if (index < 0 || !query.trim()) return text;
  return <>{text.slice(0, index)}<mark>{text.slice(index, index + query.trim().length)}</mark>{text.slice(index + query.trim().length)}</>;
}

export function ChatSearch({ search, onClose, onSelect }) {
  const t = useTranslate();
  const [query, setQuery] = useState('');
  const [result, setResult] = useState({ items: [], next: null });
  const [status, setStatus] = useState('ready');
  const input = useRef(null);
  const generation = useRef(0);
  useEffect(() => {
    const frame = requestAnimationFrame(() => input.current?.focus());
    return () => cancelAnimationFrame(frame);
  }, []);
  useEffect(() => {
    const current = ++generation.current;
    setResult({ items: [], next: null });
    if (!query.trim()) { setStatus('ready'); return; }
    setStatus('loading');
    void search({ query }).then(value => {
      if (generation.current === current) { setResult(value); setStatus('ready'); }
    }, () => { if (generation.current === current) setStatus('error'); });
    return () => { generation.current++; };
  }, [query, search]);
  async function more() {
    const current = generation.current;
    setStatus('loading');
    try {
      const page = await search({ query, before: result.next });
      if (current === generation.current) { setResult(value => ({ items: [...value.items, ...page.items], next: page.next })); setStatus('ready'); }
    } catch { if (current === generation.current) setStatus('error'); }
  }
  return <main className="app chat-search-page" aria-label={t("聊天搜索")} onKeyDown={event => { if (event.key === 'Escape') { event.preventDefault(); onClose(); } }}>
    <section className={`chat-search-content ${!result.items.length ? 'is-empty' : ''}`} aria-label={t("搜索结果")}>
      {!result.items.length ? <div className="chat-search-empty"><span className="chat-search-symbol"><IconSearchOutline16 size={28}/></span><h1>{!query.trim() ? t('搜索聊天') : status === 'loading' ? t('正在搜索') : status === 'error' ? t('无法读取聊天记录') : t('没有找到相关聊天')}</h1><p>{!query.trim() ? t('查找标题或聊天内容') : status === 'ready' ? t('换个关键词试试') : ''}</p></div>
        : <><h1 className="chat-search-heading">{t("聊天")}</h1><div className="chat-search-results">{result.items.map(chat => <button key={chat.id} className="chat-search-result" onClick={() => onSelect(chat.id)}><span className="chat-search-result-icon"><IconSearchOutline16/></span><span className="chat-search-result-text"><strong><Match text={chat.title} query={query}/></strong><span><Match text={chat.snippet} query={query}/></span></span></button>)}</div>{result.next && <button disabled={status === 'loading'} onClick={more}>{t("加载更多")}</button>}{status === 'error' && <p role="alert">{t("读取失败，请重试。")}</p>}</>}
    </section>
    <form className="chat-search-bar" role="search" onSubmit={event => { event.preventDefault(); input.current?.blur(); }}>
      <label className="chat-search-input"><IconSearchOutline16 size={22}/><input ref={input} aria-label={t("搜索聊天")} placeholder={t("搜索")} value={query} onChange={event => setQuery(event.target.value)} autoComplete="off" autoCapitalize="off" spellCheck={false} enterKeyHint="search"/>{query && <IconButton label={t("清除搜索")} type="button" className="icon-button chat-search-clear" onClick={() => { setQuery(''); input.current?.focus(); }}><span className="chat-search-clear-disc"><IconCloseOutline16 size={14}/></span></IconButton>}</label>
      <IconButton label={t("关闭搜索")} type="button" className="icon-button chat-search-close" onClick={onClose}><IconCloseOutline16 size={24}/></IconButton>
    </form>
  </main>;
}
