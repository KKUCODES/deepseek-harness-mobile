import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { remoteSourceAliases } from '../scripts/remote-source-aliases.mjs';

const root = resolve(import.meta.dirname, '..'), outfile = resolve(root, 'artifacts/tests/remote-job-output.cjs');
await build({ absWorkingDir: root, entryPoints: ['src/remote-job-output.mjs'], outfile, bundle: true, platform: 'node', format: 'cjs', logLevel: 'silent', alias: remoteSourceAliases(root) });
const { jobOutputRecords } = createRequire(import.meta.url)(outfile);
const target = { id: 'job-1', startedAt: 100 };
const call = (id, time = 110, jobId = target.id) => ({ callId: id, name: 'job_output', argsRaw: JSON.stringify({ job_id: jobId }), time });
const result = (id, text, time = 110, extra = {}) => ({ kind: 'tool-result', callId: id, call: call(id, time), callTime: time, time: time + 10,
  content: [{ type: 'text', text }], isError: false, ...extra });
const state = roots => ({ selected: 'one', list: { jobsBySession: { one: [target] } }, conversation: {
  order: roots.map((_, i) => String(i)), nodes: new Map(roots.map((root, i) => [String(i), { kind: 'tool-call', data: { root } }])) } });

test('任务归属、重用编号和不完整调用头不得误关联旧记录', () => {
  const value = state([result('old', 'old', 90), result('unknown', 'unknown', null), result('nohead', 'unknown', 110, { call: null }),
    { ...call('other', 110, 'other') }, { ...call('bad'), argsRaw: '{' }, result('current', 'valid')]);
  assert.deepEqual(jobOutputRecords(value, 'one', target).map(r => r.text), ['valid']);
  assert.equal(jobOutputRecords(value, 'two', target), null);
  assert.equal(jobOutputRecords(value, 'one', { ...target, startedAt: 500 }), null);
  assert.equal(jobOutputRecords({ ...value, list: null }, 'one', target), null);
});

test('嵌套调用、分段与重复终态保留独立记录，按实际调用时间排序', () => {
  const value = state([result('last', 'same final', 140), { ...call('parent'), name: 'exec', subCalls: [result('nested', '\u001b[31msegment\u001b[0m\n[output truncated]', 120)] },
    result('first', 'same final', 130)]);
  const records = jobOutputRecords(value, 'one', target);
  assert.deepEqual(records.map(r => r.started), [120, 130, 140]);
  assert.equal(records[0].text, '\u001b[31msegment\u001b[0m\n[output truncated]');
  assert.equal(records.filter(r => r.text === 'same final').length, 2);
  assert.equal(new Set(records.map(r => r.key)).size, 3);
});

test('同一个调用由等待变为真实失败，不将读取成功当作进程完成', () => {
  const pending = jobOutputRecords(state([call('read')]), 'one', target)[0];
  const failed = jobOutputRecords(state([result('read', 'permission denied', 110, { isError: true })]), 'one', target)[0];
  assert.equal(pending.key, failed.key);
  assert.equal(pending.settled, false); assert.equal(failed.settled, true); assert.equal(failed.failed, true);
  assert.equal(jobOutputRecords(state([result('read', '(no new output)\n[status: running]')]), 'one', target)[0].failed, false);
});

test('隐藏聊天记录不泄露到任务详情；投影读取不改变状态', () => {
  const value = state([result('hidden', 'secret'), result('visible', 'public')]);
  value.conversation.nodes.get('0').visibility = 'hidden';
  const before = structuredClone(value);
  assert.deepEqual(jobOutputRecords(value, 'one', target).map(r => r.text), ['public']);
  assert.deepEqual(value, before);
});

test('停止输出读取与读取失败分开，不改变后台任务本身的状态', () => {
  for (const code of ['ABORTED', 'ABORTED_BEFORE_DISPATCH']) {
    const record = jobOutputRecords(state([result('abort', 'tool call aborted', 110, { isError: true, error: { code } })]), 'one', target)[0];
    assert.equal(record.interrupted, true); assert.equal(record.failed, false);
  }
  const value = state([result('stop', '', 110, { isError: true, error: { code: 'interrupted' } }), result('failure', 'interrupted', 120, { isError: true })]);
  const records = jobOutputRecords(value, 'one', target);
  assert.equal(records[0].interrupted, true); assert.equal(records[0].failed, false); assert.equal(records[0].settled, true);
  assert.equal(records[1].interrupted, false); assert.equal(records[1].failed, true);
  assert.deepEqual(value.list.jobsBySession.one, [target]);
});
