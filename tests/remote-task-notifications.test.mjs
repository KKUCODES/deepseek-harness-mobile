import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { RemoteNoticeLedger, watchTaskNotifications } from '../src/remote-task-notifications.mjs';

const item = kind => ({ eventId: randomUUID(), sessionId: 'test-session', kind: kind ?? 'approval' });
const ready = pending => ({ type: 'ready', generation: randomUUID(), pendingAvailable: true, pending: pending ?? [] });
const outcome = (seq = 7, reason = 'completed') => ({ type: 'outcome', sessionId: 'test-session', seq, turn: 1, time: 123, reason });
const tick = () => new Promise(resolve => setImmediate(resolve));

test('initial pending items never notify; new ones notify once and resolution/reconnect keep stable IDs', () => {
  const ledger = new RemoteNoticeLedger(), old = item(), fresh = item('question');
  assert.deepEqual(ledger.baseline([old]), { type: 'baseline', pending: [old], removed: [] });
  assert.equal(ledger.receive({ type: 'pending', item: old }).notify, false);
  assert.equal(ledger.receive({ type: 'pending', item: fresh }).notify, true);
  assert.equal(ledger.receive({ type: 'pending', item: fresh }).notify, false);
  assert.deepEqual(ledger.baseline([fresh]).removed, [old.eventId]);
  assert.equal(ledger.receive({ type: 'pending', item: fresh }).notify, false);
  ledger.receive({ type: 'resolved', eventId: fresh.eventId });
  assert.equal(ledger.pending.size, 0);
  // 已完成的请求即使收到迟到的重复呈现，也不能再次提醒或复活待办。
  assert.equal(ledger.receive({ type: 'pending', item: fresh }).type, 'ignored');
  assert.equal(ledger.pending.size, 0);
  assert.throws(() => ledger.baseline([fresh]));
});

test('outcomes retain distinct original reasons and deduplicate by session/sequence, not model rebuild', () => {
  const ledger = new RemoteNoticeLedger();
  for (const [seq, reason] of ['completed', 'error', 'blocked', 'max-tokens'].entries()) {
    assert.equal(ledger.receive(outcome(seq, reason)).notify, true);
    assert.equal(ledger.receive(outcome(seq, reason)).notify, false);
  }
  ledger.baseline([]);
  assert.equal(ledger.receive(outcome(0)).notify, false);
  assert.equal(ledger.receive({ ...outcome(0), sessionId: 'another-session' }).notify, true);
  for (const bad of [{ ...outcome(), reason: 'aborted' }, { ...outcome(), seq: -1 },
    { ...outcome(), detail: 'private' }, { ...outcome(), sessionId: '' }]) assert.throws(() => ledger.receive(bad));
  for (let i = 0; i < 5000; i++) ledger.receive(outcome(i));
  assert.equal(ledger.seen.size, 4096);
});

test('invalid snapshots are rejected before replacing live pending state; capacity stays bounded', () => {
  const ledger = new RemoteNoticeLedger(), old = item(); ledger.baseline([old]);
  for (const bad of [[old, old], [{ ...old, kind: 'arbitrary' }], Array.from({ length: 257 }, () => item())]) {
    assert.throws(() => ledger.baseline(bad)); assert.equal(ledger.pending.size, 1);
  }
  assert.throws(() => ledger.receive({ type: 'pending', item: { ...old, sessionId: 'wrong-session' } }));
  ledger.baseline(Array.from({ length: 256 }, () => item()));
  assert.throws(() => ledger.receive({ type: 'pending', item: item() }));
  assert.equal(ledger.pending.size, 256);
});

function fixture(ledger = new RemoteNoticeLedger()) {
  const listeners = new Set(), requests = [], changes = [];
  let state = { connectionState: 'connected' };
  const model = { capabilityGeneration: 'g1', transport: { capabilities: { taskNotifications: true } },
    getSnapshot: () => state, publish(patch) { state = { ...state, ...patch }; for (const fn of [...listeners]) fn(); },
    subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); },
    client: { request(operation, event, end) {
      const completion = Promise.withResolvers(), req = { operation, event, end, completion, cancelled: 0 };
      requests.push(req); return { promise: completion.promise, cancel() { req.cancelled++; completion.resolve(); } };
    } } };
  const off = watchTaskNotifications(model, ledger, change => changes.push(change));
  return { ledger, model, changes, requests, off, state: () => state, listeners };
}

test('stream follows capabilities and connection generation, rejects stale deliveries and never replays writes', async () => {
  const f = fixture(), first = f.requests[0], old = item();
  assert.deepEqual(first.operation, { method: 'remote.taskFollow' });
  first.event(ready([old])); first.event(outcome());
  assert.equal(f.changes[1].notify, true);
  f.model.publish({ connectionState: 'disconnected' });
  assert.equal(first.cancelled, 1);
  first.event(outcome(8)); await tick(); assert.equal(f.changes.length, 2);
  f.model.capabilityGeneration = 'g2'; f.model.publish({ connectionState: 'connected' });
  const second = f.requests[1]; second.event(ready([old])); second.event(outcome());
  assert.equal(f.changes.at(-1).notify, false);
  f.off(); second.event(outcome(9)); await tick();
  assert.equal(second.cancelled, 1); assert.equal(f.listeners.size, 0); assert.equal(f.changes.length, 4);
  const rebuilt = fixture(f.ledger); rebuilt.requests[0].event(ready([old])); rebuilt.requests[0].event(outcome());
  assert.equal(rebuilt.changes.at(-1).notify, false); rebuilt.off();
});

test('malformed, ended or failed streams expose a notification error without restarting other services', async () => {
  for (const fail of [r => r.event(outcome()), r => r.end(), r => r.completion.reject(Error('overflow')),
    r => { r.event(ready()); r.event(ready()); },
    r => { r.event({ ...ready(), pendingAvailable: false }); r.event({ type: 'pending', item: item() }); }]) {
    const f = fixture(); fail(f.requests[0]); await tick();
    assert.equal(f.state().taskNotifications.status, 'error'); assert.equal(f.requests[0].cancelled, 1);
    f.model.publish({ unrelated: true }); assert.equal(f.requests.length, 1); f.off();
  }
  const f = fixture(); f.model.transport.capabilities = {}; f.model.publish({ connectionState: 'connected' });
  assert.equal(f.requests[0].cancelled, 1); assert.equal(f.requests.length, 1); f.off();
});
