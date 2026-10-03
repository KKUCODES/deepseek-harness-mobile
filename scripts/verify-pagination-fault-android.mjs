import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { writeFile } from 'node:fs/promises';
import { _android } from 'playwright';
import { androidAppWebView } from './android-app-webview.mjs';

// 原连接/真实历史/本机响应暂缓；不生成模型消息，不修改认证或Host数据。
assert.equal(process.env.DSHM_RUN_LIVE, '1');
const mode = process.argv[2] ?? 'leave'; assert.ok(['leave', 'recover'].includes(mode));
const serial = process.env.DSHM_ANDROID_SERIAL;
const adb = 'C:/Users/KKirin/AppData/Local/Android/Sdk/platform-tools/adb.exe';
const reverse = (...args) => execFileSync(adb, ['-s', serial, 'reverse', ...args], { encoding: 'utf8', windowsHide: true });
assert.match(reverse('--list'), /tcp:8787 tcp:8787/);
const control = async path => {
  const response = await fetch(`http://127.0.0.1:18794/${path}`, { method: path === 'stats' ? 'GET' : 'POST', signal: AbortSignal.timeout(3000) });
  assert.ok(response.ok); return response.json();
};
const device = (await _android.devices({ omitDriverInstall: true })).find(item => item.serial() === serial);
assert.ok(device);
const report = { at: new Date().toISOString(), mode, errors: [] };
let page, mapped = false;
try {
  await control('stats');
  const first = await (await androidAppWebView(device)).page();
  page = first.context().pages().find(item => item.url().startsWith('https://remote.dshm.invalid/'));
  if (!page) {
    const ordinary = first.context().pages().find(item => item.url().startsWith('https://appassets.androidplatform.net/'));
    await ordinary.getByRole('button', { name: '打开侧边抽屉', exact: true }).click();
    const opened = first.context().waitForEvent('page');
    await ordinary.getByRole('button', { name: 'Remote', exact: true }).click(); await opened;
    page = first.context().pages().find(item => item.url().startsWith('https://remote.dshm.invalid/'));
  }
  assert.ok(page); page.setDefaultTimeout(15000); page.on('pageerror', error => report.errors.push(error.message));
  const title = 'DSHM Remote 联调提示';
  const heading = page.getByTestId('remote-workspace').locator('.remote-heading');
  await heading.waitFor();
  if (await heading.innerText() === 'Remote') {
    try { await page.getByRole('button', { name: new RegExp(`^${title}`) }).click({ timeout: 5000 }); }
    catch (error) { if (await heading.innerText() !== title) throw error; }
  }
  assert.equal(await heading.innerText(), title);
  await page.getByRole('region', { name: '聊天内容', exact: true }).getByRole('article', { name: '模型回复' }).first().waitFor();
  const input = page.getByRole('textbox', { name: '消息', exact: true });
  const draft = await input.inputValue();
  await page.getByRole('button', { name: 'Remote 选项', exact: true }).click();
  await page.getByRole('button', { name: '电脑连接', exact: true }).click();
  await page.getByRole('button', { name: '断开连接', exact: true }).click();
  await page.getByRole('button', { name: '重新连接', exact: true }).waitFor();
  reverse('tcp:8787', 'tcp:9878'); mapped = true;
  await page.getByRole('button', { name: '重新连接', exact: true }).click();
  await page.getByRole('button', { name: new RegExp(`^${title}`) }).click();
  const history = page.getByRole('region', { name: '聊天内容', exact: true });
  const replies = history.getByRole('article', { name: '模型回复' });
  await replies.first().waitFor();
  const older = history.getByRole('button', { name: '加载更早的消息', exact: true });
  await older.scrollIntoViewIfNeeded();
  const before = await replies.allTextContents();
  assert.ok((await control('stats')).devices > 0);
  await control('pause'); await older.click();
  const until = Date.now() + 10000;
  let stats;
  do { stats = await control('stats'); if (!stats.heldBytes) await new Promise(resolve => setTimeout(resolve, 50)); } while (!stats.heldBytes && Date.now() < until);
  assert.ok(stats.heldBytes > 0); report.heldBytes = stats.heldBytes;
  assert.equal(await older.isDisabled(), true);
  assert.deepEqual(await replies.allTextContents(), before);
  assert.equal(await input.inputValue(), draft); report.pendingHistoryPreserved = true;
  if (mode === 'leave') {
    await page.getByRole('button', { name: '返回', exact: true }).click();
    await page.waitForFunction(() => document.querySelector('[data-testid="remote-workspace"] .remote-heading')?.textContent === 'Remote', null, { timeout: 3000 });
    report.pendingNavigationAllowed = true;
    await control('resume');
    assert.equal(await history.count(), 0);
    await page.getByRole('button', { name: new RegExp(`^${title}`) }).click();
    await replies.first().waitFor(); assert.equal(await input.inputValue(), draft);
  } else {
    await control('drop');
    // 观察真实连接恢复，随后用户主动重试；不在测试中重放底层请求。
    await older.waitFor();
    await page.waitForFunction(() => { const button = document.querySelector('[data-history-loader]'); return button && !button.disabled; });
    report.connectionRecovered = true;
    await older.click();
    await page.waitForFunction(count => document.querySelectorAll('.conversation article').length > count, before.length);
    report.retryLoaded = true;
    assert.deepEqual((await replies.allTextContents()).slice(-before.length), before);
    assert.equal(await input.inputValue(), draft);
  }
  await page.screenshot({ path: `artifacts/pagination-fault-${mode}-android.png` });
  assert.deepEqual(report.errors, []);
} catch (error) {
  report.failure = error.message; process.exitCode = 1;
  if (page) await page.screenshot({ path: `artifacts/pagination-fault-${mode}-failed.png` }).catch(() => {});
} finally {
  await control('resume').catch(() => {});
  if (mapped) { reverse('tcp:8787', 'tcp:8787'); report.mappingRestored = true; }
  await control('drop').catch(() => {});
  await control('stop').catch(() => {});
  await writeFile(`artifacts/pagination-fault-${mode}-android.json`, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report)); await device.close();
}
