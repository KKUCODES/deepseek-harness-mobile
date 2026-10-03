import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createRequire } from 'node:module';
import { remoteSourceAliases } from '../scripts/remote-source-aliases.mjs';

const root = resolve(import.meta.dirname, '..'), require = createRequire(import.meta.url);
const originalPath = resolve(root, '../deepseek-harness/packages/client/ui-chat/src/client/conversation-nodes/chat-snapshot-builder.ts');
const output = resolve(root, 'artifacts/tests/remote-navigation-incremental.cjs');
await build({ stdin: { contents: `export { ChatSnapshotBuilder as Adapted } from '@dshm/conversation/chat-snapshot-builder.ts';
  export { ChatSnapshotBuilder as Original } from '${originalPath.replaceAll('\\', '/')}';`, resolveDir: root },
  outfile: output, bundle: true, platform: 'node', format: 'cjs', logLevel: 'silent',
  nodePaths: [resolve(root, 'node_modules')], alias: remoteSourceAliases(root),
  plugins: [{ name: 'count-navigation-derivations', setup(bundler) {
    bundler.onLoad({ filter: /turn-navigation\.ts$/ }, ({ path }) => {
      const source = readFileSync(path, 'utf8'), anchor = '  const loaded = locations.getTurn(turn)';
      assert.equal(source.split(anchor).length, 2);
      const counter = path.includes('artifacts') ? 'adapted' : 'original';
      return { loader: 'ts', contents: source.replace(anchor, `  globalThis.__navigationCounts.${counter}++;\n${anchor}`) };
    });
  } }],
});
const { Adapted, Original } = require(output);
const location = turn => ({ kind: 'turn', turn: { turn, status: 'completed', data: new Map() } });
const reply = (turn, text = `回复 ${turn}`) => ({ key: `reply-${turn}`, id: `${turn}`, target: 'chat',
  kind: 'assistant-step', anchorSeq: turn * 10 + 1, visibility: 'visible', location: location(turn),
  data: { status: 'completed', turn, step: 1, blocks: [{ kind: 'text', text }] } });
const timeline = order => ({ turnOrder: order, turns: new Map(order.map(turn => [turn, location(turn).turn])) });
const snapshot = value => ({ order: [...value.order], navigation: [...value.navigation.items()],
  turns: value.timeline.turnOrder.map(turn => [turn, [...value.locations.getTurn(turn)]]),
  legacy: value.legacy, nodes: value.nodes.values() });

test('追加新轮次和仅更新时间线时，不重新推导未变历史轮次', () => {
  globalThis.__navigationCounts = { adapted: 0, original: 0 };
  const adapted = new Adapted(), original = new Original();
  const turns = Array.from({ length: 200 }, (_, i) => i + 1);
  const initial = { nodes: turns.map(turn => reply(turn)), timeline: timeline(turns) };
  const first = adapted.replace(initial); original.replace(initial);
  const kept = first.navigation.items()[0];
  globalThis.__navigationCounts = { adapted: 0, original: 0 };
  const input = { upserts: [reply(201)], timeline: timeline([...turns, 201]) };
  const next = adapted.apply(input), expected = original.apply(input);
  assert.deepEqual(snapshot(next), snapshot(expected));
  assert.equal(next.navigation.items()[0], kept);
  assert.equal(globalThis.__navigationCounts.original, 201, '对照必须经过上游原导航重建路径');
  assert.ok(globalThis.__navigationCounts.adapted <= 1, `新增一轮不应重算 ${globalThis.__navigationCounts.adapted} 轮`);
  globalThis.__navigationCounts.adapted = 0;
  const boundary = { upserts: [], timeline: timeline([...turns, 201].reverse()) };
  assert.deepEqual(snapshot(adapted.apply(boundary)), snapshot(original.apply(boundary)));
  assert.equal(globalThis.__navigationCounts.adapted, 0);
});

test('内容、锚点、移动、隐藏、时间线移除恢复与整页替换保持原投影语义', () => {
  globalThis.__navigationCounts = { adapted: 0, original: 0 };
  const adapted = new Adapted(), original = new Original();
  let order = [1, 2, 3], current = timeline(order);
  const compare = (method, input) => assert.deepEqual(snapshot(adapted[method](input)), snapshot(original[method](input)));
  compare('replace', { nodes: order.map(turn => reply(turn)), timeline: current });
  compare('apply', { upserts: [reply(1, '流式内容发生变化')], timeline: current });
  compare('apply', { upserts: [{ ...reply(1, '锚点变化但仍在原轮次'), anchorSeq: 12 }], timeline: current });
  compare('apply', { upserts: [{ ...reply(1, '跨轮次移动'), location: location(2) }], timeline: current });
  compare('apply', { upserts: [{ ...reply(2), visibility: 'hidden' }], timeline: current });
  compare('apply', { upserts: [reply(2, '重新显示')], timeline: current });
  const prompt = text => ({ ...reply(3), key: 'prompt-3', kind: 'user', anchorSeq: 30,
    data: { kind: 'user', seq: 30, content: [{ type: 'text', text }] } });
  compare('apply', { upserts: [prompt('原问题')], timeline: current });
  compare('apply', { upserts: [prompt('更新问题')], timeline: current });
  compare('apply', { upserts: [{ ...reply(3), kind: 'plugin-note', data: { text: '改为插件节点' } }], timeline: current });
  compare('apply', { upserts: [], timeline: timeline([3]) });
  compare('apply', { upserts: [], timeline: current });
  compare('replace', { nodes: [reply(2, '整页替换同名节点')], timeline: timeline([2]) });
  // 固定序列覆盖多个内容/结构变化合并提交，以及更新不在时间线中的轮次。
  for (let i = 0; i < 120; i++) {
    order = i % 7 === 0 ? [5, 3, 1] : [1, 2, 3, 4, 5];
    if (i % 3 === 0) current = timeline(order);
    const turn = i % 5 + 1;
    const node = { ...reply(turn, `变化 ${i}`), visibility: i % 4 === 0 ? 'hidden' : 'visible',
      location: location(i % 6 === 0 ? 5 : turn), anchorSeq: i % 8 === 0 ? i : turn * 10 + 1 };
    compare('apply', { upserts: [node, reply(6, `未入时间线 ${i}`)], timeline: current });
  }
});
