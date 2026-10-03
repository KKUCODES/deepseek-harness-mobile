import { unwrap } from './remote-model.mjs';
import { moveWorkspaceDraft } from './remote-workspace-drafts.mjs';

/** 原 uiWorkspace 的主聊天导航契约；Host 目录操作按手机产品范围明确拒绝。 */
export class RemoteWorkspaceNavigation {
  connecting = new Map();
  constructor(model) { this.model = model; }
  available() {
    const model = this.model;
    model.lifetime.signal.throwIfAborted();
    if (model.getSnapshot().connectionState !== 'connected') throw new Error('电脑暂时离线，恢复连接后可打开其他聊天。');
  }
  async showMain(target) {
    this.available();
    const model = this.model, pending = model.select(target), request = model.sessionView.request;
    await pending;
    if (!model.lifetime.signal.aborted && model.sessionView.request === request && model.pluginPanels?.isExpanded()) {
      model.pluginPanels.toggleExpanded();
    }
  }
  // 原接口是 void：异步读取失败由当前页面显示，不产生无人处理的 Promise。
  observe(pending) {
    const model = this.model, request = model.sessionView.request;
    void pending.catch(error => {
      if (!model.lifetime.signal.aborted && model.sessionView.request === request) model.fail(error);
    });
  }
  openSession(target) { this.available(); this.observe(this.showMain(target)); }
  async connectWorkspace(workspaceId) {
    this.available();
    const model = this.model, state = model.workspaces.getSnapshot();
    const workspace = state.items.find(item => item.workspaceId === workspaceId);
    if (!workspace) throw new Error('工作区已不存在，请刷新后重试。');
    const generation = model.connection.generation.getSnapshot();
    const existing = this.connecting.get(workspaceId);
    if (existing?.generation === generation) return existing.promise;
    const sessions = model.sessions.list.getSnapshot();
    // 原服务仅复用属于当前工作区、未归档且目录一致的空会话。
    for (const id of sessions.ids) {
      const session = sessions.byId[id];
      if (session?.blank && session.cwd === workspace.path && workspace.sessionIds.includes(id)
        && !state.archivedSessionIds.includes(id)) return id;
    }
    const entry = { generation };
    entry.promise = model.sessions.create({ workspaceId }).finally(() => {
      if (this.connecting.get(workspaceId) === entry) this.connecting.delete(workspaceId);
    });
    this.connecting.set(workspaceId, entry);
    return entry.promise;
  }
  async openWorkspace(workspaceId, beforeOpen) {
    const current = this.model.beginNavigation();
    const id = await this.connectWorkspace(workspaceId);
    if (!current()) return;
    // 工作区可能在请求期间被电脑移除；不能用旧结果重新打开它。
    if (!this.model.workspaces.getSnapshot().items.some(item => item.workspaceId === workspaceId)) return;
    await beforeOpen?.(id, current);
    if (current()) await this.showMain(id);
  }
  selectWorkspace(workspaceId, sessionId) {
    return this.openWorkspace(workspaceId, (nextId, current) => moveWorkspaceDraft(this.model, sessionId, nextId, current));
  }
  startSession(workspaceId) {
    this.available();
    const model = this.model, workspaces = model.workspaces.getSnapshot(), sessions = model.sessions.list.getSnapshot();
    const inherited = workspaces.items.find(item => item.sessionIds.includes(model.getSnapshot().selected))?.workspaceId;
    const recent = workspaces.phase === 'ready' && sessions.phase === 'ready'
      ? recentWorkspace(workspaces.items, sessions.byId) : undefined;
    const target = workspaceId ?? inherited ?? recent;
    if (target === undefined) this.openSession(null);
    else this.observe(this.openWorkspace(target));
  }
  async forkSession(sessionId) {
    const current = this.model.beginNavigation();
    const id = await this.model.sessions.fork({ sessionId, increaseTitle: true });
    if (current()) await this.showMain(id);
  }
  async archiveSession(sessionId) {
    this.available();
    const model = this.model, request = model.sessionView.request, generation = model.connection.generation.getSnapshot();
    unwrap(await model.workspaces.archiveSession(sessionId));
    if (!model.lifetime.signal.aborted && model.sessionView.request === request
      && model.connection.generation.getSnapshot() === generation && model.getSnapshot().connectionState === 'connected'
      && model.reference?.sessionId === sessionId) await this.showMain(null);
  }
  async unarchiveSession(sessionId) { this.available(); unwrap(await this.model.workspaces.unarchiveSession(sessionId)); }
  async pickDirectory() { throw directoryUnsupported(); }
  async listDirectory(_path, signal) { signal?.throwIfAborted(); throw directoryUnsupported(); }
  async createDirectory() { throw directoryUnsupported(); }
}

function directoryUnsupported() {
  const error = new Error('手机不支持选择或创建电脑目录，请在电脑上添加工作区。');
  error.code = 'remote_directory_navigation_disabled';
  return error;
}

function recentWorkspace(workspaces, sessions) {
  let selected, time = Number.NEGATIVE_INFINITY;
  for (const workspace of workspaces) {
    let latest = Number.NEGATIVE_INFINITY;
    for (const id of workspace.sessionIds) if (sessions[id]) latest = Math.max(latest, sessions[id].updatedAt);
    if (latest === Number.NEGATIVE_INFINITY) latest = Date.parse(workspace.createdAt);
    if (selected === undefined || latest > time) { selected = workspace.workspaceId; time = latest; }
  }
  return selected;
}
