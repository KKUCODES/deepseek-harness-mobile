import test from 'node:test';
import assert from 'node:assert/strict';
import { turnForkAnchor } from '../src/remote-forks.mjs';

test('原轮尾规则拒绝后续聊天节点/缺失结尾/不可用分支，保留中断节点坐标', () => {
  const node = { kind: 'turn-tail', data: { turn: 3, closing: { finalNode: { seq: 8.1 } }, branchUnavailable: false } };
  const order = ['tail'];
  const conversation = { nodes: new Map([['tail', node]]), locations: { getTurn: () => order } };
  assert.equal(turnForkAnchor(conversation, 'tail'), 8.1);
  conversation.nodes.set('changes', { kind: 'remote-changes' }); order.push('changes');
  assert.equal(turnForkAnchor(conversation, 'tail'), 8.1); order.pop();
  order.push('extension'); assert.equal(turnForkAnchor(conversation, 'tail'), null); order.pop();
  node.data.branchUnavailable = true; assert.equal(turnForkAnchor(conversation, 'tail'), null);
  node.data.branchUnavailable = false; node.data.closing = null; assert.equal(turnForkAnchor(conversation, 'tail'), null);
  assert.equal(turnForkAnchor(conversation, 'not-loaded'), null);
  assert.equal(turnForkAnchor(null, 'tail'), null);
});
