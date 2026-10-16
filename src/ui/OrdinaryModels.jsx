import React from 'react';
import { Button } from '@upstream/ui-primitives/src/Button.tsx';
import { providerOf } from '../ordinary-providers.mjs';
import { useTranslate } from './locale.jsx';

/** 聊天和默认模型选择共用目录，以供应商 ID 区分同名模型。 */
export function OrdinaryModels({ providers, selection, busy, onSelect, onManage }) {
  const t = useTranslate();
  return <div className="ordinary-models">{providers.map(provider => <section key={provider.id}>
    <h3>{provider.name}{!provider.configured && <small> · {t('未配置 Key')}</small>}</h3>
    {provider.models.map(model => <Button className="option" key={model.id} disabled={busy}
      aria-pressed={providerOf(selection) === provider.id && selection.model === model.id}
      onClick={() => onSelect({ provider: provider.id, model: model.id })}>{model.label}<span>{providerOf(selection) === provider.id && selection.model === model.id ? t('已选') : ''}</span></Button>)}
  </section>)}{onManage && <Button className="option" disabled={busy} onClick={onManage}>{t('管理模型服务')}</Button>}</div>;
}
