import test from 'node:test';
import assert from 'node:assert/strict';
import { schedulePluginFrameMeasurement as schedule } from '../src/plugin-frame-measurement.mjs';

function windowFrames() {
  const pending = new Map(), microtasks = []; let id = 0;
  return { requestAnimationFrame(fn) { pending.set(++id, fn); return id; }, cancelAnimationFrame(key) { pending.delete(key); },
    queueMicrotask(fn) { microtasks.push(fn); }, flushMicrotasks() { microtasks.splice(0).forEach(fn => fn()); },
    flush() { const frames = [...pending.values()]; pending.clear(); frames.forEach(fn => fn()); }, get size() { return pending.size; } };
}
test('one frame reads all plugin boxes before committing any size', () => {
  const view = windowFrames(), calls = [];
  for (let id = 0; id < 3; id++) schedule(view, () => { calls.push(`read${id}`); return id; }, size => calls.push(`write${size}`));
  assert.equal(view.size, 1); view.flush();
  assert.deepEqual(calls, ['read0', 'read1', 'read2', 'write0', 'write1', 'write2']);
});
test('initial commit batches measurements before a pending history animation frame', () => {
  const view = windowFrames(), calls = [];
  view.requestAnimationFrame(() => calls.push('history'));
  schedule(view, () => { calls.push('read1'); return 1; }, value => calls.push(`write${value}`));
  schedule(view, () => { calls.push('read2'); return 2; }, value => calls.push(`write${value}`), true);
  view.flushMicrotasks(); view.flush();
  assert.deepEqual(calls, ['read1', 'read2', 'write1', 'write2', 'history']);
});
test('unmounted or disabled frame cannot commit even if another commit disposes it', () => {
  const view = windowFrames(), calls = [];
  schedule(view, () => 1, () => cancel());
  const cancel = schedule(view, () => 2, value => calls.push(value));
  view.flush(); assert.deepEqual(calls, []);
  const off = schedule(view, () => { throw Error('disposed read'); }, () => {});
  off(); assert.equal(view.size, 0);
});
test('resizing during commit waits for next frame and windows keep separate queues', () => {
  const one = windowFrames(), two = windowFrames(), calls = [];
  schedule(one, () => 1, value => { calls.push(value); schedule(one, () => 3, value => calls.push(value)); });
  schedule(two, () => 2, value => calls.push(value));
  one.flush(); assert.deepEqual(calls, [1]);
  two.flush(); one.flush(); assert.deepEqual(calls, [1, 2, 3]);
});
