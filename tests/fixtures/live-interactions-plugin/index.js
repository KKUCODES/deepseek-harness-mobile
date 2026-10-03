import { readFile, writeFile } from 'node:fs/promises';
export const inject = ['agents', 'userQuestions'];
const control = 'Q:/Tanxian/LToys/dsh-mobile/dsh-mobile/artifacts/original-interactions-host-control.json';
const output = 'Q:/Tanxian/LToys/dsh-mobile/dsh-mobile/artifacts/original-interactions-host-result.json';

/** 仅用于真实通道验收：原提问服务发起请求，不调用模型或执行任何工具。 */
export function apply(ctx) {
  const lifetime = new AbortController();
  ctx.effect(() => () => lifetime.abort());
  let seen, busy = false, pending = 0;
  const tick = async () => {
    if (busy || pending >= 4 || lifetime.signal.aborted) return;
    busy = true;
    try {
      const request = JSON.parse(await readFile(control, 'utf8'));
      if (!request.id || seen === request.id) return;
      seen = request.id;
      const { id, kind, sessionId } = request;
      if (!['question', 'plan'].includes(kind)) throw new Error('Unsupported verification mode');
      const agent = ctx.agents.get(sessionId);
      if (!agent) throw new Error('Test session is not a live Agent');
      const questions = kind === 'question'
        ? [{ id: 'verify', question: 'DSHM 原提问通道验证', multiSelect: true, options: [{ label: '草稿保留' }, { label: '电脑同步' }] }]
        : [{ id: 'review', question: 'DSHM 原计划通道验证', detail: '# DSHM 原计划验证\n\n仅验证手机与电脑的确认通道。\n\n- 不调用模型\n- 不执行文件或命令操作',
          options: [{ label: '继续讨论' }, { label: '验证通过' }], intent: { kind: 'plan-review', approve: '验证通过' } }];
      // 连续通知验收允许少量并行原提问；每个结果绑定自己的控制ID。
      pending++; busy = false;
      try {
        const value = await ctx.userQuestions.ask({ agent, questions, signal: AbortSignal.any([lifetime.signal, AbortSignal.timeout(90000)]) });
        await writeFile(output, JSON.stringify({ id, value }));
      } catch (error) { await writeFile(output, JSON.stringify({ id, error: error.code ?? error.message })); }
      finally { pending--; }
    } catch (error) {
      if (error.code !== 'ENOENT') await writeFile(output, JSON.stringify({ id: seen, error: error.message }));
    } finally { busy = false; }
  };
  const timer = setInterval(() => { void tick(); }, 200);
  ctx.effect(() => () => clearInterval(timer));
}
