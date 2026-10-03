import React, { useEffect, useState, useSyncExternalStore } from 'react';
import { modelReadinessSchema } from '../../backend/packages/protocol/dist/index.js';
import { WelcomeNoticeStore, decodeWelcomeSection } from '../../deepseek-harness/packages/client/ui-settings-models/src/client/welcome-store.ts';
import { WELCOME_NOTICE_SETTINGS_NAMESPACE } from '../../deepseek-harness/packages/client/ui-settings-models/src/onboarding-copy.ts';
import { zh, en } from '../../deepseek-harness/packages/client/ui-settings-models/src/client/locales.ts';
import { Button } from '@upstream/ui-primitives/src/Button.tsx';
import { Surface } from './ui/Surface.jsx';
import { useLocale } from './ui/locale.jsx';
import { RemoteComputerKey } from './ui/RemoteComputerKey.jsx';
import { RemoteComputerSettings } from './ui/RemoteComputerSettings.jsx';

export function MobileModelOnboarding({ model, complete }) {
  const [kind, setKind] = useState('loading');
  const copy = useLocale() === 'en' ? en : zh;
  const generation = model.connection.generation.getSnapshot()?.id;
  useEffect(() => {
    let alive = true, request, revision = 0;
    setKind('loading');
    const read = async () => {
      const version = ++revision;
      request?.cancel();
      try {
        request = model.client.request({ method: 'remote.modelReadiness' });
        const result = modelReadinessSchema.parse(await request.promise);
        if (alive && version === revision) setKind(result.kind);
      } catch {
        if (alive && version === revision) setKind('unavailable');
      }
    };
    const stops = ['settings/document-updated', 'credentials/reference-updated', 'llm/adapters-updated'].map(event => model.remote.$on(event, read));
    void read();
    return () => { alive = false; revision++; request?.cancel(); stops.forEach(stop => stop()); };
  }, [model, generation]);
  useEffect(() => {
    if (['provider-ready', 'adapter-absent', 'unavailable'].includes(kind)) complete();
  }, [kind, complete]);
  if (kind !== 'credential-missing') return null;
  return <Surface title={copy.onboardingTitle} onClose={keepOpen}>
    <header><h2>{copy.onboardingTitle}</h2></header><p>{copy.onboardingDescription}</p>
    <RemoteComputerKey model={model}/>
    <Button onClick={complete}>{copy.onboardingLater}</Button>
  </Surface>;
}

const pluginId = '@deepseek-ai/dsh-client-ui-settings-models';
const keepOpen = () => {};

/** 复用原确认状态和版本；手机只替换窗口，确认不写电脑设置。 */
function MobileWelcomeNotice({ controller, complete }) {
  const state = useSyncExternalStore(controller.store.subscribe, controller.store.getSnapshot);
  const copy = useLocale() === 'en' ? en : zh;
  useEffect(() => { if (state.status === 'idle') void controller.load(); }, [controller, state.status]);
  useEffect(() => { if (state.acknowledged) complete(); }, [state.acknowledged, complete]);
  if (state.status === 'idle' || state.status === 'loading' || state.acknowledged) return null;
  return <Surface title={copy.welcomeTitle} onClose={keepOpen}>
    <header><h2>{copy.welcomeTitle}</h2></header>
    {copy.welcomeBody.split('\n\n').map(paragraph => <p key={paragraph}>{paragraph}</p>)}
    {state.error && <p role="alert">{copy.welcomeError}</p>}
    <Button variant="primary" disabled={state.status === 'saving'} onClick={() => void controller.acknowledge().then(done => { if (done) complete(); })}>{copy.welcomeContinue}</Button>
  </Surface>;
}

export function installRemoteModelOnboarding(model) {
  const { ctx } = model;
  // 原模块保留用于依赖解析，apply由组合策略排除；页入口只由手机持有一个实例。
  const unregisterCopy = ctx.locale.register('settings.models', { zh, en });
  const t = ctx.locale.bind('settings.models');
  const unregisterSection = ctx.slots.register({ name: 'settings.section', id: 'models', order: 10,
    label: () => t('nav') }, () => <RemoteComputerSettings model={model} showConnectionNotice={false}/>);
  model.disposers.push(() => { unregisterSection(); unregisterCopy(); });
  const injection = ctx.inject(['settingsScope'], scoped => {
    const scope = scoped.settingsScope.bind({
      namespace: WELCOME_NOTICE_SETTINGS_NAMESPACE, decode: decodeWelcomeSection,
    });
    if (scope.getSnapshot().mode !== 'memory') return;
    const controller = new WelcomeNoticeStore(scope);
    let unregister, unregisterModels;
    const sync = () => {
      const plugin = model.getSnapshot().plugins?.entries?.find(entry => entry.id === pluginId);
      // 引导跟随原模块是否存在；页入口始终由手机组合持有。
      const composed = plugin && plugin.state !== 'active' && plugin.state !== 'failed';
      if (composed && !unregister) unregister = ctx.slots.register({ name: 'settings.onboarding', id: 'welcome-notice', order: -100 },
        owner => <MobileWelcomeNotice {...owner} controller={controller}/>);
      else if (!composed && unregister) { unregister(); unregister = undefined; }
      const models = composed && model.transport.capabilities?.modelReadiness === true && model.computerKey.supported;
      if (models && !unregisterModels) unregisterModels = ctx.slots.register({ name: 'settings.onboarding', id: 'deepseek-official', order: 0 },
        owner => <MobileModelOnboarding {...owner} model={model}/>);
      else if (!models && unregisterModels) { unregisterModels(); unregisterModels = undefined; }
    };
    const stop = model.subscribe(sync); sync();
    return () => { stop(); unregister?.(); unregisterModels?.(); controller.dispose(); };
  });
  model.disposers.push(() => injection.dispose());
}
