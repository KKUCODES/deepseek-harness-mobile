import assert from 'node:assert/strict';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { resolve, sep } from 'node:path';
import { _android } from 'playwright';
import { androidAppWebView } from './android-app-webview.mjs';

const parent = resolve('../DSH-TEST'), root = resolve(parent, 'dshm-document-ui-20260926');
assert.ok(root.startsWith(parent + sep));
const contents = {
  'custom.dshmdoc': Array.from({ length: 5002 }, (_, index) => `预览行 ${index + 1} 🙂`).join('\n') + '\n',
  'readme.md': '# 手机文件预览\n\n**原 Markdown 组件**\n',
  'image.svg': '<svg xmlns="http://www.w3.org/2000/svg" width="160" height="100"><rect width="160" height="100" fill="#376ee7"/></svg>',
  'page.html': '<!doctype html><html><body><h1>DSHM isolated HTML</h1></body></html>',
  'document.pdf': await readFile('artifacts/dshm-pdf-1790183840471.pdf'),
  'document.docx': await readFile('artifacts/dshm-office-1790187656727.docx'),
};
if (process.argv.includes('--prepare') || process.argv.includes('--extend')) {
  if (!process.argv.includes('--extend')) await mkdir(root);
  for (const [name, text] of Object.entries(contents)) {
    if (process.argv.includes('--extend') && ['custom.dshmdoc', 'readme.md', 'image.svg'].includes(name)) continue;
    await writeFile(resolve(root, name), text, { flag: 'wx' });
  }
  console.log('Prepared dedicated document UI files');
} else {
  const cleanup = process.argv.includes('--cleanup');
  const device = (await _android.devices({ omitDriverInstall: true })).find(item => item.serial() === process.env.DSHM_ANDROID_SERIAL);
  assert.ok(device); device.setDefaultTimeout(20000);
  const report = { at: new Date().toISOString(), errors: [], resources: [] };
  let page;
  try {
    const first = await (await androidAppWebView(device)).page(), context = first.context();
    page = context.pages().find(item => item.url().startsWith('https://remote.dshm.invalid/'));
    if (!page) {
      const ordinary = context.pages().find(item => item.url().startsWith('https://appassets.androidplatform.net/'));
      await ordinary.getByRole('button', { name: '打开侧边抽屉', exact: true }).click();
      const opened = context.waitForEvent('page');
      await ordinary.getByRole('button', { name: 'Remote', exact: true }).click(); await opened;
      page = context.pages().find(item => item.url().startsWith('https://remote.dshm.invalid/'));
    }
    assert.ok(page); page.setDefaultTimeout(25000);
    page.on('pageerror', error => report.errors.push(error.message));
    page.on('console', message => { if (message.type() === 'error') report.errors.push(message.text()); });
    page.on('response', response => { if (response.status() >= 400) report.resources.push({ path: new URL(response.url()).pathname, status: response.status() }); });
    const panel = page.getByRole('region', { name: '插件面板', exact: true });
    if (cleanup) {
      await panel.locator('.remote-document-tab:not([hidden]) [data-textpreview-plain]').waitFor();
      assert.equal(await panel.getByTestId('live-document-renderer').count(), 0);
      report.unloadFallback = true;
      await page.reload();
    }
    if (await panel.isVisible()) await panel.getByRole('button', { name: '返回聊天', exact: true }).click();
    await page.getByTestId('remote-workspace').waitFor();
    if (!await page.getByRole('region', { name: '聊天内容', exact: true }).count()) await page.getByRole('button', { name: /^DSHM Remote 联调提示/ }).click();
    assert.equal(await page.getByTestId('remote-workspace').locator('.remote-heading').innerText(), 'DSHM Remote 联调提示');
    const editor = page.getByRole('textbox', { name: '消息', exact: true });
    const draft = await editor.innerText();
    if (cleanup) {
      await page.getByTestId('live-document-opener').waitFor({ state: 'detached' });
      for (const [name, value] of Object.entries(contents)) assert.deepEqual(await readFile(resolve(root, name)), Buffer.from(value));
      await rm(root, { recursive: true }); report.pluginUnloaded = true; report.filesRemoved = true;
    } else if (process.argv.includes('--before-unload')) {
      await page.getByTestId('live-document-opener').getByRole('button', { name: '预览 custom.dshmdoc', exact: true }).click();
      await panel.locator('.remote-document-tab:not([hidden]) [data-document-viewer-menu]').click();
      await page.getByRole('menuitem', { name: '分页测试', exact: true }).click();
      await page.getByTestId('document-renderer-result').filter({ hasText: '"kind":"text"' }).waitFor();
      report.readyForUnload = true;
    } else {
      const open = name => page.getByTestId('live-document-opener').getByRole('button', { name: `预览 ${name}`, exact: true }).click();
      await open('custom.dshmdoc');
      const output = page.getByTestId('document-renderer-result');
      await output.filter({ hasText: '"kind":"text"' }).waitFor();
      report.firstPage = JSON.parse(await output.innerText());
      assert.equal(report.firstPage.lines, 5000); assert.equal(report.firstPage.eof, false);
      assert.equal(report.firstPage.address, report.firstPage.tabAddress);
      const rendered = page.getByTestId('live-document-renderer');
      report.scaledWidth = await rendered.evaluate(element => element.getBoundingClientRect().width);
      assert.ok(report.scaledWidth <= await page.evaluate(() => innerWidth) + 0.5);
      await rendered.getByRole('button', { name: '计数 0', exact: true }).click();
      await panel.getByRole('button', { name: '加载更多', exact: true }).click();
      await output.filter({ hasText: '"eof":true' }).waitFor();
      report.lastPage = JSON.parse(await output.innerText()); assert.equal(report.lastPage.lines, 5002);
      await panel.locator('[data-document-viewer-menu]').click();
      await page.getByRole('menuitem', { name: '字节测试', exact: true }).click();
      await output.filter({ hasText: '"kind":"bytes"' }).waitFor();
      report.bytes = JSON.parse(await output.innerText()); assert.equal(report.bytes.bytes, Buffer.byteLength(contents['custom.dshmdoc']));
      await panel.locator('[data-document-viewer-menu]').click();
      await page.getByRole('menuitem', { name: '自主读取测试', exact: true }).click();
      await output.filter({ hasText: '"ok":true' }).waitFor();
      report.renderer = JSON.parse(await output.innerText()); assert.equal(report.renderer.result.value.text, '预览行 1 🙂');
      await page.screenshot({ path: 'artifacts/document-ui-android.png' });
      await panel.getByRole('button', { name: '返回聊天', exact: true }).click();
      for (const name of ['readme.md', 'image.svg', 'missing.txt', 'page.html', 'document.pdf', 'document.docx']) {
        await open(name);
        const body = panel.locator('.remote-document-tab:not([hidden])');
        if (name === 'readme.md') await body.locator('[data-document-markdown]').getByRole('heading', { name: '手机文件预览', exact: true }).waitFor();
        if (name === 'image.svg') await body.locator('img').waitFor();
        if (name === 'missing.txt') await body.locator('[data-textpreview-failed="workspace-file/not-found"]').waitFor();
        if (name === 'page.html') await body.frameLocator('iframe').getByRole('heading', { name: 'DSHM isolated HTML', exact: true }).waitFor();
        if (name === 'document.pdf' || name === 'document.docx') await body.locator('[data-pdf-preview] canvas').first().waitFor({ timeout: 60000 });
        report[name] = true;
        await panel.getByRole('button', { name: '返回聊天', exact: true }).click();
      }
      await page.getByRole('button', { name: '聊天文件定位', exact: true }).last().click();
      const target = panel.locator('[data-textpreview-target="5001"]');
      await target.waitFor(); assert.match(await target.innerText(), /预览行 5001/);
      report.line = await target.evaluate(row => {
        const body = row.closest('[data-textpreview-body]'), r = row.getBoundingClientRect(), b = body.getBoundingClientRect();
        return { visible: r.top >= b.top - 1 && r.bottom <= b.bottom + 1, scrollTop: body.scrollTop };
      });
      assert.equal(report.line.visible, true);
      await panel.getByRole('button', { name: '返回聊天', exact: true }).click();
    }
    assert.equal(await page.getByRole('textbox', { name: '消息', exact: true, includeHidden: true }).innerText(), draft); report.draftPreserved = true;
    assert.deepEqual(report.errors, []); assert.deepEqual(report.resources, []);
  } catch (error) { report.failure = error.message; if (page) await page.screenshot({ path: 'artifacts/document-ui-failure-android.png' }).catch(() => {}); throw error; }
  finally { await writeFile(`artifacts/document-ui-${cleanup ? 'cleanup' : process.argv.includes('--before-unload') ? 'before-unload' : 'live'}-android.json`, JSON.stringify(report, null, 2)); console.log(JSON.stringify(report)); await device.close(); }
}
