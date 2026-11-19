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

function toolSnapshot(target, args) {
  const root = {
    kind: 'tool-result', callId: 'call-1', name: 'read', isError: false,
    args, call: { name: 'read', argsRaw: '{"file_path":"C:\\\\work\\\\a.txt"}' },
    callTime: 1, time: 2, content: [], subCalls: [],
  };
  const node = { key: 'tool-1', kind: 'tool-call', anchorSeq: 1, data: { root } };
  return { selected: target, selectedTarget: target, conversation: { order: ['tool-1'], nodes: new Map([['tool-1', node]]) },
    session: { openState: 'open', pendingSubmissions: [] } };
}

test('缓存的工具参数恢复为可读取的只读视图，工具行不再因缺少方法抛错', () => {
  const cache = new RemoteRecentChats();
  cache.remember(toolSnapshot('tools', { object: { file_path: 'C:\\work\\a.txt' }, chunks: [], sealed: true }), null);
  const args = cache.take('tools').groups[0].nodes[0].data.root.args;
  assert.equal(args.isSealed, true);
  assert.equal(args.invalid, false);
  assert.equal(args.closed(), true);
  assert.deepEqual(args.keys(), ['file_path']);
  assert.equal(args.has('file_path'), true);
  assert.equal(args.has('missing'), false);
  assert.equal(args.complete('file_path'), true);
  assert.equal(args.complete('missing'), false);
  assert.equal(args.text('file_path'), 'C:\\work\\a.txt');
  assert.equal(args.text('missing'), undefined);
  assert.equal(args.textPrefix('file_path', 2), 'C:');
  assert.equal(args.stringLength('file_path'), 13);
  assert.equal(args.stringExceeds('file_path', 3), true);
  assert.equal(args.value('file_path'), undefined);
  assert.equal(args.refresh(), false);
  assert.throws(() => args.append('{}'));
});

test('缓存里由流式片段拼出的参数与已解析对象读法一致', () => {
  const cache = new RemoteRecentChats();
  cache.remember(toolSnapshot('stream', { chunks: ['{"file_', 'path":"b.txt"}'], sealed: true }), null);
  const args = cache.take('stream').groups[0].nodes[0].data.root.args;
  assert.equal(args.complete('file_path'), true);
  assert.equal(args.text('file_path'), 'b.txt');
  assert.equal(args.value('file_path'), undefined);
});
