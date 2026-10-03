import { readFile, writeFile } from 'node:fs/promises';
export const inject = ['agents', 'permissionPresets'];
const base = 'Q:/Tanxian/LToys/dsh-mobile/dsh-mobile/artifacts/custom-permission-';
export function apply(ctx) {
  let busy = false, seen;
  const timer = setInterval(async () => {
    if (busy) return;
    busy = true;
    try {
      const request = JSON.parse(await readFile(base + 'control.json', 'utf8'));
      if (!request.id || seen === request.id) return;
      seen = request.id;
      const agent = ctx.agents.get(request.sessionId);
      if (!agent) throw Error('Test session is not live');
      const current = ctx.permissionPresets.current(agent.session);
      await writeFile(base + 'result.json', JSON.stringify({ id: request.id, current, spec: ctx.permissionPresets.resolve(current) }));
    } catch (error) {
      if (error.code !== 'ENOENT') await writeFile(base + 'result.json', JSON.stringify({ id: seen, error: error.message }));
    } finally { busy = false; }
  }, 200);
  ctx.effect(() => () => clearInterval(timer));
}
