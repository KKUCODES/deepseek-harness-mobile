import { readFile, writeFile } from 'node:fs/promises';
export const inject = ['llm', 'tools', 'sessions', 'permissionPresets'];
const root = 'Q:/Tanxian/LToys/dsh-mobile/dsh-mobile/artifacts/';
export async function apply(ctx) {
  const seed = JSON.parse(await readFile(`${root}auto-review-live-seed.json`, 'utf8'));
  const report = { reviews: [], calls: [] };
  let writing = Promise.resolve();
  const save = () => {
    const sessions = ctx.sessions.list();
    const owned = sessions.find(session => session.id === report.calls.at(-1)?.sessionId);
    const value = JSON.stringify({ ...report, at: new Date().toISOString(),
      current: owned ? ctx.permissionPresets.current(owned) : null,
      autoSessions: sessions.filter(session => ctx.permissionPresets.current(session) === 'auto').length,
    }, null, 2);
    writing = writing.then(() => writeFile(`${root}auto-review-host.json`, value));
  };
  // 原流完全透传。仅保存本次标记对应review的分类/结果，不记录提示词、reasoning或凭据。
  ctx.on('llm/stream', (options, next) => {
    const matched = typeof options.system === 'string' && options.system.startsWith('REVIEW_POLICY')
      && options.messages.some(message => message.content?.some(block => block.type === 'text' && block.text.includes(seed.marker)));
    if (!matched) return next();
    return (async function* () {
      const row = { provider: options.provider, model: options.model, started: true };
      report.reviews.push(row); save();
      for await (const chunk of next()) {
        if (chunk.type === 'block-end' && chunk.block.type === 'text') {
          try {
            const result = JSON.parse(chunk.block.text);
            if (['low', 'medium', 'high'].includes(result.risk)) row.risk = result.risk;
            if (['allow', 'deny'].includes(result.decision)) row.decision = result.decision;
          } catch { row.invalid = true; }
        }
        if (chunk.type === 'finish') { row.finish = chunk.reason.kind; save(); }
        yield chunk;
      }
    })();
  });
  // 此观察器不修改decision，原Auto listener仍置前并执行真实模型审核。
  ctx.on('tools/pre-execute', async (exec, next) => {
    if (exec.agent && JSON.stringify(exec.arguments).includes(seed.marker)) {
      report.calls.push({ name: exec.name, sessionId: exec.agent.session.id, preset: ctx.permissionPresets.current(exec.agent.session) });
      save();
    }
    return next();
  });
  const timer = setInterval(save, 500);
  ctx.effect(() => async () => { clearInterval(timer); save(); await writing; });
  save();
}
