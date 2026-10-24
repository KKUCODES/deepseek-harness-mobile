const emptySelection = () => ({ selected: null, selectedTarget: null, selectionTrail: [], selectionRevision: 0,
  session: null, conversation: null, model: null, permission: null, agentPreset: null,
  schedules: null, plan: null, inbox: null, error: null });

/** 独立会话引用与投影；共享已认证的服务，不创建连接、插件树或另一个电脑会话。 */
export class RemoteSessionView {
  lifetime = new AbortController();
  listeners = new Set();
  snapshot = emptySelection();
  reference = null;
  selection = 0;
  request = 0;
  releases = [];
  constructor(model, { source = 'controllerOperation', onSelection, onReady, onRelease, onChange } = {}) {
    this.model = model;
    this.source = source;
    this.callbacks = { onSelection, onReady, onRelease, onChange };
    this.parentAbort = () => this.dispose();
    model.lifetime.signal.addEventListener('abort', this.parentAbort, { once: true });
    if (model.lifetime.signal.aborted) this.dispose();
  }
  subscribe = listener => {
    if (this.lifetime.signal.aborted) return () => {};
    this.listeners.add(listener); return () => this.listeners.delete(listener);
  };
  getSnapshot = () => this.snapshot;
  send(mode, input) { return this.model.send(mode, input, this); }
  stop() { return this.model.stop(this); }
  updateQueue(itemId, action) { return this.model.updateQueue(itemId, action, this); }
  answer(eventId, outcome) { return this.model.answer(eventId, outcome, this); }
  publish(patch) {
    if (this.lifetime.signal.aborted) return;
    this.snapshot = { ...this.snapshot, ...patch };
    this.callbacks.onChange?.(patch);
    for (const listener of this.listeners) listener();
  }
  release() {
    this.selection++;
    this.releases.splice(0).forEach(release => release());
    this.callbacks.onRelease?.();
    this.reference?.release(); this.reference = null;
  }
  /** 写入已发出后不能当作取消；只撤销迟到结果自动打开页面的资格。 */
  beginNavigation() {
    this.lifetime.signal.throwIfAborted();
    const { model } = this;
    if (model.getSnapshot().connectionState !== 'connected') throw new Error('电脑暂时离线，恢复连接后可打开其他聊天。');
    const request = ++this.request, generation = model.connection.generation.getSnapshot();
    const navigation = this.source === 'mainView' ? model.globalPanels?.controller.beginNavigation() : undefined;
    return () => !this.lifetime.signal.aborted && this.request === request
      && !navigation?.aborted
      && model.connection.generation.getSnapshot() === generation
      && model.getSnapshot().connectionState === 'connected';
  }
  async select(target, { trail = [] } = {}) {
    this.lifetime.signal.throwIfAborted();
    const { model } = this, { sessions } = model;
    const checkConnection = () => {
      if (target && model.getSnapshot().connectionState !== 'connected') throw new Error('电脑暂时离线，恢复连接后可打开其他聊天。');
    };
    checkConnection();
    const navigation = this.source === 'mainView' ? model.globalPanels?.controller.beginNavigation() : undefined;
    const request = ++this.request;
    // 子会话地址必须在旧引用释放前解析。读取失败保留当前视图和导航轨迹。
    target = typeof target === 'string' ? sessions.subagentAddress(target) ?? target : target;
    if (typeof target === 'string' && !sessions.list.getSnapshot().byId[target]) {
      await sessions.refresh();
      if (request !== this.request || this.lifetime.signal.aborted || navigation?.aborted) return;
      checkConnection();
      target = sessions.subagentAddress(target) ?? target;
    }
    if (typeof target === 'string' && sessions.list.getSnapshot().byId[target]?.origin === 'subagent') {
      const parentId = sessions.list.getSnapshot().byId[target].parentId;
      // 冷启动列表含子会话摘要，但地址目录尚未加载；必须由原目录确认mode和归属。
      if (!parentId || !model.subagentsAvailable) throw new Error('暂时无法打开这个聊天，请稍后重试。');
      await sessions.refreshSubagents(parentId);
      if (request !== this.request || this.lifetime.signal.aborted || navigation?.aborted) return;
      checkConnection();
      const address = sessions.subagentAddress(target);
      if (!address) throw new Error('暂时无法打开这个聊天，请稍后重试。');
      target = address;
    }
    const id = typeof target === 'string' ? target : target?.childSessionId ?? null;
    let reference;
    if (id) {
      try { reference = sessions.retain(target, { source: this.source, signal: this.lifetime.signal }); }
      catch { throw new Error('暂时无法打开这个聊天，请稍后重试。'); }
    }
    if (this.source === 'mainView') model.globalPanels?.controller.selectPanel(null);
    this.release();
    this.reference = reference ?? null;
    const generation = this.selection;
    const restored = this.callbacks.onSelection?.(id) ?? {};
    // 即使复用同一空会话，也是一轮已接受的导航；页面据此关闭先前的设置和管理界面。
    this.publish({ ...emptySelection(), selected: id, selectedTarget: target, selectionTrail: trail, selectionRevision: generation, ...restored });
    if (!id || generation !== this.selection || this.lifetime.signal.aborted) return;
    if (model.jobs) this.releases.push(model.jobs.watchRows(id));
    if (model.subagentsAvailable) {
      for (const parentId of new Set([id, ...(typeof target === 'object' ? [target.parentSessionId] : [])])) {
        this.releases.push(sessions.retainSubagentCatalog(parentId));
      }
    }
    let binding;
    try { binding = await reference.ready; }
    catch (error) { if (generation === this.selection && !this.lifetime.signal.aborted) throw error; return; }
    if (generation !== this.selection || this.lifetime.signal.aborted) return;
    await model.reconcileSubmission?.(id, binding);
    if (generation !== this.selection || this.lifetime.signal.aborted) return;
    const reconcile = () => {
      // 正在提交的原输入 shell 自己处理确认；重连及历史分页则依据原请求编号核对。
      if (generation === this.selection && !model.sending.has(id) && !model.inputBindings?.mounted(id)?.pending) {
        void model.reconcileSubmission?.(id, binding);
      }
    };
    this.releases.push((binding.history?.original ?? binding).eventSource.subscribe(reconcile), binding.session.projections.faceOf('inbox').subscribe(reconcile));
    reconcile();
    const conversation = model.conversations.binding(binding).target('chat');
    const sources = { session: binding.session, conversation };
    for (const [key, face] of Object.entries({ model: 'modelSelection', inbox: 'inbox', permission: 'permissions',
      agentPreset: 'agentPreset', schedules: 'schedule', plan: 'plan' })) sources[key] = binding.session.projections.faceOf(face);
    const update = () => {
      if (generation === this.selection) this.publish(Object.fromEntries(Object.entries(sources).map(([key, source]) => [key, source.getSnapshot()])));
    };
    for (const source of Object.values(sources)) this.releases.push(source.subscribe(update));
    update();
    if (generation === this.selection && !this.lifetime.signal.aborted) this.callbacks.onReady?.(id, binding);
  }
  dispose() {
    if (this.lifetime.signal.aborted) return;
    this.request++;
    this.release(); this.lifetime.abort(); this.listeners.clear();
    this.model.lifetime.signal.removeEventListener('abort', this.parentAbort);
  }
}
