import React, { useState } from 'react';
import { ShellCard as OriginalShellCard } from '@upstream/ui-settings-shell/src/client/ShellCard.tsx';
import { ShellCardController } from '@upstream/ui-settings-shell/src/client/shell-card-controller.ts';
import { AgentLoopCard as OriginalAgentLoopCard } from '@upstream/ui-settings-agent-loop/src/client/AgentLoopCard.tsx';
import { AgentLoopCardController } from '@upstream/ui-settings-agent-loop/src/client/agent-loop-card-controller.ts';
import { SettingsForm } from '@deepseek-ai/dsh-client-ui-primitives';
import { zh as shellZh, en as shellEn } from '@upstream/ui-settings-shell/src/client/locales.ts';
import { zh as loopZh, en as loopEn } from '@upstream/ui-settings-agent-loop/src/client/locales.ts';
import { zh as subagentZh, en as subagentEn } from '@upstream/ui-settings-subagent/src/client/locales.ts';
import { zh as searchZh, en as searchEn } from '@upstream/ui-settings-web-search/src/client/locales.ts';
export { zh, en } from '@upstream/ui-settings-plugins/src/client/locales.ts';
export { SubagentCard } from '@upstream/ui-settings-subagent/src/client/SubagentCard.tsx';
export { SubagentLimitsCardController } from '@upstream/ui-settings-subagent/src/client/subagent-limits-card-controller.ts';
export { SubagentModelSelectionCardController } from '@upstream/ui-settings-subagent/src/client/subagent-model-selection-card-controller.ts';
export { subagentCardFace } from '@upstream/ui-settings-subagent/src/client/subagent-card-controller.ts';
export { SettingsFormModel as CardForm, settingsNumberField as numberField, SettingsValueField as ValueField } from '@deepseek-ai/dsh-client-ui-primitives';

// 新版拆分了局部设置页面；只转换表单外壳的 labels，写入仍走相同的固定 Remote scope。
export function PluginConfigForm({ t, ...props }) {
  return <SettingsForm {...props} labels={Object.fromEntries(['unavailable', 'readOnly', 'saveFailed', 'save', 'saving'].map(key => [key, t(key)]))} />;
}
// 原卡片的 reset 只看 writable；保存回执未落定时禁止继续编辑，避免新草稿被原模型清空。
function ShellCard(props) {
  const saving = props.useShellCard(state => state.saving);
  return <fieldset disabled={saving} style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}><OriginalShellCard {...props} /></fieldset>;
}
function AgentLoopCard(props) {
  const saving = props.useAgentLoopCard(state => state.saving);
  return <fieldset disabled={saving} style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}><OriginalAgentLoopCard {...props} /></fieldset>;
}
export const shellCard = { Card: ShellCard, Controller: ShellCardController, hook: 'useShellCard', store: 'shellCard',
  title: 'title', description: 'description', locale: 'dshm.settings.shell' };
export const agentLoopCard = { Card: AgentLoopCard, Controller: AgentLoopCardController, hook: 'useAgentLoopCard', store: 'agentLoopCard',
  title: 'title', description: 'description', locale: 'dshm.settings.agentLoop' };
export const subagentLocale = 'dshm.settings.subagent';
export const webSearchLocale = 'dshm.settings.webSearch';
export const webSearchLabels = { title: 'title', description: 'description', maxUses: 'maxUses', maxUsesHint: 'maxUsesHint' };
export const cardLocales = { [shellCard.locale]: { zh: shellZh, en: shellEn }, [agentLoopCard.locale]: { zh: loopZh, en: loopEn },
  [subagentLocale]: { zh: subagentZh, en: subagentEn }, [webSearchLocale]: { zh: searchZh, en: searchEn } };

// 新版 plugins.item 由原插件管理页声明；手机设置分页使用自己的插槽，避免抢占其所有权。
export const configCardSlot = 'dshm.plugins.configuration';
/** 手机设置分页与原插件管理页复用同一组固定字段卡片，保持授权边界。 */
export function MobileConfigCards({ useCards, renderSlot, t }) {
  const rows = useCards(value => value), [selected, setSelected] = useState('');
  const [visited, setVisited] = useState(() => new Set());
  const active = rows.find(row => row.id === selected)?.id ?? rows[0]?.id;
  return <>
    <select className="sheet-editor" aria-label={t('configuration')} value={active ?? ''} onChange={event => {
      setVisited(before => new Set([...before, active, event.target.value]));
      setSelected(event.target.value);
    }}>
      {rows.map(row => <option key={row.id} value={row.id}>{row.label}</option>)}
    </select>
    {rows.filter(row => row.id === active || visited.has(row.id)).map(row => <div key={row.id} hidden={row.id !== active}>
      {renderSlot(configCardSlot, { view: 'page' }, { only: row.id })}
    </div>)}
  </>;
}
