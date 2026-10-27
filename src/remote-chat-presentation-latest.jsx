import { createSnapshotStore } from '@deepseek-ai/dsh-client-store';
import { derivePresentationPolicy } from '@upstream/ui-chat/src/client/presentation-policy.ts';
import { bindDisclosure } from '@upstream/ui-chat/src/client/chat/use-disclosure.ts';
import { useTurnDataValue } from '@upstream/ui-chat/src/client/chat/use-turn-data.ts';
import { ReasoningContent, DefaultReasoningBody } from '@upstream/ui-chat/src/client/chat/ReasoningContent.tsx';
export { ReasoningRow as ChatReasoningRow } from '@upstream/ui-chat/src/client/chat/ReasoningRow.tsx';
export { bindDisclosure as bindChatDisclosure } from '@upstream/ui-chat/src/client/chat/use-disclosure.ts';
export { RunningStatus as ChatRunningStatus } from '@upstream/ui-chat/src/client/chat/RunningStatus.tsx';

// 手机沿用现有紧凑过程布局，新版节点统一从原 presentation 策略读取。
export const chatPresentation = derivePresentationPolicy(createSnapshotStore('compact'), createSnapshotStore('completion'));
// 与新版原ChatNodeSeat的hookContext契约一致，折叠复位仍由原节点管理。
export const chatNodeHooks = {
  turnData: (_standard, { turnData }) => key => useTurnDataValue(turnData, key),
  disclosure: (_standard, { disclosureReset }) => bindDisclosure(disclosureReset),
};
export const chatNodeBottom = false;
export const chatSeatProps = undefined;
export const createChatFlowMotion = undefined;
export { useSearchableHidden as useChatProcessHidden } from '@upstream/ui-chat/src/client/chat/searchable-hidden.ts';

/** 保留原思考正文席位与内容工厂，插件无需识别手机私有组件。 */
export function installChatReasoning(slots, locale) {
  slots.registerFactory({ name: 'conversation.chat.reasoning.content', scope: 'root', locale }, ReasoningContent);
  slots.inject('conversation.chat.reasoning.body', () => slots.register({ name: 'conversation.chat.reasoning.body', priority: 100 }, DefaultReasoningBody));
}
