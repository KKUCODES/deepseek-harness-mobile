import React from 'react';
import { createRoot } from 'react-dom/client';
import { flushSync } from 'react-dom';
import { RemoteModel } from '../../src/remote-model.mjs';
import { loadTestRemotes } from './remote-core.mjs';
import workspaceFilesRemote from './generated/workspace-files-remote.mjs';
import sessionReferenceRemote from './generated/session-reference-remote.mjs';
import { installRemotePluginSlots, RemotePluginScope } from '../../src/remote-plugin-slots.jsx';
import { RemoteWorkspace } from '../../src/ui/RemoteWorkspace.jsx';
import { MobileModelOnboarding } from '../../src/remote-model-onboarding.jsx';
import { RemotePlugins } from '../../src/remote-plugins.jsx';
import { RemoteTransport } from '../../src/remote-transport.mjs';
import { RemoteApp } from '../../src/RemoteApp.jsx';
import { RemoteDraftStore } from '../../src/remote-drafts.mjs';
import { captureRemoteResume } from '../../src/remote-resume.mjs';
import { draftBinding } from './remote-draft-storage.mjs';
import { chatNode } from '../../../deepseek-harness/packages/client/ui-chat/src/client/conversation-nodes/common.ts';
import { RemoteFilePreview } from '../../src/ui/RemoteFilePreview.jsx';
import { sessionFileAddress } from '@deepseek-ai/dsh-util-workspace-path';
import { resolveDocumentAddress } from '../../src/remote-document-address.mjs';
import { RemoteChangesPreview } from '../../src/ui/RemoteDiff.jsx';
import { RemoteToolResult } from '../../src/ui/RemoteMessage.jsx';
import { LocaleProvider } from '../../src/ui/locale.jsx';
import * as originalFeedback from '../../../deepseek-harness/packages/client/ui-message-feedback/src/client/index.ts';
import * as originalInputTriggers from '../../../deepseek-harness/packages/client/ui-input-trigger/src/client/index.ts';
import * as originalPlan from '../../../deepseek-harness/packages/client/ui-plan/src/client/index.ts';
import * as originalTools from '../../../deepseek-harness/packages/client/ui-tool/src/client/index.ts';
import { OrdinaryMarkdown } from '../../src/ordinary-rendering.jsx';
import * as originalResources from '../../../deepseek-harness/packages/client/resources/src/client/index.ts';
import * as originalFiles from '../../../deepseek-harness/packages/client/ui-sidebar-files/src/client/index.ts';
import { Modal } from '../../../deepseek-harness/packages/client/ui-primitives/src/Modal.tsx';
import { Menu } from '../../../deepseek-harness/packages/client/ui-primitives/src/Menu.tsx';
import { checkRemoteInput, checkViewInputs } from './remote-input-checks.mjs';
import { conversationChecks } from './remote-conversation-checks.jsx';
import { composerChecks } from './remote-composer-checks.jsx';
import { navigationChecks } from './remote-navigation-checks.jsx';
import { factoryChecks } from './remote-factory-checks.jsx';
import { desktopAppsReplay } from './desktop-apps-replay.mjs';
import { enableCordisPanel } from './remote-cordis-panel.jsx';
import { enableCordisCards } from './remote-cordis-cards.jsx';
import { mountMotionProbe } from './motion-probe.jsx';
window.mountMotionProbe = mountMotionProbe;
import { renderFailureProbe } from './remote-render-failure.jsx';

// 独立测试协议回放，不进入 APK；消息仍经过原 ClientSessions/UiConversation。
const channels = new Map();
const documentMode = new URL(location.href).searchParams.has('documents');
const fileListMode = new URL(location.href).searchParams.has('files');
const fileListRoot = 'Q:/Tanxian/LToys/dsh-mobile/plugin/artifacts/official-dsh-alpha2/home/official-remote-test-project/2ea87817';
const documentReads = [];
const reviewCalls = [];
const deliveryOpens = [];
const transfers = [];
let transferProbe = false, transferHold, transferNext = 0, transferRelease, transferFailure, attachmentFailure = false;
let reviewFailure = true;
let deliverySummaryFailure = false;
const eventResults = [];
const sidebarPrompts = [];
const forkActionRequests = [];
const readingContexts = [];
const feedbackItems = new Map(), feedbackWrites = [], feedbackReads = [];
const feedbackWatchers = new Map();
let feedbackPlugin, feedbackConflict = false, feedbackSyncSession = false;
let inputProbe;
const inputHandles = [];
let catalogFailure = false;
const searchRequests = [];
let workspaceViews = [];
let workspaceDraftTest = false;
let savedDraftStore, savedUploadHooks;
const workspaceDraftUploads = [];
const workspaceWrites = [];
const settingsRequests = [];
const commandOutputRequests = [];
const keyNativeCalls = [];
const appearanceNavigationCalls = [];
let keyConfigured = true, heldKeyRead, heldKeyNative;
let heldProviderCardRead;
let readiness = 'credential-missing';
let providerRows = [], providerListHold, providerListFailure = false, providerListReads = 0;
let providerSettingsReadFailure = false;
let providerCreationWrites = [];
const endpointWrites = [];
let endpointValue = 'https://api.deepseek.com/anthropic', endpointRevision = 0, endpointOverridden = false;
const endpointView = () => ({ snapshot: crypto.randomUUID(), revision: endpointRevision, writable: true, applies: 'live', protocol: 'messages',
  origin: new URL(endpointValue).origin, inheritedOrigin: 'https://api.deepseek.com', customPath: true, overridden: endpointOverridden });
let settingsConflict = false, settingsRevision = 0, settingsLimit = 1024;
let heldSettingsRead, settingsReadFailure = false;
let modelListName = 'Initial model', modelListReads = 0, heldModelListRead;
const settingsView = () => ({ snapshot: crypto.randomUUID(), namespace: 'llm-deepseek', revision: settingsRevision, writable: true, applies: 'live',
  fields: Object.entries({ thinking: 'enabled', reasoningEffort: 'high', maxTokens: settingsLimit, defaultContextWindow: 4096, streamIdleTimeoutMs: 30000 })
    .map(([key, value]) => ({ key, value, overridden: key === 'maxTokens' })) });
let skillsFailure = true;
let permissionFailure = true, permissionWrites = 0;
let presetFailure = true, presetWrites = 0;
let presetGate;
let goalValue, goalFailure = true;
let jobStopWrites = 0;
let scheduleSeq = 500, planSeq = 500, planWrites = [], modelSeq = 500;
let workflowSeq = 0;
let historyReply, historyTesting = false;
let listRefreshGate, releaseListRefresh;
let createProbe;
let lineageTesting = false;
let fileLayoutText;
const historyRequests = [];
const transport = {
  capabilities: { ...(location.search.includes('builtin') ? { dshVersion: DSHM_MOBILE_SDK_VERSION } : {}), feedbackNotifications: true, jobControlGeneration: 'fixture-generation', endpoints: { calls: ['skills/list', 'commands/list', 'permissionPresets/catalog', 'commands/execute', 'agentPresets/list', 'agentPresets/select', ...['get', 'create', 'edit', 'pause', 'resume', 'complete', 'clear'].map(name => `goals/${name}`)] } },
  async negotiate() { this.capabilities.planModeControl = true; this.capabilities.endpoints.calls.push('subagents/list', 'subagents/prompt', 'subagents/interruptByParent'); }, dispose() {},
  async call(_channel, endpoint, payload) {
    if (endpoint === 'session/fork') {
      forkActionRequests.push(payload.args.request);
      return { ok: false, error: { code: 'fixture/fork', message: '隔离分支请求已记录' } };
    }
    if (endpoint === 'fileReferences/list') return { ok: true, value: [{ path: 'menu file.txt', kind: 'file' }] };
    if (endpoint === 'sessionReferenceResolver/candidates') return { ok: true, value: [{ sessionId: 'two', displayTitle: '菜单聊天', mention: '@dsh-session:two' }] };
    if (endpoint === 'session/create' && createProbe) {
      createProbe.calls += 1;
      return new Promise(resolve => { createProbe.finish = () => resolve({ ok: false, error: { code: 'fixture/create', message: '测试创建失败' } }); });
    }
    if (endpoint === 'session/list' && listRefreshGate) await listRefreshGate;
    if (endpoint === 'subagents/prompt') {
      sidebarPrompts.push(payload.args.request);
      return { ok: true, value: { messageId: `sidebar-${sidebarPrompts.length}` } };
    }
    if (documentMode && endpoint === 'workspaceFiles/read') {
      documentReads.push(payload.args.path);
      return { ok: true, value: { absolutePath: payload.args.path, version: 'current-v3', bytes: 20,
        text: fileLayoutText ?? `CURRENT ${payload.args.path}`, offset: 1, lines: fileLayoutText?.split('\n').length ?? 1, eof: true } };
    }
    if (fileListMode && endpoint === 'workspaceFiles/list') return { ok: true, value: { path: '.', absolutePath: payload.args.path,
      entries: payload.args.path.endsWith('/folder') ? [{ name: 'nested.txt', type: 'file' }]
        : [{ name: 'folder', type: 'directory' }, ...Array.from({ length: 90 }, (_, index) => ({ name: `approval-${String(index).padStart(3, '0')}.txt`, type: 'file' }))], truncated: false } };
    if (endpoint === 'session/page' && historyTesting && payload.args.request.address.sessionId === 'one') {
      historyRequests.push(payload.args.request);
      return new Promise(resolve => { historyReply = resolve; });
    }
    if (endpoint === 'sessionFeedback/record') {
      feedbackWrites.push({ endpoint, request: payload.args.request });
      return { ok: true, value: { ok: true, value: { recorded: true } } };
    }
    if (endpoint.startsWith('messageFeedback/')) {
      const request = payload.args.request, key = `${request.sessionId}:${request.messageId}`;
      if (endpoint === 'messageFeedback/list') { feedbackReads.push(request.sessionId); return { ok: true, value: { ok: true, value: {
        items: [...feedbackItems].filter(([key]) => key.startsWith(`${request.sessionId}:`)).map(([, item]) => item),
      } } }; }
      feedbackWrites.push({ endpoint, request });
      if (feedbackConflict) { feedbackConflict = false; return { ok: true, value: { ok: false, error: { code: 'version-conflict', current: feedbackItems.get(key) ?? null } } }; }
      if (endpoint === 'messageFeedback/delete') { feedbackItems.delete(key); return { ok: true, value: { ok: true, value: { absent: true } } }; }
      const item = { messageId: request.messageId, rating: request.rating, note: request.note, category: request.category,
        version: crypto.randomUUID(), createdAt: 1, updatedAt: 2 };
      feedbackItems.set(key, item);
      return { ok: true, value: { ok: true, value: item } };
    }
    if (['workspace/rename', 'workspace/delete', 'workspace/insertBefore'].includes(endpoint)) {
      const request = payload.args.request; workspaceWrites.push({ endpoint, request });
      const item = workspaceViews.find(item => item.workspaceId === request.workspaceId);
      if (!item) return { ok: false, error: { code: 'workspace/not-found', message: 'missing' } };
      if (endpoint === 'workspace/rename') {
        if (workspaceViews.some(other => other.workspaceId !== item.workspaceId && other.title === request.title)) return { ok: false, error: { code: 'workspace/name-conflict', message: 'conflict' } };
        const updated = { ...item, title: request.title, updatedAt: new Date().toISOString() };
        workspaceViews = workspaceViews.map(row => row.workspaceId === item.workspaceId ? updated : row);
        return { ok: true, value: { workspace: updated } };
      }
      workspaceViews = workspaceViews.filter(row => row !== item);
      if (endpoint === 'workspace/delete') return { ok: true, value: { deleted: true } };
      const index = workspaceViews.findIndex(row => row.workspaceId === request.beforeWorkspaceId);
      workspaceViews.splice(index < 0 ? workspaceViews.length : index, 0, item);
      return { ok: true, value: { workspaceIds: workspaceViews.map(row => row.workspaceId) } };
    }
    if (endpoint === 'session/search') return new Promise(resolve => searchRequests.push({ query: payload.args.query, resolve }));
    if (endpoint === '$events/result') { eventResults.push(payload.args); return { ok: true, value: { accepted: true } }; }
    if (endpoint === 'goals/get') return goalFailure ? { ok: false, error: { code: 'fixture/goal', message: '目标暂时不可用' } } : { ok: true, value: goalValue };
    if (endpoint.startsWith('goals/')) {
      if (endpoint !== 'goals/create' && payload.args.ref.revision !== goalValue?.revision) return { ok: false, error: { code: 'GOAL_STALE_REF', message: '目标已更新' } };
      if (endpoint === 'goals/create') goalValue = { id: 'fixture-goal', revision: 1, objective: payload.args.request.objective,
        phase: 'active', activation: 'armed', maxGoalRounds: payload.args.request.maxGoalRounds ?? 5, roundsStarted: 0, createdAt: 1, updatedAt: 1 };
      else if (endpoint === 'goals/clear') { const ref = { id: goalValue.id, revision: goalValue.revision + 1 }; goalValue = undefined; return { ok: true, value: ref }; }
      else { goalValue = { ...goalValue, ...payload.args.request, revision: goalValue.revision + 1 };
        if (endpoint === 'goals/pause') Object.assign(goalValue, { phase: 'paused', activation: 'disarmed' });
        if (endpoint === 'goals/resume') Object.assign(goalValue, { phase: 'active', activation: 'armed' });
        if (endpoint === 'goals/complete') Object.assign(goalValue, { phase: 'complete', activation: 'disarmed' });
      }
      return { ok: true, value: endpoint === 'goals/create' ? { ref: { id: goalValue.id, revision: 1 } } : goalValue };
    }
    if (endpoint === 'subagents/list') return { ok: true, value: { parentAvailable: true, entries: payload.args.parentSessionId === 'one' ? [
      { kind: 'child', id: 'child-once', mode: 'one-shot', label: '资料检查', activity: 'inactive', hasChildren: false },
      { kind: 'child', id: 'child-chat', mode: 'continuable', label: '分析助手', activity: 'inactive', hasChildren: lineageTesting },
      { kind: 'diagnostic', id: 'child-broken', reason: 'unavailable' },
    ] : lineageTesting && payload.args.parentSessionId === 'child-chat' ? [
      { kind: 'child', id: 'grandchild', mode: 'one-shot', label: '孙会话', activity: 'inactive', hasChildren: false },
    ] : [] } };
    if (endpoint === 'session/list') return { ok: true, value: { items: ['one', 'two', 'agent-blank', ...(workspaceDraftTest ? ['draft-from', 'draft-to'] : []), ...(feedbackSyncSession ? ['feedback-sync'] : [])].map(sessionId => ({ sessionId, ...(sessionId.startsWith('draft-') ? { cwd: `/fixture/${sessionId}` } : fileListMode ? { cwd: fileListRoot } : {}), updatedAt: 10, running: false, blank: sessionId === 'agent-blank' || sessionId.startsWith('draft-'), projections: { kind: 'sequenced', asOfSeq: -1, values: { title: sessionId } } })) } };
    if (endpoint === 'agentPresets/list') return presetFailure ? { ok: false, error: { code: 'fixture/presets', message: '模式暂时不可用' } }
      : { ok: true, value: { modeSelectionEnabled: true, authorable: false, presets: ['standard', 'minimal'].map(id => ({ id, trust: 'system', isDefault: id === 'standard' })) } };
    if (endpoint === 'agentPresets/select') {
      presetWrites++;
      if (presetGate) await presetGate.promise;
      channels.get('session/control')({ type: 'projection', sessionId: payload.args.agentId, key: 'agentPreset', seq: 200 + presetWrites, value: payload.args.agentPreset });
      return { ok: true, value: payload.args.agentPreset };
    }
    if (endpoint === 'skills/list') return skillsFailure ? { ok: false, error: { code: 'fixture/skills', message: '技能暂时不可用' } }
      : { ok: true, value: { skills: [{ name: 'review-test', description: '检查当前改动', modelInvocable: false }, { name: 'permission', description: '与命令同名', modelInvocable: true }] } };
    if (endpoint === 'commands/list') return { ok: true, value: [{ name: 'permission', description: '权限' }, { name: 'plan', definitionId: '@deepseek-ai/dsh-plan-mode' }, { name: 'feedback', description: '反馈' }] };
    if (endpoint === 'permissionPresets/catalog') return permissionFailure ? { ok: false, error: { code: 'fixture/permissions', message: '权限目录暂时不可用' } }
      : { ok: true, value: { options: ['read-only', 'workspace-write', 'danger-full-access', 'auto'].map(value => ({ value, name: value })) } };
    if (endpoint === 'commands/execute') {
      if (['/plan', '/plan off'].includes(payload.args.line)) {
        planWrites.push(payload.args);
        channels.get('session/control')({ type: 'projection', sessionId: payload.args.agentId, key: 'plan', seq: ++planSeq, value: { active: payload.args.line === '/plan', pending: false } });
        return { ok: true, value: { commandId: `fixture-plan-${planSeq}`, result: { kind: 'success' } } };
      }
      permissionWrites++;
      const { agentId, line } = payload.args;
      channels.get('session/control')({ type: 'projection', sessionId: agentId, key: 'permissions', seq: 100 + permissionWrites, value: { currentValue: line.slice('/permission '.length) } });
      return { ok: true, value: { commandId: `fixture-permission-${permissionWrites}`, result: { kind: 'success' } } };
    }
    if (endpoint === 'session/modelCatalog') return catalogFailure
      ? { ok: false, error: { code: 'fixture/catalog', message: '目录暂时不可用' } }
      : { ok: true, value: { default: { provider: 'fixture', model: 'fixture' }, routableProviders: ['fixture'], failures: [],
        groups: [{ id: 'fixture', name: '测试目录', models: [{ id: 'fixture', name: '测试模型' }] }] } };
    throw new Error(`Unexpected fixture write: ${endpoint}`);
  },
  async *stream(_channel, endpoint, payload, signal) {
    const frames = []; let wake;
    const key = endpoint === 'session/follow' ? payload.args.request.address.sessionId ?? payload.args.request.address.childSessionId : endpoint;
    channels.set(key, frame => { frames.push(frame); wake?.(); });
    if (endpoint === 'workspaceFiles/changes') yield { kind: 'ready' };
    if (endpoint === 'workspace/follow') yield { type: 'baseline', value: { items: [], archivedSessionIds: [] } };
    if (endpoint === 'session/control') yield { type: 'baseline', value: { jobs: {}, projections: {} } };
    if (endpoint === '$events') yield { type: 'ready', clientId: 'fixture', host: { home: '/fixture' } };
    if (endpoint === 'session/follow') yield { type: 'snapshot', header: { version: 1, id: key, createdAt: 0, isSeeded: false }, cursor: historyTesting && key === 'one' ? 10 : -1,
      records: historyTesting && key === 'one' ? [{ type: 'event', event: { type: 'turn/start', seq: 10, time: 1, data: { turn: 1 } } }] : [], hasMore: historyTesting && key === 'one',
      projections: { asOfSeq: -1, values: { agentPreset: 'standard' } }, assistantStream: { revision: 0 } };
    const abort = () => wake?.(); signal.addEventListener('abort', abort);
    try { while (!signal.aborted) { if (frames.length) yield frames.shift(); else await new Promise(resolve => { wake = resolve; }); } }
    finally { signal.removeEventListener('abort', abort); channels.delete(key); }
  },
};
const moduleId = '@deepseek-ai/dsh-client-modules';
function graph(revision) {
  const ids = [moduleId, '@deepseek-ai/dsh-client-ui-layout', '@fixture/stable', ...(revision === 'removed' ? [] : ['@fixture/partial'])];
  const version = id => id === '@fixture/partial' ? revision : 'v1';
  return { rev: revision, entries: ids.map(id => ({ id, rev: version(id), url: `/plugins/??${id}/client.js&rev=${version(id)}` })),
    batches: ids.map(id => ({ phase: id === moduleId ? 'bootstrap' : 'application', rev: version(id), url: `/plugins/??${id}/client.js&rev=${version(id)}`, entries: [id] })) };
}
let graphSubscriber, rejectGraph, endGraph, lateGraph, graphRevision = 'v1', graphSubscriptions = 0;
const client = { subscribe() { return () => {}; }, request(operation, onEvent, onEnd) {
  if (transferProbe && operation.method === 'remote.attachment') {
    transfers.push(operation);
    const data = btoa(`ORIGINAL ${operation.attachmentId}`);
    return { id: `attachment-${operation.attachmentId}`, cancel() {}, promise: Promise.resolve().then(() => {
      onEvent({ type: 'metadata', attachment: { attachmentId: operation.attachmentId, name: operation.name, bytes: atob(data).length } });
      onEvent({ type: 'chunk', offset: 0, data });
      if (attachmentFailure) throw new Error('remote_attachment_not_referenced');
    }) };
  }
  if (documentMode && operation.method === 'remote.desktop') return { promise: Promise.resolve({ name: '测试电脑', fileManager: 'explorer', available: true }), cancel() {} };
  if (documentMode && operation.method === 'remote.openFile') {
    deliveryOpens.push(operation);
    return { promise: Promise.resolve({ opened: true }), cancel() {} };
  }
  if (documentMode && operation.method === 'remote.changes') {
    reviewCalls.push(operation);
    if (deliverySummaryFailure && operation.index === undefined) { deliverySummaryFailure = false; return { promise: Promise.reject(new Error('temporary')), cancel() {} }; }
    if (reviewFailure && operation.index === 1) { reviewFailure = false; return { promise: Promise.reject(new Error('temporary')), cancel() {} }; }
    const value = operation.index === undefined
      ? { turn: 2, total: 2, added: 2, deleted: 2, files: ['a', 'b'].map(name => ({ path: `${name}.dshmdoc`, display: `${name}.dshmdoc`, added: 1, deleted: 1 })) }
      : { kind: 'text', path: `${operation.index === 0 ? 'a' : 'b'}.dshmdoc`, display: 'test', before: true, after: true, coarse: false,
        hunks: [{ oldStart: 1, oldLines: 1, newStart: 1, newLines: 1, lines: ['-TURN BEFORE', '+TURN AFTER'] }] };
    const promise = Promise.resolve().then(() => {
      onEvent({ type: 'metadata', sessionId: operation.sessionId, seq: operation.seq, ...(operation.index === undefined ? {} : { index: operation.index }) });
      onEvent({ type: 'chunk', offset: 0, data: btoa(JSON.stringify(value)) });
    });
    return { id: 'review-test', promise, cancel() {} };
  }
  if (operation.method === 'remote.commandOutput') {
    commandOutputRequests.push(operation);
    return { promise: Promise.resolve({ outputId: operation.outputId, state: 'available', status: 'completed',
      data: '', startOffset: operation.fromByte, nextOffset: operation.fromByte, totalBytes: operation.fromByte, lossy: false }), cancel() {} };
  }
  if (operation.method === 'remote.feedbackFollow') {
    const state = { revision: 0, onEvent }, complete = Promise.withResolvers();
    if (feedbackWatchers.has(operation.sessionId)) throw new Error('Duplicate feedback subscription');
    feedbackWatchers.set(operation.sessionId, state);
    queueMicrotask(() => { if (feedbackWatchers.get(operation.sessionId) === state) onEvent({ type: 'ready', revision: 0 }); });
    return { promise: complete.promise, cancel() {
      if (feedbackWatchers.get(operation.sessionId) === state) feedbackWatchers.delete(operation.sessionId);
      complete.resolve();
    } };
  }
  if (operation.method === 'remote.endpointRead') return { promise: Promise.resolve(endpointView()), cancel() {} };
  if (operation.method === 'remote.endpointWrite') {
    endpointWrites.push(operation); endpointRevision++; endpointOverridden = operation.change.op === 'set';
    endpointValue = endpointOverridden ? operation.change.value : 'https://api.deepseek.com/anthropic';
    return { promise: Promise.resolve(endpointView()), cancel() {} };
  }
  if (operation.method === 'remote.keyRead') {
    const value = { snapshot: crypto.randomUUID(), provider: 'deepseek-official', configured: keyConfigured, writable: true };
    return { promise: heldKeyRead ? heldKeyRead.promise.then(() => value) : Promise.resolve(value), cancel() {} };
  }
  if (operation.method === 'remote.modelReadiness') return { promise: Promise.resolve({ kind: readiness }), cancel() {} };
  if (operation.method === 'remote.providerCardRead') return { promise: (heldProviderCardRead?.promise ?? Promise.resolve()).then(() => ({ provider: {
    provider: operation.provider, displayName: 'DeepSeek', settingsNs: 'llm-deepseek', settingsPath: [], active: true,
  }, configured: true, keyConfigured })), cancel() {} };
  if (operation.method === 'remote.deepSeekModelsRead') {
    modelListReads++;
    const value = { provider: 'deepseek', snapshot: crypto.randomUUID(), revision: modelListReads,
      writable: true, overridden: false, applies: 'live', compatEditable: false,
      rows: [{ source: crypto.randomUUID(), id: 'deepseek-chat', name: modelListName }] };
    return { promise: heldModelListRead ? heldModelListRead.promise.then(() => value) : Promise.resolve(value), cancel() {} };
  }
  if (operation.method === 'remote.settingsRead' || operation.method === 'remote.settingsWrite') {
    settingsRequests.push(operation);
    if (operation.method === 'remote.settingsRead' && settingsReadFailure) {
      settingsReadFailure = false;
      return { promise: Promise.reject(new Error('remote_settings_unavailable')), cancel() {} };
    }
    if (operation.method === 'remote.settingsWrite') {
      if (settingsConflict) { settingsConflict = false; return { promise: Promise.reject(new Error('remote_settings_stale')), cancel() {} }; }
      for (const edit of operation.edits) if (edit.key === 'maxTokens') settingsLimit = edit.op === 'set' ? edit.value : 1024;
      settingsRevision++;
    }
    const value = settingsView();
    return { promise: operation.method === 'remote.settingsRead' && heldSettingsRead ? heldSettingsRead.promise.then(() => value) : Promise.resolve(value), cancel() {} };
  }
  if (operation.method === 'remote.providerSettingsList') {
    providerListReads++;
    const result = { providers: structuredClone(providerRows) }, failed = providerListFailure;
    const promise = (providerListHold?.promise ?? Promise.resolve()).then(() => {
      if (failed) throw Error('remote_settings_unavailable');
      return result;
    });
    return { promise, cancel() {} };
  }
  if (operation.method === 'remote.providerCreationRead' || operation.method === 'remote.providerCreationWrite') {
    if (operation.method.endsWith('Write')) providerCreationWrites.push(structuredClone(operation));
    return { promise: Promise.resolve({
    snapshot: crypto.randomUUID(), revision: 1, writable: true, applies: 'live', keyAvailable: false,
    protocols: ['openai-completions'], taken: providerRows.map(row => row.provider), available: [],
    ...(operation.method.endsWith('Write') ? { created: { provider: operation.provider, useKey: operation.useKey } } : {}),
  }), cancel() {} }; }
  if (operation.method === 'remote.providerSettingsRead') return { promise: providerSettingsReadFailure ? Promise.reject(Error('remote_settings_unavailable')) : Promise.resolve({
    provider: operation.provider, snapshot: crypto.randomUUID(), revision: 1, writable: true, applies: 'live',
    fields: ['displayName', 'defaultContextWindow', 'defaultMaxTokens', 'streamIdleTimeoutMs', 'timeoutMs', 'cacheRetention', 'transport']
      .map(key => ({ key, ...(key === 'displayName' ? { value: providerRows.find(row => row.provider === operation.provider)?.name ?? 'Provider' } : {}), overridden: key === 'displayName' })),
  }), cancel() {} };
  if (operation.method === 'remote.jobStop') { jobStopWrites++; return { promise: Promise.resolve({ status: 'requested' }) }; }
  if (operation.method === 'remote.graph') return { promise: Promise.resolve(graph('v1')), cancel() {} };
  if (operation.method === 'remote.graphFollow') {
    graphSubscriptions++;
    endGraph = onEnd;
    graphSubscriber = onEvent; let finish;
    queueMicrotask(() => { if (graphSubscriber === onEvent) onEvent(graph(graphRevision)); });
    return { promise: new Promise((resolve, reject) => { finish = resolve; rejectGraph = reject; }), cancel: () => { if (graphSubscriber === onEvent) graphSubscriber = null; finish(); } };
  }
  throw new Error(`Unexpected fixture operation: ${operation.method}`);
}, async call(op, data) {
  if (op === 'appearance.settings') { appearanceNavigationCalls.push({ op, data }); return {}; }
  if (op === 'notifications.context') { readingContexts.push(data.sessionId); return {}; }
  if (op === 'notifications.status') return { status: 'listening' };
  if (transferProbe && op.startsWith('file.')) {
    transfers.push({ op, data });
    if (op === 'file.save' && transferFailure) throw new Error(transferFailure);
    if (op === 'file.begin') return { downloadId: `download-${++transferNext}` };
    const result = op === 'file.chunk' ? { bytes: data.offset + atob(data.data).length }
      : op === 'file.share' ? { opened: true } : op === 'file.save' ? { saved: true } : {};
    if (op === transferHold) return new Promise(resolve => { transferRelease = () => resolve(result); });
    return result;
  }
  if (documentMode && op === 'socket.send') return;
  if (op === 'computerKey.configure') { keyNativeCalls.push({ op, data }); if (heldKeyNative) await heldKeyNative.promise; return { cancelled: true }; }
  if (op === 'computerKey.cancel') return {};
  throw new Error('Unexpected native fixture call');
} };
const bundles = new RemoteTransport({ subscribe: () => () => {} }); bundles.capabilities = {};
transport.loadBundle = (...args) => bundles.loadBundle(...args);
const coldDraft = new URLSearchParams(location.search).has('cold-draft');
const coldStore = coldDraft ? await RemoteDraftStore.open(draftBinding, indexedDB, null) : undefined;
const coldWrites = [];
if (coldStore) {
  if (!sessionStorage.getItem('cold-draft-seeded')) {
    await coldStore.write('one', 'DSHM_COLD_DRAFT');
    sessionStorage.setItem('cold-draft-seeded', '1');
  }
  const write = coldStore.write.bind(coldStore);
  coldStore.write = (...args) => { coldWrites.push({ id: args[0], text: args[1] }); return write(...args); };
}
// 正式页面会提供本地存储；地址写入的核对日志也依赖它。普通回放每次重置自己的
// 隔离数据库，冷启动专项仍保留原绑定，不能绕过生产写入前的持久化保护。
const viewStore = coldStore ?? await RemoteDraftStore.open({ ...draftBinding, deviceId: 'ui-replay' }, indexedDB, null);
if (!coldDraft) await viewStore.clear();
const model = new RemoteModel(client, { transport, loadRemotes: loadTestRemotes, draftStore: viewStore });
export { model };
await model.start();
if (documentMode) {
  transport.capabilities.endpoints.calls.push('workspaceFiles/read');
  transport.capabilities.channels = ['changes'];
  transport.capabilities.desktopOpen = true;
  transport.capabilities.desktopReveal = true;
  // 新版目录观察与 list 一样接收 scope/path；旧生成夹具缺少 changes 的 path 参数。
  const filesRemote = fileListMode ? { ...workspaceFilesRemote, descriptors: workspaceFilesRemote.descriptors.map(item => item.method === 'changes'
    ? { ...item, parameters: workspaceFilesRemote.descriptors.find(entry => entry.method === 'list').parameters } : item) } : workspaceFilesRemote;
  await model.ctx.remote.$mount(filesRemote);
}
model.pluginSlots = installRemotePluginSlots(model);
await model.pluginSlots.ready;
await model.ctx.plugin(originalInputTriggers).await();
let plugin;
let nodePlugin;
let builtinNodePlugin;
let toolsPlugin;
let wideToolPlugin;
let toolFixtureCursor = 0;
let lineFileText = Array.from({ length: 100 }, (_, index) => `source line ${index + 1}`).join('\r\n');
async function enableBuiltinNode() {
  builtinNodePlugin = model.ctx.plugin({ name: 'test-builtin-node', inject: ['slots'], apply(ctx) {
    const files = model.files;
    model.files = { ...files, text: async () => lineFileText };
    ctx.effect(() => () => { model.files = files; });
    ctx.slots.inject('conversation.chat.node', () => ctx.slots.register({ name: 'conversation.chat.node', key: 'assistant-step', locale: 'conversation' }, props => {
      const { node, useChatNode, renderMessageImages, t } = props;
      const current = useChatNode(node.key);
      const callbacks = ['openSkill', 'openFile', 'inspectCall', 'forkAt', 'loadImage', 'renderMessageImages', 'fileMentions'];
      return <section data-testid="builtin-node" data-inspect-label={t('row.inspect')} data-matching={String(current === node)} data-contract={String(callbacks.every(key => typeof props[key] === 'function'))}>
        <p>Plugin reply: {current.data.blocks.filter(block => block.kind === 'text').map(block => block.text).join('')}</p>
        {renderMessageImages({ images: [], align: 'start' })}
        <button onClick={() => props.openFile('fixture.txt', { line: 80 })}>Plugin file line</button>
        <button onClick={() => props.openFile('fixture.txt', { line: 900 })}>Missing file line</button>
        <button onClick={() => props.openFile('fixture.html', { line: 80 })}>HTML source line</button>
        <button onClick={() => props.openFile('fixture.svg', { line: 80 })}>SVG source line</button>
        <OrdinaryMarkdown text="[Markdown file line](fixture.md#L80)" onOpenFile={props.openFile}/>
      </section>;
    }));
  } });
  await builtinNodePlugin.await();
}
model.ctx.uiConversation.events.register({ kind: 'test-note', target: 'chat',
  match: event => event.type === 'test/note' ? { id: String(event.seq), role: 'start' } : null,
  start: (_context, match) => ({ text: match.event.data.text, seq: match.event.seq }),
  update: context => context.state,
  buildViewNode: context => context.state ? chatNode(context, 'test-note', context.state.seq, context.state) : null,
});
async function enableNode() {
  nodePlugin = model.ctx.plugin({ name: 'test-node-plugin', inject: ['uiConversation', 'slots', 'locale'], apply(ctx) {
    ctx.effect(() => ctx.locale.register('test.node', { zh: { title: '扩展记录' }, en: { title: 'Extension note' } }));
    ctx.slots.inject('conversation.chat.node', () => ctx.slots.register({ name: 'conversation.chat.node', key: 'test-note', locale: 'test.node' }, ({ node, sessionId, useChatNode, useTurnData, t }) => {
      const current = useChatNode(node.key);
      const absent = useTurnData('test.absent');
      return <output data-testid="plugin-node" data-session={sessionId} data-matching={String(current === node)} data-turn-data={String(absent)}>{t('title')}: {current.data.text}</output>;
    }));
  } });
  await nodePlugin.await();
}
async function enable() {
  plugin = model.ctx.plugin({ name: 'test-local-partial-plugin', inject: ['slots'], apply(ctx) {
    ctx.slots.inject('conversation.chat.turnTail', () => ctx.slots.register({ name: 'conversation.chat.turnTail', id: 'test-tail' }, ({ sessionId, useSession, useChat, useSessionStatus, turn, seq }) => {
      const cursor = useSession(value => value.cursor);
      const count = useChat(value => value.order.length);
      const running = useSessionStatus(value => value.get(sessionId)?.running);
      return <output data-testid="plugin-tail" data-session={sessionId} data-seq={seq} data-cursor={cursor} data-count={count} data-running={String(running)}>{sessionId}:{turn.turn}</output>;
    }));
    ctx.slots.inject('conversation.chat.assistant-actions', () => ctx.slots.register({ name: 'conversation.chat.assistant-actions', id: 'test-action' }, ({ messageId, sessionId }) => <button data-testid="plugin-action">{sessionId}:{messageId}</button>));
  } });
  await plugin.await();
}
const root = createRoot(document.getElementById('app'));
root.render(<><main className="remote-app" hidden data-testid="fixture-connect-page"/><RemotePluginScope model={model}><RemoteWorkspace model={model} onBack={() => {}} onConnection={() => {}}/></RemotePluginScope></>);
function emitTurn(id, turn, start, text = `Reply ${id} ${turn}`) {
  const emit = (offset, type, data, extra = {}) => channels.get(id)({ type: 'event', event: { seq: start + offset, time: (start + offset) * 10, type, data, ...extra } });
  emit(0, 'turn/start', { turn }); emit(1, 'step/start', { turn, step: 1 });
  emit(2, 'assistant/message', { turn, step: 1, stream: [], message: { id: `${id}-${turn}`, role: 'assistant', content: [{ type: 'text', text }], source: { kind: 'model', provider: 'fixture', model: 'fixture' } } }, { surfaceOp: 'append' });
  emit(3, 'step/end', { turn, step: 1 }); emit(4, 'turn/end', { turn, reason: { kind: 'completed' } });
}
const exportCapabilities = transport.capabilities;
let removeCordisPanel;
let cordisCards;
let managementCapabilities;
let releasePanelSelection, pendingPanelSelection, panelSelectionNotices;
window.fixture = { setupDesktopApps: () => { window.fixture.desktopApps = desktopAppsReplay(model); }, ...factoryChecks(model), ...navigationChecks(model), ...composerChecks(model), checkRemoteInput, checkViewInputs: () => checkViewInputs(model), sidebarState: () => ({ selected: model.snapshot.selected, drafts: model.snapshot.drafts, prompts: sidebarPrompts }), inputDraft: () => model.getSnapshot().drafts[model.getSnapshot().selected], enable, disable: () => plugin.dispose(), select: id => model.select(id), emitTurn,
  appearanceNavigationCalls: () => appearanceNavigationCalls,
  emitBlocked: (id, turn, seq) => {
    channels.get(id)({ type: 'event', event: { type: 'turn/start', seq, time: seq + 1, data: { turn } } });
    channels.get(id)({ type: 'event', event: { type: 'turn/end', seq: seq + 1, time: seq + 2, data: { turn, reason: { kind: 'blocked' } } } });
  },
  beginPendingPanelSelection: async id => {
    await model.select(null);
    const retain = model.sessions.retain, gate = new Promise(resolve => { releasePanelSelection = resolve; });
    model.sessions.retain = (...args) => {
      const reference = retain.apply(model.sessions, args);
      const ready = reference.ready.then(async binding => { await gate; return binding; });
      return new Proxy(reference, { get: (target, key) => key === 'ready' ? ready : Reflect.get(target, key, target) });
    };
    // 只暂缓真实引用的就绪，不替换绑定、原会话状态或面板控制器。
    pendingPanelSelection = model.select(id);
    model.sessions.retain = retain;
    panelSelectionNotices = model.snapshot.cordisApprovals;
    model.publish({ cordisApprovals: [{ agentId: id }] });
  },
  releasePendingPanelSelection: async () => { releasePanelSelection(); await pendingPanelSelection; model.publish({ cordisApprovals: panelSelectionNotices }); },
  enableRenderProbe: async () => { window.fixture.renderProbe = await renderFailureProbe(model); },
  coldDraftState: () => ({ saved: coldStore?.read('one'), drafts: model.snapshot.drafts, writes: coldWrites }),
  enableCordisPanel: async () => { removeCordisPanel = await enableCordisPanel(model); },
  enableCordisCards: async () => { cordisCards = await enableCordisCards(model, frame => channels.get('two')(frame)); },
  cordisCardState: state => cordisCards.state(state),
  cordisCardHistory: mode => cordisCards.history(mode),
  removeCordisCards: () => cordisCards.dispose(),
  removeCordisPanel: () => removeCordisPanel(),
  requestCordisApproval: () => removeCordisPanel.request(),
  coldDraftStored: async () => {
    const stored = await RemoteDraftStore.open(draftBinding, indexedDB, null);
    try { return stored.read('one'); } finally { stored.close(); }
  },
  enableInteractionDetails: async () => {
    if (!model.ctx.get('resources')) await model.ctx.plugin({ ...originalResources, name: 'fixture-interaction-resources' }).await();
    const details = model.ctx.plugin({ name: '@fixture/approval-detail', inject: ['slots'], apply(ctx) {
      ctx.slots.inject('conversation.approval.detail', () => ctx.slots.register({ name: 'conversation.approval.detail' },
        ({ sessionId, callId }) => <p data-testid="approval-detail">{sessionId}:{callId}</p>));
    } });
    const plan = model.ctx.plugin({ ...originalPlan, name: '@deepseek-ai/dsh-client-ui-plan' });
    await Promise.all([details.await(), plan.await()]);
    window.fixture.disableInteractionDetails = async () => { await plan.dispose(); await details.dispose(); };
  },
  openChild: id => model.openChild(id),
  enableLineage: async () => {
    lineageTesting = true;
    const plugin = model.ctx.plugin({ name: '@fixture/lineage', inject: ['slots'], apply(ctx) {
      ctx.slots.inject('conversation.session.header.lineage', () => ctx.slots.register({ name: 'conversation.session.header.lineage' }, ({ sessionId, lineageSessionId, displayTitle, openTitle }) => {
        if (openTitle) window.fixture.staleLineage = openTitle;
        return <button data-testid={`lineage-${lineageSessionId}`} data-session={sessionId} data-ancestor={String(!!openTitle)}
          style={{ width: 420 }} onClick={openTitle}>{displayTitle}</button>;
      }));
    } });
    await plugin.await(); window.fixture.removeLineage = () => plugin.dispose();
  },
  exportConnection: (connectionState, supported = true, retainCapabilities = false) => {
    transport.capabilities = connectionState === 'connected' || retainCapabilities ? { ...exportCapabilities, sessionExport: supported } : undefined;
    model.publish({ connectionState });
  },
  managementConnection: (connectionState, allowed = true) => {
    managementCapabilities ??= transport.capabilities;
    transport.capabilities = connectionState === 'connected' ? { ...managementCapabilities, management: allowed } : undefined;
    model.publish({ connectionState });
  },
  enableSettingsTabs: async () => {
    const plugin = model.ctx.plugin({ name: '@fixture/settings-tabs', inject: ['slots'], apply(ctx) {
      for (const [id, label, order] of [['one', '扩展一', 1], ['two', '扩展二', 2]]) {
        ctx.slots.inject('settings.plugins.tab', () => ctx.slots.register({ name: 'settings.plugins.tab', id, order, label }, ({ sessionId }) => {
          const [count, setCount] = React.useState(0);
          return <div data-testid={`settings-tab-${id}`} data-session={sessionId ?? 'none'} style={{ width: 600 }}>
            <button onClick={() => setCount(n => n + 1)}>计数 {count}</button></div>;
        }));
      }
    } });
    await plugin.await(); window.fixture.removeSettingsTabs = () => plugin.dispose();
  },
  enableSettingsSections: async () => {
    const plugin = model.ctx.plugin({ name: '@fixture/settings-sections', inject: ['slots'], apply(ctx) {
      ctx.slots.inject('settings.section', () => ctx.slots.register({ name: 'settings.section', id: 'fixture-section', order: 2, label: '独立设置页' }, ({ sessionId, close }) => {
        const [value, setValue] = React.useState('');
        window.fixture.closeSettingsSection = close;
        return <div data-testid="settings-section" data-session={sessionId ?? 'none'} style={{ width: 600 }}>
          <input aria-label="插件设置草稿" value={value} onChange={e => setValue(e.target.value)}/>
          <button onClick={close}>完成设置</button>
        </div>;
      }));
    } });
    await plugin.await(); window.fixture.removeSettingsSections = () => plugin.dispose();
  },
  enableSettingsOnboarding: async () => {
    const plugin = model.ctx.plugin({ name: '@fixture/settings-onboarding', inject: ['slots'], apply(ctx) {
      ctx.slots.inject('settings.onboarding', () => {
        // 故意逆序注册，验证显示顺序来自order；首步挂载后自行完成，不显示界面。
        const disposers = ['last', 'first', 'silent'].map((id, index) => ctx.slots.register({
          name: 'settings.onboarding', id: `fixture-${id}`, order: [20, 10, 0][index],
        }, owner => {
          React.useEffect(() => { if (id === 'silent') owner.complete(); }, [owner.complete]);
          window.fixture[`onboarding-${id}`] = owner;
          if (id === 'silent') return null;
          return <section data-testid={`onboarding-${id}`} data-session={owner.sessionId ?? 'none'}>
            <button onClick={owner.complete}>完成 {id}</button>
            <button onClick={() => owner.openSection('fixture-section')}>打开扩展设置 {id}</button>
            <button onClick={() => owner.openSection('models')}>打开模型设置 {id}</button>
          </section>;
        }));
        return () => disposers.forEach(dispose => dispose());
      });
    } });
    await plugin.await(); window.fixture.removeSettingsOnboarding = () => plugin.dispose();
  },
  enableModelOnboarding: async () => {
    keyConfigured = false; readiness = 'credential-missing';
    const plugin = model.ctx.plugin({ name: '@fixture/model-onboarding', inject: ['slots'], apply(ctx) {
      ctx.slots.inject('settings.onboarding', () => ctx.slots.register({ name: 'settings.onboarding', id: 'deepseek-official', order: 0 },
        owner => <MobileModelOnboarding {...owner} model={model}/>));
    } });
    await plugin.await(); window.fixture.removeModelOnboarding = () => plugin.dispose();
  },
  modelReadiness: kind => { readiness = kind; channels.get('$events')({ type: 'emit', event: 'credentials/reference-updated', args: ['TEST_REFERENCE'] }); },
  enableModelFooter: async () => {
    transport.capabilities.providerCards = true;
    const plugin = model.ctx.plugin({ name: '@fixture/model-footer', inject: ['slots'], apply(ctx) {
      ctx.slots.inject('settings.models.provider-card', () => ctx.slots.register({ name: 'settings.models.provider-card', key: 'llm-deepseek' }, ({ sessionId, provider, configured, keyConfigured }) =>
        <div data-testid="model-provider-card" data-session={sessionId ?? 'none'} data-provider={provider.provider}
          data-configured={String(configured)} data-key={String(keyConfigured)}>提供方扩展<input aria-label="提供方扩展草稿" defaultValue=""/></div>));
      ctx.slots.inject('settings.models.footer', () => ctx.slots.register({ name: 'settings.models.footer', id: 'test-footer' }, ({ sessionId }) => {
        const [count, setCount] = React.useState(0);
        return <section data-testid="model-footer" data-session={sessionId ?? 'none'} style={{ width: 600 }}>
          <button onClick={() => setCount(value => value + 1)}>设置扩展 {count}</button>
        </section>;
      }));
    } });
    await plugin.await(); window.fixture.removeModelFooter = () => plugin.dispose();
  },
  enableGlobalPanels: async () => {
    if (!model.ctx.get('resources')) await model.ctx.plugin({ ...originalResources, name: 'fixture-global-panel-resources' }).await();
    const panel = model.ctx.plugin({ name: '@fixture/global-panel', inject: ['slots', 'layout'], apply(ctx) {
      ctx.slots.inject('sidebar.panellist', () => ctx.slots.register({ name: 'sidebar.panellist', id: 'fixture-global', label: '测试插件页面' }, () => <span>P</span>));
      ctx.slots.inject('main', () => ctx.slots.register({ name: 'main', key: 'fixture-global' }, ({ sessionId, usePanelInfo }) => {
        const current = usePanelInfo(value => value.activePanelId), [count, setCount] = React.useState(0);
        return <section data-testid="global-panel-content" data-session={sessionId ?? 'none'} data-current={current}>
          <button onClick={() => setCount(value => value + 1)}>面板计数 {count}</button>
          <button onClick={() => ctx.layout.selectPanel(null)}>插件返回聊天</button>
        </section>;
      }));
    } });
    await panel.await();
    window.fixture.removeGlobalPanels = () => panel.dispose();
    window.fixture.openGlobalPanels = () => model.ctx.layout.toggleSidebar();
    window.fixture.selectGlobalPanel = id => model.ctx.layout.selectPanel(id);
    window.fixture.openSidePanel = () => model.pluginPanels.openTab('guide');
    window.fixture.closeSidePanel = () => { if (model.pluginPanels.isExpanded()) model.pluginPanels.toggleExpanded(); };
    window.fixture.checkPanelNavigation = () => {
      const pending = model.ctx.layout.beginNavigation();
      model.ctx.layout.selectPanel('fixture-global');
      const next = model.ctx.layout.beginNavigation();
      let rejected = false;
      try { model.ctx.layout.selectPanel('not-registered'); } catch { rejected = true; }
      return { previousAborted: pending.aborted, rejected, currentRetained: !next.aborted,
        selected: model.globalPanels.state.getSnapshot().panelInfo.activePanelId };
    };
    window.fixture.checkMainPanelRace = async () => {
      const pending = model.sessionView.beginNavigation();
      model.ctx.layout.selectPanel('fixture-global');
      const cancelled = !pending();
      const signal = model.ctx.layout.beginNavigation();
      await model.select('two');
      return { cancelled, signalAborted: signal.aborted, selected: model.globalPanels.state.getSnapshot().panelInfo.activePanelId };
    };
  },
  enableShellOverlay: async () => {
    const overlay = model.ctx.plugin({ name: '@fixture/shell-overlay', inject: ['slots'], apply(ctx) {
      ctx.slots.inject('shell.overlay', () => ctx.slots.register({ name: 'shell.overlay', id: 'fixture-overlay' }, ({ sessionId }) => {
        const [count, setCount] = React.useState(0);
        return <><button data-testid="shell-overlay-wide" data-session={sessionId ?? 'none'}
          style={{ width: 600, height: 40 }} onClick={() => setCount(value => value + 1)}>Overlay {count}</button>
          <button data-testid="shell-overlay-fixed" style={{ position: 'fixed', top: 100, right: 12 }}
            onClick={() => setCount(value => value + 1)}>Fixed {count}</button></>;
      }));
    } });
    await overlay.await(); window.fixture.removeShellOverlay = () => overlay.dispose();
  },
  enableHeader: async () => {
    const duplicates = [
      ['@deepseek-ai/dsh-client-ui-agent-preset', 'actions', 'agent-preset'],
      ['@deepseek-ai/dsh-session-log-export', 'utilities', 'session-log-download'],
      ['@deepseek-ai/dsh-client-ui-sidebar-terminal', 'actions', '@deepseek-ai/dsh-client-ui-sidebar-terminal'],
    ].map(([name, part, id]) => model.ctx.plugin({ name, inject: ['slots'], apply(ctx) {
      ctx.slots.inject(`conversation.session.header.${part}`, () => ctx.slots.register({ name: `conversation.session.header.${part}`, id }, () => {
        throw new Error('Desktop-only header entry must not mount');
      }));
    } }));
    await Promise.all(duplicates.map(plugin => plugin.await()));
    const header = model.ctx.plugin({ name: '@fixture/header', inject: ['slots'], apply(ctx) {
      for (const [part, order] of [['leading', 0], ['actions', 2], ['utilities', 1], ['corner', 3]]) {
        ctx.slots.inject(`conversation.session.header.${part}`, () => ctx.slots.register({ name: `conversation.session.header.${part}`, id: part, order }, ({ sessionId, useSession }) => {
          const running = useSession(value => value.running);
          const [clicks, setClicks] = React.useState(0);
          return <button data-testid={`header-${part}`} data-session={sessionId} data-running={String(running)}
            style={{ width: part === 'actions' ? 720 : 160 }} onClick={() => setClicks(value => value + 1)}>{part}:{sessionId}:{clicks}</button>;
        }));
      }
    } });
    await header.await(); window.fixture.removeHeader = async () => {
      await header.dispose(); await Promise.all(duplicates.map(plugin => plugin.dispose()));
    };
  },
  documentReads: () => documentReads,
  reviewCalls: () => reviewCalls,
  deliveryOpens: () => deliveryOpens,
  startTransfers: () => {
    transferProbe = true;
    transport.capabilities.channels.push('attachment');
    model.files.read = async function* (sessionId, path) { transfers.push({ method: 'workspace.read', sessionId, path }); yield new TextEncoder().encode('LATEST COMPLETE FILE'); };
  },
  transfers: () => transfers,
  holdTransfer: op => { transferHold = op; },
  failTransfer: value => { transferFailure = value; },
  releaseTransfer: () => { transferRelease?.(); transferRelease = undefined; },
  transferAttachment: id => {
    const legacy = Object.assign(Object.create(model), { documentPreviews: undefined });
    root.render(<RemoteFilePreview model={legacy} file={{ sessionId: 'two', path: 'same.txt', attachment: { kind: 'file', attachmentId: id, name: 'same.txt' } }} onClose={() => root.render(null)}/>);
  },
  attachmentFailure: value => { attachmentFailure = value; },
  htmlReadFailure: () => {
    const original = model.documentSources.readBytes, reads = [];
    let hold = false, rejectHeld;
    model.documentSources = { ...model.documentSources, readBytes: (address, signal) => {
      if (!address.endsWith('/read-failure.html')) return original(address, signal);
      reads.push(signal);
      if (hold) { hold = false; return new Promise((_resolve, reject) => { rejectHeld = reject; }); }
      return Promise.reject(new Error('remote_file_changed'));
    } };
    window.fixture.htmlReadCount = () => reads.length;
    window.fixture.htmlReadSignals = () => reads.map(signal => signal.aborted);
    window.fixture.htmlHoldNextRead = () => { hold = true; };
    window.fixture.htmlRejectHeldRead = () => rejectHeld(new Error('workspace-file/not-found'));
    model.pluginPanels.openResource('dsh-resource://file/session/two/read-failure.html');
  },
  htmlLegacyFailure: () => {
    let reads = 0;
    const legacy = Object.assign(Object.create(model), { documentPreviews: undefined, files: {
      async document() { reads++; return { absolutePath: '/fixture/page.html', version: 'fixture-v1',
        data: new TextEncoder().encode('<html><body><script src="./missing.js"></script></body></html>') }; },
      async bytes() { throw new Error('workspace-file/not-found'); },
    } });
    window.fixture.htmlLegacyReads = () => reads;
    root.render(<RemoteFilePreview model={legacy} file={{ sessionId: 'two', path: 'page.html' }} onClose={() => root.render(null)}/>);
  },
  attachmentPreview: id => {
    function Request() {
      const [open, setOpen] = React.useState(true);
      return open && <RemoteFilePreview model={model} file={{ sessionId: 'two', path: 'same.txt', attachment: { kind: 'file', attachmentId: id, name: 'same.txt' } }} onClose={() => setOpen(false)}/>;
    }
    root.render(<RemotePluginScope model={model}><RemoteWorkspace model={model} onBack={() => {}} onConnection={() => {}}/><Request key={id}/></RemotePluginScope>);
  },
  attachmentRenderers: async (wide = false) => {
    const plugin = model.ctx.plugin({ name: '@fixture/attachment-renderer', inject: ['slots', 'documentPreviews', 'dshmDocuments'], apply(ctx) {
      for (const mode of ['text-pages', 'bytes-complete', 'renderer']) {
        const id = `@fixture/attachment-${mode}`;
        ctx.effect(() => ctx.documentPreviews.register({ id, extensions: ['txt'], loading: mode, title: () => mode }));
        ctx.slots.inject('sidebar.right.tab.document', () => ctx.slots.register({ name: 'sidebar.right.tab.document', key: id }, function Probe({ content, resourceAddress, useResource, useTabInfo }) {
          const meta = useResource(resourceAddress), { tab } = useTabInfo();
          const [read, setRead] = React.useState(null);
          React.useEffect(() => {
            if (content.kind !== 'renderer') return;
            const controller = new AbortController(), signal = AbortSignal.any([controller.signal, tab.signal]);
            void ctx.dshmDocuments.readBytes(resourceAddress, signal).then(value => {
              if (!signal.aborted) { setRead(value.ok ? new TextDecoder().decode(value.value.data) : value.error.message); if (value.ok) content.loaded(value.value.version); }
            });
            return () => controller.abort();
          }, [content.kind, content.revision, resourceAddress, tab.signal]);
          return <output data-testid="attachment-renderer" style={wide ? { display: 'block', width: 720 } : undefined}>{JSON.stringify({ kind: content.kind, address: resourceAddress, tab: tab.contentId,
            source: meta.value?.source, text: content.kind === 'bytes' ? new TextDecoder().decode(content.data) : content.text ?? read })}</output>;
        }));
      }
    } });
    await plugin.await(); window.fixture.removeAttachmentRenderers = () => plugin.dispose();
  },
  deliveryTurn: () => {
    deliverySummaryFailure = true;
    const emit = (seq, type, data, extra = {}) => channels.get('two')({ type: 'event', event: { seq, time: seq * 10, type, data, ...extra } });
    emit(0, 'turn/start', { turn: 2 }); emit(1, 'step/start', { turn: 2, step: 1 });
    emit(2, 'deliverables/presented', { turn: 2, callId: 'present', files: ['a', 'b', 'c', 'd', 'e'].map(name => ({ path: `${name}.dshmdoc` })) });
    emit(3, 'deliverables/presented', { turn: 2, callId: 'present-again', files: [{ path: 'a.dshmdoc', description: '最新交付描述' }] });
    emit(4, 'assistant/message', { turn: 2, step: 1, stream: [], message: { id: 'delivery-answer', role: 'assistant', content: [{ type: 'text', text: '交付完成 `a.dshmdoc`' }], source: { kind: 'model', provider: 'fixture', model: 'fixture' } } }, { surfaceOp: 'append' });
    emit(5, 'step/end', { turn: 2, step: 1 }); emit(6, 'turn/end', { turn: 2, reason: { kind: 'completed' } });
    emit(7, 'workspace/changes', { turn: 2 });
  },
  documentPreview: async () => {
    await model.ctx.plugin({ ...originalResources, name: 'fixture-document-resources' }).await();
    const documentPlugin = model.ctx.plugin({ name: '@fixture/document-diff', inject: ['resources', 'documentPreviews', 'slots'], apply(ctx) {
      ctx.effect(() => ctx.resources.register({ protocol: 'file', async *open(address) {
        yield { ok: true, value: { absolutePath: address.split('/').at(-1), version: 'current-v3', bytes: 20 } };
      } }));
      ctx.effect(() => ctx.documentPreviews.register({ id: '@fixture/document-diff', extensions: ['dshmdoc'], title: () => '扩展文档', loading: 'text-pages' }));
      ctx.slots.inject('sidebar.right.tab.document', () => ctx.slots.register({ name: 'sidebar.right.tab.document', key: '@fixture/document-diff' }, ({ content }) =>
        <output data-testid="diff-custom-renderer">{content.text}</output>));
    } });
    await documentPlugin.await();
    window.fixture.removeDocumentRenderer = () => documentPlugin.dispose();
    window.fixture.openCurrentDocument = () => model.pluginPanels.openResource('dsh-resource://file/session/two/a.dshmdoc');
    function ToolPreview() {
      const [file, setFile] = React.useState(null);
      const tool = { kind: 'tool-result', name: 'edit', content: [], call: { name: 'edit', argsRaw: JSON.stringify({ file_path: 'a.dshmdoc', old_string: 'BEFORE', new_string: 'AFTER' }) },
        meta: { diffs: ['a', 'b'].map(name => ({ path: `${name}.dshmdoc`, oldText: `BEFORE ${name}`, newText: `AFTER ${name}` })) } };
      return <><RemoteToolResult tool={tool} renderContent={text => text} openChanges={value => setFile({ ...value, sessionId: 'two' })}/>
        <button onClick={() => setFile({ sessionId: 'two', seq: 80, turn: 2 })}>查看整轮改动</button>
        {file && (file.seq !== undefined ? <RemoteChangesPreview file={file} model={model} onClose={() => setFile(null)}/>
          : <RemoteFilePreview file={file} model={model} onClose={() => setFile(null)}/>)}</>;
    }
    root.render(<RemotePluginScope model={model}><RemoteWorkspace model={model} onBack={() => {}} onConnection={() => {}}/><ToolPreview/></RemotePluginScope>);
  },
  fileLayout: async (path, text) => {
    if (!model.ctx.get('resources')) await model.ctx.plugin({ ...originalResources, name: 'fixture-file-layout-resources' }).await();
    if (!window.fixture.fileLayoutResources) {
      await model.ctx.plugin({ name: '@fixture/file-layout', inject: ['resources'], apply(ctx) {
        ctx.effect(() => ctx.resources.register({ protocol: 'file', async *open(address) {
          yield { ok: true, value: { absolutePath: resolveDocumentAddress(address).path, version: 'current-v3', bytes: 1000 } };
        } }));
      } }).await();
      window.fixture.fileLayoutResources = true;
    }
    fileLayoutText = text;
    model.pluginPanels.openResource(sessionFileAddress('two', path));
  },
  fileLayoutFit: value => model.pluginSlots.layout.setUser('@fixture/attachment-renderer', value),
  fileList: async () => {
    await window.fixture.fileLayout('warmup.txt', 'DSHM_FILE_LIST_CONTENT');
    await model.ctx.plugin({ ...originalFiles, name: '@deepseek-ai/dsh-client-ui-sidebar-files' }).await();
    model.pluginPanels.openTab('files');
  },
  fileListReopen: () => model.pluginPanels.openTab('files'),
  fileListReplacement: async () => {
    const replacement = model.ctx.plugin({ name: '@fixture/files-replacement', inject: ['slots'], apply(ctx) {
      ctx.slots.inject('sidebar.right.pane.tab', () => ctx.slots.register({ name: 'sidebar.right.pane.tab', key: '@deepseek-ai/dsh-client-ui-sidebar-files', priority: -100 }, () =>
        <button data-testid="files-replacement" style={{ width: 720, height: 80 }} onClick={event => { event.currentTarget.dataset.clicked = 'yes'; }}>第三方文件面板</button>));
    } });
    await replacement.await();
    window.fixture.fileListReplacementFit = value => model.pluginSlots.layout.setUser('@fixture/files-replacement', value);
    window.fixture.fileListReplacementOff = () => replacement.dispose();
  },
  ...conversationChecks(model, transport),
  holdSelection: () => {
    const original = model.select, gate = Promise.withResolvers();
    model.select = async (...args) => { await original.call(model, ...args); await gate.promise; };
    window.fixture.releaseSelection = () => { model.select = original; gate.resolve(); };
  },
  enableSidebarResources: async () => {
    if (!model.ctx.get('resources')) await model.ctx.plugin({ ...originalResources, name: 'fixture-sidebar-resources' }).await();
  },
  readingContexts: () => readingContexts,
  enableReadingModal: async () => {
    const plugin = model.ctx.plugin({ name: '@fixture/reading-modal', inject: ['slots'], apply(ctx) {
      ctx.slots.register({ name: 'conversation.session.header.actions', id: 'reading-modal' }, function ReadingModal() {
        const [open, setOpen] = React.useState(false);
        return <><button onClick={() => setOpen(true)}>打开阅读验证弹窗</button>
          <Modal open={open} title="阅读验证弹窗" closeLabel="关闭阅读弹窗" onClose={() => setOpen(false)}>
            <input aria-label="阅读验证输入"/>
          </Modal></>;
      });
    } });
    await plugin.await(); window.fixture.removeReadingModal = () => plugin.dispose();
  },
  insertSidebarReference: () => {
    const shell = model.inputBindings.mounted().shell;
    shell.setDraft('@handoff');
    return shell.insertReference({ source: 'fixture', ref: 'handoff-file', label: '旁栏引用', clipboardText: '@handoff', appearance: 'file' },
      { start: 0, end: 8, draftRev: shell.snapshot.draftRev });
  },
  rebuildSidebarPage: () => {
    const saved = captureRemoteResume(model);
    flushSync(() => root.render(null));
    model.panelMemory.restore(saved.panels);
    model.workspaceResume = saved.workspace;
    root.render(<RemotePluginScope model={model}><RemoteWorkspace model={model} onBack={() => {}} onConnection={() => {}}/></RemotePluginScope>);
    return saved.panels.views;
  },
  seedSidebarOutput: () => {
    const view = model.conversationFocus.getSnapshot(), sessionId = view.getSnapshot().selected;
    const target = { id: 'sidebar-output', sessionId, independent: true, startedAt: 1 };
    transport.capabilities.jobOutput = true;
    channels.get('session/control')({ type: 'jobs', sessionId, jobs: [{ ...target, kind: 'pwsh', label: '旁栏输出回放', status: 'running' }] });
    // 明确的只读checkpoint回放；恢复后仍需用户手动请求下一段，不模拟模型执行。
    view.captureJobOutput = () => ({ target, stream: 'stderr', mode: 'history', full: true, reader: {
      generation: transport.capabilities.jobControlGeneration, decoder: new TextDecoder(),
      snapshot: { text: '旁栏已确认输出', offset: 21, total: 42, phase: 'ready', status: 'running', gap: false, trimmed: false },
    } });
  },
  enableInputProbe: async () => {
    inputProbe = model.ctx.plugin({ name: '@fixture/input-probe', inject: ['slots'], apply(ctx) {
      ctx.slots.register({ name: 'conversation.input.overlay', id: 'input-probe' }, ({ useInput, inputActions, sessionId }) => {
        const input = useInput(state => state);
        if (!inputHandles.some(item => item.actions === inputActions)) inputHandles.push({ id: sessionId, actions: inputActions });
        return <div data-testid="input-probe" style={{ position: 'absolute', bottom: '100%', background: 'white' }}>
          <output data-testid="probe-draft">{input.draft}</output>
          <output data-testid="probe-attachments">{input.attachmentIds.join(',')}</output>
          <button onClick={() => inputActions.setDraft(`${input.draft} plugin`)}>插件修改草稿</button>
          <button onClick={() => inputActions.removeAttachment(input.attachmentIds[0])}>插件移除附件</button>
        </div>;
      });
    } });
    await inputProbe.await();
  },
  inputApiOld: () => { inputHandles[0].actions.setDraft('stale'); inputHandles[0].actions.submit(); },
  inputApiForeign: () => inputHandles.at(-1).actions.addAttachments(['foreign-id']),
  inputApiSubmit: () => model.inputBindings.forBinding(model.reference.binding).actions.submit(),
  inputApiAttachment: async () => { await model.changeAttachments(model.getSnapshot().selected, () => [{ id: 'valid', name: 'fixture.txt', bytes: 1, state: 'ready' }]); },
  inputApiAttachments: () => model.getSnapshot().attachments[model.getSnapshot().selected],
  disableInputProbe: () => inputProbe.dispose(),
  enablePanels: async () => {
    if (!model.ctx.get('resources')) await model.ctx.plugin({ ...originalResources, name: 'fixture-resources' }).await();
    const aborted = [];
    const panels = model.ctx.plugin({ name: '@fixture/panels', inject: ['sidebarRightTabs', 'slots'], apply(ctx) {
      ctx.effect(() => ctx.sidebarRightTabs.register({ id: '@fixture/panels', kind: 'fixture-panel', title: () => '测试面板',
        guide: [{ id: 'fixture', order: 1, title: () => '测试面板' }] }));
      ctx.slots.register({ name: 'sidebar.right.tab.menu.item', id: 'fixture-panel-action' }, ({ tab, dismiss }) => tab.kind === 'fixture-panel' &&
        <button role="menuitem" onClick={() => { ctx.sidebarRight.openTab('fixture-panel', { params: { value: 'menu-action' } }); dismiss(); }}>插件菜单操作</button>);
      ctx.slots.register({ name: 'sidebar.right.pane.tab', key: '@fixture/panels' }, ({ useTabInfo, sessionId }) => {
          const { tab } = useTabInfo();
          const [count, setCount] = React.useState(0);
          const [modal, setModal] = React.useState(false), [menu, setMenu] = React.useState(false), [value, setValue] = React.useState('');
        React.useEffect(() => {
          const record = () => aborted.push(`${sessionId}:${tab.id}`);
          tab.signal.addEventListener('abort', record);
          return () => tab.signal.removeEventListener('abort', record);
        }, [tab.signal, tab.id, sessionId]);
        return <div data-testid="fixture-panel" style={{ width: 720 }}>
          <p>{sessionId}:{tab.navigation.params?.value ?? 'initial'}</p>
          <button onClick={() => setCount(count + 1)}>计数 {count}</button>
            <button onClick={() => tab.actions.openTab('guide')}>选择其他面板</button>
            <button onClick={() => setModal(true)}>打开插件弹窗</button>
            <Modal open={modal} onClose={() => setModal(false)} title="原插件弹窗" closeLabel="关闭插件弹窗">
              <input aria-label="插件弹窗输入" value={value} onChange={event => setValue(event.target.value)}/>
              <Menu open={menu} portal anchor={<button onClick={() => setMenu(true)}>弹窗菜单</button>}
                items={[{ id: 'ok', label: '填入菜单值' }]} onSelect={() => { setValue('menu-value'); setMenu(false); }} onClose={() => setMenu(false)}/>
            </Modal>
        </div>;
      });
    } });
    await panels.await();
    window.fixture.panelAborts = () => aborted;
    window.fixture.disablePanels = () => panels.dispose();
    window.fixture.openPanel = value => model.pluginPanels.openTab('fixture-panel', { params: { value } });
    window.fixture.closePanel = () => model.pluginPanels.close(model.pluginPanels.active().id);
    window.fixture.panelFile = () => {
      model.files = { text: async () => 'Mobile panel file contents' };
      model.pluginPanels.openResource('dsh-resource://file/session/two/panel.txt', { params: { line: 1 } });
    };
  },
  assistantBlocks: (content, turn = 1, start = 0) => {
    const emit = (offset, type, data, extra = {}) => channels.get('two')({ type: 'event', event: { seq: start + offset, time: start + offset, type, data, ...extra } });
    emit(0, 'turn/start', { turn }); emit(1, 'step/start', { turn, step: 1 });
    emit(2, 'assistant/message', { turn, step: 1, stream: [], message: { id: `blocks-${turn}`, role: 'assistant', content,
      source: { kind: 'model', provider: 'fixture', model: 'fixture' } } }, { surfaceOp: 'append' });
    emit(3, 'step/end', { turn, step: 1 }); emit(4, 'turn/end', { turn, reason: { kind: 'completed' } });
  },
  fileMentionsTurn: finish => {
    const emit = (seq, type, data, extra = {}) => channels.get('two')({ type: 'event', event: { seq, time: seq * 10, type, data, ...extra } });
    if (finish) { emit(15, 'turn/end', { turn: 1, reason: { kind: 'completed' } }); return; }
    model.files = { text: async (_id, path) => `File mention opened: ${path}` };
    emit(0, 'turn/start', { turn: 1 }); emit(1, 'step/start', { turn: 1, step: 1 });
    let seq = 2;
    for (const [callId, path, isError] of [['a', '/one/report.txt', false], ['b', '/two/report.txt', false], ['c', '/one/failed.txt', true], ['d', '/one/unique.txt', false]]) {
      emit(seq++, 'tool/call', { turn: 1, step: 1, callId, name: 'write', arguments: JSON.stringify({ file_path: path, content: 'fixture' }) });
      emit(seq++, 'tool/result', { turn: 1, step: 1, message: { id: `result-${callId}`, role: 'tool', source: { kind: 'tool', callId }, content: [{ type: 'tool-result', content: [{ type: 'text', text: 'fixture result' }], isError }] } }, { surfaceOp: 'append' });
    }
    emit(10, 'step/end', { turn: 1, step: 1 });
    emit(11, 'deliverables/presented', { turn: 1, callId: 'present', files: [{ path: '/one/delivery.txt' }] });
    emit(12, 'step/start', { turn: 1, step: 2 });
    emit(13, 'assistant/message', { turn: 1, step: 2, stream: [], message: { id: 'mentions-answer', role: 'assistant',
      source: { kind: 'model', provider: 'fixture', model: 'fixture' },
      content: [{ type: 'text', text: '`unique.txt` `report.txt` `/two/report.txt` `failed.txt` `unknown.txt` `delivery.txt`' }],
    } }, { surfaceOp: 'append' });
    emit(14, 'step/end', { turn: 1, step: 2 });
  },
  processTurn: (id, turn, start, finish = false) => {
    const emit = (offset, type, data, extra = {}) => channels.get(id)({ type: 'event', event: { seq: start + offset, time: (start + offset) * 10, type, data, ...extra } });
    if (finish) { emit(7, 'turn/end', { turn, reason: { kind: 'completed' } }); return; }
    emit(0, 'turn/start', { turn });
    for (const step of [1, 2]) {
      const offset = 1 + (step - 1) * 3;
      emit(offset, 'step/start', { turn, step });
      emit(offset + 1, 'assistant/message', { turn, step, stream: [], message: {
        id: `process-${id}-${turn}-${step}`, role: 'assistant',
        content: [{ type: 'text', text: `${step === 1 ? 'Process' : 'Answer'} ${id} ${turn}` }],
        source: { kind: 'model', provider: 'fixture', model: 'fixture' },
      } }, { surfaceOp: 'append' });
      emit(offset + 2, 'step/end', { turn, step });
    }
  },
  waitingTurn: (id, phase, time) => {
    const emit = (seq, type, data, extra = {}) => channels.get(id)({ type: 'event', event: { seq, time, type, data, ...extra } });
    if (phase === 'start') {
      emit(0, 'turn/start', { turn: 1 }); emit(1, 'step/start', { turn: 1, step: 1 });
      window.fixture.status(id, true);
    } else if (phase === 'text') emit(2, 'assistant/message', { turn: 1, step: 1, stream: [], message: {
      id: `waiting-${id}`, role: 'assistant', content: [{ type: 'text', text: '首段真实投影回放' }],
      source: { kind: 'model', provider: 'fixture', model: 'fixture' },
    } }, { surfaceOp: 'append' });
    else {
      const reason = phase === 'error' ? { kind: 'error', error: { message: '隔离状态回放失败', code: 'UNKNOWN' } }
        : phase === 'stop' ? { kind: 'aborted', reason: { kind: 'legacy' } } : { kind: 'completed' };
      emit(3, 'step/end', { turn: 1, step: 1 }); emit(4, 'turn/end', { turn: 1, reason });
      window.fixture.status(id, false);
    }
  },
  enableBuiltinNode, disableBuiltinNode: () => builtinNodePlugin.dispose(),
  shortenLineFile: () => { lineFileText = 'shortened file'; },
  emptyLineFile: () => { lineFileText = ''; },
  historyRequests: () => historyRequests.length,
  historyTesting: value => { historyTesting = value; },
  historyPage: page => historyReply({ ok: true, value: page }),
  historyReply: success => historyReply(success ? { ok: true, value: { records: [], hasMore: false } }
    : { ok: false, error: { code: 'gateway/internal', message: 'fixture read failed', details: {} } }),
  connectionState: connectionState => model.publish({ connectionState }),
  referenceMenuSetup: async () => {
    if (!transport.capabilities.endpoints.calls.includes('sessionReferenceResolver/candidates')) {
      await model.remote.$mount(sessionReferenceRemote);
      transport.capabilities.endpoints.calls.push('fileReferences/list', 'sessionReferenceResolver/candidates');
      model.publish();
    }
  },
  referenceMenuSeed: () => {
    const shell = model.inputBindings.mounted('one').shell;
    shell.insertReference({ source: 'fixture', ref: 'original-id', clipboardText: '@existing', appearance: 'file', label: '原引用' },
      { ...shell.caretSpan(), draftRev: shell.snapshot.draftRev });
  },
  referenceMenuDraft: () => model.inputBindings.mounted('one').captureDraft(),
  holdCreate: () => { createProbe = { calls: 0 }; },
  createCalls: () => createProbe?.calls ?? 0,
  failCreate: () => { createProbe.finish(); createProbe = undefined; },
  async beginWorkspaceDraftTest(workspacePrefix = 'draft') {
    workspaceDraftTest = true; savedDraftStore = model.draftStore; savedUploadHooks = transport.uploadHooks;
    model.draftStore = await RemoteDraftStore.open({ ...draftBinding, deviceId: 'workspace-drafts' }, indexedDB, null);
    await model.draftStore.clear();
    transport.uploadHooks = { async fetch(url, options) {
      const sessionId = new URL(url, 'https://fixture.invalid').searchParams.get('sessionId');
      const receiptId = crypto.randomUUID(); workspaceDraftUploads.push({ sessionId, receiptId, text: await options.body.text() });
      return new Response(JSON.stringify({ ok: true, value: { receiptId, file: { attachmentId: crypto.randomUUID(), name: 'workspace-draft.txt', bytes: options.body.size } } }), { status: 200 });
    } };
    await model.sessions.refresh(); await model.select('draft-from');
    const items = ['from', 'to'].map(id => ({ workspaceId: `${workspacePrefix}-${id}`, title: `草稿工作区 ${id}`, sessionIds: [`draft-${id}`],
      path: model.sessions.list.getSnapshot().byId[`draft-${id}`].cwd, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }));
    window.fixture.workspaceRows(items);
  },
  uploadWorkspaceDraft: () => model.upload(new File(['workspace draft original'], 'workspace-draft.txt'), 'draft-from'),
  insertWorkspaceReference: () => {
    const shell = model.inputBindings.mounted('draft-from').shell;
    return shell.insertReference({ source: 'reference', ref: '@same.txt', clipboardText: '@same.txt', appearance: 'file', label: 'same.txt' },
      { ...shell.caretSpan(), draftRev: shell.snapshot.draftRev });
  },
  workspaceDraftState: () => ({ selected: model.snapshot.selected, drafts: model.snapshot.drafts, attachments: model.snapshot.attachments,
    saving: model.snapshot.draftSaving, uploads: workspaceDraftUploads, locks: [...model.draftTransfers] }),
  async endWorkspaceDraftTest() {
    await model.select('one');
    for (const id of ['draft-from', 'draft-to']) {
      await model.writeDraft(id, ''); await model.changeAttachments(id, () => []);
    }
    await model.draftStore.clear(); model.draftStore.close(); model.draftStore = savedDraftStore;
    transport.uploadHooks = savedUploadHooks; workspaceDraftTest = false; window.fixture.workspaceRows([]);
    await model.sessions.refresh();
  },
  enableFeedback: async () => { feedbackPlugin = model.ctx.plugin({ ...originalFeedback, name: '@deepseek-ai/dsh-client-ui-message-feedback' }); await feedbackPlugin.await(); },
  forkActionRequests: () => forkActionRequests,
  disableFeedback: () => feedbackPlugin.dispose(),
  feedbackWrites: () => feedbackWrites,
  feedbackReads: id => feedbackReads.filter(sessionId => sessionId === id).length,
  feedbackWatchers: () => [...feedbackWatchers.keys()],
  feedbackSyncSession: async () => { feedbackSyncSession = true; await model.sessions.refresh(); },
  feedbackOtherClient: (sessionId, messageId, rating, seq) => {
    const key = `${sessionId}:${messageId}`;
    const item = { messageId, rating, version: crypto.randomUUID(), createdAt: 1, updatedAt: 2 };
    if (rating) feedbackItems.set(key, item); else feedbackItems.delete(key);
    if (seq === 'cold') {
      const watcher = feedbackWatchers.get(sessionId);
      watcher?.onEvent({ type: 'changed', revision: ++watcher.revision });
    } else if (seq !== undefined) channels.get(sessionId)({ type: 'event', event: { seq, time: seq * 10,
      type: rating ? 'feedback/message-put' : 'feedback/message-delete',
      data: rating ? { sessionId, item } : { sessionId, messageId } } });
  },
  feedbackConflict: () => { feedbackConflict = true; },
  desktopPreview: source => {
    const element = document.createElement('div'); document.body.append(element); const previewRoot = createRoot(element);
    const calls = [], controller = new AbortController(); let failure = false;
    const previewModel = { lifetime: controller, transport: { capabilities: { desktopOpen: true, desktopReveal: true, desktopOpenWorkspace: true, desktopOpenAttachment: true, channels: ['changes', 'attachment'] } },
      getSnapshot: () => ({ selected: 'desktop-test' }), files: { text: async () => '电脑文件内容' },
      client: { call: async () => {}, request(operation, event) {
        calls.push(operation);
        let promise;
        if (operation.method === 'remote.changes') promise = new Promise(resolve => queueMicrotask(() => {
          const value = operation.index === undefined ? { turn: 1, files: [{ path: 'report.txt', display: 'report.txt', added: 1, deleted: 0 }], total: 1, added: 1, deleted: 0 }
            : { kind: 'text', path: 'report.txt', display: 'report.txt', before: true, after: true, coarse: false, hunks: [] };
          event({ type: 'metadata', sessionId: operation.sessionId, seq: operation.seq, index: operation.index });
          event({ type: 'chunk', offset: 0, data: btoa(JSON.stringify(value)) }); resolve();
        }));
        else if (operation.method === 'remote.attachment') promise = new Promise(resolve => queueMicrotask(() => {
          event({ type: 'metadata', attachment: { attachmentId: 'saved-report', name: 'report.txt', bytes: 4 } });
          event({ type: 'chunk', offset: 0, data: btoa('file') }); resolve();
        }));
        else promise = ['remote.prepareDesktopFile', 'remote.prepareDesktopAttachment'].includes(operation.method) ? Promise.resolve({ name: '测试电脑', available: true, fileManager: 'explorer', snapshot: '65716e33-68b6-4e0d-8c70-0d1ad0ca4e56', fileName: 'report.txt', attachmentCopy: operation.method === 'remote.prepareDesktopAttachment' })
          : operation.method === 'remote.desktop' ? Promise.resolve({ name: '测试电脑', available: true, fileManager: 'explorer' })
          : failure ? Promise.reject(new Error('request_timeout_outcome_unknown')) : Promise.resolve({ opened: true });
        return { id: 'desktop-test-request', promise, cancel() {} };
      } },
    };
    const file = { sessionId: 'desktop-test', path: 'report.txt', ...(source === 'attachment' ? { attachment: { kind: 'file', attachmentId: 'saved-report', name: 'report.txt' } } : source === 'workspace' ? {} : { desktopSource: { source, seq: 7, index: 0 } }) };
    const showFile = () => previewRoot.render(<RemoteFilePreview file={file} model={previewModel} onClose={() => { previewRoot.unmount(); element.remove(); controller.abort(); }}/>);
    if (source === 'changes') previewRoot.render(<RemoteChangesPreview file={{ sessionId: file.sessionId, seq: 7, turn: 1 }} model={previewModel}
      onClose={() => { previewRoot.unmount(); element.remove(); controller.abort(); }} onCurrent={showFile}/>);
    else showFile();
    window.fixture.desktopCalls = () => calls;
    window.fixture.desktopFail = () => { failure = true; };
    window.fixture.desktopSucceed = () => { failure = false; };
  },
  workflow: (stage, outcome = 'completed') => {
    if (stage === 'start') workflowSeq = (model.snapshot.session?.cursor ?? -1) + 1;
    const emit = (offset, type, data) => channels.get('two')({ type: 'event', event: { seq: workflowSeq + offset, time: 10000 + offset, type, data } });
    if (stage === 'start') {
      model.sessions.handleSessionAdded({ sessionId: 'workflow-child', origin: 'subagent', parentSessionId: 'two', running: true, blank: false, updatedAt: 10,
        projections: { asOfSeq: -1, values: { title: '工作流成员' } } });
      emit(0, 'turn/start', { turn: 30 }); emit(1, 'step/start', { turn: 30, step: 1 });
      emit(2, 'tool/call', { turn: 30, step: 1, callId: 'workflow-call', name: 'workflow', arguments: '{}' });
      emit(3, 'tool-workflow/run-start', { runId: 'run', name: '手机工作流验证' });
      emit(4, 'tool-workflow/agent-start', { runId: 'run', seq: 1, label: '资料检查', phase: '检查', childId: 'workflow-child' });
    } else if (stage === 'finish') {
      emit(5, 'tool-workflow/agent-end', { runId: 'run', seq: 1, outcome });
      emit(6, 'tool-workflow/run-end', { runId: 'run', stopReason: outcome === 'failed' ? 'error' : outcome });
    } else if (stage === 'interrupt') {
      emit(5, 'step/end', { turn: 30, step: 1 }); emit(6, 'turn/end', { turn: 30, reason: { kind: 'cancelled' } });
    }
  },
  back: () => model.back(),
  interruptedTools: (target = model.snapshot.selected) => {
    // 子会话夹具初始为空，不能沿用主聊天游标，否则会触发缺页补读。
    const id = target, start = target === model.snapshot.selected
      ? Math.max(toolFixtureCursor, (model.snapshot.session?.cursor ?? -1) + 1) : 0;
    channels.get('session/control')({ type: 'jobs', sessionId: id, jobs: [{ id: 'interrupted-read', kind: 'pwsh', label: '读取停止回放', status: 'running', startedAt: 1 }] });
    const emit = (offset, type, data) => channels.get(id)({ type: 'event', event: { seq: start + offset, time: 20000 + offset, type, data,
      ...(type === 'tool/result' ? { surfaceOp: 'append' } : {}) } });
    emit(0, 'turn/start', { turn: 1 }); emit(1, 'step/start', { turn: 1, step: 1 });
    emit(2, 'tool/call', { turn: 1, step: 1, callId: 'stopped-command', name: 'pwsh', arguments: JSON.stringify({ command: 'fixture command', description: '中断回放' }) });
    emit(3, 'tool/call', { turn: 1, step: 1, callId: 'stopped-read', name: 'job_output', arguments: JSON.stringify({ job_id: 'interrupted-read' }) });
    for (const [offset, callId, code] of [[4, 'stopped-command', 'ABORTED_BEFORE_DISPATCH'], [5, 'stopped-read', 'ABORTED']]) {
      emit(offset, 'tool/result', { turn: 1, step: 1, error: { name: 'AbortError', code }, message: {
        id: `${callId}-result`, role: 'tool', source: { kind: 'tool', callId },
        content: [{ type: 'tool-result', isError: true, content: [{ type: 'text', text: 'Error: tool call aborted' }] }],
      } });
    }
    emit(6, 'step/end', { turn: 1, step: 1 }); emit(7, 'turn/end', { turn: 1, reason: { kind: 'cancelled' } });
    toolFixtureCursor = start + 8;
  },
  enableOriginalTools: async () => { toolsPlugin = model.ctx.plugin({ ...originalTools, name: '@deepseek-ai/dsh-client-ui-tool' }); await toolsPlugin.await(); },
  toolLayoutCases: (target = model.snapshot.selected) => {
    const start = target === model.snapshot.selected ? (model.snapshot.session?.cursor ?? -1) + 1 : 0;
    let offset = 0;
    const emit = (type, data) => channels.get(target)({ type: 'event', event: { seq: start + offset++, time: 1000 + offset * 500, type, data,
      ...(type === 'tool/result' || type === 'assistant/message' ? { surfaceOp: 'append' } : {}) } });
    emit('turn/start', { turn: 1 }); emit('step/start', { turn: 1, step: 1 });
    for (const [callId, name, text, isError] of [
      ['layout-read', 'read', 'File contents', false],
      ['layout-short', 'write', 'Error: [sandbox: file access denied under read-only mode]', true],
      ['layout-long', 'write', 'Error: the user rejected escalating this operation to "workspace-write"; it stays denied, so stop and explain instead of working around it', true],
    ]) {
      emit('tool/call', { turn: 1, step: 1, callId, name, arguments: JSON.stringify({ file_path: 'approval-reject.txt', content: 'layout check' }) });
      emit('tool/result', { turn: 1, step: 1, message: { id: callId + '-result', role: 'tool', source: { kind: 'tool', callId },
        ...(typeof DSHM_MOBILE_SDK_VERSION === 'string' && DSHM_MOBILE_SDK_VERSION === '0.2.1-alpha.2'
          ? { isError, content: [{ type: 'text', text }] }
          : { content: [{ type: 'tool-result', isError, content: [{ type: 'text', text }] }] }) } });
    }
    emit('step/end', { turn: 1, step: 1 }); emit('step/start', { turn: 1, step: 2 });
    emit('assistant/message', { turn: 1, step: 2, stream: [], message: { id: 'layout-answer', role: 'assistant',
      source: { kind: 'model', provider: 'fixture', model: 'fixture' }, content: [{ type: 'text', text: '文件没有被修改。请确认所需权限后再继续。' }] } });
    emit('step/end', { turn: 1, step: 2 }); emit('turn/end', { turn: 1, reason: { kind: 'completed' } });
  },
  disableOriginalTools: () => toolsPlugin.dispose(),
  workspaceErrors: ({ error, draftError, attachmentError }) => model.publish({ error,
    draftErrors: { [model.snapshot.selected]: draftError }, attachmentDraftErrors: { [model.snapshot.selected]: attachmentError } }),
  toolLocale: id => {
    model.pluginSlots.locale.setLocale(id);
    root.render(<LocaleProvider locale={id}><RemotePluginScope model={model}><RemoteWorkspace model={model} onBack={() => {}} onConnection={() => {}}/></RemotePluginScope></LocaleProvider>);
  },
  toolLayoutEmbedded: () => {
    model.conversationFocus.set(model);
    root.render(<div style={{ height: '100dvh' }}><LocaleProvider locale="zh"><RemotePluginScope model={model}>
      <RemoteWorkspace model={model} embedded onBack={() => {}} onConnection={() => {}}/>
    </RemotePluginScope></LocaleProvider></div>);
  },
  toolLayoutWide: async () => {
    wideToolPlugin = model.ctx.plugin({ name: '@fixture/wide-tool', inject: ['slots'], apply(ctx) {
      ctx.slots.inject('tool.call.toolview', () => ctx.slots.register({ name: 'tool.call.toolview', key: 'write', priority: -10 }, () =>
        <button data-testid="wide-tool" style={{ width: 720, height: 80 }} onClick={event => { event.currentTarget.dataset.clicked = 'yes'; }}>第三方工具界面</button>));
    } });
    await wideToolPlugin.await();
  },
  toolLayoutFit: value => model.pluginSlots.layout.setUser('@fixture/wide-tool', value),
  toolLayoutWideOff: () => wideToolPlugin.dispose(),
  cancellationCases: () => {
    const id = model.snapshot.selected, start = Math.max(toolFixtureCursor, (model.snapshot.session?.cursor ?? -1) + 1);
    let offset = 0;
    const emit = (type, data) => channels.get(id)({ type: 'event', event: { seq: start + offset++, time: 30000 + offset, type, data,
      ...(type === 'tool/result' ? { surfaceOp: 'append' } : {}) } });
    emit('turn/start', { turn: 2 });
    let step = 0;
    for (const [callId, error, content] of [
      ['review-denied', { name: 'AutoReviewDeniedError', code: 'AUTO_REVIEW_DENIED', reason: 'scope blocked' }, 'original denial'],
      ['ordinary-failure', { name: 'Error', code: 'FAILED' }, 'Error: tool call aborted'],
      ['cancel-partial', { name: 'AbortError', code: 'ABORTED' }, 'PARTIAL_OUTPUT_RETAINED'],
    ]) {
      step++; emit('step/start', { turn: 2, step });
      emit('tool/call', { turn: 2, step, callId, name: 'read', arguments: '{"path":"fixture.txt"}' });
      emit('tool/result', { turn: 2, step, error, message: { id: `${callId}-result`, role: 'tool', source: { kind: 'tool', callId },
        content: [{ type: 'tool-result', isError: true, content: [{ type: 'text', text: content }] }] } });
      emit('step/end', { turn: 2, step });
    }
    step++; emit('step/start', { turn: 2, step });
    emit('tool/call', { turn: 2, step, callId: 'parent-code', name: 'run_code', arguments: '{}' });
    const child = { rootCallId: 'parent-code', parentCallId: 'parent-code', subCallId: 'child-cancelled', name: 'read', arguments: { path: 'fixture.txt' } };
    emit('tool/ptc-dispatch-start', child);
    emit('tool/ptc-dispatch', { ...child, isError: true, error: { name: 'AbortError', code: 'ABORTED_BEFORE_DISPATCH' }, content: [{ type: 'text', text: 'Error: tool call aborted before dispatch' }] });
    emit('tool/result', { turn: 2, step, message: { id: 'parent-result', role: 'tool', source: { kind: 'tool', callId: 'parent-code' }, content: [{ type: 'tool-result', content: [{ type: 'text', text: 'completed outer call' }] }] } });
    emit('step/end', { turn: 2, step }); emit('turn/end', { turn: 2, reason: { kind: 'completed' } });
    toolFixtureCursor = start + offset;
  },
  keyNativeCalls: () => keyNativeCalls,
  providerSettingsReadFailure: failed => { providerSettingsReadFailure = failed; },
  providerCreationRows: () => { transport.capabilities.providerCreationModelRows = true; model.publish(); },
  providerCreationWrites: () => providerCreationWrites,
  holdProviderCardRead: () => { heldProviderCardRead = Promise.withResolvers(); },
  releaseProviderCardRead: fail => { const held = heldProviderCardRead; heldProviderCardRead = undefined; fail ? held.reject(Error('remote_settings_unavailable')) : held.resolve(); },
  keyConfigured: configured => { keyConfigured = configured; channels.get('$events')({ type: 'emit', event: 'credentials/reference-updated', args: ['TEST_REFERENCE'] }); },
  holdKeyRead: () => { heldKeyRead = Promise.withResolvers(); },
  releaseKeyRead: () => { const old = heldKeyRead; heldKeyRead = undefined; old.resolve(); },
  holdKeyNative: () => { heldKeyNative = Promise.withResolvers(); },
  releaseKeyNative: () => { const old = heldKeyNative; heldKeyNative = undefined; old.resolve(); },
  failDraftSave: broken => {
    model.draftStore = { write() { if (broken) throw new Error('QuotaExceeded'); } };
    if (broken) return model.draft('本地保存失败的草稿');
  },
  endpointWrites: () => endpointWrites,
  settingsGrant: allowed => { transport.capabilities.computerSettings = true; transport.capabilities.computerKey = true; transport.capabilities.computerEndpoint = true; transport.capabilities.management = allowed; model.publish(); },
  settingsPush: value => { settingsLimit = value; settingsRevision++; channels.get('$events')({ type: 'emit', event: 'settings/document-updated', args: [] }); },
  holdSettingsRead: () => { heldSettingsRead = Promise.withResolvers(); },
  failSettingsRead: () => { settingsReadFailure = true; },
  modelListEnable: () => { transport.capabilities.deepSeekModels = true; model.publish(); },
  modelListReads: () => modelListReads,
  modelListPush: name => { modelListName = name; channels.get('$events')({ type: 'emit', event: 'settings/document-updated', args: [] }); },
  holdModelListRead: () => { heldModelListRead = Promise.withResolvers(); },
  releaseModelListRead: () => { const held = heldModelListRead; heldModelListRead = undefined; held.resolve(); },
  releaseSettingsRead: () => { const held = heldSettingsRead; heldSettingsRead = undefined; held.resolve(); },
  providerDirectory: rows => {
    providerRows = rows; transport.capabilities.providerSettings = true; transport.capabilities.providerCreation = true; model.publish();
    channels.get('$events')({ type: 'emit', event: 'settings/document-updated', args: [] });
  },
  providerListReads: () => providerListReads,
  providerListFailure: value => { providerListFailure = value; },
  holdProviderList: () => { let resolve; const promise = new Promise(done => { resolve = done; }); providerListHold = { promise, resolve }; },
  releaseProviderList: () => { const held = providerListHold; providerListHold = null; held?.resolve(); },
  settingsRequests: () => settingsRequests,
  settingsConflict: () => { settingsConflict = true; },
  workspaceGrant: allowed => { transport.capabilities.workspaceManagement = true; transport.capabilities.management = allowed; transport.capabilities.endpoints.calls.push('workspace/rename', 'workspace/delete', 'workspace/insertBefore'); model.publish(); },
  workspaceRows: items => {
    const emit = channels.get('workspace/follow');
    for (const previous of workspaceViews) {
      if (!items.some(item => item.workspaceId === previous.workspaceId)) emit({ type: 'remove', workspaceId: previous.workspaceId });
    }
    for (const workspace of items) emit({ type: 'upsert', workspace });
    emit({ type: 'order', workspaceIds: items.map(item => item.workspaceId) });
    workspaceViews = items;
  },
  workspaceWrites: () => workspaceWrites,
  searchQueries: () => searchRequests.map(item => item.query),
  holdListRefresh: () => { listRefreshGate = new Promise(resolve => { releaseListRefresh = resolve; }); },
  releaseListRefresh: () => { releaseListRefresh(); listRefreshGate = undefined; },
  resolveSearch: (index, value) => searchRequests[index].resolve(value),
  jobOutput: (id, finished) => {
    const emit = (seq, type, data, extra = {}) => channels.get(id)({ type: 'event', event: { seq, time: 2000 + seq, type, data, ...extra } });
    if (!finished) {
      emit(0, 'turn/start', { turn: 2 }); emit(1, 'step/start', { turn: 2, step: 1 });
      emit(2, 'tool/call', { turn: 2, step: 1, callId: 'job-read', name: 'job_output', arguments: JSON.stringify({ job_id: 'live' }) });
    } else {
      emit(3, 'tool/result', { turn: 2, step: 1, message: { id: 'job-read-result', role: 'tool', source: { kind: 'tool', callId: 'job-read' },
        content: [{ type: 'tool-result', content: [{ type: 'text', text: '\u001b[32mRECORDED_JOB_OUTPUT\u001b[0m\n[status: completed]' }] }] } }, { surfaceOp: 'append' });
      emit(4, 'step/end', { turn: 2, step: 1 }); emit(5, 'turn/end', { turn: 2, reason: { kind: 'completed' } });
    }
  },
  event: frame => channels.get('$events')(frame), eventResults: () => eventResults,
  plan: (sessionId, value) => channels.get('session/control')({ type: 'projection', sessionId, key: 'plan', seq: ++planSeq, value }),
  planWrites: () => planWrites,
  schedules: (sessionId, value) => channels.get('session/control')({ type: 'projection', sessionId, key: 'schedule', seq: ++scheduleSeq, value }),
  jobStopWrites: () => jobStopWrites,
  jobs: (sessionId, jobs) => channels.get('session/control')({ type: 'jobs', sessionId, jobs }),
  goalFailure: fail => { goalFailure = fail; },
  presetFailure: value => { presetFailure = value; }, presetWrites: () => presetWrites,
  holdPreset: () => { presetGate = Promise.withResolvers(); },
  releasePreset: () => { presetGate.resolve(); presetGate = undefined; },
  catalogFailure: fail => { catalogFailure = fail; },
  skillsFailure: fail => { skillsFailure = fail; },
  permissionFailure: fail => { permissionFailure = fail; }, permissionWrites: () => permissionWrites,
  permissionProjection: (id, value) => channels.get('session/control')({ type: 'projection', sessionId: id, key: 'permissions', seq: 10, value: { currentValue: value } }),
  refreshCatalog: () => model.modelCatalog.refresh(),
  modelProjection: (id, next = null) => channels.get('session/control')({ type: 'projection', sessionId: id, key: 'modelSelection', seq: ++modelSeq, value: { next, lastUsed: null } }),
  enableNode, disableNode: () => nodePlugin.dispose(),
  emitNote: (id, seq, text) => channels.get(id)({ type: 'event', event: { seq, time: seq * 10, type: 'test/note', data: { text } } }),
  locale: id => model.pluginSlots.locale.setLocale(id),
  startGraph: async () => { model.pluginRuntime = new RemotePlugins(model); await model.pluginRuntime.start(); },
  dynamicRegistration: async () => {
    const modules = model.pluginRuntime.runtime.modules;
    const id = 'dyn/registration-fixture';
    // 与原 runner 的同步 invalidate → sink.load → import 路径相同。
    modules.invalidate(id);
    window.__ModuleLoader__.load({ id, factory: () => ({ value: 'dynamic-registered' }) });
    try { return (await modules.import(id, '', {})).value; }
    finally { modules.invalidate(id); }
  },
  updateGraph: revision => { graphRevision = revision; graphSubscriber(graph(revision)); },
  restartGraphHost: () => {
    const event = graphSubscriber, end = endGraph;
    lateGraph = () => { event(graph('v0')); end(); };
    rejectGraph(new Error('host_disconnected_outcome_unknown')); model.connection.reconnect();
  },
  lateGraph: () => lateGraph(),
  graphSubscriptions: () => graphSubscriptions,
  plugins: () => model.getSnapshot().plugins,
  settingsSections: () => model.ctx.slots.entries('settings.section').map(entry => ({ id: entry.options.id, order: entry.options.order })),
  failInitialGraph: async () => {
    await model.pluginRuntime.dispose();
    const runtime = model.pluginRuntime = new RemotePlugins(model);
    await runtime.bootstrap(graph('v1'));
    runtime.prepared = true;
    const activate = runtime.activate.bind(runtime);
    runtime.activate = async () => { await activate(); throw new Error('fixture_initial_activation_failure'); };
    await runtime.start().catch(error => runtime.fail(error));
  },
  attemptRoot: async () => {
    const fiber = model.ctx.plugin({ name: 'invalid-root-plugin', inject: ['slots'], apply(ctx) { ctx.slots.register({ name: 'root' }, () => <p>Unexpected desktop page</p>); } });
    try { await fiber.await(); return 'unexpected-success'; } catch (error) { return error.message; } finally { await fiber.dispose(); }
  },
  status: (id, running) => channels.get('$events')({ type: 'emit', event: 'api-session/status', args: [id, running] }),
  check: () => ({ channels: channels.size, desktopRenderer: !!model.ctx.get('uiRenderer'), desktopLayout: !!model.ctx.get('uiLayout') }),
  dispose: async () => { root.unmount(); await model.dispose(); },
  restoreOutputPage: async () => {
    await model.select('one');
    const target = { id: 'resume-output', sessionId: 'one', independent: true, startedAt: 1 };
    channels.get('session/control')({ type: 'jobs', sessionId: 'one', jobs: [{ ...target, kind: 'pwsh', label: '恢复测试', status: 'running' }] });
    flushSync(() => root.render(null));
    transport.capabilities.jobOutput = true;
    model.jobOutputResume = { target, stream: 'stdout', mode: 'history', full: false, reader: {
      generation: transport.capabilities.jobControlGeneration, decoder: new TextDecoder(),
      snapshot: { text: '恢复的输出', offset: 15, total: 30, phase: 'ready', status: 'running', gap: false, trimmed: false },
    } };
    root.render(<RemotePluginScope model={model}><RemoteWorkspace model={model} onBack={() => {}} onConnection={() => {}}/></RemotePluginScope>);
  },
  restoreCommandPage: async () => {
    await model.select('one');
    const start = (model.snapshot.session?.cursor ?? -1) + 1;
    for (const [offset, type, data] of [
      [0, 'turn/start', { turn: 90 }], [1, 'step/start', { turn: 90, step: 1 }],
      [2, 'tool/call', { turn: 90, step: 1, callId: 'resume-command', name: 'pwsh', arguments: JSON.stringify({ command: 'fixture command', description: '前台恢复测试' }) }],
    ]) channels.get('one')({ type: 'event', event: { seq: start + offset, time: 30000 + offset, type, data } });
    await new Promise(resolve => requestAnimationFrame(resolve));
    const nodeId = model.snapshot.conversation.order.find(key => {
      const node = model.snapshot.conversation.nodes.get(key);
      return node.kind === 'tool-call' && node.data.root.callId === 'resume-command';
    });
    if (!nodeId) throw Error('Missing original command projection');
    flushSync(() => root.render(null));
    transport.capabilities.commandOutputGeneration = crypto.randomUUID();
    const target = { sessionId: 'one', nodeId, callId: 'resume-command' };
    model.commandResume = { target, liveOutput: true, full: true, scrollTop: 0, output: { stream: 'stderr', mode: 'history', reader: {
      generation: transport.capabilities.commandOutputGeneration, outputId: '91949130-b960-4212-a01f-18b815b7035b', decoder: new TextDecoder(),
      snapshot: { text: '命令已确认内容', offset: 21, total: 21, phase: 'ended', status: 'completed', gap: false, trimmed: false },
    } } };
    root.render(<RemotePluginScope model={model}><RemoteWorkspace model={model} onBack={() => {}} onConnection={() => {}}/></RemotePluginScope>);
  },
  commandOutputRequests: () => commandOutputRequests,
  rebuildCommandPage: () => {
    const resume = captureRemoteResume(model);
    flushSync(() => root.render(null));
    model.commandResume = resume.command;
    root.render(<RemotePluginScope model={model}><RemoteWorkspace model={model} onBack={() => {}} onConnection={() => {}}/></RemotePluginScope>);
  },
  capturedCommand: () => !!captureRemoteResume(model).command,
  forgetDraftBinding: async () => {
    root.unmount(); await model.dispose();
    const drafts = await RemoteDraftStore.open(draftBinding), other = await RemoteDraftStore.open({ ...draftBinding, deviceId: 'other' });
    await drafts.write('test-chat', '要清理的测试草稿'); await other.write('test-chat', '其他绑定草稿'); localStorage.setItem('ordinary-test', '保留普通聊天');
    drafts.close(); other.close();
    let forgotten = false;
    // 原生桥的隔离夹具，只测试正式页面的确认与清理，不模拟生产授权。
    globalThis.DSHMRemote = { postMessage(raw) {
      const { id, op } = JSON.parse(raw);
      if (op === 'binding.forget') forgotten = true;
      const data = op === 'binding.info' ? draftBinding : op === 'binding.status' ? { status: 'pending' } : {};
      queueMicrotask(() => globalThis.DSHMRemote.onmessage({ data: JSON.stringify({ id, data }) }));
    } };
    createRoot(document.getElementById('app')).render(<RemoteApp/>);
    window.fixture.forgetState = async () => {
      const current = await RemoteDraftStore.open(draftBinding), remaining = await RemoteDraftStore.open({ ...draftBinding, deviceId: 'other' });
      try { return { forgotten, current: current.read('test-chat'), other: remaining.read('test-chat'), ordinary: localStorage.getItem('ordinary-test') }; }
      finally { current.close(); remaining.close(); }
    };
  },
};
