import React, { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { resolveSlotLabel } from '@deepseek-ai/dsh-client-ui-slots';
import { RemoteSettingsSectionExtension } from '../remote-plugin-slots.jsx';
import { useTranslate } from './locale.jsx';
import { RemoteConnectionNotice } from './RemoteConnectionNotice.jsx';

/** 手机承担设置窗口与导航；插件收到原 root 作用域和 close owner。 */
export function RemoteSettings({ model, onClose, navigation }) {
  const initialSection = navigation?.id ?? 'models';
  const t = useTranslate(), slots = model.ctx.slots;
  const state = useSyncExternalStore(model.subscribeView, model.getSnapshot);
  useSyncExternalStore(listener => slots.subscribe('settings.section', listener), () => slots.getVersion('settings.section'));
  const [selected, setSelected] = useState(initialSection);
  const connected = state.connectionState === 'connected';
  const permission = useRef({ model, allowed: false });
  if (permission.current.model !== model) permission.current = { model, allowed: false };
  if (connected) permission.current.allowed = model.transport.capabilities?.management === true;
  // 临时断线只冻结已授权页面；明确收权或更换model才丢弃该页实例。
  const entries = permission.current.allowed ? slots.entries('settings.section')
    .map(entry => ({ id: entry.options.id, order: entry.options.order ?? 0, label: resolveSlotLabel(entry.options.label) ?? entry.options.id }))
    .sort((a, b) => a.order - b.order) : [];
  const active = entries.some(entry => entry.id === selected) ? selected : entries.some(entry => entry.id === 'models') ? 'models' : entries[0]?.id;
  const [visited, setVisited] = useState(() => new Set([initialSection]));
  useEffect(() => {
    if (!navigation) return;
    setSelected(navigation.id); setVisited(before => new Set([...before, navigation.id]));
  }, [navigation]);
  // 设置页插槽在未授权时不会挂载，访问提示必须由外层导航负责。
  if (connected && !permission.current.allowed) return <p role="status">{t('请先在电脑端授予此设备管理权限，再查看或修改电脑设置。')}</p>;
  return <>
    <RemoteConnectionNotice state={state}/>
    {!!entries.length && <label>{t('设置页面')}
      <select className="sheet-editor" disabled={!connected} value={active} onChange={event => {
        const id = event.target.value; setSelected(id); setVisited(before => new Set([...before, id]));
      }}>
        {entries.map(entry => <option key={entry.id} value={entry.id}>{entry.id === 'models' ? t('模型设置') : entry.label}</option>)}
      </select>
    </label>}
    <fieldset className="remote-settings-content" disabled={!connected} inert={!connected ? '' : undefined}>
      {entries.filter(entry => visited.has(entry.id) || entry.id === active).map(entry => <div key={entry.id} hidden={active !== entry.id}>
        <RemoteSettingsSectionExtension id={entry.id} onClose={onClose} active={connected && active === entry.id}/>
      </div>)}
    </fieldset>
  </>;
}
