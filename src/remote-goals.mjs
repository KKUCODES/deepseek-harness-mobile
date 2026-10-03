/** 手机目标窗口只使用原 Goal Remote 与版本身份；读取、事件和写入绑定同一会话。 */
export class RemoteGoals {
  listeners = new Set();
  snapshot = { status: 'idle', sessionId: null, value: null, busy: false, error: null };
  reads = 0;
  pending = new Set();
  uncertain = new Map();
  constructor(model) {
    this.model = model;
    this.offActivation = model.remote.$on('goal/activation-changed', event => {
      if (event.sessionId === this.snapshot.sessionId) void this.refresh();
    });
    this.offGeneration = model.connection.generation.subscribe(() => {
      this.reads++;
      this.publish({ status: 'idle', value: null, error: null });
      if (model.connection.generation.getSnapshot()) void this.refresh();
    });
  }
  get available() { return this.supports('get'); }
  supports(method) { return this.model.transport.capabilities?.endpoints?.calls?.includes(`goals/${method}`) ?? false; }
  subscribe = listener => { this.listeners.add(listener); return () => this.listeners.delete(listener); };
  getSnapshot = () => this.snapshot;
  publish(patch) {
    if (this.model.lifetime.signal.aborted) return;
    this.snapshot = { ...this.snapshot, ...patch };
    for (const listener of this.listeners) listener();
  }
  select(sessionId, binding) {
    this.reads++; this.offProjection?.(); this.offProjection = null;
    this.publish({ status: 'idle', sessionId, value: null, error: null, busy: this.pending.has(sessionId) });
    if (!binding || !this.available) return;
    this.offProjection = binding.session.projections.faceOf('goal').subscribe(() => { void this.refresh(); });
    void this.refresh();
  }
  async refresh() {
    const sessionId = this.snapshot.sessionId;
    if (!this.available || !sessionId || !this.model.connection.generation.getSnapshot()) return;
    const read = ++this.reads;
    this.publish({ status: 'loading', error: null });
    try {
      // 原 get 不接收取消信号；读序号覆盖换会话、重连和晚到事件。
      const result = await this.model.remote.goals.get(sessionId);
      if (read !== this.reads) return;
      if (!result.ok) throw result.error;
      this.publish({ status: 'ready', value: result.value ?? null });
    } catch (error) {
      if (read === this.reads) this.publish({ status: 'error', error: error.message });
    }
  }
  async change(method, sessionId, ref, request) {
    const { model } = this, state = this.snapshot;
    if (!['create', 'edit', 'pause', 'resume', 'complete', 'clear'].includes(method) || !this.supports(method)) throw new Error('电脑暂不支持此目标操作。');
    if (sessionId !== state.sessionId || sessionId !== model.snapshot.selected || model.snapshot.session?.openState !== 'open'
      || state.status !== 'ready') throw new Error('聊天或目标状态已变化，请重新读取。');
    const generation = model.connection.generation.getSnapshot()?.id;
    if (generation === undefined || this.uncertain.get(sessionId) === generation) throw new Error('目标操作结果尚未确认，请重新连接并核对。');
    if (this.pending.has(sessionId)) throw new Error('目标正在更新，请稍候。');
    if (method === 'create') {
      if (state.value && state.value.phase !== 'complete') throw new Error('已有目标，请先处理当前目标。');
    } else if (!ref || ref.id !== state.value?.id || ref.revision !== state.value?.revision) {
      throw new Error('目标已在其他地方更新，请重新查看后操作。');
    }
    if (method === 'create' || method === 'edit') {
      if (!request || !Object.keys(request).length || Object.keys(request).some(key => !['objective', 'maxGoalRounds'].includes(key))
        || (method === 'create' && request.objective === undefined)
        || (request.objective !== undefined && (typeof request.objective !== 'string' || !request.objective.trim() || request.objective.length > 32000))
        || (request.maxGoalRounds !== undefined && (!Number.isSafeInteger(request.maxGoalRounds) || request.maxGoalRounds < 1))) throw new Error('请填写目标和有效的轮次上限。');
    }
    this.pending.add(sessionId); this.publish({ busy: true, error: null });
    try {
      const result = method === 'create' ? await model.remote.goals.create(sessionId, request)
        : method === 'edit' ? await model.remote.goals.edit(sessionId, ref, request)
        : await model.remote.goals[method](sessionId, ref);
      if (!result.ok) {
        if (['gateway/internal', 'gateway/cancelled'].includes(result.error.code)) {
          this.uncertain.set(sessionId, generation);
          throw new Error('目标操作结果尚未确认，请重新连接并核对。');
        }
        throw result.error;
      }
      // get 同时核对持久状态和进程内 activation；写入返回不覆盖另一会话。
      if (this.snapshot.sessionId === sessionId && model.connection.generation.getSnapshot()?.id === generation) await this.refresh();
    } finally {
      this.pending.delete(sessionId);
      this.publish({ busy: this.pending.has(this.snapshot.sessionId) });
    }
  }
  dispose() { this.reads++; this.offProjection?.(); this.offActivation(); this.offGeneration(); this.listeners.clear(); }
}
