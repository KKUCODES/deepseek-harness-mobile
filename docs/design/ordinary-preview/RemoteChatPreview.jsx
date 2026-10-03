import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@upstream/ui-primitives/src/Button.tsx';
import { TerminalBlock } from '@upstream/ui-primitives/src/TerminalBlock.tsx';
import { highlightLines } from '@upstream/ui-primitives/src/markdown/highlight.ts';
import { IconCloseOutline16, IconChevronDownOutline14, IconThinkOutline14, IconCopyOutline16, IconFolderOpenOutline16 } from '@upstream/ui-primitives/src/icons/index.tsx';
import messageStyle from '@upstream/ui-chat/src/client/chat/MessageItem.module.css';
import { diffLines } from 'diff';
import { PreviewComposer } from './PreviewComposer.jsx';
import { demoModels, fileExample, phaseLabel } from './remote-chat-demo.mjs';
import './remote-chat.css';
import { FullscreenIcon } from '../../../src/ui/FullscreenIcon.jsx';
import '@upstream/ui-theme/src/styles/shiki.css';

const terminalLabels = { signal: s => `信号 ${s}`, exitCode: n => `退出码 ${n}`, noExitCode: '退出状态未知', running: '运行中', failed: '执行失败', done: '已完成', copy: '复制输出', copied: '已复制', noOutput: '命令没有输出', collapseAria: '收起输出', collapse: '收起', expandAria: n => `展开 ${n} 行输出`, expand: n => `展开 ${n} 行` };
const approvalText = { approved: '已批准本次修改', rejected: '已拒绝，任务已停止', handled: '已在电脑端处理，无需重复操作', canceled: '任务已停止，本次请求已取消' };

function SourceLines({ code, kind = 'context' }) {
  const lines = useMemo(() => highlightLines(code.trimEnd(), 'typescript'), [code]);
  return <div className={`source-lines ${kind}`}><span className="diff-sign" aria-label={kind === 'added' ? '新增' : kind === 'removed' ? '删除' : '未修改'}>{kind === 'added' ? '+' : kind === 'removed' ? '−' : ' '}</span><pre>{lines ? lines.map((line, i) => <React.Fragment key={i}>{i > 0 && '\n'}{line.map((span, j) => <span key={j} style={span.style}>{span.text}</span>)}</React.Fragment>) : code}</pre></div>;
}

export function RemoteChatPreview({ task, session: s, dispatch, online, workspaceName, Surface, IconButton, positions, onOtherTask, otherTask, onConnection, onNotice }) {
  const [sheet, setSheet] = useState(null);
  const [full, setFull] = useState(false);
  const [fileState, setFileState] = useState('ready');
  const [fileTab, setFileTab] = useState('diff');
  const [terminalState, setTerminalState] = useState('done');
  const [terminalLines, setTerminalLines] = useState(1);
  const [banner, setBanner] = useState(false);
  const [unread, setUnread] = useState(false);
  const scroller = useRef(null);
  const nearBottom = useRef(false);
  const previousReply = useRef(s.reply);
  const historyAnchor = useRef(null);
  const fileTimer = useRef(null);
  const historyTimer = useRef(null);
  const busy = ['running', 'sending', 'accepted', 'queued', 'approval', 'question'].includes(s.phase);
  const emit = action => dispatch({ ...action, online });
  const changeFileState = value => { clearTimeout(fileTimer.current); setFileState(value); };
  const close = () => { clearTimeout(fileTimer.current); setSheet(null); setFull(false); };
  const disabled = !online || s.phase === 'unknown' || ['selecting', 'unknown'].includes(s.modelStatus);
  const atEnd = () => { const node = scroller.current; if (node) { node.scrollTop = node.scrollHeight; nearBottom.current = true; setUnread(false); } };

  useEffect(() => () => { clearTimeout(fileTimer.current); clearTimeout(historyTimer.current); }, []);
  useEffect(() => {
    if (!online) { clearTimeout(historyTimer.current); if (s.history === 'loading') dispatch({ type: 'history-error' }); }
  }, [online, s.history]);
  useLayoutEffect(() => {
    scroller.current.scrollTop = positions.current[task.id] ?? 0;
    nearBottom.current = scroller.current.scrollHeight - scroller.current.scrollTop - scroller.current.clientHeight < 70;
  }, [task.id]);
  useLayoutEffect(() => {
    const node = scroller.current;
    if (historyAnchor.current && s.history === 'complete') {
      node.scrollTop = historyAnchor.current.top + node.scrollHeight - historyAnchor.current.height;
      historyAnchor.current = null;
    } else if (s.reply !== previousReply.current) {
      if (nearBottom.current && s.reply) node.scrollTop = node.scrollHeight;
      else if (s.reply) setUnread(true);
    }
    previousReply.current = s.reply;
  }, [s.reply, s.messages.length, s.history]);
  useEffect(() => {
    if (terminalState !== 'running' || !online) return;
    const id = setInterval(() => setTerminalLines(n => n + 1), 900);
    return () => clearInterval(id);
  }, [terminalState, online]);
  function loadHistory() {
    if (!online) return;
    historyAnchor.current = { top: scroller.current.scrollTop, height: scroller.current.scrollHeight };
    emit({ type: 'history-loading' });
    clearTimeout(historyTimer.current);
    historyTimer.current = setTimeout(() => dispatch({ type: 'history-ready' }), 700);
  }
  function readFile() {
    changeFileState('loading');
    fileTimer.current = setTimeout(() => setFileState('ready'), 700);
  }
  function openFile() { readFile(); setFileTab('diff'); setSheet('file'); }
  const canDownload = online && ['ready', 'download-error'].includes(fileState);
  function download(event) {
    if (!canDownload || fileState === 'download-error') {
      event.preventDefault();
      if (fileState === 'download-error') onNotice('下载失败，请重试；没有生成替代文件');
    } else onNotice('已发起下载：示例最新完整文件');
  }
  function scene(name) {
    close();
    if (name === 'offline') { onConnection('offline'); return; }
    if (name === 'notify') { setBanner(true); return; }
    if (name === 'handled') { emit({ type: 'handled' }); emit({ type: 'question-handled' }); return; }
    if (name === 'history-error') { clearTimeout(historyTimer.current); emit({ type: 'history-error' }); scroller.current.scrollTop = 0; return; }
    if (name === 'unknown-next') { emit({ type: 'scene', patch: { fault: 'unknown', phase: 'done' } }); onNotice('下次续聊演示发送结果未知'); return; }
    if (name === 'approval') emit({ type: 'scene', patch: { phase: 'approval', approval: 'pending' } });
    else if (name === 'question') emit({ type: 'scene', patch: { phase: 'question', question: 'pending', answer: '' } });
    else emit({ type: 'scene', patch: { phase: name, reply: name === 'running' ? '' : s.reply } });
  }
  const showApproval = task.id === 'approval' || s.phase === 'approval' || s.approval !== 'pending';
  const showQuestion = task.id === 'question' || s.phase === 'question' || s.question !== 'pending';
  const modelLocked = !online || ['selecting', 'unknown'].includes(s.modelStatus);
  const terminalOutput = terminalState === 'empty' ? '' : terminalState === 'failed' ? 'Error: connection interrupted\nThe operation did not finish.' : terminalState === 'running' ? Array.from({ length: Math.min(terminalLines, 18) }, (_, i) => `检查 ${i + 1}：连接状态正常`).join('\n') : '\u001b[32m✓\u001b[0m 草稿恢复\n\u001b[32m✓\u001b[0m 页面无溢出\n\u001b[32m✓\u001b[0m 断线后不重复发送\n\n3 passed · 1.24s';
  return <>
    <div className="chat-context"><span>{workspaceName} · {phaseLabel[s.phase]}</span><Button onClick={() => setSheet('scenes')}>预览状态</Button></div>
    {banner && otherTask && <aside className="task-notice" aria-label="其他任务提醒"><span><strong>{otherTask.title}</strong><small>{otherTask.label} · 当前聊天已保留</small></span><Button onClick={() => { setBanner(false); onOtherTask(otherTask.id); }}>查看</Button><IconButton label="暂时忽略提醒" onClick={() => setBanner(false)}><IconCloseOutline16/></IconButton></aside>}
    <section ref={scroller} className="remote-chat-scroll" aria-label="远程聊天内容" onScroll={() => { const el = scroller.current; positions.current[task.id] = el.scrollTop; nearBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 70; if (nearBottom.current) setUnread(false); }}>
      <div className="sample-label">示例聊天 · 操作仅影响本预览</div>
      <div className="history-loader">{s.history === 'complete' ? <small className="muted">已显示全部消息</small> : <Button disabled={!online || s.history === 'loading'} onClick={loadHistory}>{s.history === 'loading' ? '正在加载历史…' : s.history === 'error' ? '历史读取失败，重试' : '加载更早消息'}</Button>}</div>
      <div className="remote-messages">{s.messages.map(m => m.role === 'user' ? <div key={m.id} className={messageStyle.userRow}><div className={messageStyle.userStack}><div className={messageStyle.bubble}>{m.text}{m.attachments?.map(name => <small className="message-attachment" key={name}>附件 · {name}</small>)}</div><small className="delivery-state">{m.delivery}</small></div></div> : <article className="reply" key={m.id}><div className="reply-text">{m.text}</div></article>)}
        <article className="reply"><details><summary><IconThinkOutline14/>思考过程<IconChevronDownOutline14/></summary><p className="thought">先检查已有布局与任务状态，保留输入草稿。读取工作区内容后，提出可核对的修改，再等待需要的确认。</p></details>
          <div className="tool-process"><div className="tool-row"><span className="process-check">✓</span><span>读取工作区上下文<small>3 个文件 · 已完成</small></span></div><button className="tool-row" onClick={openFile}><IconFolderOpenOutline16/><span>修改 src/composer.ts<small>+2 −2 · 查看本次差异</small></span><span>›</span></button><button className="tool-row" onClick={() => { setTerminalState(s.phase === 'failed' ? 'failed' : 'done'); setSheet('terminal'); }}><span className="command-symbol">›_</span><span>运行布局检查<small>node scripts/check-layout.mjs · 查看输出</small></span><span>›</span></button></div>
          {s.reply && <div className="reply-text">{s.reply}{s.phase === 'running' && <span className="stream-caret"/>}</div>}
          {['running', 'sending', 'accepted'].includes(s.phase) && <p className="run-status" role="status"><span className="loading-dot"/>{phaseLabel[s.phase]}{!online && ' · 更新已暂停'}</p>}
          {s.reply && <div className="reply-actions"><IconButton label="复制远程回复" onClick={async () => { try { await navigator.clipboard.writeText(s.reply); onNotice('已复制回复'); } catch { onNotice('复制失败，请选择文字复制'); } }}><IconCopyOutline16/></IconButton></div>}
        </article>
        {showApproval && <section className="request-card" aria-label="修改审批"><h3>允许修改这个文件吗？</h3><p>将输入区初始高度调整为 56，并保留草稿。仅批准本次修改。</p><Button className="inline-link" onClick={openFile}>查看 src/composer.ts 差异</Button>{s.approval === 'pending' && s.phase === 'approval' ? <div className="request-actions"><Button variant="outline" disabled={!online} onClick={() => emit({ type: 'reject' })}>拒绝</Button><Button variant="primary" className="action-primary" disabled={!online} onClick={() => emit({ type: 'approve' })}>批准本次修改</Button></div> : <p role="status">{approvalText[s.approval] || '本次请求已结束'}</p>}</section>}
        {showQuestion && <section className="request-card" aria-label="助手提问"><h3>按什么方式整理读书笔记？</h3><p>选择一种方式，或补充自己的想法。</p>{s.question === 'pending' && s.phase === 'question' ? <><div className="request-actions">{['按书籍', '按主题'].map(value => <Button key={value} variant="outline" disabled={!online} aria-pressed={s.answer === value} onClick={() => emit({ type: 'answer', value })}>{value}</Button>)}</div><textarea aria-label="回答助手问题" value={s.answer} disabled={!online} onChange={e => emit({ type: 'answer', value: e.target.value })} placeholder="也可以填写其他想法"/><Button variant="primary" className="action-primary" disabled={!online || !s.answer.trim()} onClick={() => emit({ type: 'submit-answer', id: crypto.randomUUID() })}>提交回答</Button></> : <p role="status">{s.question === 'handled' ? '已在电脑端回答，无需重复提交' : s.question === 'canceled' ? '任务已停止，问题已取消' : `已回答：${s.answer}`}</p>}</section>}
        {s.phase === 'failed' && <div className="request-card error-state" role="alert"><h3>任务执行失败</h3><p>连接中断，已产生的内容保留。查看命令详情后，可以描述下一步并发送。</p><Button onClick={() => { setTerminalState('failed'); setSheet('terminal'); }}>查看失败详情</Button></div>}
        {s.phase === 'unknown' && <div className="request-card" role="alert"><h3>暂未收到发送结果</h3><p>消息可能已被电脑接收。先核对状态，不自动重发。</p><Button disabled={!online} variant="outline" onClick={() => emit({ type: 'verify' })}>核对发送结果</Button></div>}
        {s.phase === 'queued' && <div className="request-card"><h3>任务排队中</h3><p>等待电脑开始处理。</p><Button disabled={!online} onClick={() => emit({ type: 'start-queued' })}>演示轮到此任务</Button></div>}
        {s.phase === 'stopped' && <p className="muted" role="status">任务已停止，已生成的内容保留。</p>}
      </div>
    </section>
    {unread && <Button className="latest-output" onClick={atEnd}>查看最新输出 ↓</Button>}
    {/* 防止输入框在按下与点击之间收起，移动队列/停止按钮导致点击丢失。 */}
    {(busy || s.queue.length > 0) && <div className="task-controls" onMouseDown={event => event.preventDefault()}><span>{busy ? phaseLabel[s.phase] : '当前轮次已结束'}{s.queue.length > 0 && ` · ${s.queue.length} 条排队消息`}</span><div>{s.queue.length > 0 && <Button onClick={() => setSheet('queue')}>查看队列</Button>}{busy && <Button disabled={!online} onClick={() => emit({ type: 'stop' })}>停止任务</Button>}</div></div>}
    {s.attachments.length > 0 && <div className="attachment-chips" onMouseDown={event => event.preventDefault()}>{s.attachments.map(name => <Button key={name} aria-label={`移除附件 ${name}`} onClick={() => emit({ type: 'remove-attachment', name })}>{name} ×</Button>)}</div>}
    <div className="remote-model-summary"><Button aria-label={`切换会话模型，当前 ${s.model.name}`} onClick={() => setSheet('models')}>{s.model.name}<IconChevronDownOutline14/></Button><span>{!online ? '离线 · 上次模型' : s.modelStatus === 'selecting' ? '切换中…' : s.modelStatus === 'unknown' ? '待核对' : ''}</span></div>
    {s.modelError && <div className="model-error" role="status">{s.modelError}<Button onClick={() => setSheet('models')}>查看</Button></div>}
    <PreviewComposer value={s.draft} onChange={value => emit({ type: 'draft', value })} onSend={() => { nearBottom.current = true; emit({ type: 'send', id: crypto.randomUUID() }); requestAnimationFrame(atEnd); }} onAttach={() => setSheet('attachments')} IconButton={IconButton} label="远程消息" placeholder={online ? busy ? '补充消息，加入队列' : '继续这个任务' : '离线，可先写草稿'} sendLabel={busy ? '加入队列' : '发送远程消息'} disabled={disabled} keepExpanded={sheet === 'attachments' || sheet === 'models'} toolbar={focused => <Button className="model" tabIndex={focused ? 0 : -1} aria-hidden={!focused} aria-label={`切换会话模型，当前 ${s.model.name}`} onClick={() => setSheet('models')}><span>{s.model.name}</span><IconChevronDownOutline14/></Button>}/>
    {sheet && <Surface title={sheet === 'file' ? '文件详情' : sheet === 'terminal' ? '命令详情' : sheet === 'attachments' ? '附件' : sheet === 'queue' ? '消息队列' : sheet === 'models' ? '会话模型' : '聊天预览状态'} className={`${['file', 'terminal'].includes(sheet) ? 'detail-sheet' : ''} ${full ? 'is-fullscreen' : ''}`} onClose={close}>
      <div className="sheet-handle"/><header><h2>{sheet === 'file' ? 'composer.ts' : sheet === 'terminal' ? '命令详情' : sheet === 'attachments' ? '附件' : sheet === 'queue' ? '消息队列' : sheet === 'models' ? '会话模型' : '聊天预览状态'}</h2><div className="detail-header-actions">{sheet === 'file' && <a className="icon-button download-file" aria-label="下载最新完整文件" aria-disabled={!canDownload} href={canDownload ? "./composer.latest.example.ts" : undefined} download="composer.latest.example.ts" onClick={download}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5"/></svg></a>}{['file', 'terminal'].includes(sheet) && <IconButton label={full ? '缩小窗口' : '放大窗口'} onClick={() => setFull(v => !v)}><FullscreenIcon expanded={full}/></IconButton>}<IconButton label="关闭窗口" onClick={close}><IconCloseOutline16/></IconButton></div></header>
      <div className="detail-body">
      {sheet === 'file' ? <><p className="preview-note">下载将获取最新完整文件，可能包含本次修改后的更新。</p><div className="detail-tabs"><Button aria-pressed={fileTab === 'diff'} onClick={() => setFileTab('diff')}>本次修改</Button><Button aria-pressed={fileTab === 'latest'} onClick={() => setFileTab('latest')}>最新完整文件</Button></div>{!online && <p className="remote-error" role="alert">电脑离线，当前仅保留已读差异，无法读取或下载最新文件。</p>}
        {fileState === 'loading' ? <p role="status">正在读取文件…</p> : fileState === 'deleted' ? <p role="alert">文件已删除，无法下载最新文件。</p> : fileState === 'error' ? <div role="alert"><p>文件读取失败，未使用旧版本替代。</p><Button disabled={!online} onClick={readFile}>重新读取文件</Button></div> : fileTab === 'latest' && !online ? <p>重新连接后获取最新内容。</p> : <div className="code-scroll" aria-label={fileTab === 'diff' ? '代码差异' : '最新完整文件内容'}>{fileTab === 'latest' ? <SourceLines code={fileExample.latest}/> : diffLines(fileExample.before, fileExample.after).map((part, i) => <SourceLines key={i} code={part.value} kind={part.added ? 'added' : part.removed ? 'removed' : 'context'}/>)}</div>}
        {fileState === 'download-error' && <div role="alert"><p className="remote-error">下载失败，未生成文件。</p><Button onClick={() => changeFileState('ready')}>恢复下载后重试</Button></div>}
        <details className="detail-demo"><summary>文件预览状态</summary><div className="scenario-grid">{[['loading','加载中'],['ready','正常文件'],['deleted','文件已删除'],['error','读取失败'],['download-error','下载失败']].map(([value,label]) => <Button key={value} onClick={() => changeFileState(value)}>{label}</Button>)}</div></details></>
      : sheet === 'terminal' ? <><p className="preview-note">命令输出 · 只读</p><dl className="command-meta"><dt>工作区目录</dt><dd>Q:\Projects\dsh-mobile</dd><dt>耗时</dt><dd>{terminalState === 'running' ? `${terminalLines} 秒（更新中）` : '1.24 秒'}</dd><dt>摘要</dt><dd>{terminalState === 'failed' ? '执行中断，检查未完成' : terminalState === 'running' ? '正在检查页面布局' : terminalState === 'empty' ? '命令完成，无输出' : '3 项检查通过'}</dd></dl>{!online && <p role="status">离线：显示上次输出，实时更新已暂停。</p>}{terminalState === 'loading' ? <p role="status">正在读取输出…</p> : terminalState === 'error' ? <div role="alert"><p>输出读取失败。</p><Button disabled={!online} onClick={() => setTerminalState('done')}>重新读取输出</Button></div> : <TerminalBlock command="node scripts/check-layout.mjs" cwd="Q:\Projects\dsh-mobile" output={terminalOutput} exitCode={terminalState === 'failed' ? 1 : 0} running={terminalState === 'running'} labels={terminalLabels}/>}
        <details className="detail-demo"><summary>命令预览状态</summary><div className="scenario-grid">{[['loading','加载中'],['done','已完成'],['running','持续输出'],['empty','空输出'],['error','读取失败'],['failed','执行失败']].map(([value,label]) => <Button key={value} onClick={() => { setTerminalLines(1); setTerminalState(value); }}>{label}</Button>)}</div></details></>
      : sheet === 'models' ? <><p>切换模型会同步到电脑上的这条聊天，从下一次回复开始生效。</p><div className="device-card"><strong>当前模型：{s.model.name}</strong><span>电脑上的当前模型：{s.model.name}</span><small>{s.modelStatus === 'selecting' ? `正在切换到 ${s.modelPending.name}…` : `最近更新来自：${s.modelSource}`}</small></div>{!online && <p role="status">电脑离线，显示上次模型，暂时无法切换。</p>}{s.modelError && <p className="remote-error" role="alert">{s.modelError}</p>}{s.modelStatus === 'unknown' && <Button variant="outline" disabled={!online} onClick={() => emit({ type: 'model-refresh' })}>核对电脑当前模型</Button>}{demoModels.map(model => <Button key={model.id} className="option" disabled={modelLocked} aria-pressed={s.model.id === model.id} onClick={() => emit({ type: 'model-select', id: model.id })}>{model.name}<span>{s.model.id === model.id ? '当前模型' : s.modelPending?.id === model.id ? s.modelStatus === 'unknown' ? '待核对' : '切换中…' : ''}</span></Button>)}<details className="detail-demo"><summary>模型同步演示</summary><Button className="option" disabled={!online} onClick={() => emit({ type: 'model-host-change', id: demoModels.find(model => model.id !== s.model.id).id })}>演示电脑端切换模型</Button><Button className="option" disabled={!online} onClick={() => { emit({ type: 'scene', patch: { modelFailNext: true } }); onNotice('下次切换演示失败，原模型保留'); }}>下次切换失败</Button><Button className="option" disabled={!online} onClick={() => { if (s.modelStatus !== 'selecting') emit({ type: 'model-select', id: demoModels.find(model => model.id !== s.model.id).id }); onConnection('offline'); }}>演示切换时断线</Button></details></>
      : sheet === 'attachments' ? <><p className="muted">选择要添加的照片或文件。</p><div className="attachment-options"><Button variant="outline" onClick={() => { emit({ type: 'attach', name: '布局参考.example.png' }); close(); }}>从相册选择</Button><Button variant="outline" onClick={() => { emit({ type: 'attach', name: '需求.example.txt' }); close(); }}>选择文件</Button></div></>
      : sheet === 'queue' ? <><p className="muted">当前回复结束后，可继续处理排队消息。</p>{s.queue.length === 0 ? <p>暂无排队消息。</p> : s.queue.map(m => <div className="queue-item" key={m.id}><p>{m.text}</p><Button disabled={!online} onClick={() => emit({ type: 'cancel-queue', id: m.id })}>取消排队</Button></div>)}<Button disabled={!online || busy || s.phase === 'unknown' || !s.queue.length} onClick={() => { emit({ type: 'next' }); close(); }}>演示处理下一条</Button></>
      : <><p className="muted">仅改变当前示例。所有输出、审批、文件及命令均非真实电脑操作。</p><div className="scenario-grid">{[['running','实时输出'],['approval','等待批准'],['question','等待回答'],['handled','电脑端已处理'],['queued','任务排队'],['failed','执行失败'],['done','已完成'],['history-error','历史读取失败'],['unknown-next','下次发送结果未知'],['offline','使用中断线'],['notify','其他任务提醒']].map(([value,label]) => <Button key={value} variant="outline" onClick={() => scene(value)}>{label}</Button>)}</div></>}
      </div>
    </Surface>}
  </>;
}
