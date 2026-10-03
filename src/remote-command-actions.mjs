/** 手机菜单只调用原插件注册的本地 action，不进入命令执行或消息发送管线。 */
export class RemoteCommandActions {
  entries = new Map();
  constructor(model) { this.model = model; }
  register(decoration) {
    const entry = { decoration };
    this.entries.set(decoration.name, entry);
    this.model.publish();
    return () => {
      if (this.entries.get(decoration.name) !== entry) return;
      this.entries.delete(decoration.name); this.model.publish();
    };
  }
  available(name, model = this.model) {
    const state = model.getSnapshot();
    return name === 'feedback' && !model.lifetime.signal.aborted
      && state.connectionState === 'connected' && state.session?.openState === 'open'
      && model.sessions.subagentAddress(state.selected) === undefined
      && this.entries.get(name)?.decoration.ui.kind === 'action';
  }
  async open(name, model = this.model) {
    const entry = this.entries.get(name), reference = model.reference;
    const generation = model.connection.generation.getSnapshot();
    if (!this.available(name, model) || !reference) throw new Error('此聊天暂时无法打开反馈。');
    // 目录由电脑决定；读取期间换聊天、重连或卸载插件，都不能打开过期会话的界面。
    const result = await model.remote.commands.list(reference.sessionId);
    if (!this.available(name, model) || model.reference !== reference || this.entries.get(name) !== entry
      || model.connection.generation.getSnapshot() !== generation) throw new Error('连接或聊天已变化，请重新打开。');
    if (!result.ok) throw new Error('无法读取电脑反馈入口，请稍后重试。');
    if (!result.value.some(command => command.name === name)) throw new Error('电脑未提供此聊天的反馈入口。');
    const session = { sessionId: reference.sessionId };
    if (!entry.decoration.available(session)) throw new Error('此聊天暂时无法打开反馈。');
    entry.decoration.ui.run(session);
  }
}
