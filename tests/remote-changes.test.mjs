import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { remoteSourceAliases } from '../scripts/remote-source-aliases.mjs';

const root = resolve(import.meta.dirname, '..'), require = createRequire(import.meta.url);
const output = resolve(root, 'artifacts/tests/remote-changes.cjs');
await build({ entryPoints: ['src/remote-changes.mjs'], absWorkingDir: root, outfile: output, bundle: true, platform: 'node', format: 'cjs', logLevel: 'silent',
  alias: remoteSourceAliases(root), nodePaths: [resolve(root, 'node_modules')] });
const { readChanges, remoteChangesDefinition, closingFileMentions } = require(output);
const coordinates = { sessionId: 'original', seq: 2, index: 0 };
const diff = { kind: 'text', path: 'a.txt', display: 'a.txt', before: true, after: true, coarse: false,
  hunks: [{ oldStart: 1, oldLines: 1, newStart: 1, newLines: 1, lines: ['-旧内容', '+新内容'] }] };
function fixture({ alteration, fail } = {}) {
  let cancelled = false, finish, event;
  const model = { transport: { capabilities: { channels: ['changes'] } }, client: {
    call: async () => {},
    request: (operation, accept) => {
      assert.deepEqual(operation, { method: 'remote.changes', ...coordinates }); event = accept;
      const promise = new Promise((resolve, reject) => { finish = () => fail ? reject(new Error('remote_changes_failed')) : resolve(); });
      return { id: 'stream', promise, cancel: () => { cancelled = true; } };
    },
  } };
  const emit = () => {
    event({ type: 'metadata', ...coordinates, ...alteration });
    const bytes = Buffer.from(JSON.stringify(diff));
    // 每字节分片强制跨中文 UTF-8 边界。
    for (let offset = 0; offset < bytes.length; offset++) event({ type: 'chunk', offset, data: bytes.subarray(offset, offset + 1).toString('base64') });
  };
  return { model, emit, finish: () => finish(), cancelled: () => cancelled };
}

test('差异流保留中文和原坐标，完整成功前不发布，最终失败清理', async () => {
  const f = fixture(); let published = false;
  const work = readChanges(f.model, coordinates, new AbortController().signal).then(value => { published = true; return value; });
  f.emit(); await new Promise(resolve => setImmediate(resolve)); assert.equal(published, false);
  f.finish(); assert.deepEqual(await work, diff); assert.equal(f.cancelled(), true);
  const bad = fixture({ fail: true }), failed = readChanges(bad.model, coordinates, new AbortController().signal);
  bad.emit(); bad.finish(); await assert.rejects(failed, /remote_changes_failed/); assert.equal(bad.cancelled(), true);
});

test('差异拒绝其他记录坐标，取消后迟到结果不能复活', async () => {
  for (const alteration of [{ sessionId: 'other' }, { seq: 3 }, { index: 1 }]) {
    const f = fixture({ alteration }), work = readChanges(f.model, coordinates, new AbortController().signal);
    f.emit(); f.finish(); await assert.rejects(work, /remote_changes_invalid/); assert.equal(f.cancelled(), true);
  }
  const f = fixture(), controller = new AbortController(), work = readChanges(f.model, coordinates, controller.signal);
  controller.abort(); f.emit(); f.finish(); await assert.rejects(work, { name: 'AbortError' }); assert.equal(f.cancelled(), true);
});

test('复用原公告归并，旧轮次/工具数据不会冒充当前轮差异', () => {
  const start = { event: { type: 'turn/start', data: { turn: 3 } } };
  let state = remoteChangesDefinition.start({}, start);
  assert.equal(remoteChangesDefinition.buildViewNode({ state }), null, '工具事实不自动生成整轮差异入口');
  assert.equal(remoteChangesDefinition.match({ type: 'workspace/changes', data: { turn: -1 } }), null);
  state = remoteChangesDefinition.update({ state }, { event: { type: 'workspace/changes', seq: 7, data: { turn: 3 } } });
  state = remoteChangesDefinition.update({ state }, { event: { type: 'workspace/changes', seq: 9, data: { turn: 3 } } });
  const node = remoteChangesDefinition.buildViewNode({ state, key: 'turn3', id: '3', matches: [] });
  assert.deepEqual(node.data, { turn: 3, seq: 9 }); assert.equal(node.kind, 'remote-changes');
});

test('文件引用仅匹配本轮成功写入和已交付路径，拒绝失败、歧义和较晚结果', () => {
  let state = remoteChangesDefinition.start({}, { event: { type: 'turn/start', data: { turn: 1 } } });
  let seq = 0;
  const emit = (type, data, surfaceOp) => {
    const event = { seq: ++seq, type, data, surfaceOp };
    assert.ok(remoteChangesDefinition.match(event));
    state = remoteChangesDefinition.update({ state }, { event });
  };
  for (const [callId, path, isError] of [['a', '/one/report.txt', false], ['b', '/two/report.txt', false], ['c', '/one/failed.txt', true], ['d', '/one/unique.txt', false]]) {
    emit('tool/call', { turn: 1, step: 1, callId, name: 'write', arguments: JSON.stringify({ file_path: path, content: 'test' }) });
    emit('tool/result', { turn: 1, step: 1, message: { source: { kind: 'tool', callId }, content: [{ type: 'tool-result', content: [{ type: 'text', text: 'result' }], isError }] } }, 'append');
  }
  emit('deliverables/presented', { turn: 1, callId: 'p', files: [{ path: '/one/delivery.txt' }] });
  const opened = [], owner = { seq: seq + 1, turn: { data: { get: () => state } }, openFile: path => opened.push(path) };
  const mentions = closingFileMentions(owner, path => path);
  assert.equal(mentions.resolve('report.txt'), undefined);
  assert.equal(mentions.resolve('failed.txt'), undefined);
  assert.equal(mentions.resolve('unknown.txt'), undefined);
  mentions.resolve('/two/report.txt').open(); mentions.resolve('unique.txt').open(); mentions.resolve('delivery.txt').open();
  assert.deepEqual(opened, ['/two/report.txt', '/one/unique.txt', '/one/delivery.txt']);
  assert.equal(closingFileMentions({ ...owner, seq: 1 }, path => path), undefined);
  assert.equal(closingFileMentions({ ...owner, turn: { data: { get: () => undefined } } }, path => path), undefined);
});

test('交付文件由原事件产生，保留过滤前索引，不从模型正文伪造电脑打开坐标', () => {
  let state = remoteChangesDefinition.start({}, { event: { type: 'turn/start', data: { turn: 2 } } });
  const event = { type: 'deliverables/presented', seq: 8, data: { turn: 2, callId: 'call', files: [null, { path: '/project/result.txt', description: '报告' }] } };
  assert.ok(remoteChangesDefinition.match(event));
  state = remoteChangesDefinition.update({ state }, { event });
  const node = remoteChangesDefinition.buildViewNode({ state, key: 'turn2', id: '2', matches: [] });
  assert.equal(node.data.seq, undefined);
  assert.deepEqual(node.data.presented, [{ path: '/project/result.txt', description: '报告', seq: 8, index: 1 }]);
  assert.equal(remoteChangesDefinition.match({ type: 'assistant/message', data: { text: 'presented result.txt' } }), null);
});
