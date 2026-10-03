import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
export const inject = ['settings', 'llm', 'credentials'];
const root = 'Q:/Tanxian/LToys/dsh-mobile/dsh-mobile/artifacts/';

// 临时引用必须原本不存在；只描述其状态并清理本次手机测试写入，不读取用户Key。
export async function apply(ctx) {
  const id = randomUUID(), reference = `DSHM_ONBOARDING_TEST_${id.replaceAll('-', '_')}`;
  const describe = () => ctx.settings.describe({ redactSecrets: true }).find(row => row.ns === 'llm-deepseek');
  for (let i = 0; i < 200 && !describe(); i++) await new Promise(resolve => setTimeout(resolve, 100));
  assert.ok(describe());
  let backup, changed = false, owned = false, last, stopped = false, active = Promise.resolve();
  const report = async (command, failed = false) => writeFile(`${root}model-readiness-host.json`, JSON.stringify({ id, command, changed, failed, testCredentialConfigured: (await ctx.credentials.describe(reference)).configured }));
  const restore = async () => {
    if (!changed) { if (owned) { await ctx.credentials.unset(reference); owned = false; } return; }
    assert.equal(ctx.settings.get('llm-deepseek').apiKeyEnv, reference, 'Concurrent configuration edit; refusing overwrite');
    await ctx.settings.mutate('llm-deepseek', [backup.own ? { op: 'set', path: ['apiKeyEnv'], value: backup.value } : { op: 'unset', path: ['apiKeyEnv'] }], describe().revision);
    assert.equal(ctx.settings.get('llm-deepseek').apiKeyEnv, backup.effective);
    assert.equal(Object.hasOwn(describe().user ?? {}, 'apiKeyEnv'), backup.own);
    changed = false;
    if (owned) { await ctx.credentials.unset(reference); owned = false; }
  };
  const tick = async () => {
    let cmd;
    try { cmd = JSON.parse(await readFile(`${root}model-readiness-command.json`, 'utf8')); }
    catch (error) { if (error.code === 'ENOENT' || error instanceof SyntaxError) return; throw error; }
    if (cmd.id !== id || cmd.sequence === last) return;
    last = cmd.sequence;
    try {
      if (cmd.action === 'missing') {
        assert.equal(changed, false);
        // 其他可用提供方应跳过引导，不能为造场景擅自停用它们。
        assert.deepEqual(ctx.llm.listProviders().map(row => row.id), ['deepseek-official']);
        const status = await ctx.credentials.describe(reference);
        assert.equal(status.configured, false); assert.equal(status.writable, true);
        owned = true;
        const before = describe();
        backup = { own: Object.hasOwn(before.user ?? {}, 'apiKeyEnv'), value: before.user?.apiKeyEnv, effective: ctx.settings.get('llm-deepseek').apiKeyEnv };
        // 在写配置前保留非秘密引用的恢复信息，异常退出时也能人工核对。
        await writeFile(`${root}model-readiness-restore.json`, JSON.stringify({ id, reference, ...backup }));
        await ctx.settings.mutate('llm-deepseek', [{ op: 'set', path: ['apiKeyEnv'], value: reference }], before.revision);
        changed = true;
      } else if (cmd.action === 'verify-saved') {
        assert.equal(changed, true); assert.equal(owned, true);
        assert.equal(ctx.settings.get('llm-deepseek').apiKeyEnv, reference);
        assert.equal((await ctx.credentials.describe(reference)).configured, true);
      } else { assert.equal(cmd.action, 'restore'); await restore(); }
      await report(last);
    } catch { await report(last, true); }
  };
  const timer = setInterval(() => { if (!stopped) active = active.then(tick).catch(() => {}); }, 150);
  ctx.effect(() => async () => { stopped = true; clearInterval(timer); await active; await restore(); await report('disposed'); });
  await report('ready');
}
