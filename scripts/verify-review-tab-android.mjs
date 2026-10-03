import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { _android } from 'playwright';
import { androidAppWebView } from './android-app-webview.mjs';

// 只读取专用会话的既有整轮记录，不发模型消息或修改电脑文件。
const device = (await _android.devices({ omitDriverInstall: true })).find(item => item.serial() === process.env.DSHM_ANDROID_SERIAL);
assert.ok(device); device.setDefaultTimeout(20000);
const report = { at: new Date().toISOString(), errors: [], records: [] };
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
  assert.ok(page); page.setDefaultTimeout(20000);
  page.on('pageerror', error => report.errors.push(error.message));
  const panel = page.getByRole('region', { name: '插件面板', exact: true });
  if (await panel.isVisible()) await panel.getByRole('button', { name: '返回聊天', exact: true }).click();
  await page.getByTestId('remote-workspace').waitFor();
  if (!await page.getByRole('region', { name: '聊天内容', exact: true }).count()) await page.getByRole('button', { name: /^DSHM Remote 联调提示/ }).click();
  assert.equal(await page.getByTestId('remote-workspace').locator('.remote-heading').innerText(), 'DSHM Remote 联调提示');
  const draft = await page.getByRole('textbox', { name: '消息', exact: true }).innerText();
  await page.getByRole('region', { name: '聊天内容', exact: true }).getByRole('article', { name: '模型回复' }).first().waitFor();
  const older = page.getByRole('button', { name: '加载更早的消息', exact: true });
  for (let i = 0; i < 12 && await older.count(); i++) {
    const count = await page.locator('.conversation article').count();
    await older.click();
    await page.waitForFunction(count => document.querySelectorAll('.conversation article').length > count, count);
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  }
  const entries = page.getByRole('button', { name: /^(查看第 \d+ 轮文件改动|在侧边栏查看本轮改动)$/ });
  const names = await entries.allTextContents();
  assert.ok(names.length, '当前没有可用整轮快照卡片；原卡片不会显示已过期的摘要，真实正向验收仍待可用记录');
  const active = panel.locator('.remote-document-tab:not([hidden])');
  const review = active.locator('[data-changes-review]');
  for (let index = names.length - 1; index >= 0; index--) {
    const name = names[index];
    await entries.nth(index).click();
    await panel.waitFor();
    await active.locator('[data-review-file], [data-changes-review][data-review-state="missing"]').first().waitFor();
    const state = await review.getAttribute('data-review-state');
    report.records.push({ name, state, content: state === 'missing' ? await review.innerText() : undefined });
    if (state === 'missing') {
      if (report.records.length === 1) await page.screenshot({ path: 'artifacts/review-tab-missing-android.png' });
      await panel.getByRole('button', { name: '返回聊天', exact: true }).click(); continue;
    }
    await review.locator('[data-review-view]').waitFor();
    report.selected = await review.locator('[data-review-file]').getAttribute('data-review-file');
    await review.locator('[data-review-tool="split"]').click();
    await review.locator('[data-review-view="split"]').waitFor();
    await review.locator('[data-review-tool="wrap"]').click();
    await review.locator('[data-review-view="split"][data-review-wrap]').waitFor();
    report.splitAndWrap = true;
    await review.locator('[data-review-tool="open-native"]').click();
    await active.getByRole('group', { name: '确认在电脑打开', exact: true }).waitFor();
    await active.getByRole('button', { name: '取消', exact: true }).click();
    report.desktopConfirmationCancelled = true;
    await page.screenshot({ path: 'artifacts/review-tab-android.png' });
    await review.locator('[data-review-tool="open-file"]').click();
    await active.locator('[data-textpreview-plain]').waitFor();
    report.currentText = await active.locator('[data-textpreview-plain]').innerText();
    report.currentFilePreview = true;
    await panel.getByRole('button', { name: '返回聊天', exact: true }).click();
    break;
  }
  assert.equal(await page.getByRole('textbox', { name: '消息', exact: true }).innerText(), draft);
  report.draftPreserved = true;
  assert.deepEqual(report.errors, []);
  assert.ok(report.currentFilePreview, '旧整轮记录均不可用时，不算真实正向预览通过');
} catch (error) { report.failure = error.stack; process.exitCode = 1; if (page) await page.screenshot({ path: 'artifacts/review-tab-failure-android.png' }).catch(() => {}); }
finally { await writeFile('artifacts/review-tab-android.json', JSON.stringify(report, null, 2)); console.log(JSON.stringify(report)); await device.close(); }
