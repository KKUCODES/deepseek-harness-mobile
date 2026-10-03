import React from 'react';

// 真实 Session/Conversation 服务与页面，只有电脑协议响应使用隔离回放。
export function conversationChecks(model, transport) {
  let plugin, retained, oldTarget;
  const calls = [];
  let failure;
  const originalCall = transport.call;
  const scoped = () => model.reference.binding.ctx.get('conversation');
  const target = () => scoped().input.for(model.reference.binding.ctx);
  return {
    async conversationProbe() {
      plugin = model.ctx.plugin({ name: '@fixture/conversation-api', inject: ['slots', 'conversation'], apply(ctx) {
        ctx.slots.register({ name: 'conversation.input.overlay', id: 'conversation-api' }, ({ useConversation, sessionId }) => {
          const current = useConversation(state => state);
          return <div data-testid="conversation-probe" style={{ position: 'absolute', bottom: '100%' }}>
            <output>{sessionId}:{String(current === model.conversations.binding(sessionId).snapshot.getSnapshot())}</output>
            <button onClick={() => target().focus()}>聚焦消息</button>
          </div>;
        });
        ctx.effect(() => () => { for (const id of ['one', 'two']) ctx.conversation.blocks.set(id, undefined); });
      } });
      await plugin.await();
      transport.call = async (channel, endpoint, payload, signal) => {
        if (!['session/prompt', 'session/cancel', 'session/updateQueue'].includes(endpoint)) return originalCall.call(transport, channel, endpoint, payload, signal);
        calls.push({ endpoint, request: payload.args.request });
        return failure ? { ok: false, error: { code: failure, message: 'fixture rejected' } } : { ok: true, value: { accepted: true } };
      };
    },
    conversationBlock: reason => scoped().blocks.set(model.reference.sessionId, reason ? { reason } : undefined),
    conversationNotify: text => target().notify('info', text),
    conversationSubmit: () => target().submit(),
    conversationDraft: text => target().setDraft(text),
    conversationCalls: () => calls,
    conversationLoadOlder: () => scoped().loadOlder(),
    async conversationVerbs() {
      const outcomes = [];
      try { await model.ctx.get('conversation').send('root must reject'); } catch { outcomes.push('root rejected'); }
      try { model.ctx.get('conversation').input.for(model.ctx); } catch { outcomes.push('root input rejected'); }
      await scoped().send('verbatim /file @raw');
      await scoped().cancel();
      await scoped().updateQueue('queue-1', { kind: 'remove' });
      failure = 'session/queue-item-not-found';
      await scoped().updateQueue('queue-1', { kind: 'steer' });
      outcomes.push('steer converged');
      failure = 'fixture/failed';
      for (const [name, run] of [['send', () => scoped().send('reject')], ['cancel', () => scoped().cancel()], ['queue', () => scoped().updateQueue('queue-1', { kind: 'remove' })]]) {
        try { await run(); } catch { outcomes.push(`${name} rejected`); }
      }
      failure = undefined;
      return outcomes;
    },
    async conversationRetain() {
      retained = model.sessions.retain(model.reference.sessionId, { source: 'controllerOperation', signal: model.lifetime.signal });
      await retained.ready;
      oldTarget = target();
    },
    conversationLate: () => oldTarget.notify('info', '原会话迟到提示'),
    async conversationRelease() { retained.release(); retained = undefined; },
    conversationStale: () => { oldTarget.notify('error', '过期提示'); oldTarget.setDraft('过期草稿'); oldTarget.submit(); },
    async conversationCleanup() {
      retained?.release(); retained = undefined;
      await plugin.dispose(); transport.call = originalCall;
    },
  };
}
