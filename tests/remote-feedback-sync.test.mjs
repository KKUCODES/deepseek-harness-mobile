import test from 'node:test';
import assert from 'node:assert/strict';
import { feedbackObservable } from '../src/remote-feedback-sync.mjs';

const tick = () => new Promise(resolve => setImmediate(resolve));
function fixture() {
  const listeners = new Set();
  let snapshot = { revision: 0, change: { kind: 'replace', entries: [] } }, calls = 0, pending;
  const events = { getSnapshot: () => snapshot, subscribe: listener => { listeners.add(listener); return () => listeners.delete(listener); } };
  const controller = { getSnapshot: () => 'original', subscribe: () => () => {}, resync: async () => { calls++; await pending; } };
  return { observable: feedbackObservable(controller, events, 'one'), calls: () => calls, listeners,
    hold: () => { const waiting = Promise.withResolvers(); pending = waiting.promise; return waiting.resolve; },
    emit(change) { snapshot = { revision: snapshot.revision + 1, change }; for (const listener of listeners) listener(); },
  };
}
const feedback = (sessionId = 'one', type = 'feedback/message-put') => ({ kind: 'append', entries: [{ type: 'event', event: { type, data: { sessionId } } }] });

test('touch mount reads once for all rows; feedback changes refresh but tokens/history/unrelated sessions do not', async () => {
  const f = fixture(), off1 = f.observable.subscribe(() => {}), off2 = f.observable.subscribe(() => {});
  await tick(); assert.equal(f.calls(), 1); assert.equal(f.listeners.size, 1);
  f.emit(feedback('other')); f.emit(feedback('one', 'assistant/message')); f.emit({ kind: 'prepend', entries: feedback().entries });
  await tick(); assert.equal(f.calls(), 1);
  f.emit(feedback()); f.emit(feedback('one', 'feedback/message-delete'));
  await tick(); assert.equal(f.calls(), 2);
  f.emit({ kind: 'replace', entries: [] }); await tick(); assert.equal(f.calls(), 3);
  off1(); assert.equal(f.listeners.size, 1); off2(); assert.equal(f.listeners.size, 0);
});

test('changes arriving during a read are not lost and queued reads stop after last observer leaves', async () => {
  const f = fixture(), release = f.hold(), off = f.observable.subscribe(() => {});
  await tick(); f.emit(feedback()); f.emit(feedback()); release(); await tick();
  assert.equal(f.calls(), 2);
  const releaseAgain = f.hold(); f.emit(feedback()); await tick(); f.emit(feedback()); off(); releaseAgain(); await tick();
  assert.equal(f.calls(), 3); assert.equal(f.listeners.size, 0);
  const offAgain = f.observable.subscribe(() => {}); await tick(); assert.equal(f.calls(), 4); offAgain();
});

test('cold notifications share the original serialized refresh and are released with the last visible row', async () => {
  let notify, watches = 0, stops = 0, reads = 0;
  const events = { getSnapshot: () => ({ revision: 0 }), subscribe: () => () => {} };
  const controller = { getSnapshot: () => ({}), subscribe: () => () => {}, resync: async () => { reads++; } };
  const observable = feedbackObservable(controller, events, 'cold', changed => { watches++; notify = changed; return () => { stops++; }; });
  const off1 = observable.subscribe(() => {}), off2 = observable.subscribe(() => {});
  await tick(); assert.equal(watches, 1); assert.equal(reads, 1);
  notify(); await tick(); assert.equal(reads, 2);
  off1(); assert.equal(stops, 0); off2(); assert.equal(stops, 1);
  notify(); await tick(); assert.equal(reads, 2);
});
