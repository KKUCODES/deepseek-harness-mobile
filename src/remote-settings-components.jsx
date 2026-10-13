import { BashCard } from '../../deepseek-harness/packages/client/ui-settings-plugins/src/client/BashCard.tsx';
export const MobileConfigCards = undefined;
export const configCardSlot = 'plugins.item';
import { BashCardController } from '../../deepseek-harness/packages/client/ui-settings-plugins/src/client/bash-card-controller.ts';
import { AgentLoopCard } from '../../deepseek-harness/packages/client/ui-settings-plugins/src/client/AgentLoopCard.tsx';
import { AgentLoopCardController } from '../../deepseek-harness/packages/client/ui-settings-plugins/src/client/agent-loop-card-controller.ts';
import { zh, en } from '../../deepseek-harness/packages/client/ui-settings-plugins/src/client/locales.ts';
export { zh, en };
export { SubagentCard } from '../../deepseek-harness/packages/client/ui-settings-plugins/src/client/SubagentCard.tsx';
export { SubagentLimitsCardController } from '../../deepseek-harness/packages/client/ui-settings-plugins/src/client/subagent-limits-card-controller.ts';
export { SubagentModelSelectionCardController } from '../../deepseek-harness/packages/client/ui-settings-plugins/src/client/subagent-model-selection-card-controller.ts';
export { subagentCardFace } from '../../deepseek-harness/packages/client/ui-settings-plugins/src/client/subagent-card-controller.ts';
export { CardForm, numberField } from '../../deepseek-harness/packages/client/ui-settings-plugins/src/client/card-form.ts';
export { PluginConfigForm } from '../../deepseek-harness/packages/client/ui-settings-plugins/src/client/PluginConfigForm.tsx';
export { ValueField } from '../../deepseek-harness/packages/client/ui-settings-plugins/src/client/fields.tsx';

export const shellCard = { Card: BashCard, Controller: BashCardController, hook: 'useBashCard', store: 'bashCard',
  title: 'bashTitle', description: 'bashDescription', locale: 'settings.plugins' };
export const agentLoopCard = { Card: AgentLoopCard, Controller: AgentLoopCardController, hook: 'useAgentLoopCard', store: 'agentLoopCard',
  title: 'agentLoopTitle', description: 'agentLoopDescription', locale: 'settings.plugins' };
export const subagentLocale = 'settings.plugins';
export const webSearchLocale = 'settings.plugins';
export const webSearchLabels = { title: 'webSearchTitle', description: 'webSearchDescription', maxUses: 'webSearchMaxUses', maxUsesHint: 'webSearchMaxUsesHint' };
export const cardLocales = {};
