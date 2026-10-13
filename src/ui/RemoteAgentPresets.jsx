import React, { useEffect, useState, useSyncExternalStore } from 'react';
import { useTranslate, useLocale } from './locale.jsx';
import { Button } from '@upstream/ui-primitives/src/Button.tsx';
import { IconCheckOutline16, IconChevronDownOutline14 } from '@upstream/ui-primitives/src/icons/index.tsx';
import { agentPresetText } from '../remote-agent-presets.mjs';

export function RemoteAgentPresetLabel({ model, onOpen }) {
  const t = useTranslate();
  const locale = useLocale();
  const state = useSyncExternalStore(model.subscribeView, model.getSnapshot);
  const catalog = useSyncExternalStore(model.agentPresets.subscribe, model.agentPresets.getSnapshot);
  useEffect(() => { if (model.agentPresets.available) void model.agentPresets.load(); }, [model]);
  if (!model.agentPresets.available || state.agentPreset == null) return null;
  const option = (catalog.allOptions ?? catalog.options).find(item => item.id === state.agentPreset);
  const name = option ? agentPresetText(option, locale).name : state.agentPreset;
  return <div className="remote-agent-mode"><Button aria-label={t('Agent 模式，当前 {name}', { name })} disabled={catalog.busy} onClick={onOpen}>{name}<IconChevronDownOutline14/></Button></div>;
}

export function RemoteAgentPresetPicker({ model, sessionId }) {
  const t = useTranslate();
  const locale = useLocale();
  const state = useSyncExternalStore(model.subscribeView, model.getSnapshot);
  const catalog = useSyncExternalStore(model.agentPresets.subscribe, model.agentPresets.getSnapshot);
  const [error, setError] = useState('');
  const locked = state.selected !== sessionId || state.session?.openState !== 'open' || !state.session.blank || state.session.running || state.session.awaitingFirstTurn;
  useEffect(() => { void model.agentPresets.load(); }, [model]);
  const choose = async id => { setError(''); try { await model.agentPresets.choose(id, sessionId); } catch (failure) { setError(failure.message); } };
  return <section className="remote-agent-presets">
    <p className="muted">{t("选择这次聊天使用的工具与能力，发送第一条消息后固定。")}</p>
    {locked && <p role="status">{t("本次聊天已开始，模式不能更换。")}</p>}
    {!catalog.enabled && catalog.status === 'ready' && <p role="status">{t("电脑未开启模式选择。")}</p>}
    {!model.agentPresets.writable && <p role="status">{t("请更新电脑插件和网关后选择模式。")}</p>}
    {catalog.status === 'loading' && <p role="status">{t("正在读取电脑模式…")}</p>}
    {(catalog.error || error) && <p role="alert">{t(error || catalog.error)}</p>}
    {catalog.status === 'ready' && catalog.options.map(option => {
      const text = agentPresetText(option, locale);
      return <Button key={option.id} data-agent-preset={option.id} className="option remote-permission-option" aria-label={text.name} aria-pressed={state.agentPreset === option.id}
        disabled={locked || catalog.busy || !catalog.enabled || !model.agentPresets.writable} onClick={() => void choose(option.id)}>
        <span><strong>{text.name}</strong>{text.description && <small>{text.description}</small>}</span>{state.agentPreset === option.id && <IconCheckOutline16/>}
      </Button>;
    })}
    {catalog.status === 'ready' && !catalog.options.length && <p role="status">{t("电脑没有可选模式。")}</p>}
    <Button disabled={catalog.busy || catalog.status === 'loading'} onClick={() => { setError(''); void model.agentPresets.load(); }}>{t("重新读取模式")}</Button>
  </section>;
}
