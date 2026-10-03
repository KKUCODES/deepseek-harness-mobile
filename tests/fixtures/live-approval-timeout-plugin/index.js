import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { join, resolve } from 'node:path';
import { createUserMessage } from '@deepseek-ai/dsh-llm';

export const inject = ['agents', 'sessions', 'agentPresets', 'agentDefaultModel', 'sessionController', 'workspaceRegistry', 'approval', 'userQuestions'];
const artifacts = 'Q:/Tanxian/LToys/dsh-mobile/dsh-mobile/artifacts';
const output = join(artifacts, 'approval-timeout-host.json');
const control = join(artifacts, 'approval-timeout-control.json');

/** 专用会话内调用原 ApprovalService；期限来自请求 signal，不伪造手机卡片或执行工具。 */
export async function apply(ctx) {
  const previous = await readFile(output, 'utf8').then(JSON.parse).catch(error => { if (error.code !== 'ENOENT') throw error; });
  if (previous && !previous.cleaned) {
    // 测试进程被直接终止时不会执行dispose；只恢复报告指向且仍唯一归属本夹具的登记。
    assert.equal(previous.title, 'DSHM 审批超时验收');
    assert.match(previous.sessionId ?? '', /^session-[a-f0-9-]{36}$/);
    const orphan = ctx.workspaceRegistry.get(previous.workspaceId);
    assert.ok(orphan, '缺少原工作区，必须人工核对未完成样例');
    assert.equal(resolve(orphan.path), resolve(artifacts, `approval-workspace-${previous.sessionId.slice(8)}`));
    assert.deepEqual([...orphan.sessionIds], [previous.sessionId]);
    await ctx.workspaceRegistry.archiveSession(previous.sessionId);
    await ctx.workspaceRegistry.delete(previous.workspaceId);
    previous.cleaned = true; previous.recoveredAfterProcessExit = true;
    await writeFile(join(artifacts, `approval-recovered-${previous.sessionId}.json`), JSON.stringify(previous, null, 2));
  }
  const id = randomUUID(), cwd = join(artifacts, `approval-workspace-${id}`);
  const report = { at: new Date().toISOString(), title: 'DSHM 审批超时验收', ready: false, cleaned: false, results: [],
    source: 'Original approval/question services with controlled session turns; timeout/reject use a 30-second deadline, explicit cancellation uses a 180-second fallback; no model or tool execution' };
  const lifetime = new AbortController();
  let workspace, handle, pending, timer, seen, currentRequest;
  const save = () => writeFile(output, JSON.stringify(report, null, 2));
  await save();
  ctx.effect(() => async () => {
    clearInterval(timer); lifetime.abort(); await pending;
    if (handle) { await ctx.workspaceRegistry.archiveSession(handle.agent.id); await handle.dispose(); }
    if (workspace) await ctx.workspaceRegistry.delete(workspace.id);
    report.cleaned = true; await save();
  });
  await mkdir(cwd);
  workspace = await ctx.workspaceRegistry.create(cwd, 'DSHM 审批超时测试'); report.workspaceId = workspace.id;
  const preset = await ctx.agentPresets.resolve(undefined), selection = ctx.agentDefaultModel.currentSelection();
  handle = await ctx.agents.create({ sessionId: `session-${id}`, meta: { cwd, agentPreset: preset.id },
    agentOptions: { provider: selection.provider, model: selection.model },
    setup: async agentCtx => { await ctx.agentPresets.mount(agentCtx, preset.id); } });
  const agent = handle.agent, session = agent.session;
  report.sessionId = session.id;
  await ctx.sessionController.rename({ sessionId: session.id, title: report.title });
  session.append('turn/start', { turn: 1 });
  session.append('user/message', createUserMessage({ content: [{ type: 'text', text: 'DSHM 审批生命周期验收：受控事件，不调用模型，不执行工具。' }], source: { kind: 'user' } }), { surfaceOp: 'append' });
  session.append('turn/end', { turn: 1, reason: { kind: 'completed' } });
  await ctx.sessions.flush(session); await workspace.attachSession(session.id);
  let turn = 1;
  async function tick() {
    if (lifetime.signal.aborted) return;
    const request = await readFile(control, 'utf8').then(JSON.parse).catch(error => { if (error.code === 'ENOENT') return null; throw error; });
    if (!request || request.id === seen || request.sessionId !== session.id) return;
    if (request.kind === 'cancel') {
      seen = request.id;
      assert.equal(request.target, currentRequest?.id, 'Cancellation must target the current test request');
      currentRequest.controller.abort();
      return;
    }
    if (pending) return;
    assert.ok(['timeout', 'reject', 'approval-cancel', 'question-cancel'].includes(request.kind)); seen = request.id;
    const cancellable = request.kind.endsWith('-cancel');
    currentRequest = { id: request.id, controller: new AbortController() };
    const signal = AbortSignal.any([lifetime.signal, currentRequest.controller.signal, AbortSignal.timeout(cancellable ? 180000 : 30000)]);
    const started = Date.now();
    session.append('turn/start', { turn: ++turn });
    session.append('user/message', createUserMessage({ content: [{ type: 'text', text: `受控审批 ${request.kind}：不执行工具。` }], source: { kind: 'user' } }), { surfaceOp: 'append' });
    const work = async () => {
      try {
        const outcome = request.kind === 'question-cancel'
          ? await ctx.userQuestions.ask({ agent, questions: [{ id: 'cancel-check', question: 'DSHM 提问取消验证，不执行任何工具。',
            options: [{ label: '仅验证通知' }] }], signal }).then(() => 'answered', error => error.code ?? error.message)
          : await ctx.approval.request({ agent, toolName: 'dshm_approval_lifetime_verification',
            reason: `DSHM 审批生命周期验证 ${request.kind}；不执行任何工具。`, signal });
        report.results.push({ id: request.id, kind: request.kind, outcome, elapsedMs: Date.now() - started });
      } finally {
        session.append('turn/end', { turn, reason: { kind: cancellable ? 'aborted' : 'completed' } });
        await ctx.sessions.flush(session);
        report.audit = session.snapshotEvents().filter(event => ['approval/asked', 'approval/decided'].includes(event.type));
        await save();
      }
    };
    pending = work();
    try { await pending; } finally { pending = null; currentRequest = null; }
  }
  timer = setInterval(() => { void tick().catch(async error => { report.failure = error.message; await save(); }); }, 200);
  report.ready = true; await save();
}
