import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { _android } from 'playwright';
import { androidAppWebView } from './android-app-webview.mjs';

const device = (await _android.devices({ omitDriverInstall: true })).find(d => d.serial() === '127.0.0.1:16384');
assert.ok(device); device.setDefaultTimeout(30000);
const report = { at: new Date().toISOString(), errors: [] };
const button = (root, name) => root.getByRole('button', { name, exact: true });
try {
  const context = (await (await androidAppWebView(device)).page()).context();
  const ordinary = context.pages().find(p => p.url().includes('/mobile.html')); assert.ok(ordinary);
  await button(ordinary, '打开侧边抽屉').click(); await button(ordinary, 'Remote').click();
  let page;
  for (let i = 0; i < 100 && !page; i++) {
    page = context.pages().find(p => p.url().startsWith('https://remote.dshm.invalid/'));
    if (!page) await new Promise(resolve => setTimeout(resolve, 100));
  }
  assert.ok(page); page.on('pageerror', error => report.errors.push(error.message));
  const main = page.getByTestId('remote-workspace'); await main.waitFor({ timeout: 60000 });
  let draft;
  if (await main.locator('.remote-heading strong').innerText() !== 'Remote') {
    const input = main.getByRole('textbox', { name: '消息', exact: true });
    await input.waitFor(); draft = await input.textContent();
    await button(main, '返回').click();
  }
  const welcome = page.getByRole('dialog', { name: '内测声明', exact: true });
  await welcome.waitFor();
  assert.match(await welcome.innerText(), /DeepSeek Harness/);
  assert.equal(await welcome.locator('input').count(), 0);
  await page.screenshot({ path: 'artifacts/model-welcome-android.png' });
  await button(welcome, '继续').click(); await welcome.waitFor({ state: 'detached' });
  report.acknowledged = true;
  const row = main.locator('button.remote-session-row').filter({ has: page.getByText('DSHM Remote 联调提示', { exact: true }) });
  await row.click();
  const input = main.getByRole('textbox', { name: '消息', exact: true }); await input.waitFor();
  if (draft !== undefined) assert.equal(await input.textContent(), draft);
  else draft = await input.textContent();
  await button(main, '返回').click(); await row.waitFor();
  // 允许原store的effect完成；不能把尚未加载的空白瞬间算作记住确认。
  await page.waitForTimeout(1000);
  assert.equal(await welcome.count(), 0); report.noRepeatWithinClient = true;
  await row.click(); await input.waitFor(); assert.equal(await input.textContent(), draft);
  report.chatDraftPreserved = true;
  assert.deepEqual(report.errors, []);
} finally {
  await writeFile('artifacts/model-welcome-android.json', JSON.stringify(report, null, 2));
  await device.close();
}
console.log(JSON.stringify(report));
