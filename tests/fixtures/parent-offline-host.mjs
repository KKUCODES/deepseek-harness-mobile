import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';

export const inject = ['agents', 'agentPresets', 'agentDefaultModel', 'subagents', 'sessionController', 'workspaceRegistry'];

/** 只持有自行创建的父会话句柄；通过原生命周期制造父离线，不伪造目录或手机状态。 */
export function apply(ctx) {
  assert.equal(process.env.DSHM_PARENT_LIFECYCLE_TEST, '1');
  const commandPath = new URL('../../artifacts/parent-offline-command.json', import.meta.url);
  const reportPath = new URL('../../artifacts/parent-offline-host.json', import.meta.url);
  const report = { startedAt: new Date().toISOString(), phase: 'ready', events: [], errors: [] };
  let parent;
  let childId;
  let lastCommand;
  let lastSnapshot;
  let running;
  let closed = false;
  const save = () => writeFile(reportPath, JSON.stringify(report, null, 2));
  const snapshot = () => ({ parentLive: parent ? ctx.agents.get(parent.agent.id) === parent.agent : false,
    childStatus: childId ? ctx.agents.get(childId)?.status ?? 'inactive' : null });
  const tick = async () => {
    let command;
    try { command = JSON.parse(await readFile(commandPath, 'utf8')); }
    catch (error) { if (error.code !== 'ENOENT' && !(error instanceof SyntaxError)) throw error; }
    if (command?.nonce && command.nonce !== lastCommand) {
      lastCommand = command.nonce;
      assert.match(command.nonce, /^parent-offline-[a-z0-9-]+$/);
      if (command.action === 'prepare') {
        assert.equal(parent, undefined, 'Only one owned parent per test process');
        const matches = ctx.workspaceRegistry.list().filter(item => item.title === 'DSH-TEST');
        assert.equal(matches.length, 1, 'Require the existing dedicated test workspace');
        const preset = await ctx.agentPresets.resolve(undefined);
        const selection = ctx.agentDefaultModel.currentSelection();
        report.title = `DSHM 父离线停止验证 ${Date.now()}`;
        parent = await ctx.agents.create({ sessionId: command.nonce,
          meta: { cwd: matches[0].path, agentPreset: preset.id },
          agentOptions: { provider: selection.provider, model: selection.model },
          setup: async agentCtx => { await ctx.agentPresets.mount(agentCtx, preset.id); } });
        report.parentId = parent.agent.id;
        await ctx.sessionController.rename({ sessionId: report.parentId, title: report.title });
        const started = await ctx.subagents.startContinuable({ provider: 'spawn', label: 'DSHM 父离线停止子任务',
          request: { parent: parent.agent, maxDepth: 1, prompt: [{ type: 'text', text:
            '这是 DSHM 父会话离线停止验收。不要调用工具，不读写文件，不执行命令，只回复 DSHM_PARENT_OFFLINE_READY。稍后手机会发送持续输出测试。' }] },
          signal: new AbortController().signal });
        childId = started.childId; report.childId = childId; report.phase = 'prepared';
      } else if (command.action === 'drop-parent') {
        assert.ok(parent && childId);
        assert.equal(ctx.agents.get(childId)?.status, 'running', 'Child must really be running');
        await parent.dispose();
        assert.equal(ctx.agents.get(parent.agent.id), undefined, 'Parent must really leave the registry');
        report.phase = 'parent-disposed';
      } else if (command.action === 'cleanup') {
        // 仅在验收失败或卸载时兜底停止自己创建的子任务，不影响其他会话。
        if (childId) ctx.subagents.interrupt(childId, { kind: 'user', parentSessionId: parent.agent.id });
        await parent?.dispose(); report.phase = 'cleaned';
      } else throw new Error('Unsupported test action');
      report.command = { action: command.action, nonce: command.nonce };
      await save();
    }
    const next = snapshot();
    if (JSON.stringify(next) !== lastSnapshot) {
      lastSnapshot = JSON.stringify(next); report.events.push({ at: new Date().toISOString(), ...next }); await save();
    }
  };
  const poll = () => {
    if (running || closed) return;
    running = tick().catch(async error => { report.errors.push(error.message); await save(); })
      .finally(() => { running = undefined; });
  };
  const timer = setInterval(poll, 200);
  poll();
  ctx.effect(() => async () => {
    closed = true; clearInterval(timer); await running;
    if (childId) ctx.subagents.interrupt(childId, { kind: 'user', parentSessionId: parent.agent.id });
    await parent?.dispose();
  });
}
