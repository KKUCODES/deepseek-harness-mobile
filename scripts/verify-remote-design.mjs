import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { chromium } from 'playwright';
import { resolve } from 'node:path';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { latestMobileBuild } from './latest-mobile-build.mjs';

const root = resolve(import.meta.dirname, '..'), output = resolve(root, 'artifacts/tests/remote-design');
await mkdir(output, { recursive: true });
const sdk = latestMobileBuild(root, { officialOnly: true, officialVersion: '0.2.1-rc.2' });
const fixture = resolve(root, 'tests/fixtures/remote-app-recovery.jsx');
// 隔离桥和运行时，不替换 RemoteApp、页面、表单、模态层或共享组件；不发认证/模型请求。
const seams = /^(?:\.\/remote-(?:client|model|plugins|plugin-slots|drafts)\.(?:mjs|jsx)|\.\/ordinary-clipboard\.mjs|\.\/ui\/RemoteWorkspace\.jsx)$/;
await build({ absWorkingDir: root, stdin: { contents: `
  import React from 'react'; import { createRoot } from 'react-dom/client';
  import { RemoteApp } from './src/RemoteApp.jsx';
  import { LoadingToast } from './src/ui/system/LoadingToast.jsx';
  import '@upstream/ui-theme/src/styles/base.css';
  import '@upstream/ui-theme/src/styles/design-platform.css';
  import './src/ui/mobile.css'; import './src/ui/ordinary-product.css';
  import './docs/design/ordinary-preview/remote.css'; import './src/ui/remote-product.css';
  createRoot(document.getElementById('app')).render(<RemoteApp/>);
  let toastRoot;
  window.toastFixture = (props) => { toastRoot ??= createRoot(document.getElementById('toast')); toastRoot.render(props ? <LoadingToast {...props} onCancel={() => window.toastFixture(null)} cancelLabel="取消"/> : null); };
`, resolveDir: root, loader: 'jsx' }, outfile: resolve(output, 'test.js'), bundle: true, format: 'esm', platform: 'browser', logLevel: 'silent',
  plugins: [{ name: 'connection-lifecycle-fixture', setup(builder) { builder.onResolve({ filter: seams }, () => ({ path: fixture })); } }, sdk.resolver],
  alias: sdk.alias, nodePaths: [resolve(sdk.runtime, 'node_modules'), resolve(root, 'node_modules')],
  loader: { '.svg': 'file', '.module.css': 'local-css', '.woff2': 'file', '.woff': 'file', '.ttf': 'file', '.png': 'file' },
  define: { 'process.env.NODE_ENV': '"production"' },
});
const server = createServer(async (req, res) => {
  if (req.url === '/') return res.setHeader('Content-Type', 'text/html').end('<meta name="viewport" content="width=device-width,initial-scale=1"><div id="app"></div><div id="toast"></div><link rel="stylesheet" href="/test.css"><script type="module" src="/test.js"></script>');
  if (/^\/[a-zA-Z0-9_.~-]+\.(js|css|svg|png|woff2?|ttf)$/.test(req.url)) {
    try { return res.setHeader('Content-Type', req.url.endsWith('.js') ? 'text/javascript' : req.url.endsWith('.css') ? 'text/css' : req.url.endsWith('.svg') ? 'image/svg+xml' : 'application/octet-stream').end(await readFile(resolve(output, req.url.slice(1)))); }
    catch (error) { if (error.code !== 'ENOENT') throw error; }
  }
  res.writeHead(404).end();
});
server.listen(0, '127.0.0.1'); await once(server, 'listening');
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const report = { sdk: sdk.version, source: 'Actual RemoteApp and design components; isolated bridge/runtime, no live pairing', cases: [], errors: [] };
const pages = [];
async function open({ pairing = true, plan = '' } = {}) {
  const page = await browser.newPage({ viewport: { width: 390, height: 820 }, hasTouch: true }); pages.push(page);
  page.setDefaultTimeout(7000); page.on('pageerror', error => report.errors.push(error.message));
  page.on('response', response => { if (response.status() === 404) report.errors.push(`404:${new URL(response.url()).pathname}`); });
  await page.addInitScript(({ pairing, plan }) => { window.initialPairing = pairing; window.initialRemotePlan = plan; }, { pairing, plan });
  await page.goto(`http://127.0.0.1:${server.address().port}/`);
  return page;
}
const noOverflow = page => page.evaluate(() => ![...document.querySelectorAll('.dshm-design')].filter(e => e.getClientRects().length).some(e => e.scrollWidth > e.clientWidth + 1));
try {
  const page = await open({ plan: 'hold-read' });
  await page.getByRole('heading', { name: '连接你的电脑', exact: true }).waitFor();
  assert.equal(await page.getByRole('button', { name: '继续配对', exact: true }).isDisabled(), true);
  for (const width of [390, 320]) {
    await page.setViewportSize({ width, height: 820 });
    for (const dark of [false, true]) {
      await page.evaluate(value => document.body.toggleAttribute('data-ds-dark-theme', value), dark);
      assert.equal(await noOverflow(page), true);
      assert.equal(await page.getByLabel('一次性配对链接', { exact: true }).evaluate(e => getComputedStyle(e).fontSize), '16px');
      await page.screenshot({ path: resolve(output, `pairing-${width}-${dark ? 'dark' : 'light'}.png`) });
    }
  }
  await page.setViewportSize({ width: 390, height: 820 }); await page.evaluate(() => document.body.removeAttribute('data-ds-dark-theme'));
  await page.getByRole('button', { name: '修改设备名称', exact: true }).click();
  assert.equal(await page.getByLabel('设备名称', { exact: true }).evaluate(e => e === document.activeElement), true);
  await page.getByLabel('设备名称', { exact: true }).fill('我的手机');
  await page.getByRole('button', { name: '扫描二维码', exact: false }).click();
  assert.match(await page.getByLabel('一次性配对链接', { exact: true }).inputValue(), /fixture.invalid/);
  await page.evaluate(() => window.fixture.scanError('scan_qr_not_found'));
  await page.getByRole('button', { name: '从图片识别', exact: true }).click();
  await page.getByRole('alert').filter({ hasText: '未识别到二维码' }).waitFor();
  await page.evaluate(() => window.fixture.paste(true));
  await page.getByRole('button', { name: '粘贴', exact: true }).click();
  await page.locator('.dshm-toast--loading').waitFor();
  assert.equal(await page.locator('.dshm-toast-host').evaluate(e => getComputedStyle(e).pointerEvents), 'none');
  await page.waitForTimeout(1200); assert.equal(await page.locator('.dshm-toast--loading').count(), 1);
  await page.evaluate(() => window.fixture.releasePaste());
  await page.locator('.dshm-toast--success').waitFor();
  await page.locator('.dshm-toast-host').waitFor({ state: 'hidden' });
  await page.evaluate(() => window.fixture.claimError('pairing_unavailable'));
  await page.getByRole('button', { name: '继续配对', exact: true }).click();
  await page.getByRole('alert').filter({ hasText: '链接已过期' }).waitFor();
  assert.notEqual(await page.getByLabel('一次性配对链接', { exact: true }).inputValue(), '');
  await page.evaluate(() => window.fixture.claimError(null));
  await page.getByRole('button', { name: '继续配对', exact: true }).evaluate(button => { button.click(); button.click(); });
  await page.getByRole('heading', { name: '等待电脑确认', exact: true }).waitFor();
  assert.equal((await page.evaluate(() => window.fixture.inspect())).calls.filter(x => x === 'binding.claim').length, 2, '首次过期后只重试一次，连续点击不重复领取');
  await page.screenshot({ path: resolve(output, 'waiting.png') });
  await page.getByRole('button', { name: '返回普通聊天', exact: true }).click();
  const leave = page.getByRole('dialog', { name: '暂时离开配对？', exact: true }); await leave.waitFor();
  assert.equal(await page.evaluate(() => window.dshmHandleBack()), true);
  await leave.waitFor({ state: 'hidden' });
  await page.evaluate(() => window.fixture.approve());
  await page.getByText('正在读取电脑上的项目与会话', { exact: true }).waitFor();
  report.readingGeometry = await page.evaluate(() => ({ header: document.querySelector('.dshm-app-bar').getBoundingClientRect().toJSON(), app: document.querySelector('[data-testid="remote-page"]').getBoundingClientRect().toJSON(), scrollY, rootScroll: document.getElementById('app').scrollTop }));
  assert.ok(report.readingGeometry.header.y >= 0, '读取中顶栏保持可见');
  await page.screenshot({ path: resolve(output, 'reading.png') });
  assert.equal((await page.evaluate(() => window.fixture.inspect())).calls.filter(x => x === 'socket.connect').length, 1);
  await page.evaluate(() => window.fixture.readReady());
  await page.getByTestId('workspace').waitFor();
  assert.equal(await page.getByRole('button', { name: '进入 Remote', exact: true }).count(), 0);
  report.cases.push('pairing:scan/image-error/paste-feedback/expired-link/auto-approval/auto-entry', 'light/dark at390/320, 16px input, no horizontal overflow', 'leaving-dialog and system-back priority');

  const failed = await open({ pairing: false, plan: 'read-error' });
  await failed.getByRole('button', { name: '重试读取', exact: true }).waitFor();
  await failed.screenshot({ path: resolve(output, 'read-error.png') });
  await failed.getByRole('button', { name: '重试读取', exact: true }).click();
  await failed.getByTestId('workspace').waitFor();
  assert.equal((await failed.evaluate(() => window.fixture.inspect())).calls.filter(x => x === 'socket.connect').length, 1);
  report.cases.push('data retry preserves socket and pairing');

  const cancelled = await open();
  await cancelled.getByRole('button', { name: '扫描二维码', exact: false }).click();
  await cancelled.getByRole('button', { name: '继续配对', exact: true }).click();
  await cancelled.getByRole('heading', { name: '等待电脑确认', exact: true }).waitFor();
  await cancelled.getByRole('button', { name: '返回普通聊天', exact: true }).click();
  await cancelled.getByRole('button', { name: '暂时离开', exact: true }).click();
  await cancelled.evaluate(() => window.fixture.approve()); await cancelled.waitForTimeout(2300);
  assert.equal((await cancelled.evaluate(() => window.fixture.inspect())).calls.includes('socket.connect'), false);
  report.cases.push('leaving cancels approval watcher; no late auto-connect');

  const diagnostics = await open({ pairing: false, plan: 'socket-404' });
  await diagnostics.getByRole('heading', { name: '实时连接握手失败', exact: true }).waitFor();
  await diagnostics.getByRole('button', { name: '查看诊断详情', exact: true }).click();
  const diagnosticDialog = diagnostics.getByRole('dialog', { name: '诊断详情', exact: true });
  await diagnosticDialog.waitFor();
  assert.match(await diagnosticDialog.innerText(), /HTTP 404/);
  assert.equal(await diagnosticDialog.getByTestId('remote-diagnostic-stack').count(), 0);
  await diagnosticDialog.getByRole('button', { name: /技术详情/ }).click();
  await diagnosticDialog.getByTestId('remote-diagnostic-stack').waitFor();
  assert.match(await diagnosticDialog.getByTestId('remote-diagnostic-stack').innerText(), /ProtocolException/);
  for (const width of [390, 320]) for (const dark of [false, true]) {
    await diagnostics.setViewportSize({ width, height: 820 });
    await diagnostics.evaluate(value => document.body.toggleAttribute('data-ds-dark-theme', value), dark);
    assert.equal(await diagnosticDialog.getByTestId('remote-diagnostic-stack').evaluate(e => getComputedStyle(e).fontSize), '14px');
    assert.equal(await noOverflow(diagnostics), true);
    await diagnostics.screenshot({ path: resolve(output, `diagnostics-${width}-${dark ? 'dark' : 'light'}.png`) });
  }
  await diagnosticDialog.getByRole('button', { name: '复制诊断信息', exact: true }).click();
  await diagnosticDialog.getByRole('status').filter({ hasText: '诊断信息已复制' }).waitFor();
  assert.match((await diagnostics.evaluate(() => window.fixture.diagnostics())).copied, /http_404/);
  await diagnostics.keyboard.press('Escape'); await diagnosticDialog.waitFor({ state: 'hidden' });
  assert.equal(await diagnostics.getByRole('heading', { name: '实时连接握手失败', exact: true }).isVisible(), true);
  await diagnostics.evaluate(() => window.fixture.recoverSocket());
  await diagnostics.getByRole('button', { name: '重新连接', exact: true }).click();
  await diagnostics.getByTestId('workspace').waitFor();
  await diagnostics.getByRole('button', { name: '电脑连接', exact: true }).click();
  await diagnostics.getByRole('button', { name: '问题诊断', exact: true }).click();
  const recent = diagnostics.getByRole('dialog', { name: '最近诊断', exact: true }); await recent.waitFor();
  await recent.getByText('已恢复', { exact: true }).first().waitFor();
  report.cases.push('diagnostics:actual entry/HTTP404/safe stack/toggle/copy/Escape/recovered history/light-dark390-320');

  const toast = await open(); await toast.getByLabel('设备名称', { exact: true }).waitFor();
  for (const mask of [false, true]) for (const block of [false, true]) {
    await toast.evaluate(props => window.toastFixture(props), { message: '正在保存…', delay: 0, mask, block });
    await toast.locator('.dshm-toast').waitFor();
    if (block) {
      assert.equal(await toast.getByLabel('设备名称', { exact: true }).evaluate(e => e.closest('[inert]') !== null || !!document.querySelector('dialog:modal')), true);
      await toast.keyboard.press('Escape'); await toast.locator('.dshm-toast').waitFor({ state: 'hidden' });
    } else {
      await toast.getByLabel('设备名称', { exact: true }).fill('可继续操作'); await toast.evaluate(() => window.toastFixture(null));
    }
  }
  await toast.emulateMedia({ reducedMotion: 'reduce' });
  await toast.evaluate(() => window.toastFixture({ message: '正在保存…', delay: 0 }));
  await toast.locator('.dshm-spinner').waitFor();
  assert.equal(await toast.locator('.dshm-spinner').evaluate(e => getComputedStyle(e).animationName), 'none');
  report.cases.push('LoadingToast:mask/interaction independent, keyboard cancel, no loading timeout, reduced motion');
  assert.deepEqual(report.errors, []); report.passed = true;
} catch (error) { report.failure = error.stack; process.exitCode = 1; }
finally { await writeFile(resolve(output, 'report.json'), JSON.stringify(report, null, 2)); await browser.close(); await new Promise(resolve => server.close(resolve)); }
console.log(JSON.stringify(report));
