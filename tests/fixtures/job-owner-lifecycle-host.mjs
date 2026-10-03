import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { processJob } from 'file:///Q:/Tanxian/LToys/dsh-mobile/plugin/artifacts/compatibility/background-output/native-producer.mjs';

export const inject = ['agents', 'agentPresets', 'agentDefaultModel', 'sessionController', 'workspaceRegistry', 'jobs', 'shell'];

/** 仅释放本夹具创建并持有的真实Agent句柄；不关闭用户会话、不直接修改jobs记录。 */
export function apply(ctx) {
  const commandPath = new URL('../../artifacts/job-owner-lifecycle-command.json', import.meta.url);
  const reportPath = new URL('../../artifacts/job-owner-lifecycle-host.json', import.meta.url);
  const report = { at: new Date().toISOString(), pid: process.pid, phase: 'ready', errors: [] };
  let owner, job, hooks, workdir, lastCommand, running, closed = false;
  let writing = Promise.resolve();
  const save = () => {
    const text = JSON.stringify(report, null, 2);
    return writing = writing.then(() => writeFile(reportPath, text + '\n'));
  };
  const tick = async () => {
    let command;
    try { command = JSON.parse(await readFile(commandPath, 'utf8')); }
    catch (error) { if (error.code === 'ENOENT' || error instanceof SyntaxError) return; throw error; }
    if (!command?.nonce || command.nonce === lastCommand) return;
    assert.match(command.nonce, /^job-owner-\d+-(prepare|start|drop|cleanup)$/);
    lastCommand = command.nonce;
    if (command.action === 'prepare') {
      assert.equal(owner, undefined, 'One owned test conversation per runtime');
      const matches = ctx.workspaceRegistry.list().filter(item => item.title === 'DSH-TEST');
      assert.equal(matches.length, 1);
      workdir = matches[0].path;
      const preset = await ctx.agentPresets.resolve(undefined);
      const selection = ctx.agentDefaultModel.currentSelection();
      owner = await ctx.agents.create({ sessionId: command.nonce,
        meta: { cwd: matches[0].path, agentPreset: preset.id },
        agentOptions: { provider: selection.provider, model: selection.model },
        setup: async agentCtx => { await ctx.agentPresets.mount(agentCtx, preset.id); } });
      report.sessionId = owner.agent.id;
      report.title = `DSHM 后台任务回收 ${Date.now()}`;
      await ctx.sessionController.rename({ sessionId: report.sessionId, title: report.title });
      await ctx.workspaceRegistry.get(matches[0].id).attachSession(report.sessionId);
      await ctx.sessionController.prompt({ requestId: command.nonce, sessionId: report.sessionId,
        mode: 'queue', content: [{ type: 'text', text: '只回复 DSHM_OWNER_READY，不调用工具，不操作文件。' }] }, new AbortController().signal);
      report.phase = 'prepared';
    } else if (command.action === 'start') {
      assert.ok(owner && !job);
      job = ctx.jobs.start({ kind: 'pwsh', label: 'DSHM_OWNER_LIFECYCLE_OUTPUT', owner: owner.agent,
        run: () => (hooks = processJob(signal => ctx.shell.start(ctx.shell.resolve({
          command: '1..600 | ForEach-Object { Write-Output ("DSHM_OWNER_LINE_" + $_); Start-Sleep -Milliseconds 200 }',
          workdir, timeoutMs: 150000, signal,
        })), child => child.readOutput().delta)) });
      report.jobId = job;
      report.startedAt = ctx.jobs.get(job, owner.agent).startedAt;
      // 原wait抑制完成通知触发模型；不读取或消费输出。
      void ctx.jobs.wait(job, 160000, owner.agent).then(snapshot => {
        report.settledStatus = snapshot.status; return save();
      }).catch(error => { report.errors.push(error.message); return save(); });
      report.phase = 'running';
    } else if (command.action === 'drop-owner') {
      assert.ok(owner && job);
      assert.equal(ctx.agents.get(owner.agent.id), owner.agent);
      assert.equal(ctx.jobs.get(job, owner.agent).status, 'running');
      report.beforeDrop = { ownerLive: true, jobStatus: 'running' };
      await owner.dispose();
      report.producerOutcome = await hooks.done;
      report.ownerRemoved = ctx.agents.get(owner.agent.id) === undefined;
      report.ownedJobsRemaining = ctx.jobs.list(owner.agent).filter(item => item.id === job).length;
      assert.equal(report.ownerRemoved, true);
      assert.equal(report.ownedJobsRemaining, 0);
      assert.throws(() => ctx.jobs.get(job, owner.agent));
      report.phase = 'owner-disposed';
    } else if (command.action === 'cleanup') {
      await owner?.dispose(); report.phase = 'cleaned';
    } else throw Error('Unsupported test action');
    report.command = { action: command.action, nonce: command.nonce };
    await save();
  };
  const poll = () => {
    if (running || closed) return;
    running = tick().catch(async error => { report.errors.push(error.message); await save(); })
      .finally(() => { running = undefined; });
  };
  const timer = setInterval(poll, 200);
  void save(); poll();
  ctx.effect(() => async () => { closed = true; clearInterval(timer); await running; await owner?.dispose(); await writing; });
}
