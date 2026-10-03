import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';

export const inject = ['settings'];
const root = 'Q:/Tanxian/LToys/dsh-mobile/dsh-mobile/artifacts/';
const namespace = 'llm-pi-ai';
export async function apply(ctx) {
  const id = randomUUID(), provider = `dshm-directory-${id.slice(0, 8)}`;
  const initialName = 'DSHM 目录同步验证', renamed = 'DSHM 电脑已改名';
  const baseURL = 'http://127.0.0.1:9/v1';
  const current = () => ctx.settings.get(namespace)?.providers?.[provider];
  const mutate = ops => ctx.settings.mutate(namespace, ops,
    ctx.settings.describe({ redactSecrets: true }).find(row => row.ns === namespace).revision);
  assert.equal(current(), undefined);
  let stopped = false, active = Promise.resolve(), last;
  const report = (command, failure) => writeFile(`${root}provider-directory-host.json`, JSON.stringify({
    id, provider, initialName, renamed, command, present: current() !== undefined,
    name: current()?.displayName, ...(failure ? { failure } : {}), at: new Date().toISOString(),
  }, null, 2));
  const remove = async () => {
    if (!current()) return;
    assert.equal(current().baseURL, baseURL, 'Test route identity changed');
    await mutate([{ op: 'unset', path: ['providers', provider] }]);
  };
  await report('ready');
  // 固定本地命令文件只驱动本次随机测试路由；不接受外部地址/路径/凭据。
  const tick = async () => {
    let command;
    try { command = JSON.parse(await readFile(`${root}provider-directory-command.json`, 'utf8')); }
    catch (error) { if (error.code === 'ENOENT' || error instanceof SyntaxError) return; throw error; }
    if (command.id !== id || command.sequence === last) return;
    last = command.sequence;
    try {
      if (command.action === 'add') {
        assert.equal(current(), undefined);
        await mutate([{ op: 'set', path: ['providers', provider], value: {
          displayName: initialName, api: 'openai-completions', baseURL, models: [{ id: 'directory-test' }],
        } }]);
      } else if (command.action === 'rename') {
        assert.equal(current()?.baseURL, baseURL);
        await mutate([{ op: 'set', path: ['providers', provider, 'displayName'], value: renamed }]);
      } else { assert.equal(command.action, 'remove'); await remove(); }
      await report(last);
    } catch { await report(last, 'Dedicated directory test action failed'); }
  };
  const timer = setInterval(() => { if (!stopped) active = active.then(tick).catch(() => {}); }, 150);
  ctx.effect(() => async () => { stopped = true; clearInterval(timer); await active; await remove(); await report('disposed'); });
}
