import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { chromium } from 'playwright';
import { createRequire } from 'node:module';
import { resolve, dirname } from 'node:path';
import { mkdir, readFile, writeFile, access } from 'node:fs/promises';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { latestMobileBuild } from './latest-mobile-build.mjs';

const tag = process.argv[2]; assert.match(tag ?? '', /^[a-z-]+$/); assert.equal(process.argv.length, 3);
const root = resolve(import.meta.dirname, '..'), latest = latestMobileBuild(root), require = createRequire(import.meta.url);
const dir = resolve(root, 'artifacts/tests/latest-turn-process'), output = resolve(root, `artifacts/latest-turn-process-${tag}.json`);
await assert.rejects(access(output), { code: 'ENOENT' }); await mkdir(dir, { recursive: true });
await build({ absWorkingDir: root, entryPoints: ['tests/fixtures/latest-turn-process.jsx'], outfile: resolve(dir, 'test.js'),
  bundle: true, format: 'esm', platform: 'browser', jsx: 'automatic', logLevel: 'silent', plugins: [latest.resolver],
  nodePaths: [resolve(latest.runtime, 'node_modules'), resolve(root, 'node_modules')],
  alias: { ...latest.alias, react: dirname(require.resolve('react/package.json')) },
  loader: { '.module.css': 'local-css', '.svg': 'file', '.png': 'file', '.woff2': 'file', '.woff': 'file', '.ttf': 'file' },
  define: { 'process.env.NODE_ENV': '"production"' } });
const server = createServer(async (req, res) => {
  if (req.url === '/') return res.setHeader('Content-Type', 'text/html').end('<div id="app"></div><link rel="stylesheet" href="/test.css"><script type="module" src="/test.js"></script>');
  if (req.url === '/test.js' || req.url === '/test.css') return res.setHeader('Content-Type', req.url.endsWith('.js') ? 'text/javascript' : 'text/css').end(await readFile(resolve(dir, req.url.slice(1))));
  res.writeHead(404).end();
});
server.listen(0, '127.0.0.1'); await once(server, 'listening');
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const report = { at: new Date().toISOString(), sdk: latest.version, replayOnly: true, passed: false, errors: [] };
try {
  const page = await browser.newPage({ viewport: { width: 375, height: 667 } }); page.setDefaultTimeout(3000);
  page.on('pageerror', error => report.errors.push(error.message));
  await page.goto(`http://127.0.0.1:${server.address().port}/`);
  await page.locator('[data-case="main"] [data-turn-blocked]').waitFor({ state: 'attached' });
  report.beforeAssertions = await page.locator('[data-case]').evaluateAll(rows => rows.map(row => ({ id: row.dataset.case,
    blocked: row.querySelector('[data-turn-blocked]')?.innerText,
    hidden: row.querySelector('[data-chat-flow-kind="turn-blocked"]')?.getAttribute('hidden'),
    summary: row.querySelector('button[data-turn-process]')?.innerText ?? null })));
  for (const id of ['main', 'aside']) {
    const section = page.locator(`[data-case="${id}"]`);
    await section.locator('[data-turn-blocked]').waitFor();
    assert.equal(await section.locator('[data-turn-blocked]').innerText(), '本轮任务受阻，未继续执行。');
    assert.equal(await section.locator('button[data-turn-process]').count(), 0);
    assert.equal(await section.locator('[data-turn-process-hidden="true"]').count(), 0);
  }
  assert.equal(await page.locator('[data-case="completed"] [data-chat-flow-kind="turn-blocked"]').getAttribute('hidden'), 'until-found');
  for (const id of ['aborted', 'error', 'interrupted', 'interrupted-aside', 'running']) assert.equal(await page.locator(`[data-case="${id}"] [data-chat-flow-kind="turn-blocked"]`).getAttribute('hidden'), null);
  assert.equal(await page.locator('[data-case="aborted"] button[data-turn-process]').innerText(), '已停止');
  assert.equal(await page.locator('[data-case="error"] button[data-turn-process]').innerText(), '执行失败');
  for (const id of ['interrupted', 'interrupted-aside']) {
    const interrupted = page.locator(`[data-case="${id}"]`);
    assert.equal(await interrupted.locator('button[data-turn-process]').innerText(), '已中断');
    assert.equal(await interrupted.locator('button[data-turn-process]').isDisabled(), true);
    assert.equal(await interrupted.locator('button[data-turn-process]').getAttribute('aria-expanded'), 'true');
    assert.equal(await interrupted.locator('[role="status"][aria-live="polite"]').innerText(), '已中断');
  }
  assert.deepEqual(report.errors, []); report.passed = true;
} catch (error) { report.failure = { name: error.name, message: error.message.split('\n')[0] }; process.exitCode = 1; }
finally { await browser.close(); server.close(); await writeFile(output, JSON.stringify(report, null, 2), { flag: 'wx' }); }
console.log(JSON.stringify(report));
