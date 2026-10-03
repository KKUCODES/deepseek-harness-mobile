import React, { useSyncExternalStore } from 'react';
import { RemotePanelMemory } from '../../src/remote-panel-memory.mjs';

// 仅隔离测试RemoteApp的装配/释放时序；不是鉴权、Host或实际网络验收，不进入APK。
const state = { models: [], next: window.initialRemotePlan ?? '', calls: [], clients: [] };
export class RemoteClient {
  connected = false;
  listeners = new Set();
  constructor() { state.clients.push(this); }
  publish(frame) { for (const listener of this.listeners) listener(frame); }
  subscribe(listener) { this.listeners.add(listener); return () => this.listeners.delete(listener); }
  async call(op, data = {}) {
    state.calls.push(op);
    if (op === 'binding.info') return { paired: true, origin: 'http://fixture.invalid', deviceId: 'fixture', fingerprint: 'fixture' };
    if (op === 'binding.status') return { status: 'active' };
    if (op === 'notifications.take') {
      const target = state.notification ?? {};
      if (state.notificationMode === 'take-hold') await new Promise(resolve => { state.releaseTake = resolve; });
      return target;
    }
    if (op === 'notifications.ack') {
      (state.acknowledged ??= []).push(data.id);
      if (state.notification?.id === data.id) state.notification = null;
    }
    if (op === 'socket.connect') { this.connected = true; this.publish({ type: 'ready' }); }
    return {};
  }
  async disconnect() { this.connected = false; this.publish({ type: 'closed', reason: 'user_disconnect' }); }
  async release() { this.connected = false; }
}
export class RemoteModel {
  sessionView = { request: 0 };
  panelMemory = new RemotePanelMemory();
  listeners = new Set();
  sending = new Set();
  snapshot = { selected: null, drafts: {}, attachments: {}, connectionState: 'connected' };
  transport = { negotiate: async () => {} };
  connection = { reconnect() {} };
  constructor(client) { this.client = client; this.plan = state.next; state.next = ''; state.models.push(this); }
  getSnapshot = () => this.snapshot;
  subscribe = listener => { this.listeners.add(listener); return () => this.listeners.delete(listener); };
  publish(patch) { this.snapshot = { ...this.snapshot, ...patch }; for (const listener of this.listeners) listener(); }
  async start() {
    if (['unsupported_remote_version', 'unsupported_dsh_version'].includes(this.plan)) throw Error(this.plan);
    if (this.plan === 'fail') throw Error('remote_bundle_unavailable');
    if (this.plan === 'host_offline') throw Error('host_offline');
    if (this.plan === 'disconnect') {
      this.client.connected = false; this.client.publish({ type: 'closed' });
      throw Error('connection_closed_outcome_unknown');
    }
    if (this.plan === 'hold') await new Promise((resolve, reject) => { state.release = () => reject(Error('connection_closed_outcome_unknown')); });
  }
  async select(target) {
    const request = ++this.sessionView.request;
    if (state.notificationMode === 'fail') throw Error('read_failed');
    if (['hold', 'hold-fail'].includes(state.notificationMode) && target === 'test') await new Promise((resolve, reject) => {
      state.releaseNavigation = state.notificationMode === 'hold-fail' ? () => reject(Error('old_read_failed')) : resolve;
    });
    if (request === this.sessionView.request) this.publish({ selected: target, session: {} });
  }
  fail(error) { this.error = error.message; }
  async dispose() { this.disposed = true; }
}
export class RemotePlugins { async start() {} async prepare() {} async fail() {} }
export class RemoteDraftStore { static async open() { return new RemoteDraftStore(); } close() {} }
export const registerRemoteClipboard = () => () => {};
export const installRemotePluginSlots = () => ({});
export const RemotePluginScope = ({ children }) => children;
export function RemoteWorkspace({ model, onConnection }) {
  const snapshot = useSyncExternalStore(model.subscribe, model.getSnapshot);
  return <section data-testid="workspace" data-model={state.models.indexOf(model)}>
    <p data-testid="selection">{snapshot.selected ?? 'home'}</p>
    <p data-testid="draft">{snapshot.drafts.test ?? ''}</p>
    <p data-testid="draft-editor">{snapshot.draftEditors?.test?.root?.children?.[0]?.ref ?? 'none'}</p>
    <p data-testid="output">{model.commandResume?.output?.reader?.snapshot?.offset ?? 'none'}</p>
    <p data-testid="sidebar">{model.panelMemory.capture().views[0]?.[1]?.selected ?? 'none'}</p>
    <p data-testid="filter">{model.workspaceResume?.archived ? 'archived' : 'recent'}</p>
    <button onClick={onConnection}>电脑连接</button>
  </section>;
}
export const Button = ({ children, variant, ...props }) => <button {...props}>{children}</button>;
export const IconButton = ({ label, children, ...props }) => <button aria-label={label} {...props}>{children}</button>;
export const Surface = ({ title, children }) => <section role="dialog" aria-label={title}>{children}</section>;
export const IconChevronLeftOutline14 = () => null;
export const IconCloseOutline16 = () => null;
export const IconEllipsisOutline16 = () => null;
window.fixture = {
  seed() {
    const model = state.models.at(-1);
    model.publish({ selected: 'test', drafts: { test: '保留草稿' },
      draftEditors: { test: { root: { children: [{ ref: 'original-reference' }] } } }, attachments: {} });
    model.captureCommand = () => ({ target: { sessionId: 'test' }, output: { reader: { snapshot: { offset: 65536 } } } });
    model.panelMemory.observe('sidebar-test', () => ({ selected: 'child-test' }));
    model.captureWorkspace = () => ({ archived: true, query: 'test', workspace: 'test-workspace' });
  },
  rebuild(plan) { state.next = plan; state.models.at(-1).requestRebuild(); },
  failNext() { state.next = 'fail'; },
  release() { state.release(); },
  close(reason) { const client = state.clients.at(-1); client.connected = false; client.publish({ type: 'closed', reason }); },
  ready() { const client = state.clients.at(-1); client.connected = true; client.publish({ type: 'ready' }); },
  notification(mode) {
    state.notificationMode = mode; state.notification = { sessionId: 'test', id: 'notice-test' };
    window.dispatchEvent(new Event('dshm-notification-open'));
  },
  async supersedeNotification() {
    await state.models.at(-1).select('other');
    if (state.releaseTake) state.releaseTake(); else state.releaseNavigation();
  },
  nextNotification(release = true) {
    state.notificationMode = 'success'; state.notification = { sessionId: 'latest', id: 'notice-latest' };
    window.dispatchEvent(new Event('dshm-notification-open'));
    if (release) { if (state.releaseTake) state.releaseTake(); else state.releaseNavigation(); }
  },
  notificationState() { return { target: state.notification, snapshot: state.models.at(-1).snapshot,
    waiting: !!state.releaseNavigation || !!state.releaseTake, ack: state.calls.includes('notifications.ack'), acknowledged: state.acknowledged ?? [] }; },
  inspect() { return { models: state.models.map(model => ({ disposed: !!model.disposed, presented: !!model.presented })), calls: state.calls }; },
};
