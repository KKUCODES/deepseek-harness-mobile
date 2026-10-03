import { writeFile } from 'node:fs/promises';
import { defineTool } from 'file:///F:/Program%20Files/deepseek-harness/packages/core/tools/src/index.ts';

export const inject = ['tools'];
const output = 'Q:/Tanxian/LToys/dsh-mobile/dsh-mobile/artifacts/ptc-inner-wait-host.json';
export async function apply(ctx) {
  const report = { ready: true, calls: [], disposed: false }, lifetime = new AbortController();
  let writing = Promise.resolve();
  const save = () => { const json = JSON.stringify(report, null, 2); writing = writing.then(() => writeFile(output, json)); return writing; };
  const active = new Set();
  ctx.effect(() => async () => { lifetime.abort(); await Promise.allSettled([...active]); report.disposed = true; await save(); });
  ctx.tools.register(defineTool({ name: 'dshm_ptc_wait', description: 'Wait for up to 120 seconds, respecting cancellation. No filesystem, network or process operations.',
    parameters: {}, output: { schema: { type: 'string' }, render: (_args, value) => [{ type: 'text', text: value }] },
    isConcurrencySafe: () => true,
    async execute(_args, exec) {
      const row = { sessionId: exec.agent?.id, inner: !!exec.parent, started: true, aborted: false, completed: false };
      report.calls.push(row); await save();
      const signal = AbortSignal.any([exec.signal, lifetime.signal]);
      const task = new Promise((resolve, reject) => {
        const timer = setTimeout(() => { signal.removeEventListener('abort', abort); row.completed = true; resolve('DSHM_PTC_WAIT_COMPLETED'); }, 120000);
        const abort = () => { clearTimeout(timer); row.aborted = true; reject(signal.reason); };
        if (signal.aborted) abort(); else signal.addEventListener('abort', abort, { once: true });
      });
      active.add(task);
      try { return await task; } finally { active.delete(task); await save(); }
    },
  }));
  await save();
}
