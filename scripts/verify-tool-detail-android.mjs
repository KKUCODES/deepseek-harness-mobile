import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { _android } from 'playwright';
import { androidAppWebView } from './android-app-webview.mjs';

// 只重读已经归档的真实失败记录，不发送模型请求或变更授权。
const seed = JSON.parse(await readFile('artifacts/ptc-missing-seed.json', 'utf8'));
assert.equal(seed.cleaned, true);
const device = (await _android.devices({ omitDriverInstall: true })).find(d => d.serial() === (process.env.DSHM_ANDROID_SERIAL ?? '127.0.0.1:16384'));
assert.ok(device); device.setDefaultTimeout(20000);
const report = { at: new Date().toISOString(), errors: [] };
try {
  const context = (await (await androidAppWebView(device)).page()).context();
  let page = context.pages().find(p => p.url().startsWith('https://remote.dshm.invalid/'));
  if (!page) {
    const ordinary = context.pages().find(p => p.url().includes('/mobile.html')); assert.ok(ordinary);
    await ordinary.getByRole('button', { name: '打开侧边抽屉', exact: true }).click();
    await ordinary.getByRole('button', { name: 'Remote', exact: true }).click();
    const until = Date.now() + 20000;
    while (!(page = context.pages().find(p => p.url().startsWith('https://remote.dshm.invalid/'))) && Date.now() < until) await new Promise(r => setTimeout(r, 200));
  }
  assert.ok(page); page.setDefaultTimeout(20000); page.on('pageerror', () => report.errors.push('page-error'));
  const main = page.getByTestId('remote-workspace'), heading = main.locator('.remote-heading strong');
  const menu = async name => {
    await main.getByRole('button', { name: 'Remote 选项', exact: true }).click();
    await main.getByRole('button', { name, exact: true }).click();
  };
  if (await heading.getByText(seed.title, { exact: true }).isVisible()) {
    await main.getByRole('button', { name: '返回', exact: true }).click();
    await main.getByRole('textbox', { name: '搜索远程聊天', exact: true }).fill('');
    await menu('查看最近聊天');
  }
  if (!await heading.getByText('DSHM Remote 联调提示', { exact: true }).isVisible())
    await main.getByRole('button', { name: /^DSHM Remote 联调提示/ }).click();
  const draft = await main.getByRole('textbox', { name: '消息', exact: true }).textContent();
  await main.getByRole('button', { name: '返回', exact: true }).click();
  await menu('查看已归档聊天');
  await main.getByRole('textbox', { name: '搜索远程聊天', exact: true }).fill(seed.title);
  await main.getByRole('button', { name: new RegExp(`^${seed.title}`) }).click();
  await heading.getByText(seed.title, { exact: true }).waitFor();
  await main.locator('[data-chat-call-id]').first().waitFor({ state: 'attached' });
  const toggles = main.locator('button[data-turn-process][aria-expanded="false"]');
  while (await toggles.count()) await toggles.first().click();
  const button = main.getByRole('button', { name: '工具详情', exact: true }).first();
  await button.waitFor();
  const metrics = await button.evaluate(el => ({ scaled: !!el.closest('[data-plugin-frame]'), font: parseFloat(getComputedStyle(el).fontSize), height: el.getBoundingClientRect().height }));
  assert.equal(metrics.scaled, false); assert.ok(metrics.font >= 13); assert.ok(metrics.height >= 30);
  await button.click();
  const dialog = page.getByRole('dialog', { name: '工具详情', exact: true });
  await dialog.waitFor();
  assert.equal(await dialog.locator('details').first().getAttribute('open'), '');
  assert.match(await dialog.innerText(), /ToolCallError|not found/);
  const inner = dialog.locator('summary').filter({ hasText: /^read ·/ });
  await inner.click();
  assert.match(await dialog.locator('details details').innerText(), /not found/);
  assert.equal(await dialog.locator('pre').first().evaluate(el => getComputedStyle(el).whiteSpace), 'pre-wrap');
  report.details = true; report.nestedError = true; report.metrics = metrics;
  await page.screenshot({ path: 'artifacts/tool-detail-android.png' });
  await dialog.getByRole('button', { name: '关闭工具详情', exact: true }).click();
  await main.getByRole('button', { name: '返回', exact: true }).click();
  await main.getByRole('textbox', { name: '搜索远程聊天', exact: true }).fill('');
  await menu('查看最近聊天');
  await main.getByRole('button', { name: /^DSHM Remote 联调提示/ }).click();
  assert.equal(await main.getByRole('textbox', { name: '消息', exact: true }).textContent(), draft);
  report.restored = true; assert.deepEqual(report.errors, []);
} catch (error) { report.failure = error.stack; process.exitCode = 1; }
finally {
  await writeFile('artifacts/tool-detail-android.json', JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report)); await device.close();
}
