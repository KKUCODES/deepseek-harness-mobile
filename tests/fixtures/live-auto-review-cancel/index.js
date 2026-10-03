import { readFile, writeFile } from 'node:fs/promises';
export const inject = ['llm', 'tools', 'sessions', 'permissionPresets'];
const root = 'Q:/Tanxian/LToys/dsh-mobile/dsh-mobile/artifacts/';
export async function apply(ctx) {
  const seed = JSON.parse(await readFile(`${root}auto-review-cancel-seed.json`, 'utf8'));
  const report = { reviews: [], calls: [] };
  let writing = Promise.resolve();
  const save = () => {
    const sessions = ctx.sessions.list();
    if (!report.sessionId) report.sessionId = sessions.find(session => session.snapshotEvents().some(event =>
      event.type === 'tool/call' && event.data.arguments?.includes(seed.marker)))?.id;
    const owned = sessions.find(session => session.id === report.sessionId);
    const value = JSON.stringify({ ...report, at: new Date().toISOString(),
      current: owned ? ctx.permissionPresets.current(owned) : null,
      autoSessions: sessions.filter(session => ctx.permissionPresets.current(session) === 'auto').length,
    }, null, 2);
    writing = writing.then(() => writeFile(`${root}auto-review-cancel-host.json`, value));
  };
  // 仅观察真实审核的取消信号；不延迟、改写或伪造模型流及审核结果。
  ctx.on('llm/stream', (options, next) => {
    const matched = typeof options.system === 'string' && options.system.startsWith('REVIEW_POLICY')
      && options.messages.some(message => message.content?.some(block => block.type === 'text' && block.text.includes(seed.marker)));
    if (!matched) return next();
    return (async function* () {
      const row = { started: true, provider: options.provider, model: options.model };
      report.reviews.push(row);
      const aborted = () => { row.aborted = true; save(); };
      options.signal?.addEventListener('abort', aborted, { once: true });
      if (options.signal?.aborted) aborted();
      save();
      try {
        for await (const chunk of next()) {
          if (chunk.type === 'finish') row.finish = chunk.reason.kind;
          yield chunk;
        }
      } finally {
        options.signal?.removeEventListener('abort', aborted);
        row.ended = true; save();
      }
    })();
  });
  // 原Auto审核置前，下游观察到调用意味着审核已经放行。
  ctx.on('tools/pre-execute', async (exec, next) => {
    if (exec.agent && JSON.stringify(exec.arguments).includes(seed.marker)) {
      report.calls.push({ name: exec.name, sessionId: exec.agent.session.id }); save();
    }
    return next();
  });
  const timer = setInterval(save, 250);
  ctx.effect(() => async () => { clearInterval(timer); save(); await writing; });
  save();
}
