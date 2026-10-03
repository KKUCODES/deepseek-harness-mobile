import React, { useEffect, useState } from 'react';
import { Button } from '@upstream/ui-primitives/src/Button.tsx';
import { useTranslate } from './locale.jsx';
import { insertReference, loadReferenceCandidates } from '../remote-references.mjs';

export function RemoteReferencePicker({ model, sessionId, connected, onPick }) {
  const t = useTranslate();
  const [query, setQuery] = useState('');
  const [attempt, retry] = useState(0);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const generation = model.connection.generation.getSnapshot()?.id;
  useEffect(() => {
    const controller = new AbortController();
    setResult(null); setError('');
    if (!connected) return () => controller.abort();
    const timer = setTimeout(() => {
      void loadReferenceCandidates(model, sessionId, query, controller.signal).then(groups => {
        if (!controller.signal.aborted) setResult({ query, generation, groups });
      }).catch(() => {}); // 取消由卸载、换会话、输入变化或断线触发；各来源的失败在分组中展示。
    }, 180);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [model, sessionId, connected, query, generation, attempt]);
  const current = connected && result?.query === query && result.generation === generation ? result : null;
  return <section className="remote-skills">
    <input className="sheet-editor" type="search" aria-label={t('搜索文件或聊天')} placeholder={t('搜索文件或聊天')}
      value={query} maxLength={4096} onChange={event => setQuery(event.target.value)} autoFocus/>
    <p className="muted">{t('选择后加入消息，发送时由电脑读取引用。')}</p>
    {error && <p role="alert">{t(error)}</p>}
    {!connected ? <p role="status">{t('电脑连接已断开')}</p> : !current ? <p role="status">{t('正在搜索引用…')}</p> : <>
      {current.groups.map(group => <section key={group.kind}>
        <h3>{t(group.kind === 'files' ? '文件' : '聊天')}</h3>
        {group.unavailable ? <p className="muted">{t('电脑暂不支持此类引用。')}</p>
          : group.error ? <p role="alert">{t('读取失败，请重试。')}</p>
            : !group.items.length ? <p className="muted">{t('没有找到匹配的内容')}</p> : group.items.map(item =>
              <Button className="option remote-skill-pick" key={`${item.kind}:${item.path ?? item.sessionId}`}
                aria-label={t(item.kind === 'directory' ? '打开目录 {name}' : '引用 {name}', { name: item.title })}
                onClick={() => {
                  if (item.kind === 'directory') { setQuery(`${item.path}/`); return; }
                  try {
                    void insertReference(model, sessionId, item, current.generation);
                    onPick();
                  } catch (failure) { setError(failure.message); }
                }}><strong>{item.title}{item.kind === 'directory' ? '/' : ''}</strong>{item.detail && <span>{item.detail}</span>}</Button>)}
      </section>)}
      <Button onClick={() => retry(value => value + 1)}>{t('重新读取')}</Button>
    </>}
  </section>;
}
