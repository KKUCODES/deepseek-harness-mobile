import test from 'node:test';
import assert from 'node:assert/strict';
import { RemoteReadingMemory } from '../src/remote-reading-memory.mjs';

test('阅读位置隔离设备与来源，只保存地址和游标，损坏、过期或跨会话目标不恢复', () => {
  const rows = new Map(), storage = () => ({ getItem: key => rows.get(key) ?? null, setItem: (key, value) => rows.set(key, value) });
  const first = new RemoteReadingMemory('device-a', storage), other = new RemoteReadingMemory('device-b', storage);
  first.remember('one', 'one', { seq: 120, group: 'turn:24', offset: 15 });
  assert.equal(first.read().seq, 120); assert.equal(other.read(), undefined);
  assert.deepEqual(Object.keys(first.read()).sort(), ['at', 'group', 'offset', 'selected', 'seq', 'target']);
  const key = [...rows.keys()][0], valid = rows.get(key);
  for (const patch of [{ at: 1 }, { at: null }, { at: Date.now() + 10000 }, { seq: 1.1 }, { offset: Infinity }, { group: null }, { target: 'other' }, { target: { childSessionId: 'other', parentSessionId: 'parent', mode: 'one-shot' } }]) {
    rows.set(key, JSON.stringify({ ...JSON.parse(valid), ...patch })); assert.equal(first.read(), undefined);
  }
  rows.set(key, '{broken'); assert.equal(first.read(), undefined);
  const unavailable = new RemoteReadingMemory('a', () => { throw Error('denied'); });
  assert.doesNotThrow(() => unavailable.remember('one', 'one', { seq: 0 })); assert.equal(unavailable.read(), undefined);
});
