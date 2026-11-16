import React, { useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react';
import { Button } from '@upstream/ui-primitives/src/Button.tsx';
import { remoteEventLabel } from '../remote-live-log.mjs';
import { useTranslate } from './locale.jsx';
import './remote-live-log.css';

const time = new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit', fractionalSecondDigits: 3, hourCycle: 'h23' });
const empty = Object.freeze([]);
const noSubscribe = () => () => {};
const noCapture = () => false;
const domains = { ordinary: '普通聊天', remote: 'Remote', startup: '启动', plugin: '插件', update: '软件更新' };
const events = {
  process_started: 'Android 进程已启动', page_started: '正在加载页面', page_ready: '页面已显示', page_load_failed: '页面加载失败',
  page_failed: '页面启动未完成', startup_failed: '页面启动未完成', first_paint: 'WebView 首屏已准备好', renderer_gone: 'WebView 渲染进程已退出',
  native_uncaught: 'Android 未捕获异常', uncaught_error: 'WebView 未捕获异常', unhandled_rejection: 'WebView 未处理的 Promise 异常',
  render_failed: '界面渲染失败', image_render_failed: '图片渲染失败', resource_load_failed: '页面资源加载失败',
  ordinary_open: '读取本地聊天', ordinary_send: '普通聊天发送', ordinary_request_accepted: '已开始模型请求', ordinary_response: '已收到模型响应',
  ordinary_history_failed: '本地历史写入失败', session_open: '读取电脑会话', history_page: '加载历史分页', remote_send: '发送给电脑',
  remote_turn_started: '电脑开始处理', remote_turn_input_received: '电脑已读取本次输入', remote_turn_done: '电脑已完成处理', remote_turn_failed: '电脑处理失败',
  phone_plugin: '手机插件运行状态变更', remote_plugin: '加载电脑插件', ordinary_plugin: '加载普通聊天界面',
  phone_plugin_operation_failed: '手机插件操作失败', update_action: '提交更新操作',
  preinstalled_ready: '预装插件已初始化', preinstalled_failed: '预装插件初始化失败', preinstalled_catalog_failed: '无法读取预装插件目录',
  resource_active: '已启用页面资源', resource_rollback: '页面资源已回退',
};
const phases = { start: '开始', done: '完成', failed: '失败', cancelled: '取消' };
const phasePattern = /_(start|done|failed|cancelled)$/;

function label(row, t) {
  const known = remoteEventLabel(row.event) ?? events[row.event];
  if (known) return t(known);
  const phase = phasePattern.exec(row.event)?.[1];
  const action = phase && events[row.event.replace(phasePattern, '')];
  return action ? `${t(action)} · ${t(phases[phase])}` : row.event;
}

function details(row) {
  const lines = [`${new Date(row.at).toISOString()} ${row.level} ${row.source} ${row.mode} ${row.domain}/${row.event}`];
  for (const key of ['appVersion', 'versionCode', 'build', 'trace', 'duration', 'count', 'code', 'location']) {
    if (row[key] !== undefined) lines.push(`${key}=${row[key]}`);
  }
  for (const cause of row.exception?.causes ?? []) {
    lines.push(`${cause.relation}: ${cause.type}`);
    lines.push(...cause.frames.map(frame => `  at ${frame}`));
  }
  if (row.exception?.omitted) lines.push(`redactedOrOmittedFrames=${row.exception.omitted}`);
  return lines.join('\n');
}

export function RemoteLiveLog({ client, copy = text => client.call('clipboard.write', { text }), remote = Boolean(client) }) {
  const t = useTranslate();
  const log = globalThis.__dshmDiagnostics;
  const entries = useSyncExternalStore(log?.subscribe ?? noSubscribe, log?.getSnapshot ?? (() => empty));
  const capture = useSyncExternalStore(log?.subscribe ?? noSubscribe, log?.getCapture ?? noCapture);
  const [changingCapture, setChangingCapture] = useState(false);
  const [level, setLevel] = useState('all'), [domain, setDomain] = useState(remote ? 'remote' : 'all');
  const [following, setFollowing] = useState(true), [status, setStatus] = useState(''), [selected, select] = useState(null);
  const viewport = useRef(null);
  const rows = entries.filter(entry => (level === 'all' || entry.level === level) && (domain === 'all' || entry.domain === domain));
  const last = rows.at(-1)?.id;
  useLayoutEffect(() => {
    if (following && viewport.current) viewport.current.scrollTop = viewport.current.scrollHeight;
  }, [last, level, domain, following]);
  const description = entry => [label(entry, t), entry.code, entry.count, entry.duration === undefined ? undefined : `${entry.duration} ms`].filter(value => value !== undefined).join(' · ');
  const copyRecord = async (text, id) => {
    try {
      if (id && log?.persisted) await log.copy(id);
      else await copy(text);
      setStatus('诊断信息已复制');
    } catch { setStatus('复制未完成，请重试。'); }
  };
  const toggleCapture = async enabled => {
    setChangingCapture(true);
    setStatus('');
    try { await log.setCapture(enabled); }
    catch { setStatus('日志开关未能更新，请重试。'); }
    finally { setChangingCapture(false); }
  };
  return <div className="remote-live-log">
    {!log?.persisted && <p className="muted">{t('当前仅显示本次页面运行日志。')}</p>}
    {log && <label className="remote-live-log-toggle"><input type="checkbox" role="switch" checked={capture} disabled={changingCapture}
      onChange={event => void toggleCapture(event.currentTarget.checked)}/> {t('日志采集')}</label>}
    {log && !capture && <small className="muted">{t('采集已关闭，仍可查看已有日志。')}</small>}
    <div className="remote-live-log-filters"><label>{t('日志范围')} <select value={domain} onChange={event => { setDomain(event.target.value); select(null); setFollowing(true); }}>
      <option value="all">{t('全部范围')}</option>
      {Object.entries(domains).map(([id, title]) => <option value={id} key={id}>{t(title)}</option>)}
    </select></label><label>{t('日志级别')} <select value={level} onChange={event => { setLevel(event.target.value); select(null); setFollowing(true); setStatus(''); }}>
      <option value="all">{t('全部级别')}</option>
      {['INFO', 'WARN', 'ERROR'].map(value => <option key={value}>{value}</option>)}
    </select></label></div>
    <div className="remote-live-log-lines" data-testid="remote-live-log" ref={viewport} tabIndex={0} aria-label={t('日志记录')}
      onScroll={({ currentTarget: node }) => setFollowing(node.scrollHeight - node.scrollTop - node.clientHeight <= 12)}>
      {rows.length ? rows.map(entry => <div key={entry.id} data-level={entry.level}>
        <time dateTime={new Date(entry.at).toISOString()}>{time.format(entry.at)}</time><strong>{entry.level}</strong>{entry.level !== 'INFO' || entry.trace
          ? <button type="button" className="remote-live-log-row" aria-expanded={selected?.id === entry.id} onClick={() => { select(selected?.id === entry.id ? null : entry); setStatus(''); }}>{description(entry)}</button>
          : <span>{description(entry)}</span>}
      </div>) : <span>{t('暂无日志')}</span>}
    </div>
    {selected && <section aria-label={t('日志详情')} className="remote-live-log-detail">
      <strong>{t('日志详情')} · {description(selected)}</strong>
      <pre data-testid="dshm-log-detail">{details(selected)}</pre>
      {selected.exception?.omitted > 0 && <p className="muted">{t('部分栈帧已脱敏或超出记录上限。')}</p>}
      <Button onClick={() => void copyRecord(details(selected), selected.id)}>{t('复制详情与调用栈')}</Button>
    </section>}
    <div className="remote-live-log-actions">
      {!following && <Button onClick={() => setFollowing(true)}>{t('回到最新')}</Button>}
      <Button disabled={!rows.length} onClick={() => void copyRecord(rows.map(row => `${new Date(row.at).toISOString()} ${row.level} ${row.source} ${row.domain}/${row.event}${row.code ? ` ${row.code}` : ''}${row.trace ? ` ${row.trace}` : ''}`).join('\n').slice(-39000))}>{t('复制日志')}</Button>
      {status && <small role="status">{t(status)}</small>}
    </div>
  </div>;
}
