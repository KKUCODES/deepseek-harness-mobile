import React, { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { phonePluginsFor } from './phone-plugins.mjs';
import { RemoteInterfaceHost } from './remote-interface-host.jsx';
import { flushSync } from 'react-dom';
import { Button } from '@upstream/ui-primitives/src/Button.tsx';
import { IconCloseOutline16 } from '@upstream/ui-primitives/src/icons/index.tsx';
import { Surface, IconButton } from './ui/Surface.jsx';
import { SurfacePresence } from './ui/motion.jsx';
import { RemoteClient } from './remote-client.mjs';
import { RemoteModel } from './remote-model.mjs';
import { isRemoteHostDisconnect } from './remote-transport.mjs';
import { RemoteWorkspace } from './ui/RemoteWorkspace.jsx';
import { registerRemoteClipboard } from './ordinary-clipboard.mjs';
import { installRemotePluginSlots, RemotePluginScope } from './remote-plugin-slots.jsx';
import { RemotePlugins } from './remote-plugins.jsx';
import { captureRemoteResume } from './remote-resume.mjs';
import { RemoteSyncCache } from './remote-sync-cache.mjs';
import { takeReadingRecovery } from './remote-reading-memory.mjs';
import { pairingServerOf } from './remote-pair-link.mjs';
import { RemoteDraftStore } from './remote-drafts.mjs';
import { ThemePresenter } from '../../deepseek-harness/packages/client/ui-layout/src/client/theme-presenter.ts';
import { watchPhoneAppearance } from './phone-appearance.mjs';
import { LocaleProvider, useTranslate } from './ui/locale.jsx';
import { SupportDiagnostics } from './ui/SupportDiagnostics.jsx';
import { AppUpdateEntry, AppUpdateNotice, AppUpdatePanel } from './ui/AppUpdates.jsx';
import { responseFailures } from './remote-response-errors.mjs';
import { registerUpdatePreparation } from './update-preparation.mjs';
import { RemoteConnectionPage } from './ui/RemoteConnectionPage.jsx';
import { DesignButton, DesignDialog } from './ui/system/Primitives.jsx';
import { LoadingToast } from './ui/system/LoadingToast.jsx';
import { RemoteDiagnostics } from './remote-diagnostics.mjs';
import { RemoteDiagnosticsContext, RemoteDiagnosticSheet } from './ui/RemoteDiagnostics.jsx';

const scanFailures = { scan_unavailable: '暂时无法打开扫码，请粘贴配对链接。', scan_busy: '扫码窗口已打开，请先完成或返回。', scan_timeout: '扫码已超时，请重新尝试。', scan_camera_permission: '未获得相机权限，可从图片识别或粘贴配对链接。', scan_image_invalid: '无法读取这张图片，请选择其他图片。', scan_image_too_large: '图片过大，请裁剪二维码后重试。', scan_qr_not_found: '未识别到二维码，请使用清晰的二维码图片。' };
const failures = { pairing_unavailable: '链接已过期或已被领取，请在电脑上生成新链接。', device_pending: '请先在电脑端核对指纹并批准连接。', device_revoked: '电脑已撤销这台手机，请重新配对。', http_401: '连接授权已失效，请移除本机绑定后重新配对。', permissions_changed: '电脑已调整这台手机的权限，请重新连接。', host_offline: '电脑暂时离线，请检查 DSH 是否正在运行。', host_upgrade_required: '请先更新电脑端 DSH Mobile 插件，再重新连接。',
  unsupported_remote_version: 'Remote 通信版本不兼容，请更新 App、电脑插件和中转服务后重试。',
  ...responseFailures,
  unsupported_remote_capabilities: '电脑缺少当前聊天需要的接口能力，请更新电脑插件或检查 DSH 插件状态。',
  unsupported_dsh_capabilities: '电脑缺少当前聊天需要的接口能力，请更新电脑插件或检查 DSH 插件状态。',
  unsupported_dsh_version: '电脑 DSH 版本与当前手机端不兼容，请使用配套版本后重试。' };

export function RemoteApp() {
  useEffect(() => { void phonePluginsFor('remote').start().catch(() => {}); }, []);
  const [interfaceUI] = useState(() => new RemoteInterfaceHost());
  useEffect(() => () => { void interfaceUI.dispose(); }, [interfaceUI]);
  const [client] = useState(() => new RemoteClient());
  const [language, setLanguage] = useState('zh');
  const [appearanceReady, setAppearanceReady] = useState(false);
  useEffect(() => watchPhoneAppearance(client, new ThemePresenter(), { onLanguage: setLanguage, onReady: () => setAppearanceReady(true) }), [client]);
  return <LocaleProvider locale={language}><RemoteConnection client={client} language={language} appearanceReady={appearanceReady} interfaceUI={interfaceUI}/></LocaleProvider>;
}

function RemoteConnection({ client, language, appearanceReady, interfaceUI }) {
  const t = useTranslate();
  const languageRef = useRef(language);
  languageRef.current = language;
  useEffect(() => registerRemoteClipboard(text => client.call('clipboard.write', { text })), [client]);
  const [binding, setBinding] = useState(null), [stage, setStage] = useState('idle');
  const [bindingReady, setBindingReady] = useState(false);
  // 只等待本地外观和绑定读取；电脑离线时也要及时显示可操作的连接页。
  useEffect(() => { if (bindingReady && appearanceReady) window.__dshmStartup?.ready(); }, [bindingReady, appearanceReady]);
  const [link, setLink] = useState(''), [name, setName] = useState('DSHM Android');
  const pairingServer = pairingServerOf(link);
  const [status, setStatus] = useState(''), [error, setError] = useState(''), [busy, setBusy] = useState(false), [menu, setMenu] = useState(false);
  const [leaving, setLeaving] = useState(false), [feedback, setFeedback] = useState(null), [pasteHint, setPasteHint] = useState('');
  const [watchApproval, setWatchApproval] = useState(true);
  const pairingIntent = useRef(0);
  const feedbackTimer = useRef(null), retryLoad = useRef(null), retryBinding = useRef(null), claimPending = useRef(false);
  const runtime = useRef(null), operation = useRef(Promise.resolve()), cleanup = useRef(Promise.resolve());
  const recovery = useRef({ resume: null, timer: null, attempt: 0, epoch: 0, stopped: true });
  const [model, setModel] = useState(null);
  useEffect(() => registerUpdatePreparation(async () => {
    await operation.current;
    await model?.prepareUpdate();
  }), [model]);
  const [diagnostics, setDiagnostics] = useState(false);
  const [diagnosticStore] = useState(() => new RemoteDiagnostics(client));
  const diagnosticRecords = useSyncExternalStore(diagnosticStore.subscribe, diagnosticStore.getSnapshot);
  const [diagnosticSelection, setDiagnosticSelection] = useState(null);
  useEffect(() => {
    if (!model) return;
    let connected = false;
    const observe = () => {
      const next = model.getSnapshot().connectionState === 'connected';
      if (next && !connected) void diagnosticStore.recovered();
      connected = next;
    };
    observe();
    return model.subscribe(observe);
  }, [model, diagnosticStore]);
  const diagnosticStage = useRef(stage); diagnosticStage.current = stage;
  useEffect(() => {
    const refresh = () => void diagnosticStore.refresh();
    refresh(); window.addEventListener('dshm-diagnostics-change', refresh);
    const unsubscribe = client.subscribe(frame => {
      if (frame.diagnostic) diagnosticStore.publish([frame.diagnostic, ...diagnosticStore.records.filter(item => item.id !== frame.diagnostic.id)]);
    });
    return () => { window.removeEventListener('dshm-diagnostics-change', refresh); unsubscribe(); };
  }, [client, diagnosticStore]);
  const [updatesOpen, setUpdatesOpen] = useState(false);
  useEffect(() => () => clearTimeout(feedbackTimer.current), []);
  useEffect(() => { model?.pluginSlots?.locale?.setLocale(language); }, [model, language]);
  useEffect(() => {
    let active = true;
    const takeLink = () => void client.call('binding.link').then(value => {
      if (active && value.link) { setLink(value.link); setError(''); }
    }).catch(() => {});
    takeLink();
    window.addEventListener('dshm-pair-link', takeLink);
    return () => { active = false; window.removeEventListener('dshm-pair-link', takeLink); };
  }, [client]);
  const mounted = useRef(true);
  const report = (failure, phase) => {
    if (failure.message === 'scan_cancelled') return;
    if (mounted.current) {
      setError(failure.message === 'invalid_pair_link' ? '配对链接无效，请使用电脑生成的完整链接。' : scanFailures[failure.message] ?? failures[failure.message] ?? '连接未完成，请重试。');
      if (failure.message === 'http_401') setStatus('invalid');
      // 原始异常不进入日志；只将固定错误码和自有资源的栈位置交给诊断存储。
      if (!failure.message.startsWith('scan_') && failure.message !== 'invalid_pair_link')
        void diagnosticStore.capture(failure, phase ?? (['loading', 'reading'].includes(diagnosticStage.current) ? 'reading' : 'unknown'));
    }
  };
  const run = async action => { setBusy(true); setError(''); try { await action(); } catch (failure) { report(failure); } finally { if (mounted.current) setBusy(false); } };
  const stop = () => {
    const current = runtime.current; runtime.current = null;
    // 先卸载 React 作用域，再释放插槽 adapter；快速重连也必须等待上一代彻底释放。
    if (mounted.current) flushSync(() => setModel(null));
    cleanup.current = cleanup.current.then(() => current?.dispose());
    return cleanup.current;
  };
  const connect = async (automatic = false) => {
    clearTimeout(recovery.current.timer);
    recovery.current.timer = null;
    if (!automatic) { recovery.current.epoch++; recovery.current.stopped = false; }
    if (!automatic || !runtime.current?.presented) { await stop(); setStage('connecting'); }
    try { await client.call('socket.connect'); }
    catch (failure) { if (!runtime.current?.presented) setStage('disconnected'); throw failure; }
  };
  const disconnect = () => {
    pairingIntent.current++; setWatchApproval(false);
    const recover = recovery.current;
    clearTimeout(recover.timer); recover.timer = null; recover.epoch++; recover.stopped = true; recover.resume = null;
    return client.disconnect();
  };
  useEffect(() => {
    mounted.current = true;
    const recover = recovery.current;
    recover.stopped = true;
    const cancelRecovery = (forget = false) => {
      clearTimeout(recover.timer); recover.timer = null; recover.epoch++;
      if (forget) { recover.resume = null; recover.stopped = true; }
    };
    const scheduleRecovery = () => {
      if (!mounted.current || recover.stopped || recover.timer) return;
      const epoch = recover.epoch;
      recover.timer = setTimeout(async () => {
        recover.timer = null;
        try {
          const device = await client.call('binding.status');
          if (!mounted.current || recover.stopped || epoch !== recover.epoch) return;
          setStatus(device.status);
          if (device.status !== 'active') { cancelRecovery(true); await stop(); setStage('disconnected'); return; }
          await connect(true);
        } catch (failure) {
          if (!mounted.current || recover.stopped || epoch !== recover.epoch) return;
          if (['http_401', 'device_revoked', 'permissions_changed'].includes(failure.message)) { cancelRecovery(true); await stop(); setStage('disconnected'); report(failure); }
          else scheduleRecovery();
        }
      }, Math.min(1000 * 2 ** Math.min(recover.attempt++, 4), 15000));
    };
    const load = async (resume, previous) => {
      if (previous && runtime.current !== previous) return;
      // 在旧运行环境释放前取草稿，任何在途写操作都不进入恢复队列。
      if (previous) {
        resume = captureRemoteResume(previous);
        // 装配失败或途中断网仍需交给下一次连接；仅成功呈现或明确断开/撤销后清除。
        recover.resume = resume;
      }
      await stop();
      if (!mounted.current || !client.connected || recover.stopped) return;
      try {
        const identity = await client.call('binding.info');
        if (!mounted.current || !client.connected) return;
        const draftStore = await RemoteDraftStore.open(identity).catch(error => new RemoteDraftStore(identity, () => { throw error; }));
        if (!mounted.current || !client.connected) { draftStore.close(); return; }
        const syncCache = await RemoteSyncCache.open(identity);
        if (!mounted.current || !client.connected) { draftStore.close(); syncCache?.close(); return; }
        const next = new RemoteModel(client, { syncCache, draftStore, notificationKey: JSON.stringify([identity.origin, identity.deviceId, identity.fingerprint]) });
        next.interfaceUI = interfaceUI; next.sharedInterfaceUI = true;
        runtime.current = next;
        let rebuilding = false;
        next.requestRebuild = () => {
          if (rebuilding || runtime.current !== next || !mounted.current) return;
          rebuilding = true;
          operation.current = operation.current.then(() => load(undefined, next));
        };
        next.pluginRuntime = new RemotePlugins(next);
        next.loadRemotes = () => next.pluginRuntime.prepare();
        next.onAssembled = async () => {
          next.pluginSlots = installRemotePluginSlots(next);
          next.pluginSlots.locale?.setLocale(languageRef.current);
          await next.pluginSlots.ready;
        };
        setStage('loading');
        // 原连接真正就绪后才显示“已连接”；中转 socket 连通不代表电脑服务可用。
        const offProgress = next.subscribe(() => {
          if (runtime.current === next && mounted.current && next.getSnapshot().connectionState === 'connected') setStage('reading');
        });
        try { await next.start(); } finally { offProgress(); }
        if (runtime.current !== next || !mounted.current || !client.connected) { await next.dispose(); return; }
        const nativeRecovery = await client.call('recovery.resume').catch(() => ({ restore: false }));
        if (!resume && (takeReadingRecovery() || nativeRecovery.restore)) {
          const reading = next.reading.read();
          if (reading) resume = { selected: reading.selected, selectedTarget: reading.target, reading };
        }
        if (resume) {
          if (resume.drafts) next.publish({ drafts: resume.drafts, draftEditors: resume.draftEditors, attachments: resume.attachments });
          next.workspaceResume = resume.workspace;
          next.panelMemory?.restore(resume.panels);
          if (resume.selected) await next.select(resume.selectedTarget ?? resume.selected, { trail: resume.selectionTrail ?? [] }).catch(failure => next.fail(failure));
          if (next.getSnapshot().selected === resume.selected) {
            if (resume.reading?.selected === resume.selected) {
              await next.reference?.binding.session.loadThrough(resume.reading.seq).catch(failure => next.fail(failure));
              next.readingResume = resume.reading;
            }
            next.jobOutputResume = resume.jobOutput;
            next.commandResume = resume.command;
          }
        }
        if (runtime.current !== next || !mounted.current || !client.connected) { await next.dispose(); return; }
        void next.pluginRuntime.start().catch(failure => next.pluginRuntime.fail(failure));
        recover.resume = null; recover.attempt = 0;
        next.presented = true;
        setError(''); setModel(next); setStage('ready');
      } catch (failure) {
        const readFailed = client.connected && runtime.current?.getSnapshot().connectionState === 'connected'
          && !failure.message.startsWith('unsupported_');
        await stop(); setStage(readFailed ? 'read-error' : 'disconnected');
        // 取消或撤销已给出最终状态；旧装配的网络失败不能覆盖该提示。
        if (recover.stopped) return;
        report(failure, readFailed ? 'reading' : 'negotiating');
        if (['http_401', 'device_revoked', 'permissions_changed'].includes(failure.message)) cancelRecovery(true);
        // 自动恢复取决于连接意图；首次装配尚没有聊天快照，也必须恢复只读加载。
        else if (!recover.stopped && (!client.connected || isRemoteHostDisconnect(failure) || failure.message === 'remote_generation_changed')) scheduleRecovery();
      }
    };
    retryLoad.current = () => load(recover.resume);
    const unsubscribe = client.subscribe(frame => {
      if (frame.type === 'closed') {
        cancelRecovery();
        if (frame.reason) cancelRecovery(true);
        else if (runtime.current?.presented) recover.resume = captureRemoteResume(runtime.current);
        if (!frame.reason && runtime.current?.presented) {
          // 网络中断保留真实投影与插件作用域；原 Gateway 负责取消旧审批、恢复订阅。
          runtime.current.publish({ connectionState: 'disconnected' });
        } else { setStage('disconnected'); void stop(); }
        if (frame.reason === 'device_revoked') { setStatus('invalid'); setError(failures.device_revoked); }
        else if (frame.reason === 'permissions_changed') setError(failures.permissions_changed);
        if (!frame.reason && !recover.stopped) scheduleRecovery();
      }
      // 用户断开或权限失效后，迟到的载体 ready 不能重新建立连接意图。
      if (frame.type !== 'ready' || recover.stopped) return;
      cancelRecovery();
      operation.current = operation.current.then(async () => {
        const current = runtime.current;
        if (!current?.presented) return load(recover.resume);
        try {
          await current.transport.negotiate();
          if (runtime.current !== current || !client.connected || recover.stopped) return;
          recover.resume = null; recover.attempt = 0;
          current.connection.reconnect();
          setError(''); setStage('ready');
        } catch (failure) {
          if (runtime.current !== current || recover.stopped) return;
          if (['host_offline', 'host_disconnected_outcome_unknown', 'connection_closed_outcome_unknown', 'remote_generation_changed'].includes(failure.message)) scheduleRecovery();
          else { cancelRecovery(true); await stop(); setStage('disconnected'); report(failure); }
        }
      });
    });
    const readBinding = async () => {
      const initialIntent = pairingIntent.current;
      const info = await client.call('binding.info');
      if (!mounted.current || initialIntent !== pairingIntent.current) return;
      setBinding(info);
      if (info.paired) {
        const device = await client.call('binding.status');
        if (!mounted.current || initialIntent !== pairingIntent.current) return;
        setStatus(device.status);
        if (device.status === 'active') await connect();
      }
    };
    retryBinding.current = readBinding;
    void run(readBinding).finally(() => { if (mounted.current) setBindingReady(true); });
    return () => { mounted.current = false; retryLoad.current = null; retryBinding.current = null; cancelRecovery(true); unsubscribe(); void stop(); void client.release().catch(() => {}); };
  }, [client]);
  // 已领取后只轮询只读状态；批准由电脑完成，手机不自动重放领取或任何写操作。
  useEffect(() => {
    if (!binding?.paired || status !== 'pending' || error || !watchApproval) return;
    let active = true, timer;
    const intent = pairingIntent.current;
    const poll = async () => {
      if (!active) return;
      if (document.hidden) { timer = setTimeout(poll, 2000); return; }
      try {
        const device = await client.call('binding.status');
        if (!active || intent !== pairingIntent.current) return;
        if (device.status === 'active') {
          setStatus('active');
          await run(() => connect());
          return;
        }
        if (device.status !== 'pending') { setStatus('invalid'); setError(failures.device_revoked); return; }
        timer = setTimeout(poll, 2000);
      } catch (failure) { if (active && intent === pairingIntent.current) report(failure); }
    };
    void poll();
    return () => { active = false; clearTimeout(timer); };
  }, [client, binding, status, error, watchApproval]);
  const leave = () => void run(async () => { await disconnect(); setLeaving(false); await client.call('ordinary.open'); });
  const back = () => {
    if (status === 'pending' || claimPending.current || ['connecting', 'negotiating', 'loading', 'reading'].includes(stage)) setLeaving(true);
    else void run(() => client.call('ordinary.open'));
  };
  useEffect(() => {
    if (stage === 'ready') return;
    const handle = () => {
      if (leaving) { setLeaving(false); return true; }
      if (updatesOpen) { setUpdatesOpen(false); return true; }
      if (diagnostics) { setDiagnostics(false); return true; }
      if (menu) { setMenu(false); return true; }
      back(); return true;
    };
    window.dshmHandleBack = handle;
    return () => { if (window.dshmHandleBack === handle) delete window.dshmHandleBack; };
  }, [stage, status, leaving, updatesOpen, diagnostics, menu]);
  useEffect(() => {
    if (!model || stage !== 'ready') return;
    let active = true, opening = false, pending = null, revision = 0;
    const open = async () => {
      const owner = ++revision;
      if (!active || model.getSnapshot().connectionState !== 'connected') return;
      // 只合并新的点击意图，不轮询失败通知；当前读取结束后取原生层的最新目标。
      if (opening) { pending = model.sessionView.request; return; }
      opening = true;
      let request = model.sessionView.request;
      const current = () => active && owner === revision && request === model.sessionView.request;
      try {
        const target = await client.call('notifications.take');
        if (current() && target.sessionId) {
          const navigation = model.select(target.sessionId);
          request = model.sessionView.request;
          await navigation;
          const state = model.getSnapshot();
          if (current() && state.selected === target.sessionId
            && state.session && state.connectionState === 'connected') {
            // 同一会话也要退出遮挡层；迟到的通知导航不能关闭用户随后打开的页面。
            model.publish({ notificationNavigation: target.id });
            await client.call('notifications.ack', { id: target.id });
          }
        }
      } catch { if (current()) model.publish({ error: '暂时无法打开提醒对应的聊天，请检查电脑连接后重试。' }); }
      finally {
        opening = false;
        const queuedAt = pending; pending = null;
        if (active && queuedAt !== null && queuedAt === model.sessionView.request) void open();
      }
    };
    let connected = model.getSnapshot().connectionState === 'connected';
    const off = model.subscribe(() => {
      const next = model.getSnapshot().connectionState === 'connected', recovered = next && !connected;
      connected = next;
      if (recovered) void open();
    });
    window.addEventListener('dshm-notification-open', open);
    void open();
    return () => { active = false; off(); window.removeEventListener('dshm-notification-open', open); };
  }, [model, stage, client]);
  const scan = source => void run(async () => {
    const result = await client.call('binding.scan', { source }, 130000);
    if (mounted.current && result.link) setLink(result.link);
  });
  const paste = () => void run(async () => {
    clearTimeout(feedbackTimer.current); setFeedback({ state: 'loading', message: '正在读取配对链接…' }); setPasteHint('');
    try {
      const value = await client.call('binding.paste');
      if (!mounted.current) return;
      if (!value.link) throw Error('clipboard_pair_link_missing');
      setLink(value.link); setFeedback({ state: 'success', message: '已粘贴配对链接' });
      feedbackTimer.current = setTimeout(() => setFeedback(null), 1100);
    } catch {
      // 旧 APK 没有受限粘贴桥时仍可使用系统粘贴，不扩大通用剪贴板权限。
      if (mounted.current) { setFeedback(null); setPasteHint('请长按输入框，粘贴电脑生成的配对链接。'); }
    }
  });
  const claim = () => {
    if (claimPending.current) return;
    void run(async () => {
      const intent = pairingIntent.current;
      claimPending.current = true;
      try {
        const submitted = link;
        const info = await client.call('binding.claim', { link: submitted, name: name.trim() });
        if (!mounted.current) return;
        setLink(''); setBinding(info); setStatus('pending'); setStage('idle');
        if (intent === pairingIntent.current) setWatchApproval(true);
      } finally { claimPending.current = false; }
    });
  };
  const retry = () => {
    if (!binding) { void run(() => retryBinding.current?.()); return; }
    // 等待批准只有一个读取循环，重试按钮不能与轮询同时发起两次连接。
    if (status === 'pending') { setError(''); setWatchApproval(true); return; }
    void run(async () => {
      const info = await client.call('binding.status'); setStatus(info.status);
      if (info.status === 'active') await connect();
      else if (info.status === 'pending') setWatchApproval(true);
      else setError(failures.http_401);
    });
  };
  const diagnosticContext = { store: diagnosticStore, records: diagnosticRecords,
    latest: diagnosticRecords.find(item => item.source === 'remote'), open: setDiagnosticSelection };
  return <RemoteDiagnosticsContext.Provider value={diagnosticContext}>
    <RemoteConnectionPage interfaceUI={interfaceUI} binding={binding} stage={stage} status={status} watchApproval={watchApproval} busy={busy} error={error} link={link} name={name} pairingServer={pairingServer}
      onLink={setLink} onName={setName} onScan={scan} onPaste={paste} onClaim={claim} onRetry={retry} pasteHint={pasteHint}
      onRetryRead={() => void run(() => { operation.current = operation.current.then(() => retryLoad.current?.()); return operation.current; })} onBack={back} onMore={() => setMenu(true)}/>
    {feedback && <LoadingToast state={feedback.state} message={t(feedback.message)}/>}
    <SurfacePresence>{leaving && <DesignDialog title={t('暂时离开配对？')} description={t('本次连接会暂停，已领取的配对信息会保留。')} onClose={() => setLeaving(false)}>
      <DesignButton onClick={() => setLeaving(false)}>{t('继续连接')}</DesignButton><DesignButton kind="secondary" onClick={leave}>{t('暂时离开')}</DesignButton>
    </DesignDialog>}</SurfacePresence>
    <AppUpdateNotice/>
    <SurfacePresence>{updatesOpen && <AppUpdatePanel onClose={() => setUpdatesOpen(false)}/>}</SurfacePresence>
    {stage === 'ready' && model && <RemotePluginScope model={model}><RemoteWorkspace model={model} onBack={back} onConnection={() => setMenu(true)}/></RemotePluginScope>}
    <SurfacePresence>{menu && <Surface phoneTheme title={t('电脑连接')} onClose={() => setMenu(false)}><header><h2>{t('电脑连接')}</h2><IconButton label={t('关闭窗口')} onClick={() => setMenu(false)}><IconCloseOutline16/></IconButton></header>
      <Button className="option" onClick={() => { setMenu(false); setDiagnosticSelection('recent'); void diagnosticStore.refresh(); }}>{t('问题诊断')}</Button>
      <AppUpdateEntry buttonClass="option" onOpen={() => { setMenu(false); setUpdatesOpen(true); }}/>
      <p>{binding?.origin ?? t('尚未连接电脑')}</p>
      {binding?.paired && <><Button className="option" onClick={() => void run(async () => { setMenu(false); await disconnect(); })}>{t('断开连接')}</Button>
        <details><summary>{t('移除本机绑定')}</summary><p>{t('移除后清理这台电脑的本机草稿，需要重新配对；电脑上的设备记录仍可在电脑端撤销。')}</p><Button onClick={() => void run(async () => { await model?.transport.syncCache?.clear(); await disconnect(); await stop(); const drafts = await RemoteDraftStore.open(binding); try { await drafts.clear(); } finally { drafts.close(); } await client.call('binding.forget'); diagnosticStore.publish([]); setBinding({ paired: false }); setStatus(''); setMenu(false); })}>{t('确认移除')}</Button></details></>}
    </Surface>}</SurfacePresence>
    {diagnostics && <SupportDiagnostics read={async () => {
      const info = await client.call('app.info');
      return { info, mode: 'remote', stage: model?.getSnapshot().connectionState ?? stage, binding,
        capabilities: model?.transport.capabilities, plugins: model?.getSnapshot().plugins };
    }} copy={text => client.call('clipboard.write', { text })} onClose={() => setDiagnostics(false)}/>}
    {diagnosticSelection !== null && <RemoteDiagnosticSheet store={diagnosticStore} records={diagnosticRecords} selection={diagnosticSelection}
      onSelect={setDiagnosticSelection} onClose={() => setDiagnosticSelection(null)}
      onEnvironment={() => { setDiagnosticSelection(null); setDiagnostics(true); }}/>
    }
  </RemoteDiagnosticsContext.Provider>;
}
