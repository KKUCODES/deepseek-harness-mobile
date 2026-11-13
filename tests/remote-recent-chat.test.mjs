import test from 'node:test';
import assert from 'node:assert/strict';
import { RemoteRecentChats } from '../src/remote-recent-chat.mjs';

function snapshot(target, count = 1, text = '回复') {
  const selected = typeof target === 'string' ? target : target.childSessionId;
  const order = Array.from({ length: count }, (_, index) => String(index));
  const nodes = new Map(order.map((key, index) => [key, { key, kind: 'assistant-step', anchorSeq: index,
    data: { text, turn: index }, location: { turn: { turn: index, data: { subscribe() {} } } } }]));
  return { selected, selectedTarget: target, conversation: { order, nodes }, session: { openState: 'open', pendingSubmissions: ['draft'] } };
}

test('最近会话只保留有界正文，超大记录与过期条目沿用冷读', t => {
  t.mock.timers.enable({ apis: ['Date'], now: 1 });
  const cache = new RemoteRecentChats();
  for (const id of ['a', 'b', 'c', 'd']) cache.remember(snapshot(id, 200), null);
  assert.equal(cache.take('a'), undefined);
  const warm = cache.take('d');
  assert.equal(warm.groups.length, 24);
  assert.equal(warm.groups.at(-1).id, 'turn:199');
  assert.deepEqual(warm.groups.at(-1).nodes[0], { key: '199', kind: 'assistant-step', data: { text: '回复', turn: 199 } });
  assert.equal(cache.take('d'), undefined);
  cache.remember(snapshot('huge', 1, '大'.repeat(512 * 1024)), null);
  assert.equal(cache.take('huge'), undefined);
  t.mock.timers.tick(10 * 60 * 1000);
  assert.equal(cache.take('b'), undefined);
});

test('缓存按完整会话地址隔离，并可按会话删除或清空', () => {
  const cache = new RemoteRecentChats();
  const target = { parentSessionId: 'parent', childSessionId: 'child', mode: 'continuable' };
  const anchor = { selected: 'child', group: 'turn:20', nodeKey: '20', seq: 20, offset: 8 };
  cache.remember(snapshot(target, 70), anchor);
  assert.equal(cache.take('child'), undefined);
  assert.equal(cache.take({ ...target, mode: 'one-shot' }), undefined);
  assert.equal(cache.take({ ...target, parentSessionId: 'another' }), undefined);
  const warm = cache.take(target);
  assert.deepEqual(warm.anchor, anchor);
  assert.ok(warm.groups.some(group => group.id === anchor.group));
  cache.remember(snapshot(target), null);
  cache.forget('child');
  assert.equal(cache.take(target), undefined);
  cache.remember(snapshot('one'), null);
  cache.clear();
  assert.equal(cache.take('one'), undefined);
});
