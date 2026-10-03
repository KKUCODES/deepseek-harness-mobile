import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { _android } from 'playwright';
import { androidAppWebView } from './android-app-webview.mjs';
const device = (await _android.devices({ omitDriverInstall: true })).find(d => d.serial() === process.env.DSHM_ANDROID_SERIAL);
assert.ok(device);
const report = { at: new Date().toISOString(), errors: [] };
try {
  const page = (await (await androidAppWebView(device)).page()).context().pages().find(p => p.url().startsWith('https://remote.dshm.invalid/'));
  assert.ok(page); page.setDefaultTimeout(30000); page.on('pageerror', () => report.errors.push('page-error'));
  const main = page.getByTestId('remote-workspace'), title = 'DSHM Remote 联调提示';
  await main.locator('.remote-heading strong').getByText(title, { exact: true }).waitFor();
  const input = main.getByRole('textbox', { name: '消息', exact: true }), draft = await input.innerHTML();
  await main.getByRole('button', { name: '返回', exact: true }).click();
  const search = main.getByRole('textbox', { name: '搜索远程聊天', exact: true });
  const match = main.locator('.remote-session-row').filter({ has: page.getByText(title, { exact: true }) });
  // 已有专用会话正文标记，不发送模型请求或修改任何会话。
  const marker = 'DSHM_HTML_ATTACHMENT_READY';
  await search.fill(marker);
  const fallback = main.getByText('电脑尚未开启聊天内容搜索，当前仅搜索标题。', { exact: true });
  const snippet = match.locator('.remote-search-snippet').filter({ hasText: marker });
  await Promise.race([fallback.waitFor(), snippet.waitFor()]);
  report.titleOnly = await fallback.isVisible();
  if (report.titleOnly) { await search.fill(title); await match.waitFor(); }
  else { report.bodyMatched = true; assert.equal(await main.getByRole('button', { name: '重新搜索', exact: true }).count(), 0); }
  await main.locator('.remote-project-row').filter({ hasText: 'DSH-TEST' }).click();
  await match.waitFor(); report.workspaceMatched = true;
  await main.getByRole('button', { name: 'Remote 选项', exact: true }).click();
  await main.getByRole('button', { name: '查看已归档聊天', exact: true }).click();
  await match.waitFor({ state: 'hidden' }); report.activeExcluded = true;
  await main.getByRole('button', { name: 'Remote 选项', exact: true }).click();
  await main.getByRole('button', { name: '查看最近聊天', exact: true }).click();
  await match.waitFor();
  await search.fill(`DSHM_NO_MATCH_${Date.now()}`);
  await match.waitFor({ state: 'hidden' }); report.noUnrelatedResult = true;
  if (!report.titleOnly) { await main.getByText('没有找到匹配的聊天，试试其他关键词。', { exact: true }).waitFor(); report.emptyResult = true; }
  await search.fill(title); await match.waitFor(); report.titleMatched = true;
  await search.fill(''); await match.click();
  await main.locator('.remote-heading strong').getByText(title, { exact: true }).waitFor();
  assert.equal(await input.innerHTML(), draft); report.draftPreserved = true;
  assert.deepEqual(report.errors, []);
} catch (error) { report.failure = error.stack; process.exitCode = 1; }
finally { await writeFile('artifacts/current-search-android.json', JSON.stringify(report, null, 2)); console.log(JSON.stringify(report)); await device.close(); }
