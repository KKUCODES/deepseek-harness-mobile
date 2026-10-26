import { Context } from '@deepseek-ai/cordis';
import { RemoteError } from '../../deepseek-harness/packages/typert/protocol/src/index.ts';
import { RemoteSessions } from './remote-sessions.mjs';
import { remoteSessionCatalogs } from './remote-session-catalogs.mjs';
import { createSessionControlStream } from '../../deepseek-harness/packages/api/session-controller/src/client/transport.ts';
import { ClientWorkspaceModel, createWorkspaceStateStream } from '../../deepseek-harness/packages/api/workspace-controller/src/client/index.ts';
import { UiConversation } from '../../deepseek-harness/packages/client/ui-conversation/src/client/conversation/assembly.ts';
import { registerConversationNodes } from '@dshm/conversation/register.ts';
import { RemoteTransport, isRemoteHostDisconnect } from './remote-transport.mjs';
import { RemoteFiles } from './remote-files.mjs';
import { inputImageType, imagePromptPart } from './remote-image-input.mjs';
import { remoteChangesDefinition } from './remote-changes.mjs';
import { remoteTurnBlockedDefinition } from './remote-turn-blocked.mjs';
import { turnForkAnchor } from './remote-forks.mjs';
import { installRemoteCore, bindRemoteSessions, until } from './remote-core.mjs';
import { ModelCatalogDirectory } from '../../deepseek-harness/packages/client/ui-model-selection/src/client/catalog.ts';
import { RemoteSkills } from './remote-skills.mjs';
import { RemotePermissions } from './remote-permissions.mjs';
import { RemoteAgentPresets } from './remote-agent-presets.mjs';
import { RemoteGoals } from './remote-goals.mjs';
import { RemoteJobActions } from './remote-job-actions.mjs';
import { RemotePlanMode } from './remote-plan-mode.mjs';
import { RemoteWorkspaceActions } from './remote-workspaces.mjs';
import { RemoteComputerSettings, RemoteProviderSettings, RemoteDeepSeekModels } from './remote-settings.mjs';
import { RemoteComputerKey } from './remote-key.mjs';
import { RemoteComputerEndpoint } from './remote-endpoint.mjs';
import { subagentAccess, watchSubagentService, SUBAGENT_MODEL_READ_ONLY, assertLocalSubagent } from './remote-subagents.mjs';
import { workflowMemberTarget } from './remote-workflows.mjs';
import { MAX_UPLOAD_BYTES } from '../../backend/packages/protocol/dist/index.js';
import { RemoteNoticeLedger, watchTaskNotifications } from './remote-task-notifications.mjs';
import { RemoteSessionView } from './remote-session-view.mjs';
import { RemoteWorkspaceNavigation } from './remote-workspace-navigation.mjs';
import { RemoteViewNotifications } from './remote-view-notifications.mjs';
import { sameRemoteDraft } from './remote-drafts.mjs';
import { RemoteEndpointJournal } from './remote-endpoint-journal.mjs';
import { RemoteReadingMemory } from './remote-reading-memory.mjs';

/** 只组装数据和会话投影；不启动 bootClient，不挂载电脑页面。 */
export class RemoteModel {
  listeners = new Set();
  viewNotifications = new RemoteViewNotifications(() => this.lifetime.signal.aborted);
  snapshot = { ready: false, error: null, selected: null, conversation: null, session: null, catalog: null, events: [], drafts: {}, draftEditors: {}, draftErrors: {}, draftSaving: {}, attachments: {} };
  draftVersions = new Map();
  attachmentDraftVersions = new Map();
  sendingAttachmentIds = new Map();
  lifetime = new AbortController();
  disposers = [];
  answering = new Set();
  uploads = new Map();
  sending = new Set();
  reconcilingDrafts = new Map();
  draftTransfers = new Set();
  selectingModels = new Set();
  pendingImageUrls = new Set();
  constructor(client, { syncCache, transport = new RemoteTransport(client, { syncCache }), loadRemotes, draftStore, notificationKey } = {}) {
    this.client = client;
    this.transport = transport;
    this.transport.pluginOperations?.setScope(notificationKey, draftStore);
    this.ctx = new Context();
    this.loadRemotes = loadRemotes;
    this.draftStore = draftStore;
    this.reading = new RemoteReadingMemory(notificationKey);
    this.endpointJournal = new RemoteEndpointJournal(draftStore, () => this.publish({ endpointRecoveries: this.endpointJournal.summaries() }));
    this.snapshot.endpointRecoveries = this.endpointJournal.summaries();
    // 同一绑定的核心模块重建沿用去重记录；新绑定不沿用旧电脑的通知身份。
    if (!client.noticeLedger || client.noticeLedgerKey !== notificationKey) {
      client.noticeLedger = new RemoteNoticeLedger(); client.noticeLedgerKey = notificationKey;
    }
    this.noticeLedger = client.noticeLedger;
    const call = (endpoint, args, signal) => this.call(endpoint, args, signal);
    this.files = new RemoteFiles(call, signal => AbortSignal.any([signal, this.lifetime.signal,
      ...[this.transport.lifetime?.signal].filter(Boolean)]));
  }
  assembleSessions() {
    this.disposers.push(watchSubagentService(this));
    this.jobs = this.ctx.get('jobs');
    if (this.transport.capabilities?.endpoints?.streams?.includes('job/list') && !this.jobs) throw Error('remote_jobs_service_missing');
    if (this.jobs) this.disposers.push(this.jobs.state.subscribe(() => this.publish()));
    this.sessions = new RemoteSessions(this.ctx, this.remote);
    this.workspaces = new ClientWorkspaceModel(this.remote.workspace);
    this.workspaceActions = new RemoteWorkspaceActions(this);
    this.computerSettings = new RemoteComputerSettings(this);
    this.providerSettings = new RemoteProviderSettings(this);
    this.deepSeekModels = new RemoteDeepSeekModels(this);
    this.computerKey = new RemoteComputerKey(this);
    this.computerEndpoint = new RemoteComputerEndpoint(this);
    this.searchKey = new RemoteComputerKey(this, 'web-search-deepseek');
    this.searchEndpoint = new RemoteComputerEndpoint(this, 'web-search-deepseek');
    this.conversations = new UiConversation(this.ctx, this.sessions);
    registerConversationNodes(this.ctx);
    this.ctx.uiConversation.events.register(remoteChangesDefinition);
    this.ctx.uiConversation.events.register(remoteTurnBlockedDefinition);
    this.control = createSessionControlStream(this.remote, { accept: frame => this.sessions.handleControlFrame(frame), failed: error => this.fail(error) });
    this.workspaceStream = createWorkspaceStateStream(this.remote, { accept: this.workspaces, failed: error => this.fail(error) });
    this.disposers.push(this.sessions.list.subscribe(() => this.publish()), this.workspaces.subscribe(() => this.publish()));
    bindRemoteSessions(this);
    this.skills = new RemoteSkills(this);
    this.permissions = new RemotePermissions(this);
    this.agentPresets = new RemoteAgentPresets(this);
    this.goals = new RemoteGoals(this);
    this.jobActions = new RemoteJobActions(this);
    this.planMode = new RemotePlanMode(this);
    this.sessionView = new RemoteSessionView(this, {
      source: 'mainView',
      onSelection: id => this.restoreSelectionDraft(id),
      onReady: (id, binding) => this.goals.select(id, binding),
      onRelease: () => this.goals.select(null),
      onChange: patch => this.publish(patch),
    });
    this.workspaceNavigation = new RemoteWorkspaceNavigation(this);
    this.ctx.provide('uiWorkspace', this.workspaceNavigation);
    this.remote.$on('agent-preset/selected', sessionId => this.skills.invalidate(sessionId));
    this.remote.$on('commands/change', () => { this.skills.invalidate(); this.planMode.invalidate(); });
    this.modelCatalog = new ModelCatalogDirectory(this.ctx);
    this.disposers.push(this.modelCatalog.store.subscribe(() => {
      const catalog = this.modelCatalog.store.getSnapshot();
      this.publish({ catalog: catalog.value, catalogStatus: catalog.status, catalogError: catalog.error });
    }));
    for (const event of ['llm/adapters-updated', 'settings/document-updated', 'credentials/reference-updated']) {
      this.remote.$on(event, () => this.modelCatalog.refresh());
    }
    this.disposers.push(this.connection.generation.subscribe(() => {
      const generation = this.connection.generation.getSnapshot();
      this.capabilityRead?.abort();
      this.capabilityGeneration = undefined;
      if (!generation) { this.publish({ connectionState: 'connecting' }); return; }
      // Host 可以单独重启而中继 socket 不断；每个原连接世代都重新核对电脑能力。
      this.capabilityRefresh = this.refreshCapabilities(generation);
      // 首次启动由 start 等待并报告；后续失败已在刷新逻辑中显示和分类。
      void this.capabilityRefresh.catch(() => {});
      this.sessions.handleConnected(); this.control.restart(); this.control.start();
      this.modelCatalog.resetGeneration();
      this.skills.invalidate();
      this.planMode.invalidate();
    }), this.connection.state.subscribe(() => {
      const connectionState = this.connection.state.getSnapshot();
      this.publish({ connectionState, ...(connectionState === 'disconnected' ? { error: '电脑连接中断，正在重新连接。' } : connectionState === 'connected' ? { error: null } : {}) });
    }));
  }
  subscribe = listener => { this.listeners.add(listener); return () => this.listeners.delete(listener); };
  subscribeView = listener => {
    if (this.lifetime.signal.aborted) return () => {};
    return this.viewNotifications.subscribe(listener);
  };
  getSnapshot = () => this.snapshot;
  async refreshCapabilities(generation) {
    const controller = new AbortController(); this.capabilityRead = controller;
    const signal = AbortSignal.any([controller.signal, this.lifetime.signal]);
    this.publish({ connectionState: 'connecting' });
    try {
      await this.transport.negotiate({ signal });
      if (signal.aborted || this.connection.generation.getSnapshot() !== generation) return;
      this.capabilityGeneration = generation.id;
      this.publish({ connectionState: this.connection.state.getSnapshot(), error: null });
    } catch (error) {
      if (signal.aborted) return;
      this.publish({ connectionState: 'disconnected', error: '无法确认电脑当前能力，请重新连接。' });
      if (isRemoteHostDisconnect(error) || error.message === 'request_timeout_outcome_unknown') this.connection.reconnect();
      throw error;
    }
  }
  publish(patch = {}) {
    if (this.lifetime.signal.aborted) return;
    const previous = this.snapshot;
    this.snapshot = { ...this.snapshot, ...patch, lastReceivedAt: this.transport.lastReceivedAt,
      list: remoteSessionCatalogs(this.sessions?.list.getSnapshot()), workspaces: this.workspaces?.getSnapshot(),
      jobs: this.jobs?.state.getSnapshot() };
    if (this.snapshot.connectionState === 'connected' && this.capabilityGeneration !== this.connection?.generation.getSnapshot()?.id) this.snapshot.connectionState = 'connecting';
    for (const listener of this.listeners) listener();
    if (!this.lifetime.signal.aborted) this.viewNotifications.publish(previous, this.snapshot);
  }
  fail(error) { this.publish({ error: error.message }); }
  async call(endpoint, args, signal) {
    const result = await this.transport.call('/api', endpoint, { args }, AbortSignal.any([this.lifetime.signal, ...(signal ? [signal] : [])]));
    if (!result.ok) return { ok: false, error: new RemoteError(result.error.code, result.error.message, result.error.details ?? {}) };
    return result;
  }
  async start() {
    await this.transport.negotiate();
    this.lifetime.signal.throwIfAborted();
    if (!this.loadRemotes) throw new Error('remote_definitions_required');
    const remotes = await this.loadRemotes();
    this.lifetime.signal.throwIfAborted();
    const core = installRemoteCore(this);
    this.connection = core.connection; this.remote = this.ctx.remote;
    await remotes.apply(this.ctx);
    await this.pluginRuntime?.installJobs();
    this.lifetime.signal.throwIfAborted();
    this.assembleSessions();
    await this.onAssembled?.();
    const ready = Promise.withResolvers();
    const off = this.connection.generation.subscribe(() => { if (this.connection.generation.getSnapshot()) ready.resolve(); });
    core.open();
    try { await until(ready.promise, this.lifetime.signal); } finally { off(); }
    await this.capabilityRefresh;
    this.workspaceStream.start();
    await this.sessions.refresh();
    // 目录失败只影响模型选择，不能让已连通的聊天和历史一起退出。
    await this.modelCatalog.load().catch(() => {});
    this.publish({ ready: true });
    this.restartTaskNotifications();
    this.disposers.push(() => this.noticeWatcher?.());
  }
  restartTaskNotifications() {
    this.noticeWatcher?.();
    this.noticeWatcher = watchTaskNotifications(this, this.noticeLedger, change => {
      this.publish({ notificationChange: change, pendingNotices: [...this.noticeLedger.pending.values()] });
    });
  }
  get reference() { return this.sessionView?.reference ?? null; }
  get selection() { return this.sessionView?.selection ?? 0; }
  releaseSelection() { this.sessionView?.release(); }
  select(target, options) { return this.sessionView.select(target, options); }
  beginNavigation() { return this.sessionView.beginNavigation(); }
  createSessionView() {
    this.lifetime.signal.throwIfAborted();
    if (!this.sessions || !this.conversations) throw new Error('remote_session_services_not_ready');
    return new RemoteSessionView(this, { onSelection: id => {
      this.publish(this.restoreDraft(id));
    } });
  }
  restoreSelectionDraft(id) {
    this.skills.select(id);
    this.planMode.select(id);
    return this.restoreDraft(id);
  }
  restoreDraft(id) {
    const restored = {};
    // 在新输入框第一次出现前同步恢复，避免会话网络加载期间输入覆盖旧草稿。
    if (id && this.draftStore && !Object.hasOwn(this.snapshot.drafts, id)) {
      try {
        const saved = this.draftStore.readEntry?.(id) ?? { text: this.draftStore.read(id) };
        restored.drafts = { ...this.snapshot.drafts, [id]: saved.text };
        restored.draftEditors = { ...this.snapshot.draftEditors, [id]: saved.editor };
        restored.draftErrors = { ...this.snapshot.draftErrors, [id]: null };
      }
      catch { restored.draftErrors = { ...this.snapshot.draftErrors, [id]: '无法读取本机草稿，请检查手机存储后重新打开聊天。' }; }
    }
    if (id && this.draftStore?.readAttachments && !Object.hasOwn(this.snapshot.attachments, id)) {
      try { restored.attachments = { ...this.snapshot.attachments, [id]: this.draftStore.readAttachments(id) }; }
      catch { restored.attachmentDraftErrors = { ...this.snapshot.attachmentDraftErrors, [id]: '无法读取本机附件草稿，请检查手机存储后重新打开聊天。' }; }
    }
    return restored;
  }
  get subagentsAvailable() {
    const calls = this.transport.capabilities?.endpoints?.calls;
    return calls?.includes('subagents/list') === true || calls?.includes('session/projections') === true;
  }
  async openChild(id, view = this) {
    const { selected, selectedTarget, selectionTrail = [], list } = view.getSnapshot();
    const child = list?.subagentsByParent[selected]?.entries.find(item => item.id === id && item.kind === 'child');
    if (!this.subagentsAvailable || !child) throw new Error('子会话已变化，请刷新后重试。');
    assertLocalSubagent(child);
    await view.select({ parentSessionId: selected, childSessionId: child.id, mode: child.mode }, { trail: [...selectionTrail, selectedTarget] });
  }
  async back(view = this) {
    const trail = [...(view.getSnapshot().selectionTrail ?? [])];
    if (trail.length) return view.select(trail.pop(), { trail });
    const parent = subagentAccess(view.getSnapshot()).address?.parentSessionId;
    return view.select(parent ?? null);
  }
  async openWorkflowMember(target, view = this) {
    const state = view.getSnapshot(), address = workflowMemberTarget(state, target);
    const trail = [...(state.selectionTrail ?? []), state.selectedTarget];
    await view.select(address, { trail });
  }
  sessionFor(view = this) {
    this.lifetime.signal.throwIfAborted();
    view.lifetime.signal.throwIfAborted();
    if ((view !== this && view.model !== this) || !view.reference) throw new Error('remote_session_unselected');
    if (this.snapshot.connectionState !== 'connected') throw new Error('电脑暂时离线，请恢复连接后重试。');
    return view.reference;
  }
  async stop(view = this) {
    const reference = this.sessionFor(view);
    const access = subagentAccess(view.getSnapshot(), this.snapshot.subagentServiceAvailable);
    if (!access.canStop) throw new Error(access.address?.mode === 'continuable'
      ? access.message : '此子任务只能查看执行记录。');
    return unwrap(await reference.binding.session.cancel());
  }
  draft(value) { return this.writeDraft(this.snapshot.selected, value); }
  async prepareUpdate() {
    if (this.sending.size || this.draftTransfers.size || Object.values(this.snapshot.draftSaving ?? {}).some(Boolean)
      || Object.values(this.snapshot.attachmentDraftSaving ?? {}).some(Boolean)) throw Error('web_restart_busy');
    // 重新提交当前快照并等待事务，不能只依据界面已显示文字判断落盘完成。
    for (const [id, text] of Object.entries(this.snapshot.drafts)) await this.draftStore?.write(id, text, this.snapshot.draftEditors[id]);
    for (const [id, attachments] of Object.entries(this.snapshot.attachments)) await this.draftStore?.writeAttachments?.(id, attachments, this.sendingAttachmentIds.get(id) ?? []);
  }
  async writeDraft(id, value, editor) {
    if (!id || this.lifetime.signal.aborted) return;
    const version = (this.draftVersions.get(id) ?? 0) + 1; this.draftVersions.set(id, version);
    this.publish({ drafts: { ...this.snapshot.drafts, [id]: value }, draftEditors: { ...this.snapshot.draftEditors, [id]: editor },
      draftSaving: { ...this.snapshot.draftSaving, [id]: true } });
    try {
      await this.draftStore?.write(id, value, editor);
      if (this.draftVersions.get(id) === version) this.publish({ draftErrors: { ...this.snapshot.draftErrors, [id]: null } });
    } catch {
      if (this.draftVersions.get(id) === version) this.publish({ draftErrors: { ...this.snapshot.draftErrors, [id]: value === ''
        ? '本机草稿未能清理，重启后可能仍显示旧内容，请勿重复发送。'
        : '草稿未能保存到手机，请勿关闭 App，检查存储后重试。' } });
    } finally { if (this.draftVersions.get(id) === version) this.publish({ draftSaving: { ...this.snapshot.draftSaving, [id]: false } }); }
  }
  async reconcileSubmission(id, binding, acceptedRequestId) {
    if (!this.draftStore?.readSubmission || this.lifetime.signal.aborted) return;
    if (this.reconcilingDrafts.has(id)) {
      await this.reconcilingDrafts.get(id);
      return this.reconcileSubmission(id, binding, acceptedRequestId);
    }
    const operation = (async () => {
      try {
        const pending = this.draftStore.readSubmission(id);
        if (!pending) return;
        const inbox = binding.session.projections.faceOf('inbox').getSnapshot();
        const matches = source => source?.kind === 'user' && source.rpcId === pending.requestId;
        const received = acceptedRequestId === pending.requestId
          || binding.eventSource.getSnapshot().entries.some(entry => entry.type === 'event'
            && entry.event.type === 'user/message' && matches(entry.event.data.source))
          || ['next-turn', 'next-step'].some(key => inbox?.[key]?.some(item => matches(item.source)));
        if (!received) return;
        const version = this.draftVersions.get(id), filesVersion = this.attachmentDraftVersions.get(id);
        const current = () => !this.lifetime.signal.aborted && this.draftVersions.get(id) === version
          && this.attachmentDraftVersions.get(id) === filesVersion;
        const result = await this.draftStore.settleSubmission(id, pending.requestId, current);
        if (!result || !current()) return;
        const draft = { text: this.snapshot.drafts[id] ?? '', editor: this.snapshot.draftEditors[id] };
        this.publish({ ...(result.clearedDraft && sameRemoteDraft(draft, pending.draft) ? {
          drafts: { ...this.snapshot.drafts, [id]: '' }, draftEditors: { ...this.snapshot.draftEditors, [id]: undefined },
          draftErrors: { ...this.snapshot.draftErrors, [id]: null },
        } : {}), attachments: { ...this.snapshot.attachments,
          [id]: (this.snapshot.attachments[id] ?? []).filter(item => !result.attachmentIds.includes(item.id)) } });
      } catch {
        if (!this.lifetime.signal.aborted) this.publish({ draftErrors: { ...this.snapshot.draftErrors,
          [id]: '发送记录尚未核对或草稿未能清理，请检查聊天记录，勿重复发送。' } });
      }
    })();
    this.reconcilingDrafts.set(id, operation);
    try { await operation; } finally { if (this.reconcilingDrafts.get(id) === operation) this.reconcilingDrafts.delete(id); }
  }
  changeAttachments(id, update) {
    this.publish({ attachments: { ...this.snapshot.attachments, [id]: update(this.snapshot.attachments[id] ?? []) } });
    return this.saveAttachmentDrafts(id);
  }
  async saveAttachmentDrafts(id, sendingIds = this.sendingAttachmentIds.get(id) ?? []) {
    if (this.lifetime.signal.aborted) return false;
    const version = (this.attachmentDraftVersions.get(id) ?? 0) + 1; this.attachmentDraftVersions.set(id, version);
    this.publish({ attachmentDraftSaving: { ...this.snapshot.attachmentDraftSaving, [id]: true } });
    try {
      await this.draftStore?.writeAttachments?.(id, this.snapshot.attachments[id] ?? [], sendingIds);
      if (this.attachmentDraftVersions.get(id) === version) this.publish({ attachmentDraftErrors: { ...this.snapshot.attachmentDraftErrors, [id]: null } });
      return true;
    } catch {
      if (this.attachmentDraftVersions.get(id) === version) this.publish({ attachmentDraftErrors: { ...this.snapshot.attachmentDraftErrors,
        [id]: '附件草稿未能保存，请检查手机存储后重试；暂时不要关闭 App。' } });
      return false;
    } finally {
      if (this.attachmentDraftVersions.get(id) === version) this.publish({ attachmentDraftSaving: { ...this.snapshot.attachmentDraftSaving, [id]: false } });
    }
  }
  async upload(file, sessionId = this.snapshot.selected, { image = false } = {}) {
    if (this.draftTransfers.has(sessionId)) throw new Error('草稿正在转移，请稍后添加附件。');
    if (!sessionId || !(file instanceof Blob)) throw new Error('remote_attachment_invalid');
    if (file.size > MAX_UPLOAD_BYTES) throw new Error('文件过大，超过电脑允许的上传大小。');
    const child = this.sessions.subagentAddress(sessionId);
    if (child && (child.mode === 'one-shot' || !inputImageType(file, image))) throw new Error('此子会话不支持上传文件。可继续的子会话支持发送图片。');
    const id = crypto.randomUUID(), controller = new AbortController(); this.uploads.set(id, controller);
    this.changeAttachments(sessionId, items => [...items, { id, name: file.name ?? '文件', bytes: file.size, state: 'uploading' }]);
    try {
      const mediaType = inputImageType(file, image);
      // 拷贝原件字节，不能把 Android 临时 content URI 的读取许可当作持久文件。
      const source = new Blob([await file.arrayBuffer()], { type: mediaType ?? file.type });
      if (controller.signal.aborted || this.lifetime.signal.aborted) return;
      await this.changeAttachments(sessionId, items => items.map(item => item.id === id
        ? { ...item, source, ...(mediaType ? { kind: 'image', mediaType } : {}) } : item));
      await this.prepareAttachment(id, sessionId, controller);
    } catch (error) {
      if (!controller.signal.aborted) await this.changeAttachments(sessionId, items => items.map(item => item.id === id
        ? { ...item, state: 'error', error: error.message } : item));
    } finally { if (this.uploads.get(id) === controller) this.uploads.delete(id); }
  }
  async prepareAttachment(id, sessionId = this.snapshot.selected, controller = new AbortController()) {
    const item = this.snapshot.attachments[sessionId]?.find(item => item.id === id);
    if (!item?.source || item.state === 'uncertain' || this.sending.has(sessionId) || this.lifetime.signal.aborted) return;
    const child = this.sessions.subagentAddress(sessionId);
    if (child && (child.mode === 'one-shot' || item.kind !== 'image')) throw new Error('此子会话不支持准备该附件。');
    if (this.uploads.has(id) && this.uploads.get(id) !== controller) return;
    this.uploads.set(id, controller);
    await this.changeAttachments(sessionId, items => items.map(value => value.id === id ? { ...value, state: 'uploading', error: undefined } : value));
    try {
      if (item.kind === 'image') {
        if (!this.transport.capabilities?.channels?.includes('prompt')) throw new Error('请更新电脑插件和网关后发送图片。');
        if (!controller.signal.aborted) await this.changeAttachments(sessionId, items => items.map(value => value.id === id ? { ...value, state: 'ready' } : value));
        return;
      }
      const query = new URLSearchParams({ sessionId, name: item.name });
      const response = await this.transport.uploadHooks.fetch(`/api/session/uploadFileBinary?${query}`, {
        method: 'POST', headers: { 'content-type': 'application/octet-stream' }, body: item.source,
        signal: AbortSignal.any([controller.signal, this.lifetime.signal]),
      });
      if (!response.ok) throw new Error(`remote_upload_http_${response.status}`);
      const value = unwrap(await response.json()), ref = value?.file;
      // 沿用 FileUploadValue：只保存 Host 签发的会话内 receipt，不把路径当成授权。
      if (typeof value?.receiptId !== 'string' || typeof ref?.attachmentId !== 'string'
        || typeof ref.name !== 'string' || !Number.isSafeInteger(ref.bytes) || ref.bytes < 0) throw new Error('remote_upload_invalid_receipt');
      if (!controller.signal.aborted) await this.changeAttachments(sessionId, items => items.map(item => item.id === id
        ? { ...item, name: ref.name, bytes: ref.bytes, state: 'ready', receiptId: value.receiptId, file: ref } : item));
    } catch (error) {
      if (!controller.signal.aborted) await this.changeAttachments(sessionId, items => items.map(item => item.id === id
        ? { ...item, state: 'error', error: error.message } : item));
    } finally { if (this.uploads.get(id) === controller) this.uploads.delete(id); }
  }
  removeAttachment(id, sessionId = this.snapshot.selected) {
    if (this.sending.has(sessionId) || this.draftTransfers.has(sessionId)) return;
    this.uploads.get(id)?.abort();
    return this.changeAttachments(sessionId, items => items.filter(item => item.id !== id));
  }
  async send(mode = 'queue', input, view = this) {
    const reference = this.sessionFor(view);
    const id = reference.sessionId;
    if (this.draftTransfers.has(id)) throw new Error('草稿正在转移，请稍后发送。');
    const generation = this.connection.generation.getSnapshot()?.id;
    // 原输入 shell 在异步序列化引用前冻结提交身份，不能再从当前草稿取模型正文。
    const checkInput = () => {
      input?.signal?.throwIfAborted();
      view.lifetime.signal.throwIfAborted();
      if (view.reference !== reference || generation !== this.connection.generation.getSnapshot()?.id
        || this.snapshot.connectionState !== 'connected'
        || (input && (input.reference !== reference || input.generation !== generation))) {
        throw new Error('聊天或电脑连接已变化，请核对草稿后重新发送。');
      }
    };
    checkInput();
    const text = input ? input.text : this.snapshot.drafts[id] ?? '';
    const displayDraft = input?.displayDraft ?? (!input ? { text, editor: this.snapshot.draftEditors[id] } : undefined);
    if (typeof text !== 'string' || text.length > 100000) throw new Error('remote_draft_invalid');
    const available = this.snapshot.attachments[id] ?? [];
    const ids = input?.attachmentIds;
    if (input && (!Array.isArray(ids) || new Set(ids).size !== ids.length
      || ids.some(key => !available.some(item => item.id === key)))) throw new Error('remote_attachment_expired');
    const attachments = input ? ids.map(key => available.find(item => item.id === key)) : available;
    const signal = AbortSignal.any([this.lifetime.signal, view.lifetime.signal, ...[input?.signal].filter(Boolean)]);
    if (!text.trim() && !attachments.length) return;
    if (this.sending.has(id)) throw new Error('remote_submission_pending');
    if (this.planMode.pendingSessions.has(id)) throw new Error('计划模式正在切换，请稍候再发送。');
    if (this.agentPresets.pendingSessions.has(id)) throw new Error('Agent 模式正在切换，请稍候再发送。');
    if (attachments.some(item => item.state !== 'ready')) throw new Error('remote_attachments_not_ready');
    const access = subagentAccess(view.getSnapshot(), this.snapshot.subagentServiceAvailable);
    if (!access.canSend) throw new Error(access.message);
    if (access.address && attachments.some(item => item.kind !== 'image')) throw new Error('子会话不支持发送文件附件。');
    const session = reference.binding.session;
    // 不自动重放失败或未知结果；等待原始 requestId 在电脑事件中确认。
    this.sending.add(id);
    this.sendingAttachmentIds.set(id, attachments.map(item => item.id));
    let dispatched = false;
    try {
      if (attachments.length && !await this.saveAttachmentDrafts(id, attachments.map(item => item.id))) throw new Error('附件草稿尚未保存，暂未发送，请检查手机存储后重试。');
      const content = [ ...(text.trim() ? [{ type: 'text', text }] : []) ];
      for (const item of attachments) content.push(item.kind === 'image'
        ? await imagePromptPart(item, signal) : { type: 'file', receiptId: item.receiptId });
      checkInput();
      // 序列化/原生保存期间附件可能被移除或重新上传。只发送本次确认的同一批对象。
      if (input && attachments.some(item => !this.snapshot.attachments[id]?.includes(item))) throw new Error('remote_attachment_expired');
      const urls = [];
      const submission = session.beginSubmission({ mode, text, attachments: attachments.map(item => {
        if (item.kind !== 'image') return { type: 'file', value: item.file };
        const previewUrl = URL.createObjectURL(item.source); urls.push(previewUrl); this.pendingImageUrls.add(previewUrl);
        return { type: 'image', value: { previewUrl, name: item.name } };
      }), onRetire: () => { for (const url of urls) { URL.revokeObjectURL(url); this.pendingImageUrls.delete(url); } } });
      let result;
      try {
        if (displayDraft && this.draftStore?.prepareSubmission) {
          await this.draftStore.prepareSubmission(id, submission.requestId, displayDraft, attachments.map(item => item.id));
          checkInput();
        }
        dispatched = true;
        // 基线上游 Session.prompt 的子会话分支会重新生成 requestId，导致本地回显无法退休。
        // 调用同一原生成接口并保留 beginSubmission 的 id，电脑记录仍是唯一事实来源。
        result = access.address ? await this.remote.subagents.prompt({
          ...access.address, requestId: submission.requestId, delivery: mode, content,
          clientTimeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        }, signal) : await session.prompt(content, mode, signal, submission.requestId);
        // 原 Gateway 将载体异常折叠为结果；这不等于电脑明确拒绝了发送。
        if (!result.ok && ['gateway/internal', 'gateway/cancelled'].includes(result.error.code)) throw result.error;
      } catch (error) {
        submission.abandon();
        if (dispatched) await this.changeAttachments(id, items => items.map(item => attachments.includes(item) ? { ...item, state: 'uncertain' } : item));
        else await this.draftStore?.forgetSubmission?.(id, submission.requestId);
        throw error;
      }
      this.sendingAttachmentIds.delete(id);
      if (!result.ok) {
        submission.abandon(); await this.draftStore?.forgetSubmission?.(id, submission.requestId); await this.saveAttachmentDrafts(id);
      }
      unwrap(result);
      await this.reconcileSubmission(id, reference.binding, submission.requestId);
      // 原 shell 自己提交/恢复编辑器；它的持久化草稿可能是引用的展示形式。
      if (!input && this.snapshot.drafts[id] === text) await this.writeDraft(id, '');
      await this.changeAttachments(id, items => items.filter(item => !attachments.includes(item)));
    } finally { this.sending.delete(id); this.sendingAttachmentIds.delete(id); if (!dispatched && attachments.length) await this.saveAttachmentDrafts(id); }
  }
  async create(workspaceId, view = this) {
    if (!this.workspaces.getSnapshot().items.some(item => item.workspaceId === workspaceId)) throw new Error('remote_workspace_required');
    const current = view.beginNavigation();
    const id = await this.sessions.create({ workspaceId });
    if (current()) await view.select(id);
    return id;
  }
  async chooseModel(selection, view = this) {
    // 原接口只能配置普通 Agent，子会话不能绕过父子地址以普通会话激活。
    if (subagentAccess(view.getSnapshot()).address) throw new Error(SUBAGENT_MODEL_READ_ONLY);
    const sessionId = this.sessionFor(view).sessionId, state = view.getSnapshot();
    if (state.session?.openState !== 'open' || state.session.running) throw new Error('remote_model_busy');
    if (this.selectingModels.has(sessionId)) throw new Error('模型正在切换，请稍候。');
    this.selectingModels.add(sessionId);
    try {
      const result = await this.remote.session.selectModel({ sessionId, provider: selection.provider, model: selection.model,
        ...(selection.reasoningEffort === undefined ? {} : { reasoningEffort: selection.reasoningEffort }) });
      if (!result.ok && ['gateway/internal', 'gateway/cancelled'].includes(result.error.code)) {
        throw new Error('模型切换结果尚未确认，请重新连接并核对当前模型。');
      }
      const value = unwrap(result);
      // 选中值始终由电脑投影更新；响应不能覆盖已切换到的其他会话。
      // 原 DSH 同时保存下次新会话的默认值，因此更新共享目录。
      if (!this.lifetime.signal.aborted) this.modelCatalog.refresh();
      return value;
    } finally { this.selectingModels.delete(sessionId); }
  }
  async updateQueue(itemId, action, view = this) {
    const reference = this.sessionFor(view);
    if (!view.getSnapshot().inbox?.['next-turn']?.some(item => item.id === itemId)) throw new Error('remote_queue_item_expired');
    unwrap(await reference.binding.session.updateQueue(itemId, action));
  }
  async rename(title, view = this) {
    if (!title.trim()) throw new Error('remote_title_required');
    unwrap(await this.sessionFor(view).binding.session.rename(title.trim()));
  }
  async fork(atSeq, view = this) {
    const reference = this.sessionFor(view);
    if (this.forking) throw new Error('正在创建分支，请稍候。');
    const sessionId = reference.sessionId, current = view.beginNavigation();
    this.forking = true;
    try {
      const id = await this.sessions.fork({ sessionId, ...(atSeq === undefined ? {} : { atSeq }), increaseTitle: true });
      if (current()) await view.select(id);
      return id;
    } finally { this.forking = false; }
  }
  async forkTurn(nodeId, sessionId, view = this) {
    if (sessionId !== view.getSnapshot().selected) throw new Error('聊天已切换，请在当前聊天中选择分支位置。');
    const atSeq = turnForkAnchor(view.getSnapshot().conversation, nodeId);
    if (atSeq === null) throw new Error('这条记录暂时不能分支，请选择已完成轮次的最后一条回复。');
    return this.fork(atSeq, view);
  }
  async archive(archived, view = this) {
    const id = this.sessionFor(view).sessionId;
    const current = view.beginNavigation();
    unwrap(await (archived ? this.workspaces.archiveSession(id) : this.workspaces.unarchiveSession(id)));
    if (current() && view.reference?.sessionId === id) await view.select(null);
  }
  async answer(eventId, outcome, view) {
    const pending = this.interactions?.get(eventId);
    if (!pending) throw new Error('remote_event_expired');
    // 应用级通知可处理指定事件；聊天界面必须另外核对当前视图归属。
    if (view && this.sessionFor(view).sessionId !== pending.sessionId) throw new Error('remote_event_expired');
    if (this.answering.has(eventId)) throw new Error('remote_event_submitting');
    this.answering.add(eventId);
    try {
      if (outcome.kind === 'next') pending.delegate();
      else if (outcome.kind === 'result') await pending.answer(outcome.value);
      // 提出修改沿用原计划卡片的取消语义，不能伪造成批准或普通选项答案。
      else if (outcome.kind === 'cancel' && pending.kind === 'plan-review') await pending.cancel();
      else throw new Error('remote_answer_invalid');
    } finally { this.answering.delete(eventId); }
  }
  async dispose() {
    if (this.closing) return this.closing;
    this.releaseSelection(); this.lifetime.abort();
    this.viewNotifications.dispose();
    this.skills?.dispose();
    this.permissions?.dispose();
    this.planMode?.dispose();
    this.agentPresets?.dispose();
    this.goals?.dispose();
    for (const url of this.pendingImageUrls) URL.revokeObjectURL(url);
    this.pendingImageUrls.clear();
    this.disposers.forEach(off => off()); this.transport.dispose();
    this.closing = Promise.allSettled([this.transport.pluginOperations?.settled?.(), this.pluginRuntime?.dispose(),
      this.control?.dispose(), this.workspaceStream?.dispose(), this.ctx.fiber.dispose()]).finally(() => this.draftStore?.close?.());
    return this.closing;
  }
}

export function unwrap(result) { if (!result.ok) throw result.error; return result.value; }
