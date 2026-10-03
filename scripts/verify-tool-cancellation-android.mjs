import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { _android } from 'playwright';
import { androidAppWebView } from './android-app-webview.mjs';

const seed = JSON.parse(await readFile('artifacts/auto-review-cancel-seed.json', 'utf8'));
assert.equal(seed.cleaned, true); assert.equal(seed.resumed, true);
const device = (await _android.devices({ omitDriverInstall: true })).find(d => d.serial() === 'emulator-5554');
assert.ok(device); device.setDefaultTimeout(20000);
const report = { at: new Date().toISOString(), errors: [], source: 'Actual persisted cancellation from real desktop review; no new model request' };
try {
  const context = (await (await androidAppWebView(device)).page()).context();
  let page = context.pages().find(p => p.url().startsWith('https://remote.dshm.invalid/'));
  if (!page) {
    const ordinary = context.pages().find(p => p.url().includes('/mobile.html')); assert.ok(ordinary);
    await ordinary.getByRole('button', { name: '打开侧边抽屉', exact: true }).click();
    await ordinary.getByRole('button', { name: 'Remote', exact: true }).click();
    const deadline = Date.now() + 20000;
    do { page = context.pages().find(p => p.url().startsWith('https://remote.dshm.invalid/')); if (page) break; await new Promise(r => setTimeout(r, 200)); } while (Date.now() < deadline);
  }
  assert.ok(page); page.setDefaultTimeout(20000); page.on('pageerror', () => report.errors.push('page-error'));
  const main = page.getByTestId('remote-workspace');
  const menu = async name => { await main.getByRole('button', { name: 'Remote 选项', exact: true }).click(); await main.getByRole('button', { name, exact: true }).click(); };
  const heading = main.locator('.remote-heading strong');
  if (await main.getByRole('button', { name: /^DSHM Remote 联调提示/ }).count()) await main.getByRole('button', { name: /^DSHM Remote 联调提示/ }).click();
  await heading.getByText('DSHM Remote 联调提示', { exact: true }).waitFor();
  const originalDraft = await main.getByRole('textbox', { name: '消息', exact: true }).textContent();
  await main.getByRole('button', { name: '返回', exact: true }).click();
  await menu('查看已归档聊天');
  await main.getByRole('textbox', { name: '搜索远程聊天', exact: true }).fill(seed.title);
  await main.getByRole('button', { name: new RegExp(`^${seed.title}`) }).click();
  await heading.getByText(seed.title, { exact: true }).waitFor();
  const message = main.getByText('已取消，工具尚未执行', { exact: true });
  if (!await message.isVisible()) {
    for (const toggle of await main.locator('button[data-turn-process][aria-expanded="false"]').all()) await toggle.click();
  }
  await message.waitFor();
  const row = main.locator('[data-tool="read"][data-state="stopped"]');
  assert.equal(await row.count(), 1); assert.equal(await main.getByText('Error: tool call aborted before dispatch', { exact: true }).count(), 0);
  assert.equal(await main.getByText('Auto review 已拒绝', { exact: true }).count(), 0);
  await message.click();
  await row.getByText('已取消，工具尚未执行', { exact: true }).last().waitFor();
  report.localizedStoppedRow = true; report.expandedDetails = true;
  await page.screenshot({ path: 'artifacts/tool-cancellation-current-android.png' });
  await main.getByRole('button', { name: '返回', exact: true }).click();
  await main.getByRole('textbox', { name: '搜索远程聊天', exact: true }).fill('');
  await menu('查看最近聊天');
  await main.getByRole('button', { name: /^DSHM Remote 联调提示/ }).click();
  await heading.getByText('DSHM Remote 联调提示', { exact: true }).waitFor();
  assert.equal(await main.getByRole('textbox', { name: '消息', exact: true }).textContent(), originalDraft);
  report.restored = true; assert.deepEqual(report.errors, []);
} catch (error) { report.failure = error.stack; process.exitCode = 1; }
finally {
  await writeFile('artifacts/tool-cancellation-current-android.json', JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report)); await device.close();
}
