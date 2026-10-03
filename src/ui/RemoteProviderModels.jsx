import React, { useEffect, useSyncExternalStore } from 'react';
import { Button } from '@upstream/ui-primitives/src/Button.tsx';
import { useTranslate } from './locale.jsx';

/** 与聊天选择器共享电脑目录，不从提供方配置猜测最终可用模型。 */
export function RemoteProviderModels({ model, provider }) {
  const t = useTranslate();
  const catalog = model.modelCatalog;
  const state = useSyncExternalStore(catalog.store.subscribe, catalog.store.getSnapshot);
  useEffect(() => { void catalog.load().catch(() => {}); }, [catalog, provider]);
  const ready = state.status === 'ready';
  const group = ready ? state.value?.groups.find(group => group.id === provider) : undefined;
  const failed = ready && state.value?.failures.some(failure => failure.id === provider);
  const routable = ready && state.value?.routableProviders.includes(provider);
  return <section className="remote-provider-models" aria-label={t('提供方模型')}>
    <h3>{t('提供方模型')}</h3>
    {(state.status === 'idle' || state.status === 'loading') && <p role="status">{t('正在读取电脑上的模型…')}</p>}
    {state.status === 'error' && <p role="alert">{t('暂时无法读取电脑模型，请重试。')}</p>}
    {failed && <p role="alert">{t('此提供方的模型目录读取失败，请检查电脑配置。')}</p>}
    {ready && !failed && !routable && <p role="status">{t('此提供方暂时不可用于聊天，请检查电脑配置和凭据。')}</p>}
    {ready && !failed && routable && !group?.models.length && <p role="status">{t('此提供方尚无可用模型。')}</p>}
    {group?.models.map(item => <div className="remote-computer-setting" key={item.id}>
      <div>{item.name}</div>
      <small className="remote-muted">{item.id}</small>
    </div>)}
    <Button disabled={state.status === 'loading'} onClick={() => catalog.refresh()}>{t('重新读取模型')}</Button>
  </section>;
}
