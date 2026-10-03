import React, { useEffect, useState, useSyncExternalStore } from 'react';
import { providerCardViewSchema } from '../../../backend/packages/protocol/dist/index.js';
import { RemoteProviderCardExtension } from '../remote-plugin-slots.jsx';
import { computerSettingsError } from '../remote-settings.mjs';
import { useTranslate } from './locale.jsx';
import { Button } from '@upstream/ui-primitives/src/Button.tsx';

/** 原扩展仅收到电脑确认的公开 owner；无注册项时不额外读取凭据状态。 */
export function RemoteProviderCard({ model, provider }) {
  const t = useTranslate(), slots = model.ctx.slots;
  const version = useSyncExternalStore(listener => slots.subscribe('settings.models.provider-card', listener),
    () => slots.getVersion('settings.models.provider-card'));
  const state = useSyncExternalStore(model.subscribeView, model.getSnapshot);
  const generation = model.connection.generation.getSnapshot()?.id;
  const [revision, refresh] = useState(0), [result, setResult] = useState(null);
  const allowed = state.connectionState === 'connected' && model.transport.capabilities?.management === true
    && model.transport.capabilities?.providerCards === true && slots.entries('settings.models.provider-card').length > 0;
  useEffect(() => {
    const changed = () => refresh(value => value + 1);
    const offs = ['settings/document-updated', 'credentials/reference-updated', 'llm/adapters-updated'].map(event => model.remote.$on(event, changed));
    return () => offs.forEach(off => off());
  }, [model]);
  useEffect(() => {
    if (!allowed) return;
    let active = true;
    const request = model.client.request({ method: 'remote.providerCardRead', provider });
    void request.promise.then(value => {
      const view = providerCardViewSchema.parse(value);
      if (view.provider.provider !== provider) throw Error('remote_settings_invalid');
      if (active) setResult({ provider, generation, revision, view });
    }).catch(error => {
      if (active) setResult(previous => ({ provider, generation, revision, error: computerSettingsError(error),
        ...(previous?.provider === provider && previous.generation === generation ? { view: previous.view } : {}) }));
    });
    return () => { active = false; request.cancel(); };
  }, [model, provider, generation, allowed, version, revision]);
  if (!allowed || !result || result.provider !== provider || result.generation !== generation) return null;
  const pending = result.revision !== revision;
  // 同一连接的刷新保留插件实例与草稿，但核验完成前不展示旧 owner，也不允许交互。
  return <>
    {result.view && <div hidden={pending || !!result.error}><RemoteProviderCardExtension view={result.view}/></div>}
    {!pending && result.error && <div role="status"><p>{t(result.error)}</p><Button onClick={() => refresh(value => value + 1)}>{t('重新读取设置')}</Button></div>}
  </>;
}
