import { createSnapshotStore } from '@deepseek-ai/dsh-client-store';
import { derivePresentationPolicy } from '@upstream/ui-chat/src/client/presentation-policy.ts';
import { bindDisclosure } from '@upstream/ui-chat/src/client/chat/use-disclosure.ts';
import { useTurnDataValue } from '@upstream/ui-chat/src/client/chat/use-turn-data.ts';

// 手机沿用现有紧凑过程布局，新版节点统一从原 presentation 策略读取。
export const chatPresentation = derivePresentationPolicy(createSnapshotStore('compact'), createSnapshotStore('completion'));
// 与新版原ChatNodeSeat的hookContext契约一致，折叠复位仍由原节点管理。
export const chatNodeHooks = {
  turnData: (_standard, { turnData }) => key => useTurnDataValue(turnData, key),
  disclosure: (_standard, { disclosureReset }) => bindDisclosure(disclosureReset),
};
export const chatNodeBottom = false;
export const chatSeatProps = undefined;
