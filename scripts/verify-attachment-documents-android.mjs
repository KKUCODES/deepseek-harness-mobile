import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { _android } from 'playwright';
import { androidAppWebView } from './android-app-webview.mjs';

const phase = process.argv.includes('--plugin') ? 'plugin' : process.argv.includes('--formats') ? 'formats' : process.argv.includes('--cleanup') ? 'cleanup' : 'plain';
const prefix = process.env.DSHM_VALIDATION_PREFIX ?? 'attachment-document';
assert.match(prefix, /^[a-z0-9-]+$/);
const name = 'dshm-shared-upload-20260924.txt', expected = await readFile(`artifacts/${name}`, 'utf8');
const device = (await _android.devices({ omitDriverInstall: true })).find(item => item.serial() === process.env.DSHM_ANDROID_SERIAL);
assert.ok(device); device.setDefaultTimeout(20000);
const report = { at: new Date().toISOString(), phase, errors: [], modes: [] }; let page;
try {
  const context = (await (await androidAppWebView(device)).page()).context();
  page = context.pages().find(item => item.url().startsWith('https://remote.dshm.invalid/'));
  if (!page) {
    const ordinary = context.pages().find(item => item.url().startsWith('https://appassets.androidplatform.net/'));
    await ordinary.getByRole('button', { name: '打开侧边抽屉', exact: true }).click();
    const opened = context.waitForEvent('page');
    await ordinary.getByRole('button', { name: 'Remote', exact: true }).click(); await opened;
    page = context.pages().find(item => item.url().startsWith('https://remote.dshm.invalid/'));
  }
  assert.ok(page); page.setDefaultTimeout(25000); page.on('pageerror', error => report.errors.push(error.message));
  const panel = page.getByRole('region', { name: '插件面板', exact: true });
  if (await panel.isVisible()) await panel.getByRole('button', { name: '返回聊天', exact: true }).click();
  await page.getByTestId('remote-workspace').waitFor();
  if (!await page.getByRole('region', { name: '聊天内容', exact: true }).count()) await page.getByRole('button', { name: /^DSHM Remote 联调提示/ }).click();
  assert.equal(await page.getByTestId('remote-workspace').locator('.remote-heading').innerText(), 'DSHM Remote 联调提示');
  const draft = await page.getByRole('textbox', { name: '消息', exact: true }).innerText();
  const card = page.getByRole('button', { name: `查看附件 ${name}`, exact: true }).first();
  await page.getByRole('article', { name: '模型回复', exact: true }).first().waitFor();
  for (let attempt = 0; attempt < 12 && !await card.count(); attempt++) {
    const older = page.getByRole('button', { name: '加载更早的消息', exact: true });
    if (!await older.count()) break;
    const count = await page.locator('.conversation article').count(); await older.click();
    await page.waitForFunction(count => document.querySelectorAll('.conversation article').length > count, count);
  }
  await card.click();
  const current = panel.locator('.remote-document-tab:not([hidden])');
  if (phase !== 'plugin') {
    await current.locator('[data-textpreview-plain]').waitFor();
    assert.equal(await current.locator('[data-textpreview-plain]').textContent(), expected);
    report.originalPlainBody = true;
    assert.equal(await current.getByTestId('live-attachment-document-result').count(), 0);
    report.address = await current.locator('[data-textpreview-url]').getAttribute('data-textpreview-url');
  } else {
    const output = current.getByTestId('live-attachment-document-result');
    for (const [kind, label] of [['text', '附件分页验收'], ['bytes', '附件字节验收'], ['renderer', '附件自主读取验收']]) {
      await current.locator('[data-document-viewer-menu]').click();
      await page.getByRole('menuitem', { name: label, exact: true }).click();
      await output.filter({ hasText: new RegExp(`"kind":\\s*"${kind}"`) }).filter({ hasText: 'DSHM_SHARED_UPLOAD_OK' }).waitFor();
      const value = JSON.parse(await output.innerText());
      assert.equal(value.text, kind === 'text' ? expected.replace(/\n$/, '') : expected);
      assert.equal(value.source, 'attachment'); assert.equal(value.address, value.tabAddress);
      report.address = value.address; report.modes.push(kind);
    }
  }
  assert.match(report.address, /^dsh-resource:\/\/dshm-attachment\//);
  await device.screenshot({ path: `artifacts/${prefix}-${phase}-android.png` });
  await panel.getByRole('button', { name: '返回聊天', exact: true }).click();
  if (phase === 'formats') {
    const open = async name => { await page.getByRole('button', { name: `查看附件 ${name}`, exact: true }).first().click(); };
    const closeTab = async () => {
      await panel.getByRole('button', { name: '面板操作', exact: true }).click();
      await page.getByRole('menuitem', { name: '关闭当前面板', exact: true }).click();
      if (await panel.isVisible()) await panel.getByRole('button', { name: '返回聊天', exact: true }).click();
    };
    await open('dshm-image-input.png');
    await current.locator('img').waitFor();
    await current.locator('img').evaluate(image => image.decode());
    report.image = await current.locator('img').evaluate(image => ({ width: image.naturalWidth, height: image.naturalHeight }));
    assert.deepEqual(report.image, { width: 1024, height: 1024 });
    await device.screenshot({ path: `artifacts/${prefix}-image-android.png` }); await closeTab();
    await open('dshm-html-attachment-1790191718468.html');
    const frame = current.frameLocator('iframe');
    await frame.getByRole('heading', { name: '原始 HTML 附件', exact: true }).waitFor();
    await frame.getByRole('button', { name: '计数 0', exact: true }).click();
    await frame.getByRole('button', { name: '计数 1', exact: true }).waitFor();
    report.html = await frame.locator('body').evaluate(() => ({ origin: self.origin, bridge: typeof window.DSHMRemote, ordinary: typeof window.DSHMOrdinary }));
    assert.deepEqual(report.html, { origin: 'null', bridge: 'undefined', ordinary: 'undefined' });
    await device.screenshot({ path: `artifacts/${prefix}-html-android.png` }); await closeTab();
    await open('dshm-html-attachment-1790191718468-missing.html');
    await current.getByRole('alert').filter({ hasText: '附件缺少引用的脚本或样式' }).waitFor();
    assert.equal(await current.locator('iframe').count(), 0); report.missingDependencyRejected = true; await closeTab();
    report.office = [];
    for (const extension of ['docx', 'xlsx', 'pptx', 'doc', 'xls', 'ppt', 'corrupt.docx']) {
      await open(`dshm-office-attachment-1790193112958.${extension}`);
      if (extension === 'corrupt.docx') {
        await current.locator('[data-textpreview-failed]').waitFor({ timeout: 60000 });
        assert.equal(await current.locator('canvas').count(), 0);
        report.office.push({ extension, corruptRejected: true });
      } else {
        await current.locator('[data-pdf-text]').getByText(/Office preview/).first().waitFor({ timeout: 90000 });
        const text = (await current.locator('[data-pdf-text]').allTextContents()).join('');
        assert.ok(text.includes('中文文档'));
        assert.ok(await current.locator('canvas').first().evaluate(canvas => canvas.width > 0 && canvas.height > 0));
        report.office.push({ extension, text, canvas: true });
        await device.screenshot({ path: `artifacts/${prefix}-${extension}-android.png` });
      }
      await closeTab();
    }
    assert.equal(page.workers().length, 0); report.closedWorkersReleased = true;
  }
  assert.equal(await page.getByRole('textbox', { name: '消息', exact: true }).innerText(), draft);
  report.draftPreserved = true;
  report.attachmentButtons = await page.getByRole('button', { name: /查看附件|查看图片|打开图片/ }).allTextContents();
  assert.deepEqual(report.errors, []);
} catch (error) {
  report.failure = error.message;
  if (page) { report.body = (await page.locator('body').innerText()).slice(-3500); await page.screenshot({ path: `artifacts/${prefix}-${phase}-failure.png` }); }
  throw error;
} finally {
  await writeFile(`artifacts/${prefix}-${phase}-android.json`, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report)); await device.close();
}
