import { chatNode } from '../../deepseek-harness/packages/client/ui-chat/src/client/conversation-nodes/common.ts';

/** pre-step拒绝可能没有用户或模型消息；按原结算事件保留可重读的结果，不补造消息。 */
export const remoteTurnBlockedDefinition = {
  kind: 'turn-blocked', target: 'chat',
  match: event => event.type === 'turn/end' && event.data.reason.kind === 'blocked'
    ? { id: String(event.data.turn), role: 'start' } : null,
  start: (_context, match) => ({ turn: match.event.data.turn, seq: match.event.seq, time: match.event.time }),
  update: context => context.state,
  buildViewNode: context => context.state
    ? chatNode(context, 'turn-blocked', context.state.seq, context.state) : null,
};
