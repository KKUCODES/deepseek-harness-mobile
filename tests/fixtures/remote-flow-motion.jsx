import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { ChatNodeSeat } from '@upstream/ui-chat/src/client/chat/ChatNodeSeat.tsx';
import { TurnProcessNodeView } from '@upstream/ui-chat/src/client/chat/TurnProcessNodeView.tsx';
import { chatSeatProps, createChatFlowMotion } from '../../src/remote-chat-presentation-alpha2.jsx';
import { RemoteFlowMotion } from '../../src/ui/motion.jsx';

function Case({ id }) {
  const [expanded, setExpanded] = useState(false);
  const [motion] = useState(() => createChatFlowMotion(() => null, () => {}));
  useEffect(() => () => motion.clear(), [motion]);
  const turn = { turn: 1, status: 'closed', start: { time: 1000 }, end: { time: 2000, data: { reason: { kind: 'completed' } } } };
  const spec = { turn: 1, controlAnchorSeq: 0, processStartSeq: 0, answerAnchorSeq: null, answerStep: null, inlineReasoning: false };
  const props = { ...chatSeatProps, useChatNodeBottom: () => false,
    useChatNode: key => ({ key, kind: key.endsWith('summary') ? 'turn-process' : 'tool-call', anchorSeq: 1, location: { kind: 'turn', turn }, data: { turn: 1 } }),
    useChatNodeProcess: () => ({ turn: 1, turnStarted: true, turnClosed: true, hasExternalProcess: true, spec }),
    usePresentation: select => select({ foldCompletedTurns: true }),
    useStore: select => select({ turnProcesses: [{ turn: 1, answerStep: 0, collapsed: !expanded }] }),
    actions: { setTurnProcessOpen: (_turn, _step, value) => setExpanded(value) },
    t: key => ({ 'message.turnProcess.worked': '已完成', 'message.turnProcess.took': '已完成，用时' })[key] ?? key,
    renderSlot: (_name, owner) => owner.node.kind === 'turn-process' ? <TurnProcessNodeView {...owner} t={props.t}/>
      : <div style={{ padding: 12 }}><p>工具执行过程</p><p>命令输出与修改记录</p><input aria-label={`${id} 局部草稿`}/></div> };
  return <RemoteFlowMotion.Provider value={motion}><section data-case={id} data-chat-motion="" style={{ height: 240, overflow: 'auto', border: '1px solid #ddd' }}>
    <ChatNodeSeat {...props} nodeKey={`${id}:summary`}/><ChatNodeSeat {...props} nodeKey={`${id}:tool`}/>
  </section></RemoteFlowMotion.Provider>;
}
createRoot(document.getElementById('app')).render(<><Case id="main"/><Case id="aside"/></>);
