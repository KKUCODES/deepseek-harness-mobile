import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { chromium } from 'playwright';
import { createRequire } from 'node:module';
import { resolve, dirname } from 'node:path';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { once } from 'node:events';

const root = resolve(import.meta.dirname, '..'), require = createRequire(import.meta.url);
const output = resolve(root, 'artifacts/tests/markdown-cache');
await mkdir(output, { recursive: true });
await build({ absWorkingDir: root, entryPoints: ['tests/fixtures/markdown-cache.jsx'], outfile: resolve(output, 'test.js'), bundle: true, format: 'esm', logLevel: 'silent',
  alias: { '@upstream': resolve(root, '../deepseek-harness/packages/client'), react: dirname(require.resolve('react/package.json')) },
  nodePaths: [resolve(root, 'node_modules')], loader: { '.module.css': 'local-css', '.woff': 'file', '.woff2': 'file', '.ttf': 'file' },
  plugins: [{ name: 'test-only-parser-count', setup(builder) {
    // Instrument only the isolated test bundle; the upstream checkout stays read-only.
    builder.onLoad({ filter: /markdown[/\\]parse\.ts$/ }, async args => ({ loader: 'ts', contents: (await readFile(args.path, 'utf8'))
      .replace(/export function (parseGfm(?:WithMath)?)\(text: string\): Root \{/g, '$&\n(globalThis.__parseCalls ??= []).push({ parser: "$1", chars: text.length });') }));
  } }],
});
const server = createServer(async (req, res) => {
  if (req.url === '/') return res.setHeader('Content-Type', 'text/html').end('<div id="app"></div><script type="module" src="/test.js"></script>');
  if (req.url === '/test.js') return res.setHeader('Content-Type', 'text/javascript').end(await readFile(resolve(output, 'test.js')));
  res.writeHead(404).end();
});
server.listen(0, '127.0.0.1'); await once(server, 'listening');
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const report = { errors: [] };
try {
  const page = await browser.newPage(); page.on('pageerror', error => report.errors.push(error.message));
  await page.goto(`http://127.0.0.1:${server.address().port}/`);
  await page.getByRole('region', { name: '历史', exact: true }).waitFor();
  const original = await page.getByRole('region', { name: '历史', exact: true }).innerText();
  report.before = await page.evaluate(() => window.__parseCalls.length);
  for (let i = 0; i < 5; i++) await page.getByRole('button', { name: '更新无关状态', exact: true }).click();
  report.afterUnchanged = await page.evaluate(() => window.__parseCalls.length);
  assert.equal(report.afterUnchanged, report.before, 'Unrelated chat updates must not reparse settled history or reset the streaming parser');
  await page.evaluate(() => { window.__parseCalls = []; });
  await page.getByRole('button', { name: '继续生成', exact: true }).click();
  report.appendCalls = await page.evaluate(() => window.__parseCalls);
  assert.ok(report.appendCalls.length > 0);
  assert.ok(report.appendCalls.every(item => item.parser === 'parseGfm' && item.chars < 200), 'Streaming append must parse only the trailing blocks');
  assert.equal(await page.getByRole('region', { name: '历史', exact: true }).innerText(), original);
  assert.deepEqual(report.errors, []);
} catch (error) { report.failure = error.message; process.exitCode = 1; }
finally { await writeFile('artifacts/markdown-cache-web.json', JSON.stringify(report, null, 2)); console.log(JSON.stringify(report)); await browser.close(); server.close(); }
