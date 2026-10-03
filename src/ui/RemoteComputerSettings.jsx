import React, { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { useTranslate } from './locale.jsx';
import { Button } from '@upstream/ui-primitives/src/Button.tsx';
import { RemoteComputerKey } from './RemoteComputerKey.jsx';
import { RemoteComputerEndpoint } from './RemoteComputerEndpoint.jsx';
import { RemoteConnectionNotice } from './RemoteConnectionNotice.jsx';
import { RemoteProviderSettings } from './RemoteProviderSettings.jsx';
import { RemoteProviderModelEditor } from './RemoteProviderModelEditor.jsx';
import { RemoteModelSettingsExtensions } from '../remote-plugin-slots.jsx';
import { RemoteProviderCard } from './RemoteProviderCard.jsx';

const fields = {
  thinking: { label: '允许深度思考', choices: [['enabled', '允许'], ['disabled', '关闭']] },
  reasoningEffort: { label: '默认思考强度', choices: [['off', '关闭'], ['low', '低'], ['high', '高'], ['max', '最高']] },
  maxTokens: { label: '单次回复上限（Token）', min: 1 },
  defaultContextWindow: { label: '默认上下文长度（Token）', min: 1 },
  streamIdleTimeoutMs: { label: '等待输出超时（毫秒）', min: 1 },
};

export function RemoteComputerSettings({ model, showConnectionNotice = true }) {
  const t = useTranslate();
  const state = useSyncExternalStore(model.subscribeView, model.getSnapshot);
  const connected = state.connectionState === 'connected';
  const settings = model.computerSettings;
  const [view, setView] = useState(null), [draft, setDraft] = useState({});
  const [busy, setBusy] = useState(false), [notice, setNotice] = useState('');
  const [stale, setStale] = useState(false);
  const alive = useRef(false), active = useRef(null);
  const draftRef = useRef(draft), revision = useRef(0), refresh = useRef(() => {});
  draftRef.current = draft;
  const run = async (writing, automatic = false) => {
    if (active.current || model.getSnapshot().connectionState !== 'connected') return;
    if (writing && stale) return;
    if (automatic && Object.keys(draftRef.current).length) { setStale(true); return; }
    const controller = new AbortController(); active.current = controller;
    const started = revision.current;
    setBusy(true); setNotice('');
    try {
      const next = writing ? await settings.save(view, Object.values(draft), controller.signal) : await settings.read(controller.signal);
      if (!alive.current || controller.signal.aborted) return;
      if (!writing && started !== revision.current) return;
      if (automatic && Object.keys(draftRef.current).length) { setStale(true); return; }
      setView(next); setDraft({}); draftRef.current = {}; setStale(false);
      if (writing) setNotice(next.applies === 'restart' ? '已保存，重启电脑上的 DSH 后生效。' : '已保存到电脑。');
    } catch (error) {
      if (alive.current && !controller.signal.aborted) {
        setNotice(error.message);
        // 保存或重读失败都保留已显示的表单；失效快照必须重读后才能再提交。
        setStale(settings.view !== view);
      }
    }
    finally {
      if (active.current === controller) active.current = null;
      if (alive.current && !controller.signal.aborted) {
        setBusy(false);
        if (started !== revision.current) queueMicrotask(() => refresh.current());
      }
    }
  };
  refresh.current = () => { if (alive.current && settings.permitted && settings.supported) void run(false, true); };
  useEffect(() => {
    alive.current = true;
    if (settings.permitted && settings.supported) void run(false);
    const off = model.remote.$on('settings/document-updated', () => {
      revision.current++;
      if (Object.keys(draftRef.current).length) setStale(true);
      if (!active.current) refresh.current();
    });
    return () => { alive.current = false; active.current?.abort(); off(); };
  }, [settings, model]);
  const change = (key, edit) => setDraft(before => ({ ...before, [key]: edit }));
  if (connected && !settings.permitted) return <p role="status">{t("请先在电脑端授予此设备管理权限，再查看或修改电脑设置。")}</p>;
  if (connected && !settings.supported) return <p role="status">{t("请更新电脑远程插件和网关后使用电脑设置。")}</p>;
  return <section className="remote-computer-settings">
    {showConnectionNotice && <RemoteConnectionNotice state={state}/>}
    <p>{t("修改当前电脑的 DeepSeek 选项，会影响电脑上的聊天。手机普通聊天的设置保持独立。")}</p>
    <RemoteComputerKey model={model}/>
    <RemoteComputerEndpoint model={model}/>
    {model.deepSeekModels && <RemoteProviderModelEditor service={model.deepSeekModels}/>}
    {view && <form onSubmit={event => { event.preventDefault(); void run(true); }}>
      {!view.writable && <p role="status">{t("电脑设置目前只读。")}</p>}
      {view.fields.map(field => {
        const definition = fields[field.key], edit = draft[field.key];
        const value = edit?.op === 'set' ? edit.value : field.value ?? '';
        return <div className="remote-computer-setting" key={field.key}>
          <label htmlFor={`computer-${field.key}`}>{t(definition.label)}</label>
          {definition.choices ? <select id={`computer-${field.key}`} className="sheet-editor" value={value} disabled={!connected || busy || !view.writable}
            onChange={event => change(field.key, { op: 'set', key: field.key, value: event.target.value })}>
            <option value="" disabled>{t("电脑默认")}</option>{definition.choices.map(([key, label]) => <option key={key} value={key}>{t(label)}</option>)}
          </select> : <input id={`computer-${field.key}`} className="sheet-editor" type="number" inputMode="numeric" min={definition.min} step="1" value={value}
            disabled={!connected || busy || !view.writable} onChange={event => change(field.key, { op: 'set', key: field.key, value: event.target.value === '' ? '' : Number(event.target.value) })}/>}
          <div className="remote-setting-meta"><small>{t(edit?.op === 'unset' ? '保存后恢复电脑默认值' : field.overridden ? '已单独设置' : '使用电脑默认值')}</small>
            <Button type="button" disabled={!connected || busy || !view.writable || (!field.overridden && !edit)} onClick={() => change(field.key, { op: 'unset', key: field.key })}>{t("恢复默认")}</Button></div>
        </div>;
      })}
      <Button type="submit" variant="primary" disabled={!connected || busy || stale || !view.writable || !Object.keys(draft).length}>{t("保存到电脑")}</Button>
    </form>}
    <Button disabled={!connected || busy} onClick={() => void run(false)}>{t(busy ? '正在处理…' : '重新读取设置')}</Button>
    {Object.keys(draft).length > 0 && <p className="remote-muted">{t("重新读取会放弃未保存的修改。")}</p>}
    {stale && <p role="status">{t('电脑设置已变化。你的修改已保留，请重新读取设置后核对。')}</p>}
    {notice && <p role="status">{t(notice)}</p>}
    <RemoteProviderCard model={model} provider="deepseek-official"/>
    {model.providerSettings && <RemoteProviderSettings model={model}/>}
    {connected && settings.permitted && <RemoteModelSettingsExtensions/>}
  </section>;
}
