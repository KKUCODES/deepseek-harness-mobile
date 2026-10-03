import React, { useEffect, useMemo, useRef, useState } from 'react';
import { TerminalBlock } from '@upstream/ui-primitives/src/TerminalBlock.tsx';
import { parseAnsiLines } from '@upstream/ui-primitives/src/ansi.ts';
import { writeClipboard } from '../ordinary-clipboard.mjs';
import { Button } from '@upstream/ui-primitives/src/Button.tsx';
import { IconCloseOutline16 } from '@upstream/ui-primitives/src/icons/index.tsx';
import { commandDetails, commandOutputTarget } from '../remote-commands.mjs';
import { RemoteCommandOutput } from './RemoteCommandOutput.jsx';
import { Surface, IconButton } from './Surface.jsx';
import { FullscreenIcon } from './FullscreenIcon.jsx';
import { RemoteOfflineStatus } from './RemoteOfflineStatus.jsx';

import { useTranslate } from './locale.jsx';

export function RemoteCommand({ model, target, tool, sessionCwd, onClose }) {
  const t = useTranslate();
  const labels = { signal: signal => t('终止信号 {signal}', { signal }), exitCode: code => t('退出码 {code}', { code }), noExitCode: t('未提供退出码'),
    running: t('执行中'), failed: t('执行失败'), done: t('调用已结束'), copy: t('复制输出'), copied: t('已复制'), noOutput: t('没有输出'),
    collapseAria: t('收起输出'), collapse: t('收起'), expandAria: count => t('展开 {count} 行输出', { count }), expand: count => t('展开 {count} 行', { count }) };
  const [resume] = useState(() => model?.commandResume?.target === target ? model.commandResume : undefined);
  const retained = useRef(resume?.output), body = useRef(null);
  const detail = commandDetails(tool, sessionCwd);
  const identity = model && commandOutputTarget(model.getSnapshot(), target);
  const outputTarget = useMemo(() => identity, [model, target, identity?.rootCallId, identity?.rootCallTime]);
  const supportsLive = !!outputTarget && detail?.foreground && !!model.transport.capabilities?.commandOutputGeneration;
  const [liveOutput, setLiveOutput] = useState(resume?.liveOutput ?? true);
  const [full, setFull] = useState(resume?.full ?? false), [now, setNow] = useState(Date.now), [copyState, setCopyState] = useState('');
  useEffect(() => {
    if (body.current && resume) body.current.scrollTop = resume.scrollTop ?? 0;
  }, []);
  useEffect(() => {
    if (!model) return;
    model.commandResume = undefined;
    const capture = () => ({ target, liveOutput, full, scrollTop: body.current?.scrollTop ?? 0,
      output: retained.capture?.() ?? retained.current });
    model.captureCommand = capture;
    return () => { if (model.captureCommand === capture) delete model.captureCommand; };
  }, [model, target, liveOutput, full]);
  const lines = useMemo(() => parseAnsiLines(detail?.output ?? ''), [detail?.output]);
  useEffect(() => {
    if (!detail?.running) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [detail?.running]);
  useEffect(() => { setCopyState(''); }, [tool]);
  const seconds = detail?.start === null || !detail ? null : Math.max(0, ((detail.end ?? now) - detail.start) / 1000).toFixed(1);
  return <Surface title={t('命令详情')} onClose={onClose} className={`remote-file-preview remote-command-preview${full ? ' is-fullscreen' : ''}`}>
    <header><h2>{t('命令详情')}</h2><div className="remote-file-header-actions">
      <IconButton label={t(full ? '缩小窗口' : '放大窗口')} onClick={() => setFull(value => !value)}><FullscreenIcon expanded={full}/></IconButton>
      <IconButton label={t('关闭命令详情')} onClick={onClose}><IconCloseOutline16/></IconButton></div></header>
    {!detail ? <p role="status">{t('当前聊天中没有这条命令记录。')}</p> : <>
      <div className="remote-file-preview-actions"><span role="status">{t(detail.status)}</span>{seconds !== null && <span>{t('{seconds} 秒', { seconds })}</span>}</div>
      <div className="remote-file-preview-body" ref={body}>
        {model && <RemoteOfflineStatus model={model}/>}
        {detail.description && <p>{detail.description}</p>}
        {detail.cwd && <p className="remote-diff-path">{t('目录：{path}', { path: detail.cwd })}</p>}
        {detail.terminal && <details className="remote-command-source"><summary>{t('完整命令')}</summary><pre className="remote-command-source">{detail.command || t('发送终端输入')}</pre></details>}
        {supportsLive && <div role="group" aria-label={t('命令输出视图')}>
          <Button variant={liveOutput ? 'primary' : 'ghost'} aria-pressed={liveOutput} onClick={() => setLiveOutput(true)}>{t('实时输出')}</Button>
          <Button variant={!liveOutput ? 'primary' : 'ghost'} aria-pressed={!liveOutput} onClick={() => setLiveOutput(false)}>{t('执行结果')}</Button>
        </div>}
        {supportsLive && liveOutput ? <RemoteCommandOutput model={model} target={outputTarget} retained={retained}/>
          : detail.terminal ? <TerminalBlock {...detail.terminal.card} command={detail.command || t('发送终端输入')} labels={labels} maxLines={120}/>
          : <><pre className="remote-command-source">{detail.command || t('发送终端输入')}</pre>
            {detail.output ? <><Button onClick={() => void writeClipboard(detail.output).then(ok => setCopyState(ok ? '已复制' : '复制失败，请重试'))}>{t(copyState || '复制输出')}</Button>
              <pre className="remote-command-output">{lines.map((line, index) => <React.Fragment key={index}>{line.map((span, at) => <span key={at} style={span.style}>{span.text}</span>)}{index < lines.length - 1 ? '\n' : ''}</React.Fragment>)}</pre></>
              : <p>{detail.error || t(detail.running ? '等待电脑返回执行结果…' : '没有输出')}</p>}</>}
        {detail.running && detail.terminal && !(supportsLive && liveOutput) && <p className="muted">{t('等待电脑返回执行结果…')}</p>}
      </div>
    </>}
  </Surface>;
}
