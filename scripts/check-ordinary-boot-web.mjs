import assert from 'node:assert/strict';
import { once } from 'node:events';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { chromium } from 'playwright';
import { createValidationServer } from './serve.mjs';
import { checkOrdinaryInput } from './check-ordinary-input.mjs';

const latest = process.argv.includes('--latest-candidate');
assert.ok(process.argv.slice(2).every(arg => arg === '--latest-candidate'));
const root = resolve(import.meta.dirname, '..');
const dist = resolve(root, latest ? 'artifacts/latest-mobile-dist' : 'dist');
const artifacts = JSON.parse(await readFile(resolve(dist, 'plugin-artifacts.json'), 'utf8'));
for (const entry of artifacts.filter(item => item.id.startsWith('@deepseek-ai/dsh-')))
  assert.equal(entry.version, latest ? '0.2.1-alpha.1' : '0.1.6-alpha.2');
const server = createValidationServer(dist), report = { at: new Date().toISOString(), latest, pageErrors: [], consoleErrors: [] };
server.listen(0, '127.0.0.1'); await once(server, 'listening');
let browser;
try {
  browser = await chromium.launch({ channel: 'msedge', headless: true });
  const page = await browser.newPage({ viewport: { width: 375, height: 667 } });
  page.on('pageerror', error => report.pageErrors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') report.consoleErrors.push(message.text()); });
  await page.goto(`http://127.0.0.1:${server.address().port}/mobile.html`);
  await page.waitForFunction(() => document.getElementById('app')?.textContent.includes('启动失败')
    || document.querySelector('button[aria-label="打开侧边抽屉"]'), undefined, { timeout: 20000 });
  report.startupText = (await page.locator('body').innerText()).slice(0, 600);
  assert.equal(report.startupText.includes('启动失败'), false, report.startupText);
  await page.getByRole('button', { name: '打开侧边抽屉', exact: true }).click();
  await page.getByRole('button', { name: 'Remote', exact: true }).waitFor();
  // 同一套实际插件还须能绑定聊天、插入提示词、卸载重载及保留草稿。
  await page.goto(`http://127.0.0.1:${server.address().port}/index.html`);
  await page.getByTestId('ready').waitFor();
  report.inputLifecycle = await checkOrdinaryInput(page);
  await page.getByRole('button', { name: '深色', exact: true }).click();
  await page.getByRole('button', { name: '增大字号', exact: true }).click();
  await page.waitForFunction(() => window.dshmValidation.snapshot().settings.value.fontSize === 15);
  await page.reload(); await page.getByTestId('ready').waitFor();
  assert.deepEqual(await page.evaluate(() => window.dshmValidation.snapshot().settings.value), { preference: 'dark', fontSize: 15 });
  await page.waitForFunction(() => document.body.hasAttribute('data-ds-dark-theme'));
  assert.equal(await page.evaluate(() => document.body.style.getPropertyValue('--dsh-content-font-size')), '15px');
  await page.getByRole('button', { name: '中文', exact: true }).click();
  await page.getByRole('menuitem', { name: 'English', exact: true }).click();
  await page.reload(); await page.getByTestId('ready').waitFor();
  await page.getByRole('button', { name: 'English', exact: true }).waitFor();
  report.originalAppearanceWritesPersisted = true;
  assert.deepEqual(report.pageErrors, []); assert.deepEqual(report.consoleErrors, []);
  report.originalOrdinaryPageAndRemoteEntry = true; report.passed = true;
} catch (error) { report.passed = false; report.error = error.message; throw error; }
finally {
  await browser?.close(); await new Promise(resolve => server.close(resolve));
  await writeFile(resolve(root, latest ? 'artifacts/latest-mobile-runtime/ordinary-boot-web.json' : 'artifacts/ordinary-boot-web.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify(report));
}
