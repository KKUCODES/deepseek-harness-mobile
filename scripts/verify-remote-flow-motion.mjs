import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { chromium } from 'playwright';
import { createRequire } from 'node:module';
import { resolve, dirname } from 'node:path';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { latestMobileBuild } from './latest-mobile-build.mjs';

const root = resolve(import.meta.dirname, '..'), require = createRequire(import.meta.url);
const latest = latestMobileBuild(root, { officialOnly: true, officialVersion: '0.2.1-alpha.2' });
const output = resolve(root, 'artifacts/tests/remote-flow-motion'); await mkdir(output, { recursive: true });
await build({ absWorkingDir: root, entryPoints: ['tests/fixtures/remote-flow-motion.jsx'], outfile: resolve(output, 'test.js'),
  bundle: true, format: 'esm', platform: 'browser', jsx: 'automatic', logLevel: 'silent', plugins: [latest.resolver],
  nodePaths: [resolve(latest.runtime, 'node_modules'), resolve(root, 'node_modules')],
  alias: { ...latest.alias, react: dirname(require.resolve('react/package.json')) },
  loader: { '.module.css': 'local-css', '.svg': 'file', '.png': 'file', '.woff2': 'file', '.woff': 'file', '.ttf': 'file' }, define: { 'process.env.NODE_ENV': '"production"' } });
const server = createServer(async (req, res) => {
  if (req.url === '/') return res.setHeader('Content-Type', 'text/html').end('<div id="app"></div><link rel="stylesheet" href="/test.css"><script type="module" src="/test.js"></script>');
  if (['/test.js', '/test.css'].includes(req.url)) return res.setHeader('Content-Type', req.url.endsWith('.css') ? 'text/css' : 'text/javascript').end(await readFile(resolve(output, req.url.slice(1))));
  res.writeHead(404).end();
});
server.listen(0, '127.0.0.1'); await once(server, 'listening');
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const report = { sdk: latest.version, componentReplayOnly: true, passed: false, cases: [], errors: [] };
try {
  const page = await browser.newPage({ viewport: { width: 375, height: 667 } }); page.setDefaultTimeout(5000);
  page.on('pageerror', error => report.errors.push(error.message));
  await page.goto(`http://127.0.0.1:${server.address().port}/`);
  for (const id of ['main', 'aside']) {
    const scope = page.locator(`[data-case="${id}"]`), row = scope.locator('[data-chat-flow-kind="tool-call"]');
    const button = scope.locator('[data-turn-process]');
    await button.waitFor(); assert.equal(await row.getAttribute('hidden'), 'until-found');
    await button.click();
    await row.locator('input').waitFor(); await row.locator('input').fill('保留局部草稿');
    await page.waitForFunction(() => !document.querySelector('[data-chat-motion="reveal"], [data-chat-motion="collapse"]'));
    await button.click();
    await page.waitForFunction(() => !document.querySelector('[data-chat-motion="reveal"], [data-chat-motion="collapse"]'));
    assert.equal(await row.getAttribute('hidden'), 'until-found');
    await button.click();
    await page.waitForFunction(() => !document.querySelector('[data-chat-motion="reveal"], [data-chat-motion="collapse"]'));
    assert.equal(await row.locator('input').inputValue(), '保留局部草稿');
    for (let index = 0; index < 6; index++) await button.evaluate(element => element.click());
    await page.waitForFunction(() => !document.querySelector('[data-chat-motion="reveal"], [data-chat-motion="collapse"]'));
    assert.equal(await row.evaluate(element => element.style.height + element.style.overflow + element.style.transition), '');
    report.cases.push({ id, expandCollapse: true, draftPreserved: true, interruptClean: true });
  }
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.locator('[data-case="main"] [data-turn-process]').click();
  assert.equal(await page.locator('[data-chat-motion="reveal"], [data-chat-motion="collapse"]').count(), 0);
  report.reducedMotion = true; assert.deepEqual(report.errors, []); report.passed = true;
} catch (error) { report.failure = error.message; process.exitCode = 1; }
finally { await browser.close(); server.close(); await writeFile(resolve(root, 'artifacts/remote-flow-motion-web.json'), JSON.stringify(report, null, 2)); }
console.log(JSON.stringify(report));
