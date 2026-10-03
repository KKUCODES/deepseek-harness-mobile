import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { _android } from 'playwright';
import { androidAppWebView } from './android-app-webview.mjs';

// 只读取既有联调历史，经原插件按钮打开手机窗口；不发送模型请求或修改授权。
const device = (await _android.devices({ omitDriverInstall: true })).find(item => item.serial() === process.env.DSHM_ANDROID_SERIAL);
assert.ok(device, 'Set DSHM_ANDROID_SERIAL to the running test device');
const report = { at: new Date().toISOString(), errors: [] };
try {
  const first = await (await androidAppWebView(device)).page();
  const page = first.context().pages().find(item => item.url().startsWith('https://remote.dshm.invalid/'));
  assert.ok(page); page.setDefaultTimeout(15000);
  page.on('pageerror', error => report.errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') report.errors.push(message.text()); });
  assert.equal(await page.getByTestId('remote-workspace').locator('.remote-heading').innerText(), 'DSHM Remote 联调提示');
  const editor = page.getByRole('textbox', { name: '消息', exact: true });
  const draft = await editor.inputValue();
  const older = page.getByRole('button', { name: '加载更早的消息', exact: true });
  for (let i = 0; i < 10 && await older.count(); i++) {
    await older.click();
    await page.waitForFunction(() => ![...document.querySelectorAll('button')].some(button => button.textContent === '加载更早的消息' && button.disabled));
  }
  assert.equal(await older.count(), 0);
  const tools = page.locator('[data-chat-call-id]');
  report.toolCount = await tools.count(); assert.ok(report.toolCount > 0);
  assert.doesNotMatch((await tools.allTextContents()).join('\n'), /tool\.title\.|ask\.rowTitle|row\.failed/);
  const write = tools.filter({ has: page.locator('[data-tool="write"]') }).filter({ hasText: 'dshm-approval-test-20260923.txt' }).first();
  const expand = async row => {
    const seat = row.locator('xpath=ancestor::*[@data-chat-flow-key][1]');
    if (await seat.getAttribute('hidden')) {
      const turn = await seat.getAttribute('data-chat-turn');
      await page.locator(`button[data-turn-process="${turn}"]`).click();
    }
    const toggle = row.locator('[data-disclosure-row]').first();
    if (await toggle.getAttribute('aria-expanded') !== 'true') await toggle.press('Enter');
  };
  await expand(write);
  await write.getByRole('button', { name: '查看', exact: true }).click();
  const detail = page.getByRole('dialog', { name: '工具详情', exact: true });
  await detail.waitFor();
  await detail.locator('summary').click();
  await detail.getByRole('button', { name: '查看本次修改', exact: true }).waitFor();
  assert.equal(await page.getByRole('dialog', { name: '命令详情', exact: true }).count(), 0);
  await page.screenshot({ path: 'artifacts/node-slot-tool-detail-android.png' });
  report.genericDetail = { originalInspectButton: true, actualWriteDiff: true, ownDialog: true };
  await detail.getByRole('button', { name: '关闭工具详情', exact: true }).click();
  await write.getByRole('button', { name: 'dshm-approval-test-20260923.txt', exact: true }).click();
  const file = page.getByRole('dialog', { name: '文件预览', exact: true });
  await file.waitFor();
  await file.locator('pre').waitFor();
  assert.ok((await file.locator('pre').innerText()).trim());
  report.fileCallback = { ownPreview: true, textLoaded: true };
  await file.getByRole('button', { name: '关闭文件预览', exact: true }).click();
  const image = tools.filter({ has: page.locator('[data-tool="read_image"]') }).first();
  await expand(image);
  await image.locator('img').first().waitFor();
  await page.waitForFunction(() => [...document.querySelectorAll('[data-tool="read_image"] img')].some(item => item.complete && item.naturalWidth > 0));
  report.image = await image.locator('img').first().evaluate(item => ({ width: item.naturalWidth, height: item.naturalHeight, blob: item.src.startsWith('blob:https://remote.dshm.invalid/') }));
  assert.equal(report.image.blob, true);
  await image.scrollIntoViewIfNeeded();
  await page.screenshot({ path: 'artifacts/node-slot-image-android.png' });
  const command = tools.filter({ has: page.locator('[data-tool="pwsh"]') }).first();
  await expand(command);
  await command.getByRole('button', { name: '查看', exact: true }).click();
  const terminal = page.getByRole('dialog', { name: '命令详情', exact: true });
  await terminal.waitFor();
  assert.doesNotMatch(await terminal.innerText(), /没有这条命令/);
  report.commandCallback = { ownTerminal: true, history: true };
  await terminal.getByRole('button', { name: '关闭命令详情', exact: true }).click();
  assert.equal(await editor.inputValue(), draft); report.draftPreserved = true;
  assert.equal(await page.locator('iframe').count(), 0); report.noDesktopIframe = true;
  assert.deepEqual(report.errors, []);
} catch (error) { report.failure = error.stack; process.exitCode = 1; }
finally {
  await writeFile('artifacts/node-slot-tools-android.json', JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report)); await device.close();
}
