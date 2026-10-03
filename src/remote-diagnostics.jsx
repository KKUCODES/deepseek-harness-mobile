import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { RemoteClient } from './remote-client.mjs';
import { pairingServerOf } from './remote-pair-link.mjs';
import './validation.css';

const client = new RemoteClient();
function RemotePage() {
  const [binding, setBinding] = useState({ paired: false });
  const [link, setLink] = useState('');
  const [name, setName] = useState('DSHM Android 验证');
  const [state, setState] = useState('未连接');
  const [online, setOnline] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [sessions, setSessions] = useState([]);
  const [selected, setSelected] = useState('');
  const [records, setRecords] = useState([]);
  const [live, setLive] = useState(null);
  const [draft, setDraft] = useState('');
  const [confirmForget, setConfirmForget] = useState(false);
  const follow = useRef(null);
  const generation = useRef(0);
  const report = failure => setError(failure.message);
  const action = async run => { setBusy(true); setError(''); try { await run(); } catch (failure) { report(failure); } finally { setBusy(false); } };
  const clearSession = () => { generation.current++; follow.current?.cancel(); follow.current = null; setRecords([]); setLive(null); setSelected(''); setDraft(''); };
  const draftKey = id => `dshm.remote.draft:${binding.deviceId}:${id}`;
  useEffect(() => {
    void client.call('binding.info').then(setBinding).catch(report);
    return client.subscribe(frame => {
      if (frame.type === 'ready') { setState('已连接'); setOnline(frame.hostOnline); }
      if (frame.type === 'closed') { setState('已断开'); setOnline(false); clearSession(); setSessions([]); }
    });
  }, []);
  const list = async () => {
    const result = await client.request({ method: 'session.list' }).promise;
    if (!Array.isArray(result?.items)) throw new Error('invalid_session_list');
    setSessions(result.items);
  };
  const choose = id => {
    clearSession(); setSelected(id); setDraft(localStorage.getItem(draftKey(id)) ?? '');
    const owner = generation.current;
    const current = client.request({ method: 'session.follow', address: { kind: 'session', sessionId: id }, maxMessages: 30 }, value => {
      if (owner !== generation.current) return;
      if (value.type === 'snapshot') { setRecords(value.records); setLive(value.assistantStream ?? null); }
      else if (value.type === 'event') setRecords(previous => [...previous.filter(item => item.event.seq !== value.event.seq), value]);
      else if (value.type === 'assistant-stream') setLive(value.frame);
    }, () => { if (owner === generation.current) setState('订阅已结束，请重新连接'); });
    follow.current = current;
    void current.promise.catch(failure => { if (owner === generation.current) report(failure); });
  };
  const send = async () => {
    const requestId = crypto.randomUUID();
    const target = selected; const text = draft;
    // 不自动重试写操作；结果未知时保留草稿与 requestId，供核对远端记录。
    setError('');
    try {
      await client.request({ method: 'session.prompt', sessionId: target, requestId, mode: 'queue', text }).promise;
      localStorage.removeItem(draftKey(target)); setDraft('');
    } catch (failure) { throw new Error(`${failure.message}；请核对远端记录后再决定是否重发。请求：${requestId}`); }
  };
  return <main className="validation" data-testid="remote-page">
    <h1>Remote 技术验证</h1><p>通过已绑定电脑查看并继续 DSH 会话。此页不提供普通聊天 Key。</p>
    <button onClick={() => void action(() => client.call('ordinary.open'))} data-testid="ordinary-open">返回普通聊天</button>
    <p role="status" data-testid="remote-state">{state}</p>
    {error && <p role="alert" data-testid="remote-error">{error}</p>}
    {!binding.paired ? <section>
      <label>一次性配对链接 <textarea aria-label="一次性配对链接" value={link} onChange={event => setLink(event.target.value)} /></label>
      <label>设备名称 <input aria-label="设备名称" value={name} maxLength={80} onChange={event => setName(event.target.value)} /></label>
      {pairingServerOf(link)?.startsWith('http:') && <p>HTTP 连接不安全，连接未加密；建议使用 HTTPS。</p>}
      <button disabled={busy || !link || !name.trim()} data-testid="remote-pair" onClick={() => void action(async () => {
        const submitted = link; setLink('');
        const info = await client.call('binding.claim', { link: submitted, name });
        setBinding(info); setState('等待电脑批准');
      })}>领取配对</button>
    </section> : <section>
      <p>{binding.origin}</p><p>设备公钥指纹：<code data-testid="remote-fingerprint">{binding.fingerprint}</code></p>
      {binding.origin.startsWith('http:') && <p>HTTP 连接不安全，凭据及聊天内容未加密。</p>}
      <button disabled={busy} data-testid="remote-status" onClick={() => void action(async () => {
        const info = await client.call('binding.status'); setState(info.status === 'active' ? '已批准，尚未连接' : info.status);
      })}>检查批准状态</button>
      <button disabled={busy} data-testid="remote-connect" onClick={() => void action(async () => {
        await client.disconnect(); setState('连接中');
        try { await client.call('socket.connect'); } catch (failure) { setState('连接失败'); throw failure; }
      })}>连接 / 重新连接</button>
      <button disabled={busy} onClick={() => void action(() => client.disconnect())}>断开连接</button>
      <button disabled={busy} onClick={() => setConfirmForget(true)}>移除本机绑定</button>
      {confirmForget && <p>本机凭据将删除；电脑上的设备记录需在电脑端撤销。
        <button onClick={() => void action(async () => { await client.disconnect(); await client.call('binding.forget'); setBinding({ paired: false }); setConfirmForget(false); })}>确认移除</button>
        <button onClick={() => setConfirmForget(false)}>保留绑定</button></p>}
    </section>}
    {state === '已连接' && <section>
      <p>{online ? '电脑在线' : '电脑离线'}</p>
      <button disabled={busy || !online} onClick={() => void action(list)} data-testid="remote-list">读取任务列表</button>
      <select aria-label="远端会话" value={selected} disabled={busy} onChange={event => void action(() => choose(event.target.value))}>
        <option value="" disabled>选择已有会话</option>
        {sessions.map(item => <option key={item.sessionId} value={item.sessionId}>{item.projections?.values?.title ?? item.sessionId}</option>)}
      </select>
      {selected && <>
        <div data-testid="remote-records" className="ordinary-messages">
          {records.filter(record => ['user/message', 'assistant/message'].includes(record.event?.type)).map(record => <article key={record.event.seq}>
            <h3>{record.event.type === 'user/message' ? '你' : 'DSH'}</h3>
            <pre>{JSON.stringify(record.event.data.message?.content ?? record.event.data.content ?? record.event.data, null, 2)}</pre>
          </article>)}
        </div>
        <details><summary>当前协议事件（技术验证）</summary><pre>{JSON.stringify(live, null, 2)}</pre></details>
        <textarea aria-label="远端聊天消息" value={draft} maxLength={64000} disabled={busy}
          onChange={event => { setDraft(event.target.value); localStorage.setItem(draftKey(selected), event.target.value); }} />
        <button data-testid="remote-send" disabled={busy || !draft.trim()} onClick={() => void action(send)}>发送到电脑</button>
        <button disabled={busy} onClick={() => void action(() => client.request({ method: 'session.cancel', sessionId: selected }).promise)}>停止电脑当前任务</button>
      </>}
    </section>}
    <p>这里只验证当前协议与模式隔离；完整消息渲染、历史翻页、Remote 插件加载和正式 UI 仍待实现。</p>
  </main>;
}
createRoot(document.getElementById('app')).render(<RemotePage />);
