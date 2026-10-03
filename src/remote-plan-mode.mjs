import { resolveCommand } from '../../deepseek-harness/packages/client/ui-commands/src/client/resolution.ts';

export const planModeLabel = plan => !plan ? '不可用' : plan.pending
  ? (plan.active ? '正在退出计划模式' : '正在进入计划模式') : plan.active ? '已开启' : '已关闭';

/** 开关只发送原计划命令，状态由同一会话的 plan 投影决定。 */
export class RemotePlanMode {
  listeners = new Set();
  snapshot = { sessionId: null, status: 'idle', available: false, error: null };
  reads = 0;
  pendingSessions = new Set();
  uncertain = new Map();
  constructor(model) { this.model = model; }
  subscribe = listener => { this.listeners.add(listener); return () => this.listeners.delete(listener); };
  getSnapshot = () => this.snapshot;
  get writable() { return this.model.transport.capabilities?.planModeControl === true; }
  publish(patch) {
    if (this.model.lifetime.signal.aborted) return;
    this.snapshot = { ...this.snapshot, ...patch };
    for (const listener of this.listeners) listener();
  }
  select(sessionId) {
    this.reads++;
    this.publish({ sessionId, status: 'idle', available: false, error: null });
  }
  invalidate() {
    const reload = this.snapshot.status !== 'idle';
    this.select(this.snapshot.sessionId);
    if (reload) void this.load();
  }
  async load() {
    const { sessionId } = this.snapshot, { model } = this;
    const read = ++this.reads;
    if (!sessionId || !model.transport.capabilities?.endpoints?.calls?.includes('commands/list')) return;
    this.publish({ status: 'loading', available: false, error: null });
    try {
      const result = await model.remote.commands.list(sessionId);
      if (read !== this.reads || model.lifetime.signal.aborted) return;
      if (!result.ok) throw result.error;
      // 同名第三方命令不能被当成计划模式开关。
      const command = resolveCommand('plan', result.value);
      this.publish({ status: 'ready', available: command?.definitionId === '@deepseek-ai/dsh-plan-mode' });
    } catch (error) {
      if (read === this.reads) this.publish({ status: 'error', available: false, error: error.message });
    }
  }
  async choose(active, sessionId) {
    const { model } = this, state = model.snapshot;
    const generation = model.connection.generation.getSnapshot()?.id;
    if (!this.writable) throw new Error('请更新电脑插件和网关后切换计划模式。');
    if (typeof active !== 'boolean' || !sessionId || state.selected !== sessionId || this.snapshot.sessionId !== sessionId
      || state.session?.openState !== 'open' || state.connectionState !== 'connected' || !state.plan
      || model.sessions.subagentAddress(sessionId) !== undefined) throw new Error('当前聊天暂时不能切换计划模式。');
    if (this.pendingSessions.has(sessionId) || model.sending.has(sessionId)) throw new Error('操作正在提交，请稍候。');
    if (generation === undefined || this.uncertain.get(sessionId) === generation)
      throw new Error('计划模式切换结果尚未确认，请重新连接并核对当前状态。');
    if (this.snapshot.status !== 'ready' || !this.snapshot.available) throw new Error('电脑当前未提供计划模式开关，请重新读取。');
    const target = state.plan.pending ? !state.plan.active : state.plan.active;
    if (target === active) return;
    this.pendingSessions.add(sessionId); this.publish({});
    try {
      // 只用空参数 /plan 进入；/plan on 会把 on 作为用户消息触发一轮回复。
      const result = await model.remote.commands.execute(sessionId, active ? '/plan' : '/plan off', []);
      if (!result.ok) {
        if (['gateway/internal', 'gateway/cancelled'].includes(result.error.code)) throw result.error;
        throw Object.assign(new Error(result.error.message), { confirmed: true });
      }
      if (!result.value) throw Object.assign(new Error('电脑未提供计划模式命令。'), { confirmed: true });
      if (result.value.result.kind === 'error') throw Object.assign(new Error(result.value.result.text), { confirmed: true });
    } catch (error) {
      if (error.confirmed) throw error;
      this.uncertain.set(sessionId, generation);
      throw new Error('计划模式切换结果尚未确认，请重新连接并核对当前状态。');
    } finally { this.pendingSessions.delete(sessionId); this.publish({}); }
  }
  dispose() { this.reads++; this.listeners.clear(); }
}
