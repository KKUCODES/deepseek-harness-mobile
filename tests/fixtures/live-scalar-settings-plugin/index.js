import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';

export const inject = ['settings'];
const root = 'Q:/Tanxian/LToys/dsh-mobile/dsh-mobile/artifacts/';
const ns = 'llm-deepseek', key = 'streamIdleTimeoutMs';
// 固定非敏感字段，通过原 Host 设置服务产生真实事件；保留原用户覆盖层。
export async function apply(ctx) {
  const describe = () => ctx.settings.describe({ redactSecrets: true }).find(row => row.ns === ns);
  const initial = describe(), original = initial.value[key];
  const overridden = Object.hasOwn(initial.user ?? {}, key), saved = initial.user?.[key];
  assert.ok(Number.isSafeInteger(original) && original > 0 && original < 2147480000);
  const id = randomUUID();
  let last, expected = original, cleaned = false, stopped = false, active = Promise.resolve();
  const report = (command, failure) => writeFile(`${root}scalar-settings-host.json`, JSON.stringify({
    id, original, overridden, value: describe().value[key], cleaned, command, failure,
  }, null, 2));
  const mutate = async value => {
    const view = describe();
    assert.equal(view.value[key], expected, 'Concurrent scalar edit; refusing overwrite');
    await ctx.settings.mutate(ns, [value === undefined ? { op: 'unset', path: [key] } : { op: 'set', path: [key], value }], view.revision);
    expected = describe().value[key];
  };
  const cleanup = async () => {
    if (cleaned) return;
    await mutate(overridden ? saved : undefined);
    assert.equal(describe().value[key], original);
    assert.equal(Object.hasOwn(describe().user ?? {}, key), overridden);
    cleaned = true;
  };
  await report('ready');
  const tick = async () => {
    let cmd;
    try { cmd = JSON.parse(await readFile(`${root}scalar-settings-command.json`, 'utf8')); }
    catch (error) { if (error.code === 'ENOENT' || error instanceof SyntaxError) return; throw error; }
    if (cmd.id !== id || cmd.sequence === last) return;
    last = cmd.sequence;
    try {
      assert.ok(!cleaned);
      assert.ok(['first', 'second', 'cleanup'].includes(cmd.action));
      if (cmd.action === 'cleanup') await cleanup();
      else await mutate(original + (cmd.action === 'first' ? 1000 : 2000));
      await report(last);
    } catch { await report(last, 'Scalar test action failed'); }
  };
  const timer = setInterval(() => { if (!stopped) active = active.then(tick).catch(() => {}); }, 150);
  ctx.effect(() => async () => { stopped = true; clearInterval(timer); await active; await cleanup(); await report('disposed'); });
}
