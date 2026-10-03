import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { remoteSourceAliases } from '../scripts/remote-source-aliases.mjs';
import { changesSummaryUrl, changesDiffUrl } from '../../deepseek-harness/packages/client/ui-deliverables/src/changes.ts';

const root = resolve(import.meta.dirname, '..'), require = createRequire(import.meta.url);
const output = resolve(root, 'artifacts/tests/remote-review-store.cjs');
await build({ entryPoints: ['src/remote-review-store.mjs'], absWorkingDir: root, outfile: output, bundle: true, platform: 'node', format: 'cjs', logLevel: 'silent',
  alias: remoteSourceAliases(root), nodePaths: [resolve(root, 'node_modules')] });
const { RemoteReviewStore } = require(output);

const summary = { turn: 2, files: [{ path: 'a.txt' }], total: 1, added: 1, deleted: 1 };
const summaryKey = changesSummaryUrl('one', 3), diffKey = changesDiffUrl('one', 3, 0);
const model = () => ({ lifetime: new AbortController() });

test('摘要和差异按会话/记录去重，差异先核对摘要中的文件', async () => {
  const calls = [], store = new RemoteReviewStore(model(), async (_model, coordinates) => {
    calls.push(coordinates);
    return coordinates.index === undefined ? summary : { path: 'a.txt', kind: 'text' };
  });
  await Promise.all([store.loadDiff('one', 3, 0), store.loadDiff('one', 3, 0)]);
  await store.loadSummary('one', 3);
  assert.equal(calls.length, 2);
  assert.deepEqual(store.diffs.getSnapshot()[diffKey], { path: 'a.txt', kind: 'text' });
  await store.loadSummary('two', 3);
  assert.equal(calls.length, 3);
  await store.loadDiff('one', 3, 9);
  assert.equal(calls.length, 3);
  await store.dispose();
});

test('网络失败可重试；不存在保持缺失；错文件差异不显示', async () => {
  let attempt = 0;
  const store = new RemoteReviewStore(model(), async (_model, coordinates) => {
    if (coordinates.seq === 9) throw new Error('remote_changes_missing');
    if (coordinates.index !== undefined) return { path: 'other.txt' };
    if (++attempt === 1) throw new Error('offline');
    return summary;
  });
  await store.loadSummary('one', 3);
  assert.equal(store.summaries.getSnapshot()[summaryKey], 'error');
  await store.loadDiff('one', 3, 0);
  assert.equal(store.diffs.getSnapshot()[diffKey], 'error');
  assert.equal(store.errors.getSnapshot()[diffKey].message, 'remote_changes_invalid');
  await store.loadSummary('one', 9);
  assert.equal(store.summaries.getSnapshot()[changesSummaryUrl('one', 9)], 'missing');
  await store.dispose();
});

test('换连接和销毁淘汰迟到结果，旧finally不能清除新请求', async () => {
  const reads = [], store = new RemoteReviewStore(model(), (_model, _coordinates, signal) => new Promise(resolve => reads.push({ resolve, signal })));
  const first = store.loadSummary('one', 3);
  store.reset(); assert.equal(reads[0].signal.aborted, true);
  const second = store.loadSummary('one', 3);
  reads[0].resolve({ ...summary, turn: 1 }); await first;
  assert.equal(store.summaries.getSnapshot()[summaryKey], 'loading');
  assert.equal(store.pending.get(summaryKey), second);
  reads[1].resolve(summary); await second;
  assert.equal(store.summaries.getSnapshot()[summaryKey].turn, 2);
  store.reset(); const last = store.loadSummary('one', 3), disposed = store.dispose();
  assert.equal(reads[2].signal.aborted, true);
  reads[2].resolve(summary); await last; await disposed;
  await store.loadSummary('two', 3); assert.equal(reads.length, 3);
});

test('旧连接等待摘要的差异请求不能在重连后继续读取', async () => {
  const reads = [], store = new RemoteReviewStore(model(), (_model, coordinates) => new Promise(resolve => reads.push({ resolve, coordinates })));
  const old = store.loadDiff('one', 3, 0);
  store.reset();
  const current = store.loadSummary('one', 3);
  reads[1].resolve(summary); await current;
  reads[0].resolve(summary); await old;
  assert.equal(reads.length, 2);
  assert.equal(store.diffs.getSnapshot()[diffKey], undefined);
  await store.dispose();
});
