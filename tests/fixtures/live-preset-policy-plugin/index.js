import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
export const inject = ['settings', 'sessions', 'sessionProjections'];
const root = 'Q:/Tanxian/LToys/dsh-mobile/dsh-mobile/artifacts/';
const fields = ['default', 'modeSelectionEnabled'];
export async function apply(ctx) {
  const describe = () => ctx.settings.describe({ redactSecrets: true }).find(row => row.ns === 'agent-presets');
  for (let i = 0; i < 200 && !describe(); i++) await new Promise(resolve => setTimeout(resolve, 100));
  assert.ok(describe());
  const id = randomUUID(), original = structuredClone(describe()), target = original.value.default === 'minimal' ? 'standard' : 'minimal';
  let stopped = false, restored = false, command, active = Promise.resolve();
  const current = () => Object.fromEntries(fields.map(key => [key, ctx.settings.get('agent-presets')[key]]));
  const report = () => writeFile(`${root}preset-policy-host.json`, JSON.stringify({ id, target, original: Object.fromEntries(fields.map(key => [key, original.value[key]])), current: current(), restored, command,
    sessions: ctx.sessions.list().map(session => ({ id: session.id, preset: ctx.sessionProjections.stateOf(session, 'agentPreset') })),
  }));
  await writeFile(`${root}preset-policy-restore.json`, JSON.stringify({ id, user: original.user, value: original.value }));
  const restore = async () => {
    const now = current();
    assert.ok([original.value.default, target].includes(now.default), 'Concurrent default edit; refusing overwrite');
    await ctx.settings.mutate('agent-presets', fields.map(key => Object.hasOwn(original.user ?? {}, key)
      ? { op: 'set', path: [key], value: original.user[key] } : { op: 'unset', path: [key] }), describe().revision);
    for (const key of fields) {
      assert.equal(ctx.settings.get('agent-presets')[key], original.value[key]);
      assert.equal(Object.hasOwn(describe().user ?? {}, key), Object.hasOwn(original.user ?? {}, key));
    }
    restored = true;
  };
  const tick = async () => {
    let request;
    try { request = JSON.parse(await readFile(`${root}preset-policy-command.json`, 'utf8')); }
    catch (error) { if (error.code !== 'ENOENT' && !(error instanceof SyntaxError)) throw error; }
    if (request?.id === id && request.sequence !== command) {
      assert.equal(request.action, 'restore'); await restore(); command = request.sequence;
    }
    await report();
  };
  const timer = setInterval(() => { if (!stopped) active = active.then(tick); }, 200);
  ctx.effect(() => async () => { stopped = true; clearInterval(timer); await active; if (!restored) await restore(); command = 'disposed'; await report(); });
  await report();
}
