import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { processJob } from 'file:///Q:/Tanxian/LToys/dsh-mobile/plugin/artifacts/compatibility/background-output/native-producer.mjs';

export const inject = ['agents', 'jobs', 'shell', 'userQuestions'];
const control = 'Q:/Tanxian/LToys/dsh-mobile/dsh-mobile/artifacts/sidebar-output-control.json';
const result = 'Q:/Tanxian/LToys/dsh-mobile/dsh-mobile/artifacts/sidebar-output-host.json';

/** 固定打印任务经原shell、jobs与独立字节读取通道运行；不使用模型或写用户文件。 */
export function apply(ctx) {
  let seen, busy, closed, job, owner, hooks, question;
  // 结算监听与停止请求可能同时完成，串行写回以免两个JSON互相覆盖。
  let writing = Promise.resolve();
  const save = value => (writing = writing.then(() => writeFile(result, JSON.stringify(value))));
  const tick = async () => {
    if (busy || closed) return;
    busy = true;
    try {
      const request = JSON.parse(await readFile(control, 'utf8'));
      if (seen === request.id) return;
      assert.match(request.id, /^sidebar-output-\d+-(start|stop|notify)$/);
      seen = request.id;
      if (request.action === 'start') {
        assert.equal(job, undefined, 'One owned job per verification runtime');
        owner = ctx.agents.get(request.sessionId);
        assert.ok(owner, 'The selected test conversation must be live');
        const shell = ctx.shell;
        assert.ok(shell);
        assert.ok(request.variant === undefined || request.variant === 'streams');
        const command = request.variant === 'streams'
          ? 'Write-Output "DSHM_HISTORY_BEGIN"; Write-Output ("0123456789" * 14000); Write-Output "DSHM_HISTORY_END"; 1..600 | ForEach-Object { Write-Output ("DSHM_SIDEBAR_LINE_" + $_); Write-Error ("DSHM_SIDEBAR_ERR_" + $_) -ErrorAction Continue; Start-Sleep -Milliseconds 300 }'
          : '1..600 | ForEach-Object { Write-Output ("DSHM_SIDEBAR_LINE_" + $_); Start-Sleep -Milliseconds 300 }';
        job = ctx.jobs.start({ kind: 'pwsh', label: 'DSHM_SIDEBAR_LIVE_OUTPUT', owner,
          run: () => (hooks = processJob(signal => shell.start(shell.resolve({
            command,
            workdir: 'Q:/Tanxian/LToys/dsh-mobile/DSH-TEST', timeoutMs: 200000, signal,
          })), process => process.readOutput().delta)) });
        // 原wait在结算时标记已报告，避免测试任务完成再次唤起模型。
        const startId = seen;
        void ctx.jobs.wait(job, 210000, owner).then(snapshot => save({ id: startId, job, phase: 'settled', snapshot }))
          .catch(error => save({ id: startId, job, error: error.message }));
        await save({ id: seen, job, sessionId: owner.id, phase: 'running' });
      } else if (request.action === 'stop') {
        question?.abort();
        assert.ok(job && owner);
        ctx.jobs.kill(job, owner, 'DSHM sidebar output verification cleanup');
        await ctx.jobs.wait(job, 10000, owner);
        await save({ id: seen, job, phase: 'cleaned', snapshot: ctx.jobs.get(job, owner) });
      } else if (request.action === 'notify') {
        assert.equal(question, undefined, 'One notification per verification runtime');
        const agent = ctx.agents.get(request.sessionId);
        assert.ok(agent, 'Notification target must be a live test conversation');
        question = new AbortController();
        const id = seen;
        await save({ id, phase: 'question-pending' });
        void ctx.userQuestions.ask({ agent, questions: [{ id: 'output-switch', question: 'DSHM 旁栏输出切换验证',
          options: [{ label: '仅验证通知跳转' }] }], signal: AbortSignal.any([question.signal, AbortSignal.timeout(90000)]) })
          .then(value => save({ id, value })).catch(error => save({ id, error: error.code ?? error.message }));
      } else throw Error('Unsupported verification action');
    } catch (error) {
      if (error.code !== 'ENOENT') await save({ id: seen, error: error.message });
    } finally { busy = false; }
  };
  const timer = setInterval(() => { void tick(); }, 200);
  ctx.effect(() => async () => {
    closed = true; clearInterval(timer);
    question?.abort();
    if (job && owner) { ctx.jobs.kill(job, owner, 'DSHM verification unloaded'); await hooks.done; }
  });
}
