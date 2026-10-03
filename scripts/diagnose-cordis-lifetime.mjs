import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { transform } from 'esbuild';
import { Context } from '@deepseek-ai/cordis';

// 执行原客户端源码；仅将网络端点换成受控延迟，重放实际日志的销毁时序。
// 这是生命周期隔离诊断，不替代Android入口、真实网络或认证验收。
async function sourceModule(path) {
  const source = await readFile(path, 'utf8');
  const { code } = await transform(source, { loader: 'ts', format: 'esm', target: 'es2024' });
  return import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`);
}
const report = { at: new Date().toISOString(), scope: 'original source lifecycle replay', cases: [] };
const flush = async () => { for (let i = 0; i < 12; i++) await Promise.resolve(); };
const { ClientCordisInspectRegistry, provideClientCordisInspect } = await sourceModule(
  '../deepseek-harness/packages/extensions/cordis-client-runner/src/client/inspect-registry.ts');
const { createCordisInventory } = await sourceModule(
  '../deepseek-harness/packages/extensions/ui-cordis/src/client/inventory.ts');

// 对应原runner apply中的提供方注册effect；其移除回调仍会排入目录同步。
const ctx = new Context();
let online = true;
const calls = [], errors = [];
const originalError = console.error;
console.error = (...args) => errors.push(args.map(value => value instanceof Error ? value.message : String(value)).join(' '));
try {
  const registry = new ClientCordisInspectRegistry({
    sync: async providers => {
      calls.push({ online, providers: providers.map(provider => provider.id) });
      if (!online) throw new Error('client api: dynamicCordisRunner/syncInspectManifest has no active Connection');
    }, resolve: async () => {},
  });
  provideClientCordisInspect(ctx, registry);
  ctx.effect(() => registry.register({ manifest: { id: 'diagnostic-provider', methods: [] }, query: async () => null }));
  await flush();
  assert.deepEqual(calls, [{ online: true, providers: ['diagnostic-provider'] }]);
  online = false;
  await ctx.fiber.dispose();
  await flush();
  assert.deepEqual(calls[1], { online: false, providers: [] });
  assert.equal(errors.length, 1);
  assert.match(errors[0], /syncing inspect providers failed:.*has no active Connection/);
  report.cases.push({ name: 'provider removal on actual Cordis context disposal', publishesAfterDisposal: true, calls, errors: [...errors] });
} finally { console.error = originalError; }

// 对应旧 inventory 在 apply closure 中持有的请求；取消后没有 reset/dispose 则仍上报。
for (const invalidate of [false, true]) {
  const request = Promise.withResolvers(), failures = [];
  const inventory = createCordisInventory({ inventory: () => request.promise }, error => failures.push(error.message));
  const off = inventory.subscribe(() => {});
  inventory.refresh(); off();
  if (invalidate) inventory.reset();
  request.reject(new Error('gateway/internal: client api: dynamicCordisRunner/inventory failed: signal is aborted without reason'));
  await flush();
  assert.equal(failures.length, invalidate ? 0 : 1);
  report.cases.push({ name: 'late aborted inventory read', invalidated: invalidate, failures, errorPublished: Boolean(inventory.getSnapshot().error) });
}
await writeFile('artifacts/cordis-lifetime-diagnosis.json', JSON.stringify(report, null, 2));
console.log(JSON.stringify(report));
