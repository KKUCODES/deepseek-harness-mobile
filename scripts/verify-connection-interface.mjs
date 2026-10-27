import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { chromium } from 'playwright';
import { resolve, dirname } from 'node:path';
import { createRequire } from 'node:module';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { latestMobileBuild } from './latest-mobile-build.mjs';
import { remoteSourceAliases } from './remote-source-aliases.mjs';

const root = process.cwd(), sdk = latestMobileBuild(root, { officialOnly: true, officialVersion: process.argv.includes('--alpha2') ? '0.2.1-alpha.2' : '0.2.1-rc.2' });
const output = resolve(`artifacts/tests/connection-interface/${sdk.version}`), require = createRequire(import.meta.url);
await mkdir(output, { recursive: true });
const seams = /^(?:\.\/remote-(?:client|model|plugins|plugin-slots|drafts)\.(?:mjs|jsx)|\.\/ordinary-clipboard\.mjs|\.\/ui\/(?:RemoteWorkspace|Surface)\.jsx)$/;
await build({ absWorkingDir: root, entryPoints: ['tests/fixtures/connection-interface.jsx'], outfile: resolve(output, 'test.js'), bundle: true, format: 'esm', jsx: 'automatic', platform: 'browser', target: 'chrome100', logLevel: 'silent',
  plugins: [{ name: 'isolated-connection-lifecycle', setup(builder) { builder.onResolve({ filter: seams }, args => args.importer.endsWith('RemoteApp.jsx') ? { path: resolve('tests/fixtures/remote-app-recovery.jsx') } : undefined); } }, sdk.resolver],
  alias: { ...sdk.alias, ...remoteSourceAliases(root, sdk), react: dirname(require.resolve('react/package.json')), 'node:module': resolve(sdk.upstream, 'apps/web/src/node-module-stub.ts') },
  nodePaths: [resolve(sdk.runtime, 'node_modules'), resolve('node_modules')], loader: { '.module.css': 'local-css', '.svg': 'file', '.png': 'file', '.woff2': 'file', '.woff': 'file', '.ttf': 'file' }, define: { 'process.env.NODE_ENV': '"production"' } });
const server = createServer(async (req, res) => {
  if (req.url === '/') return res.setHeader('Content-Type', 'text/html').end('<meta name="viewport" content="width=device-width,initial-scale=1"><div id="app"></div><link rel="stylesheet" href="/test.css"><script type="module" src="/test.js"></script>');
  if (/^\/[a-zA-Z0-9_.~-]+\.(js|css|svg|png|woff2?|ttf)$/.test(req.url)) try { return res.setHeader('Content-Type', req.url.endsWith('.js') ? 'text/javascript' : req.url.endsWith('.css') ? 'text/css' : 'image/svg+xml').end(await readFile(resolve(output, req.url.slice(1)))); } catch {}
  res.writeHead(404).end();
}); server.listen(0, '127.0.0.1'); await once(server, 'listening');
const browser = await chromium.launch({ channel: 'msedge', headless: true }), report = { sdk: sdk.version, source: 'Actual RemoteApp, local interface host, public plugin and plugin management; isolated connection lifecycle, not authentication', cases: [], errors: [] };
try {
  for (const mode of ['unpaired', 'pending', 'connecting', 'reading', 'read-error', 'offline']) {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 } }), page = await context.newPage(); page.setDefaultTimeout(12000);
    page.on('pageerror', error => report.errors.push(error.message));
    await page.addInitScript(mode => { window.initialPairing = ['unpaired', 'pending'].includes(mode); window.initialRemotePlan = ({ connecting: 'hold', reading: 'hold-read', 'read-error': 'read-error', offline: 'host_offline' })[mode] ?? ''; }, mode);
    await page.goto(`http://127.0.0.1:${server.address().port}/`);
    const plugin = page.getByTestId('remote-connection-plugin'), fallback = page.getByTestId('remote-connection-default'); await plugin.waitFor();
    const manager = page.locator('#connection-management');
    async function details(label) { await page.evaluate(() => window.connectionProbe.open()); await manager.getByRole('button', { name: new RegExp('^' + label) }).click(); }
    async function choose(label, enabled = true) {
      await details(label); await manager.getByRole('switch').setChecked(enabled); await page.evaluate(() => window.connectionProbe.close());
    }
    if (mode === 'pending') {
      await plugin.getByLabel('一次性配对链接', { exact: true }).fill('https://fixture.invalid/pair#key=' + 'A'.repeat(43));
      await plugin.getByRole('button', { name: '继续配对', exact: true }).click(); await plugin.getByRole('heading', { name: '等待电脑确认' }).waitFor();
    }
    if (mode === 'reading') await plugin.getByRole('heading', { name: '正在读取电脑会话…' }).waitFor();
    if (mode === 'read-error') await plugin.getByRole('button', { name: '重试读取', exact: true }).waitFor();
    if (mode === 'unpaired') {
      await plugin.getByLabel('一次性配对链接', { exact: true }).fill('https://fixture.invalid/pair#key=' + 'B'.repeat(43));
      await plugin.getByLabel('设备名称', { exact: true }).fill('保留设备名称');
    }
    await choose('Remote 新版首页', false); await fallback.waitFor(); assert.equal(await plugin.count(), 0);
    if (mode === 'unpaired') {
      assert.match(await fallback.getByLabel('一次性配对链接', { exact: true }).inputValue(), /B{43}/);
      assert.equal(await fallback.getByLabel('设备名称', { exact: true }).inputValue(), '保留设备名称');
    }
    await choose('Remote 新版首页'); await plugin.waitFor();
    await details('Remote 新版首页'); await manager.getByRole('button', { name: '卸载', exact: true }).click();
    await page.getByRole('button', { name: '确认卸载', exact: true }).click();
    await page.evaluate(() => window.connectionProbe.close()); await fallback.waitFor();
    await choose('另一款连接界面'); await page.getByTestId('alternative-connection').waitFor();
    const keys = await page.evaluate(() => ({ view: Object.keys(window.connectionProbe.owner.view), actions: Object.keys(window.connectionProbe.owner.actions), parts: Object.keys(window.connectionProbe.owner.parts) }));
    assert.ok(!keys.view.some(key => ['link', 'binding', 'key', 'token'].includes(key))); assert.ok(!keys.actions.includes('call'));
    await page.evaluate(() => window.connectionProbe.fail()); await fallback.waitFor();
    await choose('仅首页的旧插件'); await fallback.waitFor();
    await choose('无法加载的界面'); await fallback.waitFor();
    await page.waitForFunction(() => window.connectionProbe.registry.getSnapshot().runtime['@example/broken-interface']?.status === 'failed');
    const calls = (await page.evaluate(() => window.fixture.inspect())).calls;
    assert.equal(calls.includes('binding.forget'), false);
    assert.equal(calls.filter(op => op === 'binding.claim').length, mode === 'pending' ? 1 : 0, '界面启停不得重新配对');
    if (mode === 'unpaired') assert.match(await fallback.getByLabel('一次性配对链接', { exact: true }).inputValue(), /B{43}/);
    report.cases.push({ mode, disable: true, enable: true, uninstall: true, alternative: true, renderFailure: true, loadFailure: true, legacyHome: true, bindingRetained: true });
    await context.close();
  }
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } }), page = await context.newPage();
  page.on('pageerror', error => report.errors.push(error.message));
  await page.addInitScript(() => { window.initialRemotePlan = 'hold-read'; });
  await page.goto(`http://127.0.0.1:${server.address().port}/`);
  await page.getByTestId('remote-connection-plugin').getByRole('heading', { name: '正在读取电脑会话…' }).waitFor();
  await page.evaluate(() => window.fixture.readReady()); await page.getByTestId('workspace').waitFor();
  // 生命周期替身没有真实generation引擎；通过正式重建入口验证RemoteModel替换。
  await page.evaluate(() => { window.fixture.seed(); window.fixture.rebuild(''); });
  await page.waitForFunction(() => window.fixture.inspect().models.length === 2);
  await page.getByTestId('workspace').waitFor();
  assert.equal(await page.getByTestId('draft').innerText(), '保留草稿');
  assert.equal(await page.evaluate(() => window.connectionProbe.activations), 1, '连接就绪和替换电脑模型不会重启本地界面模块');
  report.modelRebuildSameInterface = true; await context.close();
  assert.deepEqual(report.errors, []);
} catch (error) { report.failure = error.stack; throw error; }
finally { await writeFile(resolve(output, 'report.json'), JSON.stringify(report, null, 2)); console.log(JSON.stringify(report)); await browser.close(); server.close(); }
