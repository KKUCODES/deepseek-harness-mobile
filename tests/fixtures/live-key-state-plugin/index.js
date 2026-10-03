import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';

export const inject = ['settings', 'credentials'];
const root = 'Q:/Tanxian/LToys/dsh-mobile/dsh-mobile/artifacts/';
const namespace = 'llm-pi-ai';

// 仅提供本机验收刺激：目标固定为本次创建的独立路由，不暴露网络或任意凭据接口。
export async function apply(ctx) {
  const id = randomUUID(), suffix = id.replaceAll('-', '');
  const provider = `dshm-key-state-${suffix.slice(0, 8)}`;
  // 原 CredentialRef 是符合 POSIX 环境变量名称语法的 branded string。
  const ref = `DSHM_KEY_STATE_${suffix.toUpperCase()}`;
  const profile = { displayName: 'DSHM Key 状态同步验证', api: 'openai-completions',
    baseURL: 'http://127.0.0.1:9/v1', apiKeyEnv: ref, models: [{ id: 'dshm-state-model' }] };
  const descriptor = () => ctx.settings.describe({ redactSecrets: true }).find(row => row.ns === namespace);
  const current = () => ctx.settings.get(namespace)?.providers?.[provider];
  assert.equal(current(), undefined);
  assert.equal((await ctx.credentials.describe(ref)).configured, false);
  let cleaned = false, stopped = false, last, active = Promise.resolve();
  const report = async (command, failure) => writeFile(`${root}key-state-host.json`, JSON.stringify({
    id, provider, command, cleaned, configured: (await ctx.credentials.describe(ref)).configured,
    routePresent: current() !== undefined, ...(failure ? { failure } : {}), at: new Date().toISOString(),
  }, null, 2));
  const cleanup = async () => {
    if (cleaned) return;
    assert.equal(current()?.apiKeyEnv, ref, 'Dedicated route identity changed');
    await ctx.credentials.unset(ref);
    await ctx.settings.mutate(namespace, [{ op: 'unset', path: ['providers', provider] }], descriptor().revision);
    cleaned = true;
  };
  await ctx.settings.mutate(namespace, [{ op: 'set', path: ['providers', provider], value: profile }], descriptor().revision);
  await report('ready');
  const tick = async () => {
    let command;
    try { command = JSON.parse(await readFile(`${root}key-state-command.json`, 'utf8')); }
    catch (error) { if (error.code === 'ENOENT' || error instanceof SyntaxError) return; throw error; }
    if (command.id !== id || command.sequence === last) return;
    last = command.sequence;
    try {
      assert.ok(['set', 'unset', 'cleanup'].includes(command.action));
      assert.ok(!cleaned);
      assert.equal(current()?.apiKeyEnv, ref);
      if (command.action === 'cleanup') await cleanup();
      else if (command.action === 'unset') await ctx.credentials.unset(ref);
      else await ctx.credentials.set(ref, `dshm-test-${randomUUID()}`);
      await report(last);
    } catch { await report(last, 'Dedicated test action failed'); }
  };
  const timer = setInterval(() => { if (!stopped) active = active.then(tick).catch(() => {}); }, 150);
  ctx.effect(() => async () => {
    stopped = true; clearInterval(timer); await active; await cleanup(); await report('disposed');
  });
}
