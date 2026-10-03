import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { _android } from 'playwright';
import { androidAppWebView } from './android-app-webview.mjs';

const host = JSON.parse(await readFile('artifacts/auto-deny-host.json', 'utf8'));
assert.equal(host.phase, 'settled'); assert.equal(host.failure, undefined);
assert.ok(host.reviews.some(row => row.decision === 'deny')); assert.equal(host.bodyCalls, 0); assert.equal(host.filePreserved, true);
assert.equal(host.errorCode, 'AUTO_REVIEW_DENIED');
const report = { at: new Date().toISOString(), sessionId: host.sessionId, errors: [] };
const device = (await _android.devices({ omitDriverInstall: true })).find(item => item.serial() === '127.0.0.1:16384');
assert.ok(device); device.setDefaultTimeout(20000);
const button = (root, name) => root.getByRole('button', { name, exact: true });
try {
  const context = (await (await androidAppWebView(device)).page()).context();
  const page = context.pages().find(item => item.url().includes('/remote.html')); assert.ok(page);
  page.on('pageerror', () => report.errors.push('page-error'));
  if (await button(page, '重新连接').isVisible()) await button(page, '重新连接').click();
  const main = page.getByTestId('remote-workspace'); await main.waitFor({ timeout: 60000 });
  const welcome = page.getByRole('dialog', { name: '内测声明', exact: true });
  if (await welcome.isVisible()) await button(welcome, '继续').click();
  const heading = main.locator('.remote-heading strong');
  if (await heading.innerText() !== 'Remote') await button(main, '返回').click();
  await main.locator('button.remote-session-row').filter({ has: page.getByText(host.title, { exact: true }) }).click();
  const collapsed = main.locator('button[data-turn-process][aria-expanded="false"]');
  if (await collapsed.count()) await collapsed.first().click();
  const tool = main.locator('[data-tool="dshm_delete_existing_fixture"]'); await tool.waitFor();
  assert.equal(await tool.getAttribute('data-state'), 'error');
  assert.match(await main.innerText(), /Auto review.*拒绝/);
  assert.equal(await button(main, '停止生成').count(), 0); report.denialDisplayed = true;
  await page.screenshot({ path: 'artifacts/auto-deny-android.png' });
  const input = main.getByRole('textbox', { name: '消息', exact: true });
  const marker = `DSHM_AFTER_DENY_${host.id.slice(-8)}`;
  await input.fill(`拒绝验证已结束，不要调用任何工具。请只回复 ${marker}。`);
  await button(main, '发送消息').click(); report.sent = true;
  await main.getByRole('article', { name: '模型回复', exact: true }).filter({ hasText: marker }).waitFor({ timeout: 60000 });
  await button(main, '停止生成').waitFor({ state: 'hidden' }); report.continued = true;
  await button(main, 'Remote 选项').click(); await button(main, '归档聊天').click();
  await heading.getByText('Remote', { exact: true }).waitFor(); report.archived = true;
  await main.locator('button.remote-session-row').filter({ has: page.getByText('DSHM Remote 联调提示', { exact: true }) }).click();
  assert.deepEqual(report.errors, []);
} catch (error) { report.failure = error.message; process.exitCode = 1; }
finally { await writeFile('artifacts/auto-deny-android.json', JSON.stringify(report, null, 2)); await device.close(); }
console.log(JSON.stringify(report));
