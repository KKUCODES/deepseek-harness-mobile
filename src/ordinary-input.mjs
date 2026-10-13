import { createSnapshotStore } from '@deepseek-ai/dsh-client-store';
import * as InputPlugin from '../../deepseek-harness/packages/client/ui-input-trigger/src/client/index.ts';

const observable = value => ({ getSnapshot: () => value, subscribe: () => () => {} });
const absent = observable({ key: undefined, hooks: {}, keyedHooks: {}, props: {} });

/** 仅为输入插件提供普通聊天身份。隔离的 sessions 不能激活根域的 Host 插件。 */
export class OrdinaryInput {
  bindings = new Map();
  state = createSnapshotStore({ enabled: false, generation: 0, sourceEnabled: true });
  subscriptions = new Set();

  constructor(root) {
    this.root = root;
    this.promptSettings = root.settingsScope.bind({ namespace: 'ordinary-prompts' });
    const prompts = () => this.promptSettings.getSnapshot().value.prompts;
    root.effect(() => this.promptSettings.subscribe(() => { for (const listener of this.subscriptions) listener(); }));
    this.ctx = root.isolate('sessions').isolate('inputTriggers');
    // 服务由隔离域内自己的插件持有；父插件启停通知不跨到根域的 sessions。
    this.provider = this.ctx.plugin({ apply: scope => scope.provide('sessions', {
      sessionOf: actx => [...this.bindings.values()].find(item => item.ctx === actx)?.session,
      binding: id => this.bindings.get(id),
      scope: id => this.bindings.get(id)?.ctx,
    }) });
    this.adapter = {
      current: absent,
      bindingSource: target => {
        if (target === undefined) return absent;
        const binding = this.bindings.get(target);
        if (!binding) throw new Error('ordinary_input_scope_expired');
        return binding.source;
      },
      renderArea: (binding, props) => binding.key === undefined ? props.empty?.() ?? null : props.children,
    };
    this.source = {
      name: '普通聊天提示词', trigger: '/',
      candidates: async ({ sessionId }, { query }) => this.bindings.has(sessionId)
        ? prompts().filter(item => item.name.toLowerCase().includes(query.toLowerCase()) || item.label.includes(query)) : [],
      onPick: ({ candidate }) => ({ text: candidate.value }),
      lexicon: () => prompts().map(item => item.name),
      subscribeLexicon: (_, listener) => { this.subscriptions.add(listener); return () => this.subscriptions.delete(listener); },
    };
  }

  async enable(enabled) {
    if (this.state.getSnapshot().enabled === enabled) return;
    if (enabled) {
      await this.provider.await();
      this.plugin = this.ctx.plugin(InputPlugin);
      await this.plugin.await();
      // 等原始入口创建的服务就绪，再注册真实本地提示词来源。
      this.resolver = this.ctx.plugin({ inject: ['inputTriggers'], apply: scope => {
        this.service = scope.inputTriggers;
      } });
      await this.resolver.await();
      if (this.state.getSnapshot().sourceEnabled) this.removeSource = this.service.registerSource(this.source);
    } else {
      this.state.set({ ...this.state.getSnapshot(), enabled: false });
      for (const binding of [...this.bindings.values()]) await binding.dispose();
      this.removeSource?.(); this.removeSource = undefined;
      await this.resolver.dispose();
      await this.plugin.dispose(); this.service = undefined;
    }
    const previous = this.state.getSnapshot();
    this.state.set({ ...previous, enabled, generation: previous.generation + 1 });
  }

  setSource(enabled) {
    if (this.state.getSnapshot().sourceEnabled === enabled) return;
    if (enabled && this.service) this.removeSource = this.service.registerSource(this.source);
    else { this.removeSource?.(); this.removeSource = undefined; }
    this.state.set({ ...this.state.getSnapshot(), sourceEnabled: enabled });
  }

  async bind(chatId, insert) {
    const id = `ordinary:${chatId}`;
    if (!this.service || this.bindings.has(id)) throw new Error('ordinary_input_binding_unavailable');
    let binding;
    const fiber = this.ctx.plugin({ apply: scope => {
      const session = Object.freeze({ sessionId: id });
      binding = { sessionId: id, session, ctx: scope };
      binding.source = observable({ key: id, ctx: scope, hooks: {}, keyedHooks: {}, props: {} });
      this.bindings.set(id, binding);
      // Cordis 事件共用总线，显式核对发起上下文，防止写入别的聊天。
      scope.on('slash/input-insert-text', function (request) {
        if (this === scope && binding.active) return insert(request) ? true : undefined;
      });
      scope.effect(() => () => { binding.active = false; this.bindings.delete(id); });
      binding.active = true;
      binding.controller = this.service.sessionOf(scope);
    } });
    await fiber.await();
    binding.dispose = async () => { binding.active = false; await fiber.dispose(); };
    return binding;
  }

  snapshot() {
    return { ...this.state.getSnapshot(), bindings: this.bindings.size, subscriptions: this.subscriptions.size,
      rootSessionsAbsent: this.root.get('sessions') === undefined };
  }
}
