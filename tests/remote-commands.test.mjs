import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { remoteSourceAliases } from '../scripts/remote-source-aliases.mjs';

const root = resolve(import.meta.dirname, '..'), require = createRequire(import.meta.url);
const outfile = resolve(root, 'artifacts/tests/remote-commands.cjs');
await build({ absWorkingDir: root, entryPoints: ['src/remote-commands.mjs'], outfile, bundle: true, platform: 'node', format: 'cjs', logLevel: 'silent',
  alias: remoteSourceAliases(root), nodePaths: [resolve(root, 'node_modules')] });
const { commandDetails, commandAt } = require(outfile);
const call = (args = {}, name = 'pwsh') => ({ callId: 'shell', name, argsRaw: JSON.stringify({ command: 'Write-Output 测试', description: '测试命令', ...args }), time: 1000 });
const result = (text, args = {}, extra = {}) => ({ kind: 'tool-result', callId: 'shell', call: call(args), callTime: 1000, time: 2500,
  content: [{ type: 'text', text }], isError: false, ...extra });

test('实际 shell 格式的非零退出与信号不能被调用成功掩盖，ANSI 输出保留', () => {
  const failed = commandDetails(result('\u001b[31m失败\u001b[0m\n[exit code: 7]', { workdir: 'src/..' }), '/project');
  assert.equal(failed.status, '执行失败');
  assert.equal(failed.cwd, '/project');
  assert.equal(failed.terminal.card.exitCode, 7);
  assert.equal(failed.terminal.card.output, '\u001b[31m失败\u001b[0m');
  assert.equal(commandDetails(result('输出\n[killed by signal: SIGTERM]')).status, '执行失败');
  const empty = commandDetails(result(''));
  assert.equal(empty.status, '已完成'); assert.equal(empty.terminal.card.output, '');
});

test('持久 shell、后台回执、工具失败与未知输入不虚构进程退出', () => {
  const persistent = commandDetails(result('partial output', { description: undefined }));
  assert.equal(persistent.terminal, null); assert.equal(persistent.status, '调用已结束');
  const background = commandDetails(result('started background job 1', { run_in_background: true }));
  assert.equal(background.terminal, null); assert.equal(background.status, '已返回后台任务信息');
  const failure = commandDetails(result('permission denied', {}, { isError: true }));
  assert.equal(failure.terminal, null); assert.equal(failure.status, '调用失败');
  assert.equal(commandDetails({ ...call(), argsRaw: '{' }), null);
  assert.equal(commandDetails(call({}, 'custom-shell')), null);
  assert.equal(commandDetails(null), null);
});

test('详情坐标随当前投影从执行中更新为结束，嵌套调用及会话隔离', () => {
  const target = { sessionId: 'chat', nodeId: 'node', callId: 'shell' };
  const state = { selected: 'chat', conversation: { nodes: new Map([['node', { kind: 'tool-call', data: { root: { callId: 'ptc', subCalls: [call()] } } }]]) } };
  const running = commandDetails(commandAt(state, target));
  assert.equal(running.running, true); assert.equal(running.start, 1000); assert.equal(running.end, null);
  state.conversation.nodes.set('node', { kind: 'tool-call', data: { root: { callId: 'ptc', subCalls: [result('完成')] } } });
  const done = commandDetails(commandAt(state, target));
  assert.equal(done.running, false); assert.equal(done.end, 2500); assert.equal(done.terminal.card.output, '完成');
  assert.equal(commandAt({ ...state, selected: 'another' }, target), null);
  state.conversation.nodes.clear(); assert.equal(commandAt(state, target), null);
});

test('原投影的 interrupted 显示已停止，不把错误正文中的单词当作停止信号', () => {
  for (const code of ['interrupted', 'ABORTED', 'ABORTED_BEFORE_DISPATCH']) {
    const stopped = commandDetails(result('', {}, { isError: true, error: { code } }));
    assert.equal(stopped.status, '已停止'); assert.equal(stopped.running, false);
  }
  assert.equal(commandDetails(result('interrupted', {}, { isError: true, error: { code: 'internal' } })).status, '调用失败');
});
