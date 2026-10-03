import test from 'node:test';
import assert from 'node:assert/strict';
import { Context } from '@deepseek-ai/cordis';
import { MobilePluginLayout } from '../src/mobile-plugin-layout.mjs';
import { activationManifest, pluginEntries } from '../src/remote-plugin-policy.mjs';

test('模型设置始终由手机组合，保留模块依赖且即使通用接口齐全也不执行桌面apply', () => {
  const id = '@deepseek-ai/dsh-client-ui-settings-models';
  const manifest = { modules: [{ id }], plugins: [{ id }] };
  const calls = ['credentials/describe', 'credentials/set', 'credentials/unset',
    'llm/listProviders', 'llm/listConfigurableProviders', 'llm/discoverModels', 'settings/describe', 'settings/mutate'];
  const loader = { entries: () => [{ options: { name: id }, fiber: { state: 2 } }] };
  for (const missing of calls) {
    const caps = { management: true, endpoints: { calls: calls.filter(call => call !== missing) } };
    const chosen = activationManifest(manifest, caps);
    assert.equal(chosen.modules, manifest.modules);
    assert.deepEqual(chosen.plugins, [], missing);
    assert.equal(pluginEntries(manifest, loader, caps)[0].state, 'mobile', missing);
  }
  assert.deepEqual(activationManifest(manifest, { endpoints: { calls } }).plugins, []);
  assert.equal(pluginEntries(manifest, loader, { management: false })[0].state, 'mobile');
});

test('交付卡片只在完整读取与桌面动作能力可用时标为手机组合', () => {
  const id = '@deepseek-ai/dsh-client-ui-deliverables';
  const manifest = { modules: [{ id }], plugins: [{ id }] }, loader = { entries: () => [] };
  const caps = { desktopOpen: true, desktopReveal: true, channels: ['changes'], endpoints: { calls: ['workspaceFiles/read'] } };
  assert.equal(pluginEntries(manifest, loader, caps)[0].state, 'mobile');
  for (const key of Object.keys(caps)) {
    const incomplete = { ...caps }; delete incomplete[key];
    assert.equal(pluginEntries(manifest, loader, incomplete)[0].state, 'waiting');
    assert.deepEqual(activationManifest(manifest, incomplete).plugins, []);
  }
  assert.deepEqual(activationManifest(manifest, caps).plugins, []);
});

test('用户布局覆盖持久化、作者声明随插件卸载释放，存储失败不伪报保存', async () => {
  const values = new Map(), storage = { getItem: key => values.get(key), setItem: (key, value) => values.set(key, value) };
  const ctx = new Context(), layout = new MobilePluginLayout(ctx, storage);
  const id = 'layout-test';
  const fiber = ctx.plugin({ name: id, inject: ['dshmLayout'], apply(scope) { scope.dshmLayout.configure({ autoFit: false }); } });
  await fiber.await();
  assert.equal(layout.effective(id), false);
  layout.setUser(id, true); assert.equal(layout.effective(id), true);
  const second = new Context(), restored = new MobilePluginLayout(second, storage);
  assert.equal(restored.userValue(id), true);
  layout.setUser(id, undefined); assert.equal(layout.effective(id), false);
  await fiber.dispose(); assert.equal(layout.effective(id), true);
  layout.setUser(id, false);
  storage.setItem = () => { throw new Error('disk unavailable'); };
  assert.throws(() => layout.setUser(id, true), /disk unavailable/);
  assert.equal(layout.effective(id), false);
  await second.fiber.dispose(); await ctx.fiber.dispose();
});

test('手机只替换组合入口，完整模块依赖表和其他插件保留，缺服务不标为成功', () => {
  const names = ['@deepseek-ai/dsh-client-ui-layout', '@deepseek-ai/dsh-client-hmr', '@deepseek-ai/dsh-client-ui-session', '@other/ui', '@deepseek-ai/custom'];
  const manifest = { modules: names.map(id => ({ id })), plugins: names.map(id => ({ id })) };
  const selected = activationManifest(manifest);
  assert.equal(selected.modules, manifest.modules);
  assert.deepEqual(selected.plugins.map(item => item.id), names.slice(3));
  const loader = { entries: () => [{ options: { name: '@other/ui' }, fiber: { state: 0, inject: { missing: {} } }, ctx: { get: () => undefined } }] };
  const states = pluginEntries(manifest, loader);
  assert.equal(states[0].state, 'mobile');
  assert.deepEqual(states[3], { id: '@other/ui', state: 'waiting', missing: ['missing'] });
  assert.equal(states[4].state, 'failed');
});

test('未接入的桌面专用 HTTP 功能暂停 apply，不能伪报手机已提供', () => {
  const id = '@deepseek-ai/dsh-client-ui-open-in-app';
  const manifest = { modules: [{ id }], plugins: [{ id }] };
  const selected = activationManifest(manifest);
  assert.equal(selected.modules, manifest.modules);
  assert.deepEqual(selected.plugins, []);
  const [entry] = pluginEntries(manifest, { entries: () => [] });
  assert.equal(entry.state, 'waiting');
  assert.match(entry.reason, /暂不支持/);
  const capabilities = { desktopApps: true };
  assert.equal(pluginEntries(manifest, { entries: () => [] }, capabilities)[0].state, 'mobile');
  assert.deepEqual(activationManifest(manifest, capabilities).plugins, []);
});

test('交互终端不随接口或管理授权启用，保留依赖模块及其他插件入口', () => {
  const id = '@deepseek-ai/dsh-client-ui-sidebar-terminal';
  const names = [id, '@other/command-result'];
  const manifest = { modules: names.map(id => ({ id })), plugins: names.map(id => ({ id })) };
  for (const capabilities of [undefined, { management: true, endpoints: { calls: ['terminal/list', 'terminal/create', 'terminal/write'] } }]) {
    const selected = activationManifest(manifest, capabilities);
    assert.equal(selected.modules, manifest.modules);
    assert.deepEqual(selected.plugins, [manifest.plugins[1]]);
    const [entry] = pluginEntries(manifest, { entries: () => [] }, capabilities);
    assert.equal(entry.state, 'waiting');
    assert.match(entry.reason, /不提供交互终端/);
  }
});

test('真实服务已注册仍需电脑协商允许接口；完整模块表保留且不扩大权限', () => {
  const id = '@deepseek-ai/dsh-cordis-client-runner';
  const manifest = { modules: [{ id }], plugins: [{ id }] }, loader = { entries: () => [] };
  for (const capabilities of [undefined, { management: true }, { endpoints: { calls: ['session/list'] } }]) {
    const chosen = activationManifest(manifest, capabilities);
    assert.equal(chosen.modules, manifest.modules); assert.deepEqual(chosen.plugins, []);
    assert.match(pluginEntries(manifest, loader, capabilities)[0].reason, /未开放/);
  }
  const allowed = { endpoints: { calls: ['getClientCode', 'inventory', 'invoke', 'reportClientGuardFailure', 'reportRenderFailure',
    'resolveInspectQuery', 'resolveRequestRun', 'runHostHalf', 'settleUserRun', 'stopFromPanel', 'syncInspectManifest', 'undefineFromPanel']
    .map(method => `dynamicCordisRunner/${method}`) } };
  assert.deepEqual(activationManifest(manifest, allowed).plugins, manifest.plugins);
  const both = { modules: manifest.modules, plugins: [...manifest.plugins, { id: '@deepseek-ai/dsh-client-ui-cordis' }] };
  for (const missing of allowed.endpoints.calls) {
    const partial = { endpoints: { calls: allowed.endpoints.calls.filter(call => call !== missing) } };
    assert.deepEqual(activationManifest(both, partial).plugins, [], missing);
    assert.ok(pluginEntries(both, loader, partial).every(entry => entry.state === 'waiting'), missing);
  }
  assert.deepEqual(activationManifest(both, allowed).plugins, both.plugins);
});

test('电脑插件管理须实际协商清单和写入接口，管理标记不能替代接口能力', () => {
  const id = '@deepseek-ai/dsh-client-ui-plugin-manager';
  const manifest = { modules: [{ id }], plugins: [{ id }] };
  const calls = ['pluginInventory/list', 'pluginManager/listPlugins', 'pluginManager/installBundle'];
  for (const missing of calls) {
    const capabilities = { management: true, endpoints: { calls: calls.filter(item => item !== missing) } };
    assert.deepEqual(activationManifest(manifest, capabilities).plugins, []);
  }
  assert.deepEqual(activationManifest(manifest, { management: true, endpoints: { calls } }).plugins, manifest.plugins);
});

test('文件资源插件需同时允许元数据和变化订阅，侧栏可用不能隐式放开网页', () => {
  const id = '@deepseek-ai/dsh-api-workspace-files';
  const manifest = { modules: [{ id }], plugins: [{ id }] };
  for (const endpoints of [{ calls: ['workspaceFiles/stat'] }, { streams: ['workspaceFiles/changes'] }]) {
    assert.deepEqual(activationManifest(manifest, { endpoints }).plugins, []);
    assert.match(pluginEntries(manifest, { entries: () => [] }, { endpoints })[0].reason, /未开放/);
  }
  const endpoints = { calls: ['workspaceFiles/stat'], streams: ['workspaceFiles/changes'] };
  assert.deepEqual(activationManifest(manifest, { endpoints }).plugins, manifest.plugins);
  const browser = { plugins: [{ id: '@deepseek-ai/dsh-client-ui-sidebar-browser' }] };
  assert.deepEqual(activationManifest(browser, { endpoints }).plugins, []);
  assert.match(pluginEntries(browser, { entries: () => [] }, { endpoints })[0].reason, /暂不支持/);
});

test('文件树仅在电脑协商允许按需目录接口时启用', () => {
  const manifest = { plugins: [{ id: '@deepseek-ai/dsh-client-ui-sidebar-files' }] };
  assert.deepEqual(activationManifest(manifest, { endpoints: { calls: ['workspaceFiles/stat'] } }).plugins, []);
  assert.deepEqual(activationManifest(manifest, { endpoints: { calls: ['workspaceFiles/list'] } }).plugins, manifest.plugins);
});
