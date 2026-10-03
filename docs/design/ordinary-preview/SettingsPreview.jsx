import React, { useEffect, useRef, useState } from 'react';
import { Button } from '@upstream/ui-primitives/src/Button.tsx';
import { Switch } from '@upstream/ui-primitives/src/Switch.tsx';
import { IconChevronLeftOutline14, IconChevronRightOutline14, IconCloseOutline16, IconEllipsisOutline16, IconDataOutline16, IconPersonalizationOutline16, IconSettingsOutline16, IconBrowseOutline16 } from '@upstream/ui-primitives/src/icons/index.tsx';
import { backupExample, exportPreviewHistory, parsePreviewHistory, mergePreviewHistory, notificationPreview } from './settings-demo.mjs';
import './settings-preview.css';

const headings = { home: '设置', chat: '普通聊天', appearance: '外观与语言', notifications: '通知', data: '本地数据', remote: '电脑连接' };
const connectionNames = { unpaired: '未绑定', pairing: '等待配对', waiting: '等待电脑批准', online: '已连接', offline: '离线', reconnecting: '正在重连', connecting: '正在连接', revoked: '授权已失效' };
const keyErrors = { invalid: 'Key 无效，请检查后重试。原配置已保留。', quota: '账户额度不足，请充值后重试。原配置已保留。', network: '暂时无法连接 DeepSeek。原配置保持不变，请检查网络。' };

function SettingsRow({ icon, title, value, onClick, danger = false, disabled = false }) {
  return <button className={`settings-row ${danger ? 'danger' : ''}`} onClick={onClick} disabled={disabled}>{icon}<span className="settings-row-label">{title}</span>{value && <span className="settings-row-value">{value}</span>}<IconChevronRightOutline14/></button>;
}

export function SettingsPreview({ visible, onBack, Surface, IconButton, defaultModel, onDefaultModel, chats, hasDrafts, onHistory, onClearHistory, remoteState, onRemoteCommand, onOpenRemote }) {
  const [page, setPage] = useState('home');
  const [sheet, setSheet] = useState(null);
  const [configured, setConfigured] = useState(false);
  const [sampleReady, setSampleReady] = useState(false);
  const [keyResult, setKeyResult] = useState('success');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState(null);
  const [theme, setTheme] = useState('system');
  const [language, setLanguage] = useState('zh');
  const [systemDark, setSystemDark] = useState(() => matchMedia('(prefers-color-scheme: dark)').matches);
  const [permission, setPermission] = useState(false);
  const [notifications, setNotifications] = useState({ attention: true, done: true, failed: true });
  const [lifecycle, setLifecycle] = useState('foreground');
  const [notificationOnline, setNotificationOnline] = useState(true);
  const [notification, setNotification] = useState(null);
  const [notificationEvent, setNotificationEvent] = useState('attention');
  const [importData, setImportData] = useState(null);
  const [importError, setImportError] = useState('');
  const [exportData, setExportData] = useState('');
  const [cache, setCache] = useState(2.4);
  const [failNext, setFailNext] = useState(false);
  const timer = useRef(null);
  const scroll = useRef(null);
  const dark = theme === 'dark' || (theme === 'system' && systemDark);
  const online = remoteState === 'online';
  const bound = ['online', 'offline', 'reconnecting', 'connecting', 'revoked', 'unavailable'].includes(remoteState);
  const reconnecting = ['reconnecting', 'connecting'].includes(remoteState);
  const draftModel = useRef(defaultModel);
  const [modelChoice, setModelChoice] = useState(defaultModel);

  useEffect(() => { if (visible) { setPage('home'); setSheet(null); setNotice(null); } }, [visible]);
  useEffect(() => { if (scroll.current) scroll.current.scrollTop = 0; }, [page]);
  useEffect(() => { if (sheet) setNotice(null); }, [sheet]);
  useEffect(() => () => clearTimeout(timer.current), []);
  useEffect(() => {
    const onKey = event => { if (visible && !sheet && !busy && event.key === 'Escape') { event.preventDefault(); if (page === 'home') onBack(); else setPage('home'); } };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [visible, sheet, busy, page, onBack]);
  useEffect(() => { const query = matchMedia('(prefers-color-scheme: dark)'); const change = event => setSystemDark(event.matches); query.addEventListener('change', change); return () => query.removeEventListener('change', change); }, []);
  function message(text, error = false) { setNotice({ text, error }); }
  function open(next) { setNotice(null); setPage(next); }
  function closeSheet() { if (!busy) setSheet(null); }
  function perform(action) {
    if (busy) return;
    setBusy(true); setNotice(null);
    const fail = failNext; setFailNext(false);
    timer.current = setTimeout(() => {
      setBusy(false);
      if (fail) { message('操作未完成，原数据已保留。请重试。', true); return; }
      action();
    }, 650);
  }
  function saveKey() {
    perform(() => {
      if (keyResult !== 'success') { message(keyErrors[keyResult], true); return; }
      setConfigured(true); setSheet(null); setSampleReady(false); message('示例配置已保存');
    });
  }
  function prepareImport(example) {
    setImportError(''); setImportData(null);
    try { setImportData(parsePreviewHistory(example)); } catch (error) { setImportError(error.message); }
  }
  function confirmImport() {
    perform(() => { const result = mergePreviewHistory(chats, importData); onHistory(result.chats); setSheet(null); message(`已导入 ${result.added} 条聊天，跳过 ${result.skipped} 条重复记录。`); });
  }
  const storageBytes = new TextEncoder().encode(exportPreviewHistory(chats)).length;
  const sheetTitle = { key: '配置 DeepSeek Key', removeKey: '移除 Key', model: '默认模型', theme: '主题', language: '语言', permission: '系统通知权限', notification: '通知效果预览', import: '导入聊天', export: '导出聊天', clear: '清空本地聊天', cache: '清理临时缓存', unbind: '解除电脑绑定', scenes: '设置预览场景' }[sheet];
  const Notice = () => notice && <div className={`settings-notice ${notice.error ? 'is-error' : ''}`} role={notice.error ? 'alert' : 'status'}>{notice.text}</div>;

  return <main hidden={!visible} className={`app settings-app ${dark ? 'settings-dark' : ''}`}>
    <header className="topbar remote-topbar"><IconButton label={page === 'home' ? '退出设置' : '返回设置首页'} disabled={busy} onClick={() => page === 'home' ? onBack() : setPage('home')}><IconChevronLeftOutline14 size={22}/></IconButton><strong>{headings[page]}</strong><IconButton label="设置预览场景" disabled={busy} onClick={() => setSheet('scenes')}><IconEllipsisOutline16 size={22}/></IconButton></header>
    <section ref={scroll} className="settings-scroll" aria-label="设置内容">
      {!sheet && <Notice/>}
      {page === 'home' ? <>
        <h2 className="settings-group-title">这台手机</h2><div className="settings-group">
          <SettingsRow icon={<IconDataOutline16/>} title="普通聊天" value={configured ? '已配置' : '未配置 Key'} onClick={() => open('chat')}/>
          <SettingsRow icon={<IconPersonalizationOutline16/>} title="外观与语言" value={{ system: '跟随系统', light: '浅色', dark: '深色' }[theme]} onClick={() => open('appearance')}/>
          <SettingsRow icon={<IconSettingsOutline16/>} title="通知" value={permission ? '已允许' : '未允许'} onClick={() => open('notifications')}/>
          <SettingsRow icon={<IconDataOutline16/>} title="本地数据" value={`${chats.length} 条聊天`} onClick={() => open('data')}/>
        </div><h2 className="settings-group-title">Remote</h2><div className="settings-group"><SettingsRow icon={<IconBrowseOutline16/>} title="电脑连接" value={connectionNames[remoteState] || '连接不可用'} onClick={() => open('remote')}/></div><p className="settings-help">手机偏好与电脑设置分开。这里不会修改电脑模型、插件或工作区。</p>
      </> : page === 'chat' ? <>
        <h2 className="settings-group-title">模型服务</h2><div className="settings-group"><SettingsRow title="DeepSeek Key" value={configured ? '已配置' : '未配置'} onClick={() => { setSampleReady(false); setSheet('key'); }}/><SettingsRow title="默认模型" value={defaultModel} onClick={() => { draftModel.current = defaultModel; setModelChoice(defaultModel); setSheet('model'); }}/>{configured && <SettingsRow title="移除 Key" danger onClick={() => setSheet('removeKey')}/>}</div><p className="settings-help">使用你自己的 Key，由手机直接连接 DeepSeek。Key 不发送给电脑或转发服务。</p><p className="settings-help">默认模型用于新聊天，已有聊天的模型保持不变。</p>
      </> : page === 'appearance' ? <>
        <div className="settings-group"><SettingsRow title="主题" value={{ system: '跟随系统', light: '浅色', dark: '深色' }[theme]} onClick={() => setSheet('theme')}/><SettingsRow title="语言" value={language === 'zh' ? '简体中文' : 'English'} onClick={() => setSheet('language')}/></div>
        <h2 className="settings-group-title">显示效果</h2><div className="settings-appearance-sample"><strong>{language === 'zh' ? '探索未至之境' : 'Explore beyond the horizon'}</strong><p>{language === 'zh' ? '有什么想聊的？' : 'What would you like to talk about?'}</p><div>{language === 'zh' ? '发送消息，聊聊你的想法' : 'Message your thoughts'}</div></div>
      </> : page === 'notifications' ? <>
        <div className="settings-group"><SettingsRow title="系统通知" value={permission ? '已允许（示例）' : '未允许'} onClick={() => setSheet('permission')}/></div><h2 className="settings-group-title">Remote 提醒</h2><div className="settings-group">{[['attention', '需要批准或回答'], ['done', '任务完成'], ['failed', '执行失败']].map(([id, label]) => <div className="settings-toggle" key={id}><span>{label}</span><Switch checked={notifications[id]} label={label} onChange={value => setNotifications(current => ({ ...current, [id]: value }))}/></div>)}</div>
        <p className="settings-help">使用 App 时在页面内提醒，切到后台后通过通知提醒。App 被系统关闭后将停止接收，重新打开即可尝试连接。</p><p className="settings-help">点击通知查看任务详情。关闭通知不影响聊天。</p><Button variant="outline" onClick={() => { setNotification(null); setSheet('notification'); }}>预览提醒效果</Button>
      </> : page === 'data' ? <>
        <div className="settings-storage"><strong>{chats.length}<small> 条普通聊天</small></strong><p>聊天记录约 {(storageBytes / 1024).toFixed(1)} KB · 临时缓存 {cache.toFixed(1)} MB</p></div><div className="settings-group"><SettingsRow title="导出聊天" onClick={() => { setExportData(exportPreviewHistory(chats)); setSheet('export'); }}/><SettingsRow title="导入聊天" onClick={() => { setImportData(null); setImportError(''); setSheet('import'); }}/><SettingsRow title="清理临时缓存" value={`${cache.toFixed(1)} MB`} onClick={() => setSheet('cache')}/><SettingsRow title="清空聊天与草稿" danger disabled={!chats.length && !hasDrafts} onClick={() => setSheet('clear')}/></div><p className="settings-help">备份包含普通聊天的已发送消息，不含草稿或密钥。导入时会跳过重复聊天，保留已有内容。</p><p className="settings-help">清理缓存不会删除聊天或解除电脑绑定。</p>
      </> : <>
        <div className="settings-device"><IconBrowseOutline16 size={28}/><h2>{bound ? 'DESKTOP-GMCSCPA' : '尚未绑定电脑'}</h2><p>{connectionNames[remoteState] || '连接不可用'}</p></div>
        {bound ? <><div className="settings-group"><SettingsRow title="查看电脑任务" onClick={() => onOpenRemote()}/><SettingsRow title="重新连接" disabled={online || reconnecting || remoteState === 'revoked'} value={reconnecting ? '连接中…' : online ? '已连接' : ''} onClick={() => onRemoteCommand('reconnect')}/>{remoteState === 'revoked' && <SettingsRow title="重新配对" onClick={() => onOpenRemote()}/>}<SettingsRow title="解除绑定" danger disabled={reconnecting} onClick={() => setSheet('unbind')}/></div><p className="settings-help">解绑移除这台手机的连接入口，电脑任务继续运行，普通聊天和 Key 保留。离线解绑无法确认电脑端撤销，请稍后在电脑移除本设备。</p></> : <><p className="settings-help">在电脑生成一次性配对链接，经电脑批准后连接。</p><Button variant="primary" onClick={() => onOpenRemote()}>前往 Remote 连接</Button></>}
      </>}
      
    </section>
    {sheet && <Surface title={sheetTitle} onClose={closeSheet} className="settings-sheet"><div className="sheet-handle"/><header><h2>{sheetTitle}</h2><IconButton label="关闭设置窗口" disabled={busy} onClick={closeSheet}><IconCloseOutline16/></IconButton></header><Notice/>{busy && <p role="status">正在处理…</p>}
      {sheet === 'key' ? <><p>使用 DeepSeek Key 连接你的账户。</p><label className="settings-field">DeepSeek Key<input type="password" readOnly value={sampleReady ? 'preview-only' : ''} placeholder="此预览不接受真实 Key" aria-label="演示 Key" autoComplete="off"/></label><Button variant="outline" disabled={busy} onClick={() => setSampleReady(true)}>填入固定示例</Button><div className="settings-actions"><Button variant="outline" disabled={busy} onClick={closeSheet}>取消</Button><Button variant="primary" disabled={busy || !sampleReady} onClick={saveKey}>验证并保存示例</Button></div></>
      : sheet === 'model' ? <>{['DeepSeek', 'DeepSeek · 快速'].map(name => <Button key={name} className="option" aria-pressed={modelChoice === name} onClick={() => setModelChoice(name)}>{name}<span>{modelChoice === name ? '已选' : ''}</span></Button>)}<p className="settings-help">只影响下一次新建的普通聊天。</p><div className="settings-actions"><Button variant="outline" onClick={closeSheet}>取消</Button><Button variant="primary" disabled={modelChoice === draftModel.current} onClick={() => { onDefaultModel(modelChoice); setSheet(null); message('默认模型已更新，下一次新聊天生效。'); }}>保存默认模型</Button></div></>
      : sheet === 'theme' || sheet === 'language' ? <>{(sheet === 'theme' ? [['system', '跟随系统'], ['light', '浅色'], ['dark', '深色']] : [['zh', '简体中文'], ['en', 'English']]).map(([id, label]) => <Button key={id} className="option" aria-pressed={(sheet === 'theme' ? theme : language) === id} onClick={() => { if (sheet === 'theme') setTheme(id); else setLanguage(id); setSheet(null); }}>{label}{(sheet === 'theme' ? theme : language) === id && <span>已选</span>}</Button>)}</>
      : sheet === 'permission' ? <><p>允许通知后，可及时收到任务完成、失败和待处理提醒。</p><p className="settings-help">权限预览 · 不更改系统设置</p><div className="settings-actions"><Button variant="outline" onClick={() => { setPermission(false); setSheet(null); }}>演示不允许</Button><Button variant="primary" onClick={() => { setPermission(true); setSheet(null); }}>演示允许</Button></div></>
      : sheet === 'notification' ? <><label className="settings-field">事件类型<select value={notificationEvent} onChange={event => { setNotificationEvent(event.target.value); setNotification(null); }}><option value="attention">需要批准或回答</option><option value="done">任务完成</option><option value="failed">执行失败</option></select></label><label className="settings-field">App 状态<select value={lifecycle} onChange={event => { setLifecycle(event.target.value); setNotification(null); }}><option value="current">正在看此任务</option><option value="foreground">前台其他页面</option><option value="background">后台进程存活</option><option value="killed">进程已结束</option></select></label><div className="settings-toggle"><span>示例连接可用</span><Switch checked={notificationOnline} label="示例连接可用" onChange={value => { setNotificationOnline(value); setNotification(null); }}/></div><Button variant="outline" onClick={() => setNotification(notificationPreview({ lifecycle, permission, online: notificationOnline, enabled: notifications[notificationEvent], event: notificationEvent }))}>模拟提醒事件</Button>{notification && <div className="settings-notification" role="status"><small>{notification.kind === 'system' ? '系统通知外观示例' : '提醒行为'}</small><p>{notification.text}</p>{['banner', 'system'].includes(notification.kind) && <Button onClick={() => { setSheet(null); onOpenRemote({ attention: 'approval', done: 'done', failed: 'failed' }[notificationEvent]); }}>查看示例任务</Button>}</div>}</>
      : sheet === 'import' ? <><p>选择聊天备份，检查内容后再导入。</p><div className="settings-actions"><Button variant="outline" disabled={busy} onClick={() => prepareImport(JSON.stringify(backupExample))}>选择示例备份</Button><Button disabled={busy} onClick={() => prepareImport('{invalid')}>损坏文件示例</Button><Button disabled={busy} onClick={() => prepareImport(JSON.stringify({ ...backupExample, version: 99 }))}>新版备份示例</Button></div>{importError && <p role="alert" className="settings-error">{importError}</p>}{importData && <p role="status">检查通过：{importData.length} 条聊天，新增 {mergePreviewHistory(chats, importData).added} 条，重复 {mergePreviewHistory(chats, importData).skipped} 条。</p>}<div className="settings-actions"><Button variant="outline" disabled={busy} onClick={closeSheet}>取消</Button><Button variant="primary" disabled={busy || !importData} onClick={confirmImport}>确认导入</Button></div></>
      : sheet === 'export' ? <><p>导出当前 {chats.length} 条普通聊天，不包含 Key、设备凭据、电脑数据或草稿。</p><label className="settings-field">导出内容<textarea readOnly rows={7} value={exportData}/></label><form method="post" action="/preview-history-export"><input type="hidden" name="history" value={exportData}/><Button variant="primary" type="submit">下载示例备份</Button></form></>
      : sheet === 'scenes' ? <><p>只改变预览场景，不调用模型、不改变真实权限。</p><div className="scenario-grid">{[['success', 'Key 配置成功'], ['invalid', 'Key 无效'], ['quota', '额度不足'], ['network', '网络错误']].map(([id, label]) => <Button key={id} variant="outline" onClick={() => { setKeyResult(id); setSheet(null); message(`Key 配置将演示：${label}`); }}>{label}</Button>)}<Button variant="outline" onClick={() => { setFailNext(true); setSheet(null); message('下一次数据或 Key 操作将失败，原状态保持不变。'); }}>下次操作失败</Button>{[['online','电脑已连接'],['offline','电脑离线'],['revoked','电脑授权失效']].map(([id,label]) => <Button key={id} variant="outline" onClick={() => { onRemoteCommand('scenario', id); setSheet(null); }}>{label}</Button>)}</div></>
      : <><p>{({ removeKey: '移除 Key 后，需要重新配置才能开始普通聊天。已有聊天和电脑绑定将保留。', clear: `将清空 ${chats.length} 条普通聊天及全部本地草稿。此操作无法撤销，建议先导出备份。Key、插件、电脑任务和绑定不受影响。`, cache: '仅清理临时缓存，保留聊天、草稿、Key 和电脑绑定。', unbind: online ? '解除绑定后，需要重新配对才能访问电脑。电脑任务会继续运行。' : '当前无法确认电脑端撤销。将移除手机上的绑定，请稍后在电脑端撤销此设备。普通聊天不受影响。' })[sheet]}</p><div className="settings-actions"><Button variant="outline" disabled={busy} onClick={closeSheet}>取消</Button><Button variant="primary" disabled={busy} onClick={() => perform(() => { if (sheet === 'removeKey') setConfigured(false); if (sheet === 'clear') onClearHistory(); if (sheet === 'cache') setCache(0); if (sheet === 'unbind') onRemoteCommand('unbind'); setSheet(null); message({ removeKey: 'Key 配置已移除。', clear: '普通聊天与草稿已清空，其他设置保留。', cache: '临时缓存已清理。', unbind: '已解除这台手机的绑定。' }[sheet]); })}>{({ removeKey: '确认移除', clear: '确认清空', cache: '确认清理', unbind: '确认解绑' })[sheet]}</Button></div></>}
    </Surface>}
  </main>;
}
