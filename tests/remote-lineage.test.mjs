import assert from 'node:assert/strict';
import test from 'node:test';
import { sessionLineage, openLineageAncestor } from '../src/remote-lineage.mjs';

const list = { byId: {
  root: { id: 'root', displayTitle: '根', origin: 'session' },
  child: { id: 'child', displayTitle: '子', origin: 'subagent', parentId: 'root' },
  grand: { id: 'grand', displayTitle: '孙', origin: 'subagent', parentId: 'child' },
} };
test('层级只使用真实直接父关系；缺项与环路有界', () => {
  assert.deepEqual(sessionLineage(list, 'grand').map(item => item.id), ['root', 'child', 'grand']);
  assert.deepEqual(sessionLineage(list, 'missing'), []);
  const broken = { byId: { ...list.byId, child: { ...list.byId.child, parentId: 'missing' } } };
  assert.deepEqual(sessionLineage(broken, 'grand').map(item => item.id), ['child', 'grand']);
  broken.byId.child.parentId = 'grand';
  assert.deepEqual(sessionLineage(broken, 'grand').map(item => item.id), ['child', 'grand']);
});
test('祖先导航沿原子会话地址返回并裁剪轨迹；旧回调不导航', async () => {
  const reference = {}, calls = [], lifetime = new AbortController();
  const child = { parentSessionId: 'root', childSessionId: 'child', mode: 'continuable' };
  const state = { list, selected: 'grand', selectionTrail: ['root', child] };
  const model = { reference, lifetime, getSnapshot: () => state, select: (...args) => calls.push(args) };
  await openLineageAncestor(model, reference, 'child');
  assert.deepEqual(calls.pop(), [child, { trail: ['root'] }]);
  await openLineageAncestor(model, reference, 'root');
  assert.deepEqual(calls.pop(), ['root', { trail: [] }]);
  await assert.rejects(openLineageAncestor(model, reference, 'grand'));
  await assert.rejects(openLineageAncestor(model, {}, 'root'));
  state.selected = 'root';
  await assert.rejects(openLineageAncestor(model, reference, 'child'));
  state.selected = 'grand'; lifetime.abort();
  await assert.rejects(openLineageAncestor(model, reference, 'root'));
  assert.deepEqual(calls, []);
});
