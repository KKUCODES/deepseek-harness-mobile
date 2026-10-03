import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { chromium } from 'playwright';
import { resolve } from 'node:path';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { once } from 'node:events';

const root = process.cwd(), directory = resolve('artifacts/tests/remote-app-recovery');
await mkdir(directory, { recursive: true });
const fixture = resolve('tests/fixtures/remote-app-recovery.jsx');
const seams = /^(?:\.\/remote-(?:client|model|plugins|plugin-slots|drafts)\.(?:mjs|jsx)|\.\/ordinary-clipboard\.mjs|\.\/ui\/(?:RemoteWorkspace|Surface)\.jsx|@upstream\/ui-primitives\/src\/(?:Button\.tsx|icons\/index\.tsx))$/;
await build({ stdin: { contents: "import React from 'react'; import {createRoot} from 'react-dom/client'; import {RemoteApp} from './src/RemoteApp.jsx'; createRoot(document.getElementById('app')).render(<RemoteApp/>);", resolveDir: root, loader: 'jsx' },
  outfile: resolve(directory, 'test.js'), bundle: true, format: 'esm', platform: 'browser', logLevel: 'silent',
  plugins: [{ name: 'lifecycle-test-seams', setup(build) { build.onResolve({ filter: seams }, () => ({ path: fixture })); } }],
  define: { 'process.env.NODE_ENV': '"production"' },
});
const server = createServer(async (req, res) => {
  if (req.url === '/') return res.setHeader('Content-Type', 'text/html').end('<div id="app"></div><script type="module" src="/test.js"></script>');
  if (req.url === '/test.js') return res.setHeader('Content-Type', 'text/javascript').end(await readFile(resolve(directory, 'test.js')));
  res.writeHead(404).end();
});
server.listen(0, '127.0.0.1'); await once(server, 'listening');
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const report = { source: 'actual RemoteApp with isolated lifecycle dependencies, not authentication or real transport', cases: [], failures: [] };
try {
  for (const mode of ['disconnect', 'host_offline', 'cancel', 'revoked']) {
    const page = await browser.newPage(); page.setDefaultTimeout(5000);
    try {
      const cancelled = mode === 'cancel' || mode === 'revoked';
      await page.addInitScript(plan => { window.initialRemotePlan = plan; }, cancelled ? 'hold' : mode);
      await page.goto(`http://127.0.0.1:${server.address().port}/`);
      if (cancelled) {
        await page.waitForFunction(() => window.fixture.inspect().models.length === 1);
        if (mode === 'cancel') {
          await page.getByRole('button', { name: '连接选项', exact: true }).click();
          await page.getByRole('button', { name: '断开连接', exact: true }).click();
        } else await page.evaluate(() => window.fixture.close('device_revoked'));
        await page.evaluate(() => { window.fixture.release(); window.fixture.ready(); });
        await page.waitForTimeout(1600);
        assert.equal(await page.getByTestId('workspace').count(), 0, '取消/撤销后的迟到 ready 不能恢复连接');
        const state = await page.evaluate(() => window.fixture.inspect());
        assert.equal(state.models.length, 1); assert.ok(state.models[0].disposed);
        assert.equal(state.calls.filter(call => call === 'socket.connect').length, 1);
        if (mode === 'cancel') assert.equal(await page.getByRole('alert').count(), 0, '主动取消不应显示连接失败');
        else assert.match(await page.getByRole('alert').innerText(), /电脑已撤销这台手机/);
      } else {
        await page.getByTestId('workspace').waitFor();
        const state = await page.evaluate(() => window.fixture.inspect());
        assert.equal(state.models.length, 2); assert.ok(state.models[0].disposed);
        assert.equal(state.calls.filter(call => call === 'socket.connect').length, 2);
        assert.equal(state.calls.includes('binding.forget'), false);
      }
      report.cases.push(`initial-${mode}`);
    } catch (error) { report.failures.push({ mode: `initial-${mode}`, message: error.message }); }
    finally { await page.close(); }
  }
  for (const mode of ['fail', 'repeated-failure', 'disconnect', 'cancel', 'permissions-changed', 'unsupported_remote_version', 'unsupported_dsh_version']) {
    const page = await browser.newPage(); page.setDefaultTimeout(5000);
    try {
      await page.goto(`http://127.0.0.1:${server.address().port}/`);
      await page.getByTestId('workspace').waitFor();
      await page.evaluate(() => window.fixture.seed());
      const cleared = mode === 'cancel' || mode === 'permissions-changed';
      await page.evaluate(plan => window.fixture.rebuild(plan), cleared ? 'hold' : mode === 'repeated-failure' ? 'fail' : mode);
      if (mode.startsWith('unsupported_')) {
        const expected = mode === 'unsupported_remote_version'
          ? 'Remote 通信版本不兼容，请更新 App、电脑插件和中转服务后重试。'
          : '电脑 DSH 版本与当前手机端不兼容，请使用配套版本后重试。';
        await page.getByRole('alert').filter({ hasText: expected }).waitFor();
        assert.equal(await page.getByTestId('remote-fingerprint').innerText(), 'fixture');
        assert.equal(await page.getByRole('heading', { name: '连接授权已失效' }).count(), 0);
      }
      if (cleared) {
        await page.waitForFunction(() => window.fixture.inspect().models.length === 2);
        await page.evaluate(reason => { window.fixture.close(reason); window.fixture.release(); }, mode === 'cancel' ? 'user_disconnect' : 'permissions_changed');
      }
      if (mode === 'repeated-failure') {
        await page.getByRole('button', { name: '重新连接', exact: true }).waitFor();
        await page.evaluate(() => window.fixture.failNext());
        await page.getByRole('button', { name: '重新连接', exact: true }).click();
        await page.waitForFunction(() => window.fixture.inspect().models.length === 3 && window.fixture.inspect().models[2].disposed);
      }
      if (mode !== 'disconnect') {
        await page.getByRole('button', { name: '重新连接', exact: true }).waitFor();
        await page.getByRole('button', { name: '重新连接', exact: true }).click();
      }
      await page.getByTestId('workspace').waitFor();
      assert.equal(await page.getByTestId('selection').innerText(), cleared ? 'home' : 'test');
      assert.equal(await page.getByTestId('draft').innerText(), cleared ? '' : '保留草稿');
      assert.equal(await page.getByTestId('draft-editor').innerText(), cleared ? 'none' : 'original-reference');
      assert.equal(await page.getByTestId('output').innerText(), cleared ? 'none' : '65536');
      assert.equal(await page.getByTestId('sidebar').innerText(), cleared ? 'none' : 'child-test');
      assert.equal(await page.getByTestId('filter').innerText(), cleared ? 'recent' : 'archived');
      const state = await page.evaluate(() => window.fixture.inspect());
      assert.equal(state.calls.includes('binding.forget'), false);
      assert.ok(state.models.slice(0, -1).every(model => model.disposed));
      assert.equal(state.models.filter(model => model.presented && !model.disposed).length, 1);
      report.cases.push(mode);
    } catch (error) { report.failures.push({ mode, message: error.message, body: await page.locator('body').innerText() }); }
    finally { await page.close(); }
  }
  for (const mode of ['success', 'hold', 'fail', 'user-after-take', 'queued-then-user', 'latest-after-take', 'latest-after-select', 'latest-after-failure']) {
    const page = await browser.newPage(); page.setDefaultTimeout(5000);
    try {
      await page.goto(`http://127.0.0.1:${server.address().port}/`);
      await page.getByTestId('workspace').waitFor();
      const latest = mode.startsWith('latest-');
      const setup = ['latest-after-take', 'user-after-take'].includes(mode) ? 'take-hold' : ['latest-after-select', 'queued-then-user'].includes(mode) ? 'hold' : mode === 'latest-after-failure' ? 'hold-fail' : mode;
      await page.evaluate(mode => { window.fixture.seed(); window.fixture.notification(mode); }, setup);
      if (latest) {
        await page.waitForFunction(() => window.fixture.notificationState().waiting);
        await page.evaluate(() => window.fixture.nextNotification());
        await page.waitForFunction(() => window.fixture.notificationState().snapshot.notificationNavigation === 'notice-latest');
      } else if (['hold', 'user-after-take', 'queued-then-user'].includes(mode)) {
        await page.waitForFunction(() => window.fixture.notificationState().waiting);
        if (mode === 'queued-then-user') await page.evaluate(() => window.fixture.nextNotification(false));
        await page.evaluate(() => window.fixture.supersedeNotification());
        await page.getByTestId('selection').filter({ hasText: 'other' }).waitFor();
      } else if (mode === 'fail') {
        await page.waitForFunction(() => window.fixture.notificationState().snapshot.error);
      } else await page.waitForFunction(() => window.fixture.notificationState().ack);
      const state = await page.evaluate(() => window.fixture.notificationState());
      assert.equal(state.ack, latest || mode === 'success');
      assert.equal(state.snapshot.notificationNavigation, latest ? 'notice-latest' : mode === 'success' ? 'notice-test' : undefined);
      assert.equal(state.snapshot.drafts.test, '保留草稿');
      if (latest) {
        assert.deepEqual(state.acknowledged, ['notice-latest']);
        assert.equal(state.snapshot.selected, 'latest');
        assert.equal(state.snapshot.error, undefined);
      } else if (mode !== 'success') assert.equal(state.target.id, mode === 'queued-then-user' ? 'notice-latest' : 'notice-test');
      report.cases.push(`notification-${mode}`);
    } catch (error) { report.failures.push({ mode: `notification-${mode}`, message: error.message }); }
    finally { await page.close(); }
  }
} finally {
  const artifact = process.env.DSHM_RECOVERY_ARTIFACT ?? 'remote-app-recovery';
  assert.match(artifact, /^[a-z0-9-]+$/);
  await writeFile(`artifacts/${artifact}.json`, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report)); await browser.close(); await new Promise(resolve => server.close(resolve));
}
if (report.failures.length) process.exitCode = 1;
