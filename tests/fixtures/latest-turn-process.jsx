import React from 'react';
import { createRoot } from 'react-dom/client';
import { ChatNodeSeat } from '@upstream/ui-chat/src/client/chat/ChatNodeSeat.tsx';
import { TurnProcessNodeView } from '@upstream/ui-chat/src/client/chat/TurnProcessNodeView.tsx';

// 只回放结算状态的主聊天/旁栏展示契约；不启动模型或模拟 Remote 授权。
const t = key => ({ 'message.turnProcess.worked': '已完成', 'message.turnProcess.took': '已完成，用时',
  'message.stopped': '已停止', 'message.turnProcess.failed': '执行失败' })[key] ?? key;
function Case({ id, reason, status = 'closed' }) {
  const turn = { turn: 1, status, start: { time: 1000 }, end: status === 'closed' ? { time: 2000, data: { reason: { kind: reason } } } : undefined };
  const node = kind => ({ key: id + ':' + kind, kind, anchorSeq: 1, location: { kind: 'turn', turn }, data: { turn: 1 } });
  const process = { turn: 1, turnClosed: status === 'closed', turnStarted: true, hasExternalProcess: true,
    spec: { turn: 1, controlAnchorSeq: 0, processStartSeq: 0, answerAnchorSeq: null, answerStep: null, inlineReasoning: false } };
  const props = { useChatNode: key => node(key.endsWith('turn-process') ? 'turn-process' : 'turn-blocked'),
    useChatNodeProcess: () => process, usePresentation: select => select({ foldCompletedTurns: true }),
    useStore: select => select({ turnProcesses: [] }), actions: { setTurnProcessOpen() {} }, t,
    renderSlot: (_name, owner) => owner.node.kind === 'turn-process'
      ? <TurnProcessNodeView {...owner} t={t}/>
      : <p data-turn-blocked="1" role="status">本轮任务受阻，未继续执行。</p> };
  return <section data-case={id}>
    <ChatNodeSeat {...props} nodeKey={id + ':turn-process'}/>
    <ChatNodeSeat {...props} nodeKey={id + ':turn-blocked'}/>
  </section>;
}
createRoot(document.getElementById('app')).render(<>
  <Case id="main" reason="blocked"/><Case id="aside" reason="blocked"/>
  <Case id="completed" reason="completed"/><Case id="aborted" reason="aborted"/>
  <Case id="error" reason="error"/><Case id="running" status="open"/>
  <Case id="interrupted" reason="interrupted"/><Case id="interrupted-aside" reason="interrupted"/>
</>);
