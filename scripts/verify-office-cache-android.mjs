import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir, unlink, rmdir } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { _android } from 'playwright';
import { androidAppWebView } from './android-app-webview.mjs';

const root = resolve('../DSH-TEST/dshm-office-cache-20260926'), path = resolve(root, 'cache.docx');
assert.equal(dirname(root), resolve('../DSH-TEST'));
const original = await readFile('artifacts/dshm-office-1790187656727.docx');
const corrupt = Buffer.from('DSHM_OFFICE_CACHE_CORRUPT_TEST');
const prepare = process.argv.includes('--prepare');
if (prepare) {
  await mkdir(root); await writeFile(path, original, { flag: 'wx' }); console.log('Prepared dedicated Office cache file');
} else {
  const device = (await _android.devices({ omitDriverInstall: true })).find(item => item.serial() === process.env.DSHM_ANDROID_SERIAL);
  assert.ok(device); device.setDefaultTimeout(20000);
  const report = { at: new Date().toISOString(), errors: [] }; let page;
  try {
    const context = (await (await androidAppWebView(device)).page()).context();
    page = context.pages().find(item => item.url().startsWith('https://remote.dshm.invalid/'));
    if (!page) {
      const ordinary = context.pages().find(item => item.url().startsWith('https://appassets.androidplatform.net/'));
      await ordinary.getByRole('button', { name: '打开侧边抽屉', exact: true }).click();
      const opened = context.waitForEvent('page'); await ordinary.getByRole('button', { name: 'Remote', exact: true }).click(); await opened;
      page = context.pages().find(item => item.url().startsWith('https://remote.dshm.invalid/'));
    }
    assert.ok(page); page.setDefaultTimeout(25000); page.on('pageerror', e => report.errors.push(e.message));
    await page.getByTestId('remote-workspace').waitFor();
    const panel = page.getByRole('region', { name: '插件面板', exact: true });
    if (await panel.isVisible()) await panel.getByRole('button', { name: '返回聊天', exact: true }).click();
    if (!await page.getByRole('region', { name: '聊天内容', exact: true }).count()) await page.getByRole('button', { name: /^DSHM Remote 联调提示/ }).click();
    assert.equal(await page.getByTestId('remote-workspace').locator('.remote-heading').innerText(), 'DSHM Remote 联调提示');
    const draft = await page.getByRole('textbox', { name: '消息', exact: true }).innerText();
    // 只记录所测只读操作的名称，不读取凭据、响应或更改真实消息。
    await page.evaluate(() => {
      const bridge = window.DSHMRemote, send = bridge.postMessage.bind(bridge);
      window.__officeRequests = []; window.__restoreOfficeProbe = () => { bridge.postMessage = send; };
      bridge.postMessage = raw => {
        const value = JSON.parse(raw), op = value.data?.frame?.operation;
        if (value.op === 'socket.send' && op && (op.method === 'remote.office' || op.endpoint === 'officeToPdf/generation'
          || op.endpoint === 'workspaceFiles/readBytes' && op.payload?.args?.path?.endsWith('cache.docx')))
          window.__officeRequests.push({ method: op.method, endpoint: op.endpoint, priority: op.priority, range: op.payload?.args?.range });
        return send(raw);
      };
    });
    await page.getByRole('button', { name: 'Remote 选项', exact: true }).click();
    await page.getByRole('button', { name: '插件面板', exact: true }).click();
    const filesTab = panel.locator('nav').getByRole('button', { name: '文件', exact: true });
    if (await filesTab.count()) await filesTab.click(); else await panel.getByRole('button', { name: /工作区文件/ }).click();
    const tree = panel.locator('[data-files-state="tree"]'); await tree.waitFor();
    const folder = tree.getByRole('button', { name: 'dshm-office-cache-20260926', exact: true });
    if (await folder.getAttribute('aria-expanded') !== 'true') await folder.click();
    await tree.getByRole('button', { name: 'cache.docx', exact: true }).click();
    const current = panel.locator('.remote-document-tab:not([hidden])');
    const rendered = async () => {
      await current.locator('[data-pdf-text]').getByText(/Office preview/).first().waitFor({ timeout: 90000 });
      assert.ok(await current.locator('canvas').first().evaluate(c => c.width > 0 && c.height > 0));
    };
    const requests = () => page.evaluate(() => window.__officeRequests);
    const conversions = async () => (await requests()).filter(op => op.method === 'remote.office').length;
    await rendered(); assert.equal(await conversions(), 1);
    assert.equal((await requests()).find(op => op.method === 'remote.office').priority, 'foreground');
    report.initial = await requests();
    await current.locator('[data-textpreview-tool="reload"]').click();
    await page.waitForFunction(() => window.__officeRequests.filter(op => op.endpoint === 'officeToPdf/generation').length >= 2);
    await rendered(); assert.equal(await conversions(), 1); report.reusedWithoutPdfTransfer = true;
    assert.ok((await requests()).filter(op => op.endpoint === 'workspaceFiles/readBytes' && op.range?.length === 1).length >= 2);
    await device.screenshot({ path: 'artifacts/office-cache-hit-android.png' });
    assert.deepEqual(await readFile(path), original); await writeFile(path, corrupt);
    await current.locator('[data-textpreview-tool="reload"]').click();
    await current.locator('[data-textpreview-failed]').waitFor({ timeout: 90000 });
    assert.equal(await current.locator('canvas').count(), 0); assert.equal(await conversions(), 2); report.changedRejected = true;
    await device.screenshot({ path: 'artifacts/office-cache-changed-android.png' });
    assert.deepEqual(await readFile(path), corrupt); await writeFile(path, original);
    await current.locator('[data-textpreview-tool="reload"]').click(); await rendered();
    assert.equal(await conversions(), 3); report.restored = true;
    assert.deepEqual(await readFile(path), original); await unlink(path);
    await current.locator('[data-textpreview-tool="reload"]').click();
    await current.locator('[data-textpreview-failed]').waitFor();
    assert.equal(await current.locator('canvas').count(), 0); assert.equal(await conversions(), 3); report.deletedDeniedBeforeTransfer = true;
    await panel.getByRole('button', { name: '面板操作', exact: true }).click();
    await page.getByRole('menuitem', { name: '关闭当前面板', exact: true }).click();
    if (await panel.isVisible()) await panel.getByRole('button', { name: '返回聊天', exact: true }).click();
    assert.equal(await page.getByRole('textbox', { name: '消息', exact: true }).innerText(), draft); report.draftPreserved = true;
    assert.equal(page.workers().length, 0); report.workersReleased = true;
    await rmdir(root); report.testFilesRemoved = true; report.requests = await requests();
    assert.deepEqual(report.errors, []);
  } catch (e) { report.failure = e.message; if (page) { report.body = (await page.locator('body').innerText()).slice(-3500); await page.screenshot({ path: 'artifacts/office-cache-failure.png' }); } throw e; }
  finally {
    if (page) await page.evaluate(() => window.__restoreOfficeProbe?.()).catch(() => {});
    await writeFile('artifacts/office-cache-android.json', JSON.stringify(report, null, 2)); console.log(JSON.stringify(report)); await device.close();
  }
}
