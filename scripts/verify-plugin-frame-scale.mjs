import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { readFile, writeFile, mkdir } from 'node:fs/promises';

const prefix = process.env.DSHM_FRAME_PREFIX ?? 'plugin-frame-scale';
assert.match(prefix, /^[a-z0-9-]+$/);
await mkdir('artifacts/tests/plugin-frame-scale', { recursive: true });
await build({ entryPoints: ['tests/fixtures/plugin-frame-scale.jsx'], outfile: 'artifacts/tests/plugin-frame-scale/test.js',
  bundle: true, platform: 'browser', format: 'esm', jsx: 'automatic', define: { 'process.env.NODE_ENV': '"production"' } });
const server = createServer(async (req, res) => {
  if (req.url === '/') return res.setHeader('Content-Type', 'text/html').end('<div id="app"></div><script type="module" src="/test.js"></script>');
  if (req.url === '/test.js') return res.setHeader('Content-Type', 'text/javascript').end(await readFile('artifacts/tests/plugin-frame-scale/test.js'));
  res.writeHead(404).end();
});
server.listen(0, '127.0.0.1'); await once(server, 'listening');
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const report = { errors: [], environment: 'Desktop Edge 375x667; actual MobilePluginFrame, 200 independent plugins' };
try {
  const page = await browser.newPage({ viewport: { width: 375, height: 667 } });
  page.on('pageerror', error => report.errors.push(error.message));
  await page.goto(`http://127.0.0.1:${server.address().port}`);
  await page.waitForFunction(() => window.frameFixture);
  const cdp = await page.context().newCDPSession(page); await cdp.send('Performance.enable');
  const metric = async () => Object.fromEntries((await cdp.send('Performance.getMetrics')).metrics.map(item => [item.name, item.value]));
  const before = await metric();
  await page.evaluate(() => window.frameFixture.setCount(200));
  await page.waitForFunction(() => {
    const buttons = [...document.querySelectorAll('[data-plugin-frame] button')];
    return buttons.length === 200 && buttons.every(button => Math.abs(button.getBoundingClientRect().width - 320) < 1);
  });
  const after = await metric();
  report.layoutCount = after.LayoutCount - before.LayoutCount;
  report.layoutMs = (after.LayoutDuration - before.LayoutDuration) * 1000;
  report.scriptMs = (after.ScriptDuration - before.ScriptDuration) * 1000;
  await page.getByRole('button', { name: 'Plugin 0', exact: true }).click();
  assert.equal(await page.getByRole('button', { name: 'Plugin 0', exact: true }).getAttribute('data-clicked'), 'yes');
  await page.evaluate(() => window.frameFixture.toggle(false));
  await page.waitForFunction(() => document.querySelector('button').getBoundingClientRect().width === 600);
  await page.evaluate(() => window.frameFixture.toggle(true));
  await page.waitForFunction(() => Math.abs(document.querySelector('button').getBoundingClientRect().width - 320) < 1);
  await page.evaluate(() => window.frameFixture.setCount(0));
  await page.waitForFunction(() => document.querySelectorAll('[data-plugin-frame]').length === 0);
  assert.deepEqual(report.errors, []);
  if (process.argv.includes('--assert-batched')) assert.ok(report.layoutCount < 20, `200个插件不应触发逐项布局，实际 ${report.layoutCount}`);
  report.ok = true;
} catch (error) { report.failure = error.message; process.exitCode = 1; }
finally { await writeFile(`artifacts/${prefix}.json`, JSON.stringify(report, null, 2)); console.log(JSON.stringify(report)); await browser.close(); server.close(); }
