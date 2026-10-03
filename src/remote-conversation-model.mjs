import { RemoteSessionView } from './remote-session-view.mjs';
import { RemoteSkills } from './remote-skills.mjs';
import { RemotePermissions } from './remote-permissions.mjs';
import { RemoteAgentPresets } from './remote-agent-presets.mjs';
import { RemoteGoals } from './remote-goals.mjs';
import { RemotePlanMode } from './remote-plan-mode.mjs';
import { RemoteJobActions } from './remote-job-actions.mjs';
import { RemoteViewNotifications } from './remote-view-notifications.mjs';

/** 同一聊天界面的独立呈现模型：只拥有选择与局部目录，不拥有连接或插件树。 */
export class RemoteConversationModel {
  listeners = new Set();
  viewNotifications = new RemoteViewNotifications(() => this.lifetime.signal.aborted);
  snapshot;
  local = {};
  disposed = false;
  constructor(model) {
    model.lifetime.signal.throwIfAborted();
    this.model = model;
    for (const key of ['ctx', 'remote', 'client', 'transport', 'connection', 'sessions', 'conversations',
      'workspaces', 'workspaceActions', 'computerSettings', 'providerSettings', 'computerKey', 'computerEndpoint', 'searchKey', 'searchEndpoint',
      'files', 'modelCatalog', 'pluginSlots', 'pluginPanels', 'documentPreviews', 'documentFiles', 'reviewPreview', 'deliverablesPreview',
      'pendingImageUrls', 'conversationFocus', 'globalPanels',
      'inputBindings', 'composerBlocks', 'sending', 'draftTransfers', 'workspaceNavigation']) {
      Object.defineProperty(this, key, { get: () => model[key] });
    }
    this.view = new RemoteSessionView(model, {
      onSelection: id => {
        model.publish(model.restoreDraft(id));
        this.skills.select(id); this.planMode.select(id); this.local = {};
      },
      onReady: (id, binding) => this.goals.select(id, binding),
      onRelease: () => this.goals?.select(null),
      onChange: () => this.publish(),
    });
    this.lifetime = this.view.lifetime;
    this.skills = new RemoteSkills(this);
    this.permissions = new RemotePermissions(this);
    this.agentPresets = new RemoteAgentPresets(this);
    this.goals = new RemoteGoals(this);
    this.planMode = new RemotePlanMode(this);
    this.jobActions = new RemoteJobActions(this);
    // 目录和当前选择属于视图；写入锁与未知结果必须跨视图共用。
    for (const [service, keys] of [['permissions', ['selecting', 'uncertain']], ['agentPresets', ['pendingSessions', 'uncertain']],
      ['goals', ['pending', 'uncertain']], ['planMode', ['pendingSessions', 'uncertain']], ['jobActions', ['pending', 'uncertain']]]) {
      for (const key of keys) this[service][key] = model[service][key];
    }
    this.commandActions = {
      available: name => model.commandActions?.available(name, this),
      open: name => model.commandActions.open(name, this),
    };
    this.offs = [model.subscribe(() => this.publish()),
      model.remote.$on('agent-preset/selected', id => this.skills.invalidate(id)),
      model.remote.$on('commands/change', () => { this.skills.invalidate(); this.planMode.invalidate(); }),
      model.connection.generation.subscribe(() => { this.skills.invalidate(); this.planMode.invalidate(); }),
    ];
    this.onAbort = () => this.dispose();
    this.lifetime.signal.addEventListener('abort', this.onAbort, { once: true });
    this.publish();
  }
  get reference() { return this.view.reference; }
  get selection() { return this.view.selection; }
  get subagentsAvailable() { return this.model.subagentsAvailable; }
  subscribe = listener => { this.listeners.add(listener); return () => this.listeners.delete(listener); };
  subscribeView = listener => {
    if (this.disposed || this.lifetime.signal.aborted) return () => {};
    return this.viewNotifications.subscribe(listener);
  };
  getSnapshot = () => this.snapshot;
  publish(patch = {}) {
    if (this.disposed || this.lifetime.signal.aborted) return;
    const previous = this.snapshot;
    this.local = { ...this.local, ...patch };
    const root = this.model.getSnapshot(), view = this.view.getSnapshot();
    this.snapshot = { ...root, ...view, ...this.local, error: this.local.error ?? view.error ?? root.error };
    for (const listener of this.listeners) listener();
    if (!this.lifetime.signal.aborted) this.viewNotifications.publish(previous, this.snapshot);
  }
  fail(error) { this.publish({ error: error.message }); }
  select(target, options) { return this.view.select(target, options); }
  beginNavigation() { return this.view.beginNavigation(); }
  back() { return this.model.back(this); }
  openChild(id) { return this.model.openChild(id, this); }
  openChildAside(id) { return this.model.openChildAside(id, this); }
  openWorkflowMember(target) { return this.model.openWorkflowMember(target, this); }
  send(mode, input) { return this.model.send(mode, input, this); }
  stop() { return this.model.stop(this); }
  updateQueue(id, action) { return this.model.updateQueue(id, action, this); }
  answer(id, outcome) { return this.model.answer(id, outcome, this); }
  chooseModel(selection) { return this.model.chooseModel(selection, this); }
  create(id) { return this.model.create(id, this); }
  rename(title) { return this.model.rename(title, this); }
  fork(seq) { return this.model.fork(seq, this); }
  forkTurn(id, sessionId) { return this.model.forkTurn(id, sessionId, this); }
  archive(value) { return this.model.archive(value, this); }
  draft(value) { return this.writeDraft(this.snapshot.selected, value); }
  writeDraft(id, value, editor) { return this.model.writeDraft(id, value, editor); }
  upload(file, id = this.snapshot.selected, options) { return this.model.upload(file, id, options); }
  prepareAttachment(id, sessionId = this.snapshot.selected) { return this.model.prepareAttachment(id, sessionId); }
  removeAttachment(id, sessionId = this.snapshot.selected) { return this.model.removeAttachment(id, sessionId); }
  changeAttachments(id, update) { return this.model.changeAttachments(id, update); }
  saveAttachmentDrafts(id) { return this.model.saveAttachmentDrafts(id); }
  restartTaskNotifications() { return this.model.restartTaskNotifications(); }
  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.viewNotifications.dispose();
    this.lifetime.signal.removeEventListener('abort', this.onAbort);
    for (const off of this.offs) void off();
    this.view.dispose();
    for (const key of ['skills', 'permissions', 'agentPresets', 'goals', 'planMode']) this[key].dispose();
    this.listeners.clear();
  }
}
