import assert from 'node:assert/strict';
import { once } from 'node:events';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { chromium } from 'playwright';
import { createValidationServer } from './serve.mjs';

assert.ok(process.argv.length === 2 || (process.argv.length === 3 && process.argv[2] === '--alpha1'));
const alpha1 = process.argv[2] === '--alpha1';
const root = resolve(import.meta.dirname, '..');
const dist = resolve(root, 'artifacts', alpha1 ? 'official-mobile-dist' : 'official-alpha2-mobile-dist');
const version = alpha1 ? '0.2.1-alpha.1' : '0.2.1-alpha.2';
const versions = JSON.parse(await readFile(resolve(dist, 'sdk-versions.json'), 'utf8'));
for (const [name, actual] of Object.entries(versions)) if (name.startsWith('@deepseek-ai/dsh-')) assert.equal(actual, version);
const report = { at: new Date().toISOString(), version, pages: [], passed: false };
const server = createValidationServer(dist);
server.listen(0, '127.0.0.1'); await once(server, 'listening');
let browser;
try {
  browser = await chromium.launch({ channel: 'msedge', headless: true });
  // 浏览器没有 Android 桥；这里只验真实页面启动，不伪造 binding 或配对结果。
  for (const [route, ready] of [['remote.html', '.remote-topbar'],
    ['mobile.html', 'button[aria-label="打开侧边抽屉"]']]) {
    const page = await browser.newPage({ viewport: { width: 375, height: 667 } });
    const item = { route, pageErrors: [], ready: false };
    report.pages.push(item);
    page.on('pageerror', error => item.pageErrors.push({ message: error.message, stack: error.stack }));
    await page.goto(`http://127.0.0.1:${server.address().port}/${route}`);
    await page.waitForFunction(selector => document.querySelector(selector), ready, { timeout: 4000 })
      .then(() => { item.ready = true; }, () => {});
    item.text = (await page.locator('body').innerText()).slice(0, 600);
    await page.close();
  }
  assert.ok(report.pages.every(item => item.ready && item.pageErrors.length === 0), JSON.stringify(report.pages));
  report.passed = true;
} finally {
  await browser?.close(); await new Promise(done => server.close(done));
  const path = resolve(dist, `startup-${Date.now()}.json`);
  await writeFile(path, JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify({ path, ...report }));
}
