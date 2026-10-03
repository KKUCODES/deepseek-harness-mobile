import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { chromium } from 'playwright';
import { createRequire } from 'node:module';
import { resolve, dirname } from 'node:path';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { once } from 'node:events';

const root = resolve(import.meta.dirname, '..'), require = createRequire(import.meta.url);
const output = resolve(root, 'artifacts/tests/composer-focus');
await mkdir(output, { recursive: true });
await build({ absWorkingDir: root, entryPoints: ['tests/fixtures/composer-focus.jsx'], outfile: resolve(output, 'test.js'), bundle: true, format: 'esm', logLevel: 'silent',
  alias: { '@upstream': resolve(root, '../deepseek-harness/packages/client'), react: dirname(require.resolve('react/package.json')) },
  nodePaths: [resolve(root, 'node_modules')], loader: { '.module.css': 'local-css' } });
const server = createServer(async (req, res) => {
  if (req.url === '/') return res.setHeader('Content-Type', 'text/html').end('<meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/test.css"><div id="app"></div><script type="module" src="/test.js"></script>');
  if (['/test.js', '/test.css'].includes(req.url)) return res.setHeader('Content-Type', req.url.endsWith('.css') ? 'text/css' : 'text/javascript').end(await readFile(resolve(output, req.url.slice(1))));
  res.writeHead(404).end();
});
server.listen(0, '127.0.0.1'); await once(server, 'listening');
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const report = { errors: [], cases: [] };
try {
  for (const touch of [false, true]) {
    const page = await browser.newPage({ viewport: { width: 375, height: 667 }, hasTouch: touch });
    page.on('pageerror', error => report.errors.push(error.message));
    await page.goto(`http://127.0.0.1:${server.address().port}/`);
    const input = page.getByRole('textbox', { name: '消息', exact: true }), choice = page.getByRole('checkbox', { name: '继续验证', exact: true });
    await input.fill('保留草稿');
    await choice.scrollIntoViewIfNeeded();
    // 等初始展开动画结束，再验证一次完整按下/松开，不自动补第二次点击。
    await page.waitForFunction(() => document.getAnimations().every(animation => animation.playState !== 'running'));
    const before = await choice.boundingBox();
    if (touch) await page.touchscreen.tap(before.x + before.width / 2, before.y + before.height / 2);
    else {
      await page.mouse.move(before.x + before.width / 2, before.y + before.height / 2); await page.mouse.down();
      const during = await choice.boundingBox();
      assert.ok(Math.abs(during.y - before.y) < 1, '按下期间输入框不能收起并移动点击目标');
      await page.mouse.up();
    }
    assert.equal(await choice.isChecked(), true, `第一次点击必须选中 (touch=${touch})`);
    await page.locator('[data-composer-card].is-compact').waitFor();
    assert.equal(await input.inputValue(), '保留草稿');
    await input.focus(); await input.press('Tab');
    await page.getByRole('button', { name: '添加附件', exact: true }).press('Shift+Tab');
    await input.press('Escape'); await page.locator('[data-composer-card].is-compact').waitFor();
    report.cases.push({ touch, firstTap: true, draftPreserved: true, escapeCollapse: true });
    await page.close();
  }
  assert.deepEqual(report.errors, []);
  await writeFile(resolve(root, 'artifacts/composer-focus-web.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report));
} finally { await browser.close(); server.close(); }
