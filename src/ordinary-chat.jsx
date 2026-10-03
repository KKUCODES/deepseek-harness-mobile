import React, { useEffect, useRef, useState } from 'react';
import { OrdinaryHistory, completionMessages } from './ordinary-history.mjs';
import { ordinaryNative } from './ordinary-native.mjs';
import { OrdinaryTurn } from './ordinary-stream.mjs';
import { OrdinaryComposer } from './ordinary-composer.jsx';

const statusLabels = { sending: '等待回复', streaming: '正在回复', completed: '已完成', failed: '失败', interrupted: '已中断' };
const errorLabels = { key_missing: '请先配置 DeepSeek Key', http_401: 'Key 无效，请重新配置', http_402: '账户余额不足',
  http_429: '请求过于频繁，请稍后手动重试', context_limit: '当前对话超出验证版上下文限制，请新建聊天',
  credential_unavailable: '本机凭据无法解密，请重新配置 Key', request_timeout: '连接超时，未自动重试',
  history_write_failed: '历史保存失败，已停止请求', app_restarted: 'App 重启，未自动重发', stopped: '已手动停止',
  stream_closed: '连接提前结束，已保留收到的内容' };

export function OrdinaryChat({ inputRuntime, renderSlot, SessionProvider }) {
  const [client] = useState(ordinaryNative);
  const [history] = useState(() => new OrdinaryHistory());
  const [chats, setChats] = useState([]);
  const [selected, setSelected] = useState('');
  const [draft, setDraft] = useState('');
  const [model, setModel] = useState('deepseek-flash');
  const [ready, setReady] = useState(false);
  const [configured, setConfigured] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [live, setLive] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const current = useRef(null);
  const busyRef = useRef(false);
  const alive = useRef(true);
  const draftWrites = useRef(Promise.resolve());
  const selectedChat = chats.find(chat => chat.id === selected);
  const report = failure => { if (alive.current) setError(errorLabels[failure.code ?? failure.message] ?? '操作失败，请重试'); };
  const refresh = async () => { const items = await history.list(); if (alive.current) setChats(items); return items; };

  useEffect(() => {
    alive.current = true;
    void (async () => {
      await history.open();
      await history.recover();
      let items = await refresh();
      if (!items.length) { await history.create(); items = await refresh(); }
      if (!alive.current) return;
      setSelected(items[0].id); setDraft(items[0].draft); setReady(true);
      if (client.available) setConfigured((await client.status()).configured);
    })().catch(report);
    return () => { alive.current = false; current.current?.dispose(); };
  }, [history, client]);

  const editDraft = text => {
    setDraft(text);
    const id = selected;
    draftWrites.current = draftWrites.current.then(() => history.update(id, chat => { chat.draft = text; }));
    // 不吞掉保存失败：发送前仍会 await 此队列并拒绝联网。
    void draftWrites.current.catch(report);
  };
  const choose = async id => {
    if (busyRef.current) return;
    try {
      await draftWrites.current;
      const items = await refresh();
      setSelected(id); setDraft(items.find(chat => chat.id === id)?.draft ?? ''); setLive(null); setError(''); setConfirmDelete(false);
    } catch (failure) { report(failure); }
  };
  const newChat = async () => {
    if (busyRef.current) return;
    try { await draftWrites.current; const chat = await history.create(); await refresh(); setSelected(chat.id); setDraft(''); setLive(null); setConfirmDelete(false); }
    catch (failure) { report(failure); }
  };
  const remove = async () => {
    if (busyRef.current) return;
    try {
      await draftWrites.current; await history.delete(selected);
      let items = await refresh();
      if (!items.length) { await history.create(); items = await refresh(); }
      setSelected(items[0].id); setDraft(items[0].draft); setLive(null); setConfirmDelete(false);
    } catch (failure) { report(failure); }
  };
  const configure = async () => {
    try { setConfigured((await client.configure()).configured); setError(''); } catch (failure) { report(failure); }
  };
  const send = async () => {
    if (busyRef.current || !draft.trim() || !selectedChat || !configured) return;
    busyRef.current = true; setBusy(true); setError('');
    const id = selected;
    const prompt = draft.trim();
    const requestId = crypto.randomUUID();
    let unsubscribe;
    let writes = Promise.resolve();
    let writeFailure;
    try {
      await draftWrites.current;
      const chat = (await history.list()).find(item => item.id === id);
      const messages = completionMessages(chat, prompt);
      await history.update(id, item => {
        item.draft = '';
        if (!item.turns.length) item.title = prompt.slice(0, 40);
        item.turns.push({ requestId, prompt, model, status: 'sending', content: '', reasoning: '', error: null });
      });
      setDraft(''); await refresh();
      const turn = new OrdinaryTurn({ mode: 'ordinary', chatId: id, requestId });
      current.current = turn;
      unsubscribe = turn.subscribe(() => {
        const snapshot = turn.getSnapshot();
        if (alive.current) setLive(snapshot);
        if (writeFailure) return;
        writes = writes.then(() => history.update(id, item => {
          const stored = item.turns.find(entry => entry.requestId === requestId);
          if (!stored) throw new Error('ordinary_turn_missing');
          Object.assign(stored, snapshot);
        })).catch(failure => { writeFailure = failure; turn.stop(); report(failure); });
      });
      await turn.run(signal => client.open({ requestId, model, messages }, signal));
      await writes;
      if (writeFailure) report(writeFailure);
    } catch (failure) { report(failure); }
    finally {
      unsubscribe?.(); current.current?.dispose(); current.current = null;
      busyRef.current = false;
      if (alive.current) { setBusy(false); await refresh().catch(report); setLive(null); }
    }
  };

  return <section data-testid="ordinary-chat"><h2>普通聊天</h2>
    <p>手机直连 DeepSeek，历史只保存在本机。此处发送会调用真实 API。</p>
    <p data-testid="ordinary-key-state">{client.available ? (configured ? 'Key 已配置' : '尚未配置 Key') : '请在安卓验证 App 中配置 Key；浏览器仅可查看本地历史。'}</p>
    <button onClick={configure} disabled={!client.available || busy} data-testid="ordinary-key">配置 / 移除 Key</button>
    <button onClick={() => void client.call('remote.open').catch(report)} disabled={!client.available || busy} data-testid="remote-open">进入 Remote 验证</button>
    {error && <p role="alert" data-testid="ordinary-error">{error}</p>}
    {!ready ? <p>正在读取本地历史…</p> : <>
      <div className="ordinary-actions">
        <select aria-label="普通聊天历史" value={selected} onChange={event => void choose(event.target.value)} disabled={busy}>
          {chats.map(chat => <option key={chat.id} value={chat.id}>{chat.title}</option>)}
        </select>
        <button onClick={newChat} disabled={busy} data-testid="ordinary-new">新聊天</button>
        <button onClick={() => setConfirmDelete(true)} disabled={busy}>删除当前聊天</button>
      </div>
      {confirmDelete && <p>删除当前聊天及其本地历史？ <button onClick={remove} disabled={busy}>确认删除</button> <button onClick={() => setConfirmDelete(false)}>保留</button></p>}
      <div className="ordinary-messages" data-testid="ordinary-messages" aria-live="off">
        {selectedChat?.turns.map(stored => {
          const turn = live?.requestId === stored.requestId ? { ...stored, ...live } : stored;
          return <article key={turn.requestId}><h3>你</h3><p className="ordinary-text">{turn.prompt}</p>
            <h3>DeepSeek <small>{statusLabels[turn.status]}</small></h3>
            {turn.reasoning && <details><summary>思考过程</summary><p className="ordinary-text">{turn.reasoning}</p></details>}
            <p className="ordinary-text">{turn.content}</p>
            {turn.error && <p role="status">{errorLabels[turn.error] ?? `请求状态：${turn.error}`}</p>}
          </article>;
        })}
      </div>
      <label>模型 <select value={model} onChange={event => setModel(event.target.value)} disabled={busy}>
        <option value="deepseek-flash">deepseek-flash</option><option value="deepseek-v4-pro">deepseek-v4-pro</option>
      </select></label>
      <OrdinaryComposer key={selected} chatId={selected} draft={draft} editDraft={editDraft} busy={busy}
        runtime={inputRuntime} renderSlot={renderSlot} SessionProvider={SessionProvider} />
      <div className="ordinary-actions">
        <button onClick={send} disabled={busy || !configured || !draft.trim()} data-testid="ordinary-send">发送</button>
        <button onClick={() => current.current?.stop()} disabled={!busy} data-testid="ordinary-stop">停止</button>
      </div>
    </>}
  </section>;
}
