import { useContext } from 'react';
import { useFlowHidden } from '@upstream/ui-chat/src/client/chat/flow-motion.ts';
import { RemoteFlowMotion } from './ui/motion.jsx';
export { createFlowMotion as createChatFlowMotion } from '@upstream/ui-chat/src/client/chat/flow-motion.ts';
import { chatNodeHooks as previousHooks } from './remote-chat-presentation-latest.jsx';

export { chatPresentation, ChatRunningStatus, ChatReasoningRow, bindChatDisclosure, installChatReasoning } from './remote-chat-presentation-latest.jsx';
export const chatNodeBottom = true;
export const chatNodeHooks = {
  ...previousHooks,
  groupAction: (_standard, { useGroupAction }) => useGroupAction,
};

// 原Hook负责取消、卸载和临时样式清理，手机只选择当前视口的原控制器。
function useMobileGroupAction(hidden, reveal) {
  return useFlowHidden(hidden, reveal, useContext(RemoteFlowMotion));
}

export const chatSeatProps = { useGroupAction: useMobileGroupAction, deferCollapse: false };
export const useChatProcessHidden = useMobileGroupAction;
