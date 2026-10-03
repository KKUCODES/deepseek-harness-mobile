import assert from 'node:assert/strict';
import { mkdir, readFile, readdir, writeFile, unlink, rmdir } from 'node:fs/promises';
import { resolve, basename, dirname } from 'node:path';
import { _android } from 'playwright';
import { androidAppWebView } from './android-app-webview.mjs';

// 只在专用工作区创建临时网页；依赖缺失/恢复均由真实 Host 文件读取验证。
assert.equal(process.env.DSHM_RUN_LIVE, '1');
const root = resolve('../DSH-TEST', `dshm-html-retry-${Date.now()}`);
assert.equal(dirname(root), resolve('../DSH-TEST'));
const html = '<!doctype html><html><body><h1>DSHM HTML retry</h1><p id="result">waiting</p><script src="./ready.js"></script></body></html>';
const js = 'document.getElementById("result").textContent="DSHM_HTML_RECOVERED";';
const device = (await _android.devices({ omitDriverInstall: true })).find(d => d.serial() === process.env.DSHM_ANDROID_SERIAL);
assert.ok(device); device.setDefaultTimeout(25000);
const report = { at: new Date().toISOString(), errors: [], resources: [] };
let page, panel, created = false, dependency = false, draft;
try {
  await mkdir(root); created = true;
  await writeFile(resolve(root, 'retry.html'), html, { flag: 'wx' });
  await device.shell('am start -f 0x20020000 -n dev.dshmobile.validation/.ValidationActivity');
  const until = Date.now() + 20000;
  while (!(await device.shell('pidof dev.dshmobile.validation')).toString().trim() && Date.now() < until) await new Promise(resolve => setTimeout(resolve, 100));
  const context = (await (await androidAppWebView(device)).page()).context();
  const phone = context.pages().find(p => p.url().startsWith('https://appassets.androidplatform.net/'));
  assert.ok(phone);
  await phone.getByRole('button', { name: '打开侧边抽屉', exact: true }).click();
  await phone.getByRole('button', { name: 'Remote', exact: true }).click();
  while (!(page = context.pages().find(p => p.url().startsWith('https://remote.dshm.invalid/'))) && Date.now() < until) await new Promise(resolve => setTimeout(resolve, 100));
  assert.ok(page);
  page.on('pageerror', error => report.errors.push(error.message));
  page.on('response', response => { if (response.status() >= 400) report.resources.push({ path: new URL(response.url()).pathname, status: response.status() }); });
  await page.getByTestId('remote-workspace').waitFor({ timeout: 60000 });
  panel = page.getByRole('region', { name: '插件面板', exact: true });
  if (await panel.isVisible()) await panel.getByRole('button', { name: '返回聊天', exact: true }).click();
  if (!await page.getByRole('region', { name: '聊天内容', exact: true }).count()) await page.locator('.remote-session-row').filter({ hasText: 'DSHM Remote 联调提示' }).click();
  assert.equal(await page.getByTestId('remote-workspace').locator('.remote-heading').innerText(), 'DSHM Remote 联调提示');
  const editor = page.getByRole('textbox', { name: '消息', exact: true, includeHidden: true });
  draft = await editor.innerText();
  await page.getByRole('button', { name: 'Remote 选项', exact: true }).click();
  await page.getByRole('button', { name: '插件面板', exact: true }).click();
  const files = panel.locator('nav').getByRole('button', { name: '文件', exact: true });
  if (await files.count()) await files.click(); else await panel.getByRole('button', { name: /工作区文件/ }).click();
  const tree = panel.locator('[data-files-state="tree"]'); await tree.waitFor();
  assert.equal((await tree.getAttribute('data-files-root')).replaceAll('\\', '/').toLowerCase(), resolve('../DSH-TEST').replaceAll('\\', '/').toLowerCase());
  await tree.getByRole('button', { name: '重新读取', exact: true }).click();
  const folder = tree.getByRole('button', { name: basename(root), exact: true });
  await folder.waitFor(); if (await folder.getAttribute('aria-expanded') !== 'true') await folder.click();
  await tree.getByRole('button', { name: 'retry.html', exact: true }).click();
  const current = panel.locator('.remote-document-tab:not([hidden])');
  await current.getByRole('alert').waitFor();
  assert.equal(await current.locator('iframe').count(), 0);
  report.missingDependency = await current.getByRole('alert').innerText();
  await page.screenshot({ path: 'artifacts/html-retry-failure-android.png' });
  await writeFile(resolve(root, 'ready.js'), js, { flag: 'wx' }); dependency = true;
  await current.getByRole('button', { name: '重试', exact: true }).click();
  const frame = current.frameLocator('iframe');
  await frame.getByText('DSHM_HTML_RECOVERED', { exact: true }).waitFor();
  report.sandbox = await frame.locator('body').evaluate(() => ({ origin: self.origin, remote: typeof window.DSHMRemote, ordinary: typeof window.DSHMOrdinary }));
  assert.deepEqual(report.sandbox, { origin: 'null', remote: 'undefined', ordinary: 'undefined' });
  report.retryRecovered = true;
  await page.screenshot({ path: 'artifacts/html-retry-success-android.png' });
  await panel.getByRole('button', { name: '面板操作', exact: true }).click();
  await page.getByRole('menuitem', { name: '关闭当前面板', exact: true }).click();
  if (await panel.isVisible()) await panel.getByRole('button', { name: '返回聊天', exact: true }).click();
  assert.equal(await editor.innerText(), draft); report.draftPreserved = true;
  assert.deepEqual(report.errors, []); assert.deepEqual(report.resources, []);
} catch (error) { report.failure = error.stack; process.exitCode = 1; }
finally {
  try {
    if (panel && await panel.isVisible()) await panel.getByRole('button', { name: '返回聊天', exact: true }).click();
    if (created) {
      assert.deepEqual((await readdir(root)).sort(), dependency ? ['ready.js', 'retry.html'] : ['retry.html']);
      assert.equal(await readFile(resolve(root, 'retry.html'), 'utf8'), html);
      if (dependency) { assert.equal(await readFile(resolve(root, 'ready.js'), 'utf8'), js); await unlink(resolve(root, 'ready.js')); }
      await unlink(resolve(root, 'retry.html')); await rmdir(root); report.testFilesRemoved = true;
    }
  } catch (error) { report.cleanupFailure = error.stack; process.exitCode = 1; }
  await writeFile('artifacts/html-retry-android.json', JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report)); await device.close();
}
