import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
export const inject = ['settings', 'llm'];
const root = 'Q:/Tanxian/LToys/dsh-mobile/dsh-mobile/artifacts/';
export async function apply(ctx) {
  try { await setup(ctx); }
  catch (error) {
    await writeFile(`${root}model-list-host.json`, JSON.stringify({ startupFailed: true, errorType: error.name, message: error.message }, null, 2));
    throw error;
  }
}
async function setup(ctx) {
  const id = randomUUID(), route = `dshm-model-sync-${id.slice(0, 8)}`;
  const describe = ns => ctx.settings.describe({ redactSecrets: true }).find(row => row.ns === ns);
  // 设置服务先于适配器注册；验收插件只在两个实际 namespace 就绪后操作。
  for (let i = 0; i < 200 && (!describe('llm-deepseek') || !describe('llm-pi-ai')); i++) {
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  assert.ok(describe('llm-deepseek') && describe('llm-pi-ai'), 'Model settings namespaces not ready');
  const official = describe('llm-deepseek');
  const original = structuredClone(official.value.models);
  assert.ok(Array.isArray(original) && original.length > 0);
  const own = Object.hasOwn(official.user ?? {}, 'models'), saved = structuredClone(official.user?.models);
  const profile = { displayName: 'DSHM 模型同步测试', api: 'openai-completions', baseURL: 'http://127.0.0.1:9/v1', models: [{ id: 'sync-test', name: 'Initial' }] };
  const overrideRoute = 'openai';
  const current = name => ctx.settings.get('llm-pi-ai')?.providers?.[name];
  assert.equal(current(route), undefined); assert.equal(current(overrideRoute), undefined);
  assert.ok(ctx.llm.listConfigurableProviders().some(row => row.provider === overrideRoute && row.settingsNs === 'llm-pi-ai'));
  // 已安装内置路由由原 discoverModels 从本机目录回答，不请求网络。
  const catalog = await ctx.llm.discoverModels('llm-pi-ai', { provider: overrideRoute });
  const overrideId = catalog[0]?.id; assert.ok(overrideId);
  const mutate = (ns, ops) => ctx.settings.mutate(ns, ops, describe(ns).revision);
  let expected = structuredClone(original), cleaned = false, active = Promise.resolve(), stopped = false, last;
  const restore = async () => {
    if (cleaned) return;
    assert.deepEqual(describe('llm-deepseek').value.models, expected, 'Refuse concurrent official model edits');
    await mutate('llm-deepseek', [own ? { op: 'set', path: ['models'], value: saved } : { op: 'unset', path: ['models'] }]);
    for (const name of [route, overrideRoute]) {
      if (current(name)) {
        assert.equal(current(name).baseURL, profile.baseURL);
        await mutate('llm-pi-ai', [{ op: 'unset', path: ['providers', name] }]);
      }
    }
    assert.deepEqual(describe('llm-deepseek').value.models, original);
    assert.equal(Object.hasOwn(describe('llm-deepseek').user ?? {}, 'models'), own);
    cleaned = true;
  };
  const report = (command, failure) => writeFile(`${root}model-list-host.json`, JSON.stringify({ id, route, overrideRoute, cleaned, command, failure }, null, 2));
  await mutate('llm-pi-ai', [{ op: 'set', path: ['providers', route], value: profile },
    { op: 'set', path: ['providers', overrideRoute], value: { ...profile, models: undefined, modelOverrides: { [overrideId]: { name: 'Initial' } } } }].map(op => ({ ...op, value: JSON.parse(JSON.stringify(op.value)) })));
  await report('ready');
  const tick = async () => {
    let cmd;
    try { cmd = JSON.parse(await readFile(`${root}model-list-command.json`, 'utf8')); }
    catch (e) { if (e.code === 'ENOENT' || e instanceof SyntaxError) return; throw e; }
    if (cmd.id !== id || cmd.sequence === last) return;
    last = cmd.sequence;
    try {
      assert.ok(!cleaned);
      if (cmd.action === 'cleanup') await restore();
      else {
        assert.ok(['official', 'models', 'overrides'].includes(cmd.action));
        assert.ok([1, 2].includes(cmd.step));
        const name = `DSHM ${cmd.action} ${cmd.step}`;
        if (cmd.action === 'official') {
          assert.deepEqual(describe('llm-deepseek').value.models, expected);
          expected = original.map((row, i) => i ? row : { ...row, name });
          await mutate('llm-deepseek', [{ op: 'set', path: ['models'], value: expected }]);
        } else await mutate('llm-pi-ai', [{ op: 'set', path: ['providers', cmd.action === 'models' ? route : overrideRoute,
          cmd.action === 'models' ? 'models' : 'modelOverrides'], value: cmd.action === 'models' ? [{ id: 'sync-test', name }] : { [overrideId]: { name } } }]);
      }
      await report(last);
    } catch { await report(last, 'Model list test failed; inspect restoration before retry'); }
  };
  const timer = setInterval(() => { if (!stopped) active = active.then(tick).catch(() => {}); }, 150);
  ctx.effect(() => async () => { stopped = true; clearInterval(timer); await active; await restore(); await report('disposed'); });
}
