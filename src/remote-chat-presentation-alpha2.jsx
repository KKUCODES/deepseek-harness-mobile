import { useCallback, useContext, useLayoutEffect, useRef } from 'react';
import { useSearchableHidden } from '@upstream/ui-chat/src/client/chat/searchable-hidden.ts';
import { RemoteFlowMotion, reducedMotion } from './ui/motion.jsx';
export { createFlowMotion as createChatFlowMotion } from '@upstream/ui-chat/src/client/chat/flow-motion.ts';
import { chatNodeHooks as previousHooks } from './remote-chat-presentation-latest.jsx';

export { chatPresentation, ChatRunningStatus } from './remote-chat-presentation-latest.jsx';
export const chatNodeBottom = true;
export const chatNodeHooks = {
  ...previousHooks,
  groupAction: (_standard, { useGroupAction }) => useGroupAction,
};

// 使用当前手机视口的折叠时钟，不引入桌面滚动协调器或跨会话广播。
function useMobileGroupAction(hidden, reveal) {
  const motion = useContext(RemoteFlowMotion), current = useRef(null);
  const settle = useRef(() => {});
  useLayoutEffect(() => () => { if (current.current) motion?.cancelMotion(current.current); }, [motion]);
  useLayoutEffect(() => {
    const preference = matchMedia('(prefers-reduced-motion: reduce)');
    const stop = () => { if (preference.matches) settle.current(); };
    preference.addEventListener('change', stop);
    return () => preference.removeEventListener('change', stop);
  }, []);
  const transition = useCallback((element, hiding, commit) => {
    settle.current = () => { motion?.cancelMotion(element); commit(); };
    const initialized = current.current === element;
    current.current = element;
    if (!motion || !initialized || reducedMotion()) { motion?.cancelMotion(element); commit(); return; }
    if (hiding) {
      if (!element.hasAttribute('hidden') && element.dataset.chatMotion !== 'collapse') motion.collapse(element, commit);
    } else {
      const wasHidden = element.hasAttribute('hidden') || element.dataset.chatMotion === 'collapse';
      motion.cancelMotion(element); commit();
      if (wasHidden) motion.reveal(element);
    }
  }, [motion]);
  return useSearchableHidden(hidden, reveal, transition);
}

export const chatSeatProps = { useGroupAction: useMobileGroupAction, deferCollapse: false };
export const useChatProcessHidden = useMobileGroupAction;
