import React from 'react';

/** 合成连续事件仍经过原Session/投影/虚拟列表；不包含原用户思考或模型凭据。 */
export function reasoningChatFixture(model, channels, history) {
  let events = [], calls = 0, plugin;
  const source = { kind: 'model', provider: 'fixture', model: 'fixture' };
  const thought = (turn, step) => `REASONING_${turn}_${step}\n\n` + '分析边界与验证结果，保留原始思考内容。\n\n'.repeat(turn === 49 ? 120 : 4);
  const make = turn => {
    const rows = [];
    const emit = (type, data, surface = false) => rows.push({ type, data, ...(surface ? { surfaceOp: 'append' } : {}) });
    const message = (step, content) => emit('assistant/message', { turn, step, stream: [], message: {
      id: `reasoning-${turn}-${step}`, role: 'assistant', source, content,
    } }, true);
    emit('turn/start', { turn }); emit('step/start', { turn, step: 1 });
    if (turn === 50) {
      message(1, [{ type: 'reasoning', text: thought(turn, 1) }, { type: 'tool-call', id: 'reasoning-read', name: 'read', arguments: '{"file_path":"fixture.txt"}' }]);
      emit('tool/call', { turn, step: 1, callId: 'reasoning-read', name: 'read', arguments: '{"file_path":"fixture.txt"}' });
      emit('tool/result', { turn, step: 1, message: { id: 'reasoning-result', role: 'tool', source: { kind: 'tool', callId: 'reasoning-read' }, content: [{ type: 'text', text: 'REASONING_TOOL_RESULT' }] } }, true);
      emit('step/end', { turn, step: 1 }); emit('step/start', { turn, step: 2 });
    }
    const step = turn === 50 ? 2 : 1;
    message(step, [{ type: 'reasoning', text: thought(turn, step) }, { type: 'text', text: `REASONING_ANSWER_${turn}` }]);
    emit('step/end', { turn, step }); emit('turn/end', { turn, reason: { kind: 'completed' } });
    return rows;
  };
  return {
    async setup({ sessionId = 'one' } = {}) {
      await model.select(null); calls = 0;
      events = Array.from({ length: 50 }, (_, i) => make(i + 1)).flat().map((event, seq) => ({ ...event, seq, time: seq * 1000 }));
      history.active = true; history.sessionId = sessionId;
      history.snapshot = () => ({ cursor: events.at(-1).seq, hasMore: true, records: events.slice(-61).map(event => ({ type: 'event', event })) });
      history.page = async request => {
        calls++;
        const last = Math.min(request.throughSeq, (request.beforeSeq ?? request.throughSeq + 1) - 1);
        const first = Math.max(0, last - 59);
        return { ok: true, value: { hasMore: first > 0, records: events.slice(first, last + 1).map(event => ({ type: 'event', event })) } };
      };
      await model.select('one');
    },
    state: () => ({ calls }),
    async plugin() {
      plugin = model.ctx.plugin({ name: '@fixture/reasoning-body', inject: ['slots'], apply(ctx) {
        ctx.slots.inject('conversation.chat.reasoning.body', () => ctx.slots.register({ name: 'conversation.chat.reasoning.body' }, ({ text, running, renderFactorySlot }) =>
          <div data-reasoning-plugin data-running={running || undefined}>{renderFactorySlot('conversation.chat.reasoning.content', { text, running })}</div>));
      } });
      await plugin.await();
    },
    disable: () => plugin?.dispose(),
    live() {
      const next = make(51).map((event, index) => ({ ...event, seq: events.length + index, time: (events.length + index) * 1000 }));
      events.push(...next);
      for (const event of next) channels.get(history.sessionId)({ type: 'event', event });
    },
  };
}
