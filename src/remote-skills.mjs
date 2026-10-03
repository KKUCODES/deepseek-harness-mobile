import { resolveCommand } from '../../deepseek-harness/packages/client/ui-commands/src/client/resolution.ts';

/** 会话技能只读目录。手机插入原 /name 文本，由电脑的 pre-step 加载技能正文。 */
export class RemoteSkills {
  listeners = new Set();
  snapshot = { sessionId: null, status: 'idle', items: [], error: null };
  constructor(model) { this.model = model; }
  subscribe = listener => { this.listeners.add(listener); return () => this.listeners.delete(listener); };
  getSnapshot = () => this.snapshot;
  get available() {
    const calls = this.model.transport.capabilities?.endpoints?.calls ?? [];
    return ['skills/list', 'commands/list'].every(endpoint => calls.includes(endpoint));
  }
  publish(patch) {
    if (this.model.lifetime.signal.aborted) return;
    this.snapshot = { ...this.snapshot, ...patch };
    for (const listener of this.listeners) listener();
  }
  select(sessionId) {
    this.pending?.abort(); this.pending = null;
    this.publish({ sessionId, status: 'idle', items: [], error: null });
  }
  invalidate(sessionId = this.snapshot.sessionId) {
    if (sessionId !== this.snapshot.sessionId) return;
    const reload = this.snapshot.status !== 'idle';
    this.select(sessionId);
    if (reload) void this.load();
  }
  load() {
    if (this.pending) return this.pending.promise;
    const { sessionId } = this.snapshot;
    if (!sessionId || !this.available || this.model.sessions.subagentAddress(sessionId) !== undefined) {
      this.publish({ status: 'unavailable', items: [], error: null });
      return Promise.resolve();
    }
    const controller = new AbortController();
    this.pending = controller;
    const signal = AbortSignal.any([controller.signal, this.model.lifetime.signal]);
    this.publish({ status: 'loading', items: [], error: null });
    controller.promise = (async () => {
      try {
        const [skills, commands] = await Promise.all([
          this.model.remote.skills.list({ sessionId }, signal),
          // 原 commands/list 没有 signal 参数；取消后由本目录丢弃迟到结果。
          this.model.remote.commands.list(sessionId),
        ]);
        signal.throwIfAborted();
        if (!skills.ok) throw skills.error;
        if (!commands.ok) throw commands.error;
        // 与原桌面命令判定保持一致。同名命令不能被手机悄悄当作技能发送。
        const items = skills.value.skills.map(skill => ({ ...skill,
          unavailable: resolveCommand(skill.name, commands.value)
            ? '与电脑命令同名，暂不能从此处选择'
            : /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(skill.name) ? null : '此名称不支持快捷调用',
        }));
        this.publish({ status: 'ready', items, error: null });
      } catch (error) {
        if (!signal.aborted) this.publish({ status: 'error', items: [], error: error.message });
      } finally { if (this.pending === controller) this.pending = null; }
    })();
    return controller.promise;
  }
  insert(name, sessionId) {
    const current = this.snapshot;
    const skill = current.items.find(item => item.name === name);
    if (sessionId !== this.model.snapshot.selected || sessionId !== current.sessionId
      || current.status !== 'ready' || !skill || skill.unavailable
      || this.model.snapshot.session?.openState !== 'open') throw new Error('技能列表已变化，请重新打开后选择。');
    const draft = this.model.snapshot.drafts[sessionId] ?? '';
    // 多技能调用沿用电脑的空白分隔语法，不覆盖已有草稿或提前发起模型请求。
    const text = new RegExp(`(^|\\s)/${name}(?=\\s|$)`).test(draft) ? draft : `/${name} ${draft}`;
    if (text.length > 100000) throw new Error('消息过长，请缩短内容后添加技能。');
    this.model.draft(text);
  }
  dispose() { this.pending?.abort(); this.pending = null; this.listeners.clear(); }
}
