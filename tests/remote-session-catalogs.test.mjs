import test from 'node:test';
import assert from 'node:assert/strict';
import { remoteSessionCatalogs } from '../src/remote-session-catalogs.mjs';
import { assertLocalSubagent, externalSubagentResults, EXTERNAL_SUBAGENT_MESSAGE, subagentAccess, subagentReadError, subagentStatus, watchSubagentService } from '../src/remote-subagents.mjs';

test('新版手机导航读取原投影，保留错误、运行状态和未知模式限制，不修改原 store', () => {
  const error = { code: 'session/projections-unavailable', message: 'unavailable' };
  const list = {
    ids: ['parent'], byId: { child: { running: true } },
    projectionsBySession: {
      parent: { state: 'error', error, values: { subagentCatalog: [
        { id: 'child', mode: 'continuable', label: 'Child', createdAt: 1 },
        { id: 'unknown', mode: 'unknown', createdAt: 2 },
      ] } },
      child: { state: 'idle', error: null, values: { subagentCatalog: [{ id: 'grandchild', mode: 'one-shot', createdAt: 3 }] } },
      pending: { state: 'idle', error: null, values: {} },
      empty: { state: 'idle', error: null, values: { subagentCatalog: [] } },
    },
  };
  const projected = remoteSessionCatalogs(list);
  assert.equal(projected.projectionsBySession, list.projectionsBySession);
  assert.equal(projected.byId, list.byId);
  assert.equal(Object.hasOwn(list, 'subagentsByParent'), false);
  assert.equal(remoteSessionCatalogs(list), projected);
  const parent = projected.subagentsByParent.parent;
  assert.equal(parent.state, 'error'); assert.equal(parent.error, error);
  assert.equal(parent.entries[0].kind, 'child'); assert.equal(parent.entries[0].activity, 'running');
  assert.equal(parent.entries[0].hasChildren, true);
  assert.equal(parent.entries[1].kind, 'child'); assert.equal(parent.entries[1].mode, 'unknown');
  assert.equal(subagentStatus(parent.entries[1]), '当前未运行 · 模式未知');
  const unknown = { parentSessionId: 'parent', childSessionId: 'unknown', mode: 'unknown' };
  assert.equal(subagentAccess({ selectedTarget: unknown }).canSend, false);
  assert.equal(subagentAccess({ selectedTarget: unknown }).canStop, false);
  assert.equal(subagentAccess({ selectedTarget: unknown, session: { subagent: {
    address: { ...unknown, mode: 'continuable' }, parentAvailable: true,
  } } }).canSend, true);
  assert.equal(projected.subagentsByParent.pending.state, 'loading');
  assert.equal(projected.subagentsByParent.empty.state, 'ready');
  const updated = remoteSessionCatalogs({ ...list, byId: { child: { running: false } } });
  assert.notEqual(updated, projected); assert.equal(updated.subagentsByParent.parent.entries[0].activity, 'inactive');
});

test('旧版原目录保持对象身份，不使用新版字段覆盖原诊断记录', () => {
  const list = { subagentsByParent: { parent: { entries: [{ kind: 'diagnostic', reason: 'corrupt' }] } } };
  assert.equal(remoteSessionCatalogs(list), list);
  assert.equal(remoteSessionCatalogs(undefined), undefined);
});

test('外部任务保留官方目录身份，不推断本地运行状态或提供本地会话入口', () => {
  const original = { id: 'external', mode: 'external', label: 'ACP', createdAt: 1 };
  const list = { ids: ['parent'], byId: {}, projectionsBySession: {
    parent: { state: 'idle', values: { subagentCatalog: [original] } },
  } };
  const entry = remoteSessionCatalogs(list).subagentsByParent.parent.entries[0];
  assert.equal(entry.id, original.id); assert.equal(entry.mode, original.mode);
  assert.equal(subagentStatus(entry), '外部任务');
  assert.equal(subagentStatus({ ...entry, activity: 'running' }), '外部任务');
  assert.throws(() => assertLocalSubagent(entry), { message: EXTERNAL_SUBAGENT_MESSAGE });
  for (const mode of ['one-shot', 'continuable', 'unknown']) assert.doesNotThrow(() => assertLocalSubagent({ mode }));
  const access = subagentAccess({ selectedTarget: { parentSessionId: 'parent', childSessionId: entry.id, mode: entry.mode } });
  assert.equal(access.canSend, false); assert.equal(access.canStop, false);
  assert.equal(access.message, EXTERNAL_SUBAGENT_MESSAGE);
  assert.deepEqual(list.projectionsBySession.parent.values.subagentCatalog, [original]);
});

test('子会话身份读取失败显示用户提示，保留原错误与未知模式限制', () => {
  const error = Object.freeze({ code: 'subagent/catalog-diagnostic', message: 'subagent/catalog-diagnostic' });
  const address = Object.freeze({ parentSessionId: 'parent', childSessionId: 'child', mode: 'unknown' });
  const state = Object.freeze({ selectedTarget: address, session: Object.freeze({ openError: error }) });
  assert.equal(subagentReadError(error), '无法确认这个子会话的记录，请在电脑上检查。');
  assert.equal(subagentReadError({ message: error.code }), subagentReadError(error));
  assert.equal(subagentReadError({ code: 'gateway/internal', message: error.code }), subagentReadError(error));
  assert.equal(subagentReadError({ code: 'gateway/internal', message: 'other failure' }), 'other failure');
  assert.equal(subagentReadError({ code: 'session/not-found', message: error.code }), error.code);
  assert.deepEqual(subagentAccess(state), { address, canSend: false, canStop: false, message: null });
  assert.equal(state.session.openError, error);
  assert.equal(subagentReadError({ code: 'session/not-found', message: 'original message' }), 'original message');
  assert.equal(subagentAccess({ selectedTarget: address }).message, '正在确认子会话类型，暂时只能查看记录。');
});

test('外部结果只取父会话结算正文，提示词、参数和其他来源不能伪装成结果', () => {
  const notice = { type: 'user/message', seq: 7, data: { source: { kind: 'subagent-settled', senderSessionId: 'external' },
    content: [{ type: 'text', text: 'actual result' }, { type: 'file', attachment: {} }] } };
  const entries = [{ event: { ...notice, type: 'tool/call' } },
    { event: { ...notice, data: { ...notice.data, source: { kind: 'user' } } } },
    { event: { ...notice, data: { ...notice.data, source: { kind: 'subagent-settled' } } } }, { event: notice }];
  assert.deepEqual([...externalSubagentResults(entries)], [['external', { seq: 7, text: 'actual result' }]]);
  assert.equal(entries.at(-1).event, notice);
});

test('子会话服务停用撤销旧历史的发送/停止资格，恢复不改变原记录或草稿', async () => {
  const listeners = new Set(), subscriptions = [], changes = [];
  const model = {
    snapshot: { connectionState: 'connected' }, capabilityGeneration: 'first',
    transport: { capabilities: { subagentState: true } },
    getSnapshot() { return this.snapshot; },
    subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); },
    publish(patch) { this.snapshot = { ...this.snapshot, ...patch }; changes.push(patch.subagentServiceAvailable); for (const fn of listeners) fn(); },
    client: { request(operation, event, end) {
      assert.deepEqual(operation, { method: 'remote.subagentStateFollow' });
      const subscription = { event, end, cancelled: false, promise: new Promise(() => {}), cancel() { this.cancelled = true; } };
      subscriptions.push(subscription); return subscription;
    } },
  };
  const dispose = watchSubagentService(model);
  const state = Object.freeze({ session: Object.freeze({ subagent: Object.freeze({
    address: Object.freeze({ parentSessionId: 'parent', childSessionId: 'child', mode: 'continuable' }),
    parentAvailable: true,
  }) }), drafts: Object.freeze({ child: 'keep draft' }) });
  const first = subscriptions[0]; first.event({ available: true });
  assert.equal(changes.at(-1), true); assert.equal(subagentAccess(state, changes.at(-1)).canSend, true);
  first.event({ available: false });
  assert.equal(changes.at(-1), false);
  const denied = subagentAccess(state, changes.at(-1));
  assert.equal(denied.canSend, false); assert.equal(denied.canStop, false);
  assert.equal(denied.message, '电脑已停用子会话服务，恢复后可以继续聊天。');
  assert.equal(subagentAccess({ ...state, subagentServiceAvailable: false }).canSend, false);
  first.event({ available: true });
  assert.equal(changes.at(-1), true); assert.equal(subagentAccess(state, changes.at(-1)).canSend, true);
  assert.equal(state.drafts.child, 'keep draft'); assert.equal(state.session.subagent.parentAvailable, true);
  model.publish({ connectionState: 'disconnected' }); assert.equal(first.cancelled, true);
  first.event({ available: true }); assert.equal(model.snapshot.subagentServiceAvailable, false);
  model.capabilityGeneration = 'second'; model.publish({ connectionState: 'connected' });
  assert.equal(subscriptions.length, 2); first.end(); assert.equal(subscriptions[1].cancelled, false);
  subscriptions[1].event({ available: true, unexpected: 'ignored' });
  assert.equal(model.snapshot.subagentServiceAvailable, false); assert.equal(subscriptions[1].cancelled, true);
  dispose(); assert.equal(listeners.size, 0);
});
