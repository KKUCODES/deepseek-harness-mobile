import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { chromium } from 'playwright';
import { createRequire } from 'node:module';
import { resolve, dirname } from 'node:path';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { remoteSourceAliases } from './remote-source-aliases.mjs';
import { checkRemoteHistoryScale } from './check-remote-history-scale.mjs';
import { checkSidebarRendering } from './check-sidebar-rendering.mjs';
import { checkRemoteResizeFollow } from './check-remote-resize-follow.mjs';

// 仅在测试包计数；通过原会话投影和实际 RemoteWorkspace 检查历史渲染。
const root = resolve(import.meta.dirname, '..'), require = createRequire(import.meta.url);
const directory = resolve(root, 'artifacts/tests/remote-rendering');
await mkdir(directory, { recursive: true });
await build({ absWorkingDir: root, entryPoints: ['tests/fixtures/remote-plugin-slots.jsx'], outfile: resolve(directory, 'test.js'), bundle: true, format: 'esm', platform: 'browser', logLevel: 'silent',
  loader: { '.module.css': 'local-css', '.svg': 'file', '.woff2': 'file', '.woff': 'file', '.ttf': 'file' }, nodePaths: [resolve(root, 'node_modules')],
  alias: { ...remoteSourceAliases(root), '@upstream': resolve(root, '../deepseek-harness/packages/client'), react: dirname(require.resolve('react/package.json')),
    'node:module': resolve(root, '../deepseek-harness/apps/web/src/node-module-stub.ts'),
    '@deepseek-ai/cordis': require.resolve('@deepseek-ai/cordis'), '@deepseek-ai/dsh-client-store': require.resolve('@deepseek-ai/dsh-client-store'),
    '@deepseek-ai/dsh-client-ui-slots': require.resolve('@deepseek-ai/dsh-client-ui-slots'), '@deepseek-ai/dsh-client-ui-primitives': require.resolve('@deepseek-ai/dsh-client-ui-primitives'),
    '@deepseek-ai/dsh-util-values': resolve(root, '../deepseek-harness/packages/util/values/src/index.ts'),
    '@deepseek-ai/dsh-file-reference/grammar': resolve(root, '../deepseek-harness/packages/context/file-reference/src/grammar.ts') },
  define: { 'process.env.NODE_ENV': '"production"', 'process.versions.node': '"0.0.0"', 'process.execArgv': '[]', 'process.env.CORDIS_SHARED': 'undefined' },
  plugins: [{ name: 'count-message-renders', setup(bundler) {
    bundler.onLoad({ filter: /[\\/]src[\\/]remote-plugin-slots\.jsx$/ }, async ({ path }) => {
      const source = await readFile(path, 'utf8'), anchor = 'function MainFactoryOccurrence({ host }) {';
      assert.equal(source.split(anchor).length, 2);
      return { contents: source.replace(anchor, `${anchor}\nwindow.__mainFactoryRenders = (window.__mainFactoryRenders ?? 0) + 1;`), loader: 'jsx' };
    });
    bundler.onLoad({ filter: /[\\/]RemoteWorkspace\.jsx$/ }, async ({ path }) => {
      const source = await readFile(path, 'utf8'), anchor = 'export function RemoteWorkspace({ model, onBack, onConnection, embedded = false, renderConversation }) {';
      assert.equal(source.split(anchor).length, 2);
      return { contents: source.replace(anchor, `${anchor}\nwindow.__workspaceRenders = (window.__workspaceRenders ?? 0) + 1;`), loader: 'jsx' };
    });
    bundler.onLoad({ filter: /[\\/]RemoteMessage\.jsx$/ }, async ({ path }) => {
      const source = await readFile(path, 'utf8'), anchor = 'const data = node.data;';
      assert.equal(source.split(anchor).length, 2);
      return { contents: source.replace(anchor, `${anchor}
        const counts = window.__messageRenders ??= {};
        counts[node.key] = { kind: node.kind, count: (counts[node.key]?.count ?? 0) + 1 };`), loader: 'jsx' };
    });
  } }],
});
const server = createServer(async (req, res) => {
  if (req.url === '/') return res.setHeader('Content-Type', 'text/html').end('<div id="app"></div><script type="module" src="/test.js"></script>');
  if (req.url === '/test.js') return res.setHeader('Content-Type', 'text/javascript').end(await readFile(resolve(directory, 'test.js')));
  res.writeHead(404).end();
});
server.listen(0, '127.0.0.1'); await once(server, 'listening');
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const report = { at: new Date().toISOString(), errors: [] };
try {
  const page = await browser.newPage({ viewport: { width: 375, height: 667 } });
  page.on('pageerror', error => report.errors.push(error.message));
  await page.goto(`http://127.0.0.1:${server.address().port}/`);
  await page.waitForFunction(() => !!window.fixture);
  await page.evaluate(async () => { await window.fixture.enable(); await window.fixture.select('one'); window.fixture.emitTurn('one', 1, 0); });
  await page.getByText('Reply one 1', { exact: true }).waitFor();
  await page.getByTestId('plugin-tail').waitFor();
  const settle = () => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  await settle();
  const pluginCount = Number(await page.getByTestId('plugin-tail').getAttribute('data-count'));
  const before = await page.evaluate(() => window.__messageRenders);
  const input = page.getByRole('textbox', { name: '消息', exact: true });
  await input.fill('typing must not redraw history'); await settle();
  report.draft = await page.evaluate(() => window.__messageRenders);
  await page.evaluate(() => window.fixture.emitTurn('one', 2, 5));
  await page.getByText('Reply one 2', { exact: true }).waitFor(); await settle();
  report.before = before;
  report.after = await page.evaluate(() => window.__messageRenders);
  assert.ok(Object.values(before).some(item => item.kind === 'assistant-step'));
  for (const [key, item] of Object.entries(before)) {
    assert.equal(report.draft[key].count, item.count, '草稿更新不应重画已完成回复');
    assert.equal(report.after[key].count, item.count, '新回复不应重画已完成回复');
  }
  // memo 不得切断原插件的会话订阅，也不应阻止热启用/卸载。
  assert.ok(Number(await page.getByTestId('plugin-tail').first().getAttribute('data-count')) > pluginCount);
  await page.evaluate(() => window.fixture.status('one', true));
  await page.waitForFunction(() => [...document.querySelectorAll('[data-testid="plugin-tail"]')].every(node => node.dataset.running === 'true'));
  await page.evaluate(() => window.fixture.status('one', false));
  await page.waitForFunction(() => [...document.querySelectorAll('[data-testid="plugin-tail"]')].every(node => node.dataset.running === 'false'));
  await page.evaluate(() => window.fixture.disable());
  await page.getByTestId('plugin-tail').first().waitFor({ state: 'detached' });
  await page.evaluate(() => window.fixture.enable());
  await page.getByTestId('plugin-tail').first().waitFor();
  assert.equal(await page.getByTestId('plugin-tail').count(), 2);
  assert.equal(await input.innerText(), 'typing must not redraw history');
  if (process.argv.includes('--scale')) report.scale = await checkRemoteHistoryScale(page);
  if (process.argv.includes('--resize-follow')) {
    for (const path of ['src/ui/mobile.css', 'src/ui/remote-product.css', 'artifacts/tests/remote-rendering/test.css']) await page.addStyleTag({ path });
    report.resizeFollow = await checkRemoteResizeFollow(page, page.getByRole('region', { name: '聊天内容', exact: true }));
  }
  if (process.argv.includes('--sidebar-scale')) report.sidebar = await checkSidebarRendering(page);
  assert.deepEqual(report.errors, []);
  report.passed = true;
} catch (error) { report.failure = error.message; throw error; }
finally {
  await writeFile(resolve(root, process.argv.includes('--sidebar-scale') ? 'artifacts/remote-sidebar-scale.json' : process.argv.includes('--scale') ? 'artifacts/remote-history-scale.json' : 'artifacts/remote-rendering.json'), JSON.stringify(report, null, 2));
  await browser.close(); server.close();
}
console.log(JSON.stringify(report));
