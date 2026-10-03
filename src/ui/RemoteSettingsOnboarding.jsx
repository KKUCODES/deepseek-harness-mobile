import React, { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react';
import { RemoteSettingsOnboardingExtension } from '../remote-plugin-slots.jsx';

/** 原设置引导的root owner；手机只协调步骤与导航，插件仍决定是否显示界面。 */
export function RemoteSettingsOnboarding({ model, openSection }) {
  const slots = model.ctx.slots;
  const state = useSyncExternalStore(model.subscribeView, model.getSnapshot);
  useSyncExternalStore(listener => slots.subscribe('settings.onboarding', listener), () => slots.getVersion('settings.onboarding'));
  const [completed, setCompleted] = useState(() => new Set());
  const main = Object.values(state.list?.byId ?? {}).find(session => (session.retainedBy.mainView ?? 0) > 0);
  const emptyMain = state.list?.phase === 'ready' && (!main || main.blank);
  const allowed = emptyMain && state.connectionState === 'connected' && model.transport.capabilities?.management === true;
  const step = allowed ? slots.entries('settings.onboarding').slice()
    .sort((a, b) => (a.options.order ?? 0) - (b.options.order ?? 0))
    .find(entry => !completed.has(entry.options.id)) : undefined;
  const current = useRef(); current.current = { step, openSection };
  const alive = useRef(true);
  useLayoutEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  useEffect(() => { if (!emptyMain) setCompleted(new Set()); }, [emptyMain]);
  if (!step) return null;
  const id = step.options.id;
  // 卸载、切换步骤、收权或离开首页后，旧owner不再有导航/完成权限。
  const valid = () => alive.current && current.current.step === step && !model.lifetime.signal.aborted
    && slots.entries('settings.onboarding').includes(step);
  return <RemoteSettingsOnboardingExtension key={id} id={id}
    complete={() => { if (valid()) setCompleted(before => new Set([...before, id])); }}
    openSection={target => {
      if (!valid() || typeof target !== 'string') return;
      if (target === 'models' || slots.entries('settings.section').some(entry => entry.options.id === target)) current.current.openSection(target);
    }}/>;
}
