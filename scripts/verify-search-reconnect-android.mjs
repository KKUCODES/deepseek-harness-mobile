import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { _android } from 'playwright';
import { androidAppWebView } from './android-app-webview.mjs';

assert.equal(process.env.DSHM_RUN_LIVE, '1');
const phase = process.argv[2]; assert.ok(['prepare', 'offline', 'recovered'].includes(phase));
const title = 'DSHM Remote 联调提示';
const device = (await _android.devices({ omitDriverInstall: true })).find(item => item.serial() === process.env.DSHM_ANDROID_SERIAL);
assert.ok(device); device.setDefaultTimeout(20000);
const report = { at: new Date().toISOString(), phase, errors: [] };
let page;
try {
  const first = await (await androidAppWebView(device)).page();
  page = first.context().pages().find(item => item.url().startsWith('https://remote.dshm.invalid/'));
  assert.ok(page); page.setDefaultTimeout(30000); page.on('pageerror', error => report.errors.push(error.message));
  const search = page.getByRole('textbox', { name: '搜索远程聊天', exact: true });
  const match = page.locator('.remote-session-row').filter({ hasText: title });
  const fallback = page.getByText('电脑尚未开启聊天内容搜索，当前仅搜索标题。', { exact: true });
  const failed = page.getByText('聊天内容搜索失败，当前仅显示标题匹配。请检查电脑连接后重试。', { exact: true });
  if (phase === 'prepare') {
    assert.equal(await page.getByTestId('remote-workspace').locator('.remote-heading').innerText(), title);
    assert.equal(await page.getByRole('textbox', { name: '消息', exact: true }).inputValue(), '');
    await page.getByRole('button', { name: '返回', exact: true }).click();
    await search.fill(title); await fallback.waitFor(); assert.equal(await match.count(), 1);
    report.titleFallbackReady = true;
  } else if (phase === 'offline') {
    await failed.waitFor({ timeout: 60000 });
    assert.equal(await search.inputValue(), title); assert.equal(await match.count(), 1);
    assert.equal(await fallback.count(), 0); report.offlineExplained = true;
    await search.fill('DSHM_SEARCH_OFFLINE_NO_MATCH_20260925');
    await failed.waitFor(); assert.equal(await page.locator('.remote-session-row').count(), 0);
    assert.equal(await page.getByText('没有找到匹配的聊天，试试其他关键词。', { exact: true }).count(), 0);
    assert.equal(await page.locator('.remote-search-snippet').count(), 0);
    report.noFalseEmptyOrStaleSnippet = true;
    await page.getByRole('button', { name: '重新搜索', exact: true }).click(); await failed.waitFor();
    await search.fill(title); await match.waitFor(); report.offlineRetrySettles = true;
  } else {
    await fallback.waitFor({ timeout: 60000 });
    assert.equal(await search.inputValue(), title); assert.equal(await failed.count(), 0);
    await match.waitFor(); report.automaticQueryRecovery = true;
    await search.fill(''); assert.equal(await page.locator('.remote-search-snippet').count(), 0);
    await match.click();
    await page.getByRole('region', { name: '聊天内容', exact: true }).getByRole('article', { name: '模型回复' }).first().waitFor();
    assert.equal(await page.getByRole('textbox', { name: '消息', exact: true }).inputValue(), '');
    report.originalChatRestored = true;
  }
  assert.deepEqual(report.errors, []);
  await page.screenshot({ path: `artifacts/search-reconnect-${phase}-android.png` });
} catch (error) {
  report.failure = error.message; process.exitCode = 1;
  if (page) { report.body = (await page.locator('body').innerText()).slice(-1800); await page.screenshot({ path: `artifacts/search-reconnect-${phase}-failed.png` }).catch(() => {}); }
} finally {
  await writeFile(`artifacts/search-reconnect-${phase}-android.json`, JSON.stringify(report, null, 2)); console.log(JSON.stringify(report)); await device.close();
}
