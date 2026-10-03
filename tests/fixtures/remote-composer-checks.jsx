import React from 'react';

// 原插槽和pending-domain契约回放；仅本地插件操作，不制造电脑审批或模型回复。
export function composerChecks(model) {
  let plugin, barPlugin, goalPlugin, remove, publish, delegated = 0;
  return {
    async enableComposerBarProbe() {
      goalPlugin = model.ctx.plugin({ name: '@deepseek-ai/dsh-client-ui-goal', inject: ['slots'], apply(ctx) {
        ctx.slots.register({ name: 'conversation.input.dock', id: 'goal' }, () => { throw new Error('Duplicate built-in goal dock mounted'); });
        ctx.slots.register({ name: 'conversation.input.dock', id: 'other-extension' }, () => <span data-testid="other-goal-dock"/>);
      } });
      await goalPlugin.await();
      barPlugin = model.ctx.plugin({ name: '@fixture/composer-bar', inject: ['slots'], apply(ctx) {
        ctx.slots.register({ name: 'conversation.composer.bar' }, ({ sessionId, useInput, inputActions, variant, disabled, blocked }) => {
          const draft = useInput(value => value.draft);
          return <section data-testid="composer-bar-probe" data-session={sessionId} data-variant={variant} style={{ width: 600 }}>
            <input aria-label="插件消息" value={draft} disabled={disabled || !!blocked} onChange={event => inputActions.setDraft(event.target.value)}/>
            <button disabled={disabled || !!blocked || !draft} onClick={() => inputActions.submit()}>插件发送</button>
          </section>;
        });
        ctx.slots.register({ name: 'conversation.input.dock', id: 'dock-probe' }, ({ sessionId, session, input, useInput }) =>
          <output data-testid="input-dock-probe" data-session={sessionId} data-phase={session.openState}
            data-consistent={input.draft === useInput(value => value.draft)}>{input.draft}</output>);
      } });
      await barPlugin.await();
    },
    disableComposerBarProbe: async () => { await barPlugin.dispose(); await goalPlugin.dispose(); },
    async enableComposerProbe() {
      plugin = model.ctx.plugin({ name: '@fixture/composer-chain', inject: ['slots', 'uiSession'], apply(ctx) {
        publish = ctx.uiSession.registerPendingInteraction(() => 20);
        for (const priority of [1, 2]) ctx.slots.register({ name: 'conversation.composer', id: `chain-${priority}`, priority,
          select: ({ sessionId, session, pendingInteraction }) => session && pendingInteraction?.sessionId === sessionId
            && pendingInteraction.kind === 'composer-check' ? pendingInteraction : null,
        }, ({ matched, sessionId, useInput }) => <section data-testid="composer-takeover" data-session={sessionId} data-priority={priority}>
          <span>{useInput(value => value.draft)}</span><button onClick={matched.finish}>完成插件输入</button>
        </section>);
      } });
      await plugin.await();
    },
    composerTakeover(id = model.reference.sessionId) {
      remove?.();
      remove = publish({ key: crypto.randomUUID(), sessionId: id, kind: 'composer-check', finish: () => remove?.() }, async () => { delegated++; });
    },
    composerRelease() { remove?.(); },
    composerDelegated: () => delegated,
    disableComposerProbe: () => plugin.dispose(),
  };
}
