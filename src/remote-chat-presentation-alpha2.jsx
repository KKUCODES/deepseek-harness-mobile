import { useFlowHidden } from '@upstream/ui-chat/src/client/chat/flow-motion.ts';
import { chatNodeHooks as previousHooks } from './remote-chat-presentation-latest.jsx';

export { chatPresentation } from './remote-chat-presentation-latest.jsx';
export const chatNodeBottom = true;
export const chatNodeHooks = {
  ...previousHooks,
  groupAction: (_standard, { useGroupAction }) => useGroupAction,
};

// 手机保留自己的滚动容器；使用上游支持的同步隐藏，避免引入第二个桌面滚动协调器。
function useMobileGroupAction(hidden, reveal) {
  return useFlowHidden(hidden, reveal, undefined);
}

export const chatSeatProps = { useGroupAction: useMobileGroupAction, deferCollapse: false };
