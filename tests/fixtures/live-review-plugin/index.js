import assert from 'node:assert/strict';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { join } from 'node:path';
import { createAssistantMessage, createToolResultMessage, createUserMessage } from '@deepseek-ai/dsh-llm';

export const inject = ['agents', 'sessions', 'agentPresets', 'agentDefaultModel', 'sessionController', 'workspaceRegistry', 'workspaceChanges'];
const artifacts = 'Q:/Tanxian/LToys/dsh-mobile/dsh-mobile/artifacts';
const output = join(artifacts, 'review-live-host.json');

/** 受控测试会话事件驱动原快照服务，文件/git/Host读取均真实；不伪称模型执行。 */
export async function apply(ctx) {
  const previous = await readFile(output, 'utf8').then(JSON.parse).catch(error => { if (error.code !== 'ENOENT') throw error; });
  assert.ok(!previous || previous.cleaned, 'Inspect and clean the previous review fixture first');
  const id = randomUUID(), cwd = join(artifacts, `review-workspace-${id}`);
  const report = { at: new Date().toISOString(), title: 'DSHM 整轮改动快照验收', cwd, ready: false, cleaned: false,
    source: 'Controlled session/tool events; original live recorder and actual git/file snapshots; no model request' };
  let workspace, handle;
  const save = () => writeFile(output, JSON.stringify(report, null, 2));
  await save();
  ctx.effect(() => async () => {
    if (handle) { await ctx.workspaceRegistry.archiveSession(handle.agent.id); await handle.dispose(); }
    if (workspace) await ctx.workspaceRegistry.delete(workspace.id);
    report.cleaned = true; await save();
  });
  try {
    await mkdir(cwd);
    const git = (...args) => execFileSync('git', ['-c', 'user.name=DSHM Verification', '-c', 'user.email=verification@example.invalid',
      '-c', 'commit.gpgsign=false', ...args], { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    git('init', '-q', '-b', 'main');
    await writeFile(join(cwd, 'alpha.txt'), 'DSHM_REVIEW_BEFORE\nkeep\n');
    await writeFile(join(cwd, 'beta.txt'), 'DSHM_SECOND_BEFORE\n');
    await writeFile(join(cwd, 'binary.dat'), Buffer.from([0, 1, 2, 3]));
    await writeFile(join(cwd, 'large.txt'), 'large baseline\n');
    git('add', 'alpha.txt', 'beta.txt', 'binary.dat', 'large.txt'); git('commit', '-q', '-m', 'Controlled review baseline');
    workspace = await ctx.workspaceRegistry.create(cwd, 'DSHM 整轮快照测试'); report.workspaceId = workspace.id;
    const preset = await ctx.agentPresets.resolve(undefined), selection = ctx.agentDefaultModel.currentSelection();
    handle = await ctx.agents.create({ sessionId: `session-${id}`, meta: { cwd, agentPreset: preset.id },
      agentOptions: { provider: selection.provider, model: selection.model },
      setup: async agentCtx => { await ctx.agentPresets.mount(agentCtx, preset.id); } });
    const session = handle.agent.session; report.sessionId = session.id; await save();
    await ctx.sessionController.rename({ sessionId: session.id, title: report.title });
    const settle = () => ctx.waterfall('tools/pre-execute', { agent: handle.agent, name: 'dshm_review_verification',
      arguments: {}, signal: new AbortController().signal }, () => Promise.resolve({ kind: 'allow' }));
    session.append('turn/start', { turn: 1 });
    session.append('user/message', createUserMessage({ content: [{ type: 'text', text: 'DSHM 受控快照验收：测试事件，不调用模型。' }],
      source: { kind: 'user' } }), { surfaceOp: 'append' });
    session.append('step/start', { turn: 1, step: 1 });
    await settle();
    await writeFile(join(cwd, 'alpha.txt'), 'DSHM_REVIEW_AFTER\nkeep\nadded\n');
    await writeFile(join(cwd, 'beta.txt'), 'DSHM_SECOND_AFTER\n');
    await writeFile(join(cwd, 'binary.dat'), Buffer.from([0, 4, 5, 6]));
    // 高于原服务默认2 MiB上限；由原服务返回oversized，不手工构造响应。
    await writeFile(join(cwd, 'large.txt'), 'DSHM_LARGE_FILE_LINE\n'.repeat(160000));
    const callId = `review-${id}`, args = JSON.stringify({ command: 'Controlled fixture changed four test files; no shell executed by DSH' });
    session.append('assistant/message', { turn: 1, step: 1, stream: [], message: createAssistantMessage({
      content: [{ type: 'text', text: '受控文件快照验收，非模型生成。' }, { type: 'tool-call', id: callId, name: 'bash', arguments: args }],
      source: { provider: 'dshm-verification', model: 'controlled-events' } }) }, { surfaceOp: 'append' });
    const call = session.append('tool/call', { turn: 1, step: 1, callId, name: 'bash', arguments: args });
    session.append('tool/result', { turn: 1, step: 1, message: createToolResultMessage({ callId,
      content: [{ type: 'text', text: 'Test fixture wrote alpha.txt, beta.txt, binary.dat and large.txt; no model was called.' }], isError: false }) },
      { surfaceOp: 'append', sourceEventSeqs: [call.seq] });
    session.append('step/end', { turn: 1, step: 1 });
    session.append('turn/end', { turn: 1, reason: { kind: 'completed' } }); await settle();
    const event = session.snapshotEvents().find(event => event.type === 'workspace/changes'); assert.ok(event);
    const summary = ctx.workspaceChanges.summary(session.id, event.seq); assert.ok(summary?.snapshot);
    assert.deepEqual(summary.files.map(file => file.path).sort(), ['alpha.txt', 'beta.txt', 'binary.dat', 'large.txt']);
    report.seq = event.seq; report.files = summary.files;
    report.diff = await ctx.workspaceChanges.diff(session.id, event.seq, 0, new AbortController().signal);
    assert.equal(report.diff.kind, 'text');
    report.boundaries = [];
    for (const [path, kind] of [['binary.dat', 'binary'], ['large.txt', 'oversized']]) {
      const index = summary.files.findIndex(file => file.path === path);
      const diff = await ctx.workspaceChanges.diff(session.id, event.seq, index, new AbortController().signal);
      assert.equal(diff.kind, kind); report.boundaries.push(diff);
    }
    // 快照与当前文件刻意不同，手机“最新文件”不得回显快照内容。
    await writeFile(join(cwd, 'alpha.txt'), 'DSHM_REVIEW_LATEST\n');
    assert.equal(await ctx.sessions.flush(session), true); await workspace.attachSession(session.id);
    const listing = await ctx.sessionController.list({}, new AbortController().signal);
    report.listEntry = listing.items.find(item => item.sessionId === session.id) ?? null;
    report.eventTypes = session.snapshotEvents().map(event => ({ seq: event.seq, type: event.type }));
    report.header = session.header;
    report.ready = true; await save();
  } catch (error) { report.failure = error.message; await save(); throw error; }
}
