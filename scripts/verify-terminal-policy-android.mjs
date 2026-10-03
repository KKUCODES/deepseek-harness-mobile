import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { _android } from 'playwright';
import { androidAppWebView } from './android-app-webview.mjs';

// 只检查现有聊天、插件面板和命令历史，不新建终端、不发模型请求。
const device = (await _android.devices({ omitDriverInstall: true })).find(item => item.serial() === process.env.DSHM_ANDROID_SERIAL);
assert.ok(device); device.setDefaultTimeout(20000);
const report = { at: new Date().toISOString(), errors: [], resources: [] };
let page;
try {
  await device.shell('am start -f 0x20020000 -n dev.dshmobile.validation/.ValidationActivity');
  const started = Date.now() + 15000;
  while (!(await device.shell('pidof dev.dshmobile.validation')).toString().trim() && Date.now() < started) await new Promise(resolve => setTimeout(resolve, 100));
  const context = (await (await androidAppWebView(device)).page()).context();
  const ordinary = context.pages().find(item => item.url().startsWith('https://appassets.androidplatform.net/'));
  await ordinary.getByRole('button', { name: '打开侧边抽屉', exact: true }).click();
  await ordinary.getByRole('button', { name: 'Remote', exact: true }).click();
  const until = Date.now() + 20000;
  while (!page && Date.now() < until) {
    page = context.pages().find(item => item.url().startsWith('https://remote.dshm.invalid/'));
    if (!page) await new Promise(resolve => setTimeout(resolve, 100));
  }
  assert.ok(page); page.setDefaultTimeout(25000);
  page.on('pageerror', error => report.errors.push(error.message));
  page.on('console', item => { if (item.type() === 'error') report.errors.push(item.text()); });
  page.on('response', response => { if (response.status() >= 400) report.resources.push({ path: new URL(response.url()).pathname, status: response.status() }); });
  const main = page.getByTestId('remote-workspace'); await main.waitFor({ timeout: 40000 });
  const panel = page.getByRole('region', { name: '插件面板', exact: true });
  if (await panel.isVisible()) await panel.getByRole('button', { name: '返回聊天', exact: true }).click();
  const title = main.locator('.remote-heading strong');
  if (await title.innerText() === 'Remote') await main.locator('button.remote-session-row').filter({ has: page.getByText('DSHM Remote 联调提示', { exact: true }) }).click();
  await title.getByText('DSHM Remote 联调提示', { exact: true }).waitFor();
  const input = main.getByRole('textbox', { name: '消息', exact: true });
  await input.waitFor(); report.draft = await input.evaluate(node => node.textContent);
  assert.equal(await page.getByTestId('live-interactions').count(), 0);
  await main.getByRole('button', { name: 'Remote 选项', exact: true }).click();
  await main.getByRole('button', { name: '插件面板', exact: true }).click();
  await panel.getByText('工作区文件', { exact: true }).waitFor();
  assert.equal(await panel.getByText('新建终端', { exact: true }).count(), 0);
  report.guideWithoutTerminal = true;
  await page.screenshot({ path: 'artifacts/terminal-policy-guide-android.png' });
  await panel.getByRole('button', { name: '返回聊天', exact: true }).click();
  const older = page.getByRole('button', { name: '加载更早的消息', exact: true });
  for (let i = 0; i < 15 && await older.count(); i++) {
    const count = await page.locator('.conversation article').count();
    await older.click();
    // 最后一页可能仅合并已有节点；入口消失同样表示已到历史起点。
    await page.waitForFunction(count => document.querySelectorAll('.conversation article').length > count
      || ![...document.querySelectorAll('button')].some(node => node.textContent.trim() === '加载更早的消息'), count);
  }
  const tool = page.locator('[data-chat-call-id]').filter({ has: page.locator('[data-tool="pwsh"]') }).first();
  await tool.waitFor({ state: 'attached' });
  const seat = tool.locator('xpath=ancestor::*[@data-chat-flow-key][1]');
  if (await seat.getAttribute('hidden') !== null) await page.locator(`button[data-turn-process="${await seat.getAttribute('data-chat-turn')}"]`).click();
  const toggle = tool.locator('[data-disclosure-row]').first();
  if (await toggle.getAttribute('aria-expanded') !== 'true') await toggle.press('Enter');
  report.commandCard = await tool.innerText();
  await tool.getByRole('button', { name: '查看', exact: true }).click();
  const detail = page.getByRole('dialog', { name: '命令详情', exact: true });
  await detail.waitFor();
  assert.equal(await detail.locator('input, textarea, [contenteditable="true"]').count(), 0);
  await detail.getByRole('button', { name: '执行结果', exact: true }).click();
  const marker = report.commandCard.match(/DSHM_COMMAND_\d+/)?.[0];
  assert.ok(marker, '本专项只读取已有命令验证记录');
  assert.ok((await detail.innerText()).includes(marker));
  report.readOnlyCommand = await detail.innerText();
  await page.screenshot({ path: 'artifacts/terminal-policy-command-android.png' });
  await detail.getByRole('button', { name: '关闭命令详情', exact: true }).click();
  assert.equal(await input.evaluate(node => node.textContent), report.draft); report.draftPreserved = true;
  assert.deepEqual(report.errors, []); assert.deepEqual(report.resources, []);
} catch (error) {
  report.failure = error.stack; process.exitCode = 1;
  await page?.screenshot({ path: 'artifacts/terminal-policy-failure-android.png' }).catch(() => {});
} finally {
  await writeFile('artifacts/terminal-policy-android.json', JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report)); await device.close();
}
