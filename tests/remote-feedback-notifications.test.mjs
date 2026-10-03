import test from 'node:test';
import assert from 'node:assert/strict';
import { watchFeedback } from '../src/remote-feedback-notifications.mjs';

const tick = () => new Promise(resolve => setImmediate(resolve));
function fixture() {
  const requests = [], errors = [], listeners = new Set(); let generation = 1, changes = 0;
  const model = { connection: { generation: { getSnapshot: () => generation,
    subscribe: listener => { listeners.add(listener); return () => listeners.delete(listener); } } },
  fail: error => errors.push(error.message), client: { request(operation, event, end) {
    const completion = Promise.withResolvers(), request = { operation, event, end, completion, cancelled: 0 };
    requests.push(request); return { promise: completion.promise, cancel() { request.cancelled++; } };
  } } };
  const off = watchFeedback(model, 'cold-session', () => changes++);
  return { requests, errors, listeners, off, changes: () => changes,
    generation(value) { generation = value; for (const listener of listeners) listener(); } };
}

test('cold feedback notifications refresh on ready/change, restart only the subscription and ignore stale connections', async () => {
  const f = fixture(), first = f.requests[0];
  assert.deepEqual(first.operation, { method: 'remote.feedbackFollow', sessionId: 'cold-session' });
  first.event({ type: 'ready', revision: 0 }); first.event({ type: 'changed', revision: 3 });
  assert.equal(f.changes(), 2);
  f.generation(null); assert.equal(first.cancelled, 1);
  first.event({ type: 'changed', revision: 4 }); first.completion.reject(new Error('old connection')); await tick();
  assert.equal(f.changes(), 2); assert.deepEqual(f.errors, []);
  f.generation(2); const second = f.requests[1]; second.event({ type: 'ready', revision: 0 });
  assert.equal(f.changes(), 3);
  f.off(); second.event({ type: 'changed', revision: 1 }); second.end(); await tick();
  assert.equal(second.cancelled, 1); assert.equal(f.listeners.size, 0); assert.equal(f.changes(), 3);
  assert.deepEqual(f.errors, []);
});

test('invalid or ended notifications cancel and expose a retryable error without polling or replaying writes', async () => {
  for (const fail of [request => request.event({ type: 'changed', revision: 1 }), request => request.end(),
    request => request.completion.reject(new Error('denied')), request => { request.event({ type: 'ready', revision: 0 }); request.event({ type: 'changed', revision: 0 }); }]) {
    const f = fixture(), request = f.requests[0]; fail(request); await tick();
    assert.equal(request.cancelled, 1); assert.equal(f.errors.length, 1); assert.equal(f.requests.length, 1);
    f.off();
  }
});
