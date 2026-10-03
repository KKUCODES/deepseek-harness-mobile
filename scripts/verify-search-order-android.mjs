import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { writeFile } from 'node:fs/promises';
import { _android } from 'playwright';
import { androidAppWebView } from './android-app-webview.mjs';

// 只读真实已存在会话；代理保留原始响应字节，不替换模型、桥或电脑搜索结果。
assert.equal(process.env.DSHM_RUN_LIVE, '1');
const serial = process.env.DSHM_ANDROID_SERIAL;
const adb = 'C:/Users/KKirin/AppData/Local/Android/Sdk/platform-tools/adb.exe';
const reverse = (...args) => execFileSync(adb, ['-s', serial, 'reverse', ...args], { encoding: 'utf8', windowsHide: true });
assert.match(reverse('--list'), /tcp:8787 tcp:8787/);
const control = async action => {
  const response = await fetch(`http://127.0.0.1:18794/${action}`, { method: action === 'stats' ? 'GET' : 'POST', signal: AbortSignal.timeout(3000) });
  assert.ok(response.ok); return response.json();
};
const device = (await _android.devices({ omitDriverInstall: true })).find(item => item.serial() === serial);
assert.ok(device);
const report = { at: new Date().toISOString(), checks: [], errors: [] };
let page, mapped = false, draft;
const title = 'DSHM Remote 联调提示', marker = 'DSHM_HTML_ATTACHMENT_READY';
try {
  await control('stats');
  await device.shell('am start -f 0x20020000 -n dev.dshmobile.validation/.ValidationActivity');
  const first = await (await androidAppWebView(device)).page();
  const ordinary = first.context().pages().find(item => item.url().startsWith('https://appassets.androidplatform.net/'));
  await ordinary.getByRole('button', { name: '打开侧边抽屉', exact: true }).click();
  await ordinary.getByRole('button', { name: 'Remote', exact: true }).click();
  const untilPage = Date.now() + 10000;
  while (!page && Date.now() < untilPage) {
    page = first.context().pages().find(item => item.url().startsWith('https://remote.dshm.invalid/'));
    if (!page) await new Promise(resolve => setTimeout(resolve, 100));
  }
  assert.ok(page); page.setDefaultTimeout(15000);
  page.on('pageerror', error => report.errors.push(error.message));
  await page.getByTestId('remote-workspace').waitFor();
  const heading = page.getByTestId('remote-workspace').locator('.remote-heading');
  if (await heading.innerText() === 'Remote') await page.locator('.remote-session-row').filter({ hasText: title }).click();
  assert.equal(await heading.innerText(), title);
  const input = page.getByRole('textbox', { name: '消息', exact: true });
  await input.waitFor(); draft = await input.inputValue();
  await page.getByRole('button', { name: 'Remote 选项', exact: true }).click();
  await page.getByRole('button', { name: '电脑连接', exact: true }).click();
  await page.getByRole('button', { name: '断开连接', exact: true }).click();
  await page.getByRole('button', { name: '重新连接', exact: true }).waitFor();
  reverse('tcp:8787', 'tcp:9878'); mapped = true;
  await page.getByRole('button', { name: '重新连接', exact: true }).click();
  const search = page.getByRole('textbox', { name: '搜索远程聊天', exact: true });
  await search.waitFor();
  const match = page.locator('.remote-session-row').filter({ hasText: title });
  const snippet = match.locator('.remote-search-snippet').filter({ hasText: marker });
  await search.fill(marker); await snippet.waitFor({ timeout: 60000 });
  assert.equal(await page.getByRole('button', { name: '重新搜索', exact: true }).count(), 0);
  report.checks.push('Real in-memory computer index returns known message content');
  await search.fill('');
  // DOM 观察记录瞬时旧摘要，避免仅检查最终稳定画面漏掉错误闪现。
  await page.evaluate(() => {
    const samples = [], observer = new MutationObserver(() => samples.push({
      query: document.querySelector('input[aria-label="搜索远程聊天"]')?.value,
      snippets: [...document.querySelectorAll('.remote-search-snippet')].map(node => node.textContent),
    }));
    observer.observe(document.querySelector('[data-testid="remote-workspace"]'), { childList: true, subtree: true, characterData: true });
    globalThis.searchOrderObservation = { samples, observer };
  });
  for (const next of [`DSHM_NO_MATCH_ORDER_${Date.now()}`, '']) {
    await control('pause'); await search.fill(marker);
    const deadline = Date.now() + 15000; let stats;
    do {
      stats = await control('stats');
      if (!stats.heldSearchResults) await new Promise(resolve => setTimeout(resolve, 60));
    } while (!stats.heldSearchResults && Date.now() < deadline);
    assert.ok(stats.heldSearchResults > 0, 'Actual search response must already be held');
    await page.getByRole('status').filter({ hasText: '正在搜索聊天内容' }).waitFor();
    await control('pass'); await search.fill(next);
    if (next) await page.getByText('没有找到匹配的聊天，试试其他关键词。', { exact: true }).waitFor();
    else await match.waitFor();
    assert.equal(await page.locator('.remote-search-snippet').count(), 0);
    await control('resume');
    // 给原生socket及WebView事件足够时间消费迟到帧；不伪造任何应用事件。
    await new Promise(resolve => setTimeout(resolve, 600));
    assert.equal(await search.inputValue(), next);
    assert.equal(await page.locator('.remote-search-snippet').count(), 0);
    const samples = await page.evaluate(() => globalThis.searchOrderObservation.samples);
    assert.ok(samples.filter(item => item.query === next).every(item => item.snippets.length === 0));
    report.checks.push({ next: next ? 'new query settled before old reply released' : 'query cleared before old reply released', heldSearchResults: stats.heldSearchResults, oldSnippetNeverRendered: true });
  }
  await page.screenshot({ path: 'artifacts/search-order-android.png' });
  await search.fill(''); await match.click();
  await input.waitFor(); assert.equal(await input.inputValue(), draft);
  report.draftPreserved = true;
  assert.deepEqual(report.errors, []);
} catch (error) { report.failure = error.message; process.exitCode = 1; }
finally {
  if (page) await page.evaluate(() => { globalThis.searchOrderObservation?.observer.disconnect(); delete globalThis.searchOrderObservation; }).catch(() => {});
  await control('resume').catch(() => {});
  if (mapped) { reverse('tcp:8787', 'tcp:8787'); report.mappingRestored = true; }
  await control('drop').catch(() => {});
  await control('stop').catch(() => {});
  await writeFile('artifacts/search-order-android.json', JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report)); await device.close();
}
