import { readRoster, presetOptions } from '../../deepseek-harness/packages/client/ui-agent-preset/src/client/settings-store.ts';
import { presetDisplayText, zh, en } from '../../deepseek-harness/packages/client/ui-agent-preset/src/client/locales.ts';

export const agentPresetText = (option, locale = 'zh') => presetDisplayText(option, key => (locale === 'en' ? en : zh)[key]);

/** 原目录只读，选择仅落到当前空白会话；不修改电脑的默认模式或预设文件。 */
export class RemoteAgentPresets {
  listeners = new Set();
  snapshot = { status: 'idle', options: [], enabled: false, error: null, busy: false };
  reads = 0;
  pendingSessions = new Set();
  uncertain = new Map();
  seatWork = new Map();
  constructor(model) {
    this.model = model;
    this.off = model.remote.$on('settings/document-updated', ns => { if (ns === 'agent-presets') this.invalidate(); });
    this.offGeneration = model.connection.generation.subscribe(() => this.invalidate());
  }
  get available() { return this.model.transport.capabilities?.endpoints?.calls?.includes('agentPresets/list') ?? false; }
  get writable() { return this.model.transport.capabilities?.endpoints?.calls?.includes('agentPresets/select') ?? false; }
  subscribe = listener => { this.listeners.add(listener); return () => this.listeners.delete(listener); };
  getSnapshot = () => this.snapshot;
  publish(patch) {
    if (this.model.lifetime.signal.aborted) return;
    this.snapshot = { ...this.snapshot, ...patch };
    for (const listener of this.listeners) listener();
  }
  invalidate() {
    this.reads++;
    this.publish({ status: 'idle', options: [], enabled: false, error: null });
    if (this.requested && this.model.connection.generation.getSnapshot()) void this.load();
  }
  async load() {
    if (!this.available) return;
    this.requested = true;
    const read = ++this.reads;
    this.publish({ status: 'loading', error: null });
    try {
      // 原 list 无取消参数；世代和销毁检查使迟到结果不能重新发布。
      const result = await readRoster(this.model.ctx);
      if (read !== this.reads) return;
      if (!result.ok) throw new Error(result.error);
      this.publish({ status: 'ready', options: presetOptions(result.value.presets), enabled: result.value.modeSelectionEnabled });
    } catch (error) {
      if (read === this.reads) this.publish({ status: 'error', options: [], enabled: false, error: error.message });
    }
  }
  async choose(id, sessionId) {
    const { model } = this, session = model.snapshot.session;
    if (!sessionId || sessionId !== model.snapshot.selected || session?.openState !== 'open' || !session.blank
      || session.running || session.awaitingFirstTurn || model.sending.has(sessionId) || session.pendingSubmissions.length
      || model.sessions.subagentAddress(sessionId) !== undefined) throw new Error('聊天开始后不能更换 Agent 模式，请新建聊天。');
    if (this.pendingSessions.has(sessionId)) throw new Error('Agent 模式正在切换，请稍候。');
    const generation = model.connection.generation.getSnapshot()?.id;
    if (generation === undefined || this.uncertain.get(sessionId) === generation) throw new Error('切换结果尚未确认，请重新连接并核对当前模式。');
    if (!this.writable || !this.snapshot.enabled || this.snapshot.status !== 'ready' || !this.snapshot.options.some(option => option.id === id))
      throw new Error('电脑当前不允许选择此模式，请重新读取。');
    if (model.snapshot.agentPreset === id) return;
    this.pendingSessions.add(sessionId); this.publish({ busy: true });
    try {
      const result = await model.remote.agentPresets.select(sessionId, id);
      if (!result.ok) {
        if (['gateway/internal', 'gateway/cancelled'].includes(result.error.code)) {
          this.uncertain.set(sessionId, generation);
          throw new Error('切换结果尚未确认，请重新连接并核对当前模式。');
        }
        throw result.error;
      }
      // 选择返回值不能覆盖随后切到的会话；当前模式由原投影回传。
    } finally { this.pendingSessions.delete(sessionId); this.publish({ busy: this.pendingSessions.size > 0 }); }
  }
  /** 原 hero 的读取可能应用预选；整段完成前与手机发送、其他模式入口共用锁。 */
  async runSeat(sessionId, action) {
    if (sessionId === undefined) return action();
    const { model } = this;
    if (model.lifetime.signal.aborted || model.snapshot.selected !== sessionId
      || model.getSnapshot().connectionState !== 'connected') throw new Error('聊天已变化，请重新打开模式选择。');
    const count = this.seatWork.get(sessionId) ?? 0;
    if (!count && this.pendingSessions.has(sessionId)) throw new Error('Agent 模式正在切换，请稍候。');
    this.seatWork.set(sessionId, count + 1); this.pendingSessions.add(sessionId);
    this.publish({ busy: true }); model.publish();
    try { return await action(); }
    finally {
      const remaining = this.seatWork.get(sessionId) - 1;
      if (remaining) this.seatWork.set(sessionId, remaining);
      else { this.seatWork.delete(sessionId); this.pendingSessions.delete(sessionId); }
      this.publish({ busy: this.pendingSessions.size > 0 }); model.publish();
    }
  }
  dispose() { this.reads++; this.off(); this.offGeneration(); this.listeners.clear(); }
}
