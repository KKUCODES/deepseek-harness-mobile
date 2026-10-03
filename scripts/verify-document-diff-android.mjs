import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { _android } from 'playwright';
import { androidAppWebView } from './android-app-webview.mjs';

// 只读取专用聊天已有 write 历史及现存测试文件，不发消息、不制造新的文件修改。
const expected = await readFile('../DSH-TEST/dshm-approval-test-20260923.txt', 'utf8');
const device = (await _android.devices({ omitDriverInstall: true })).find(item => item.serial() === process.env.DSHM_ANDROID_SERIAL);
assert.ok(device); device.setDefaultTimeout(20000);
const report = { at: new Date().toISOString(), errors: [] };
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
  const write = page.locator('[data-chat-call-id]').filter({ has: page.locator('[data-tool="write"]') }).filter({ hasText: 'dshm-approval-test-20260923.txt' }).first();
  const seat = write.locator('xpath=ancestor::*[@data-chat-flow-key][1]');
  if (await seat.getAttribute('hidden') !== null) await page.locator(`button[data-turn-process="${await seat.getAttribute('data-chat-turn')}"]`).click();
  const toggle = write.locator('[data-disclosure-row]').first();
  if (await toggle.getAttribute('aria-expanded') !== 'true') await toggle.press('Enter');
  await write.getByRole('button', { name: '查看', exact: true }).click();
  const detail = page.getByRole('dialog', { name: '工具详情', exact: true });
  await detail.locator('summary').click();
  await detail.getByRole('button', { name: '查看本次修改', exact: true }).click();
  const body = panel.locator('.remote-document-tab:not([hidden])');
  const history = body.locator('[data-dshm-document-view="changes"]');
  await history.getByText('DSHM_APPROVAL_OK', { exact: false }).waitFor();
  assert.equal(await detail.count(), 0, '原工具模态层不得阻挡文档插件窗口');
  report.originalToolEntry = true;
  const recorded = await history.innerText();
  await body.getByRole('button', { name: '最新完整文件', exact: true }).click();
  await body.locator('[data-textpreview-plain]').getByText(expected.trim(), { exact: true }).waitFor();
  report.currentMatchesDisk = true;
  await body.getByRole('button', { name: '本次修改', exact: true }).click();
  assert.equal(await history.innerText(), recorded); report.historyPreserved = true;
  await page.screenshot({ path: 'artifacts/document-diff-android.png' });
  await panel.getByRole('button', { name: '返回聊天', exact: true }).click();
  await write.getByRole('button', { name: 'dshm-approval-test-20260923.txt', exact: true }).click();
  await body.locator('[data-textpreview-plain]').getByText(expected.trim(), { exact: true }).waitFor();
  assert.equal(await history.count(), 0); report.regularOpenCurrent = true;
  await panel.getByRole('button', { name: '返回聊天', exact: true }).click();
  assert.equal(await page.getByRole('textbox', { name: '消息', exact: true }).innerText(), draft); report.draftPreserved = true;
  assert.equal(await readFile('../DSH-TEST/dshm-approval-test-20260923.txt', 'utf8'), expected);
  report.fileUnchanged = true; assert.deepEqual(report.errors, []);
} catch (error) { report.failure = error.stack; process.exitCode = 1; if (page) await page.screenshot({ path: 'artifacts/document-diff-failure-android.png' }).catch(() => {}); }
finally { await writeFile('artifacts/document-diff-android.json', JSON.stringify(report, null, 2)); console.log(JSON.stringify(report)); await device.close(); }
