import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { chromium, _android } from 'playwright';
import { androidAppWebView } from './android-app-webview.mjs';

// 只比较既有测试调用，不发送新命令；正常登录令牌只在内存中用于固定本机地址。
const report = { at: new Date().toISOString(), callId: 'call_00_ET_otPmxO7UpsQt2E91gFZH4091' };
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const device = (await _android.devices({ omitDriverInstall: true })).find(d => d.serial() === 'emulator-5554');
try {
  const log = await readFile('artifacts/review-boundary-dsh.stdout.log', 'utf8');
  const urls = [...new Set(log.match(/http:\/\/127\.0\.0\.1:3080\/\?token=[A-Za-z0-9_-]+/g))]; assert.equal(urls.length, 1);
  const desktop = await browser.newPage();
  try { await desktop.goto(urls[0]); } catch { throw Error('Desktop login failed; URL omitted'); }
  await desktop.getByText('DSH-TEST', { exact: true }).click();
  await desktop.getByRole('treeitem').filter({ has: desktop.getByText('DSHM Remote 联调提示', { exact: true }) }).click();
  const card = desktop.locator(`[data-chat-call-id="${report.callId}"]`);
  await card.waitFor();
  const disclosure = card.locator('[data-disclosure-row][aria-expanded="false"]').first();
  if (await disclosure.count()) await disclosure.click();
  report.desktopText = await card.innerText();
  const phone = (await (await androidAppWebView(device)).page()).context().pages().find(p => p.url().startsWith('https://remote.dshm.invalid/'));
  const phoneCard = phone.locator(`[data-chat-call-id="${report.callId}"]`);
  await phoneCard.waitFor();
  const phoneDisclosure = phoneCard.locator('[data-disclosure-row][aria-expanded="false"]').first();
  if (await phoneDisclosure.count()) await phoneDisclosure.click();
  report.phoneText = await phoneCard.innerText();
  report.desktopReplacementCharacters = [...report.desktopText].filter(c => c === '\ufffd').length;
  report.phoneReplacementCharacters = [...report.phoneText].filter(c => c === '\ufffd').length;
  report.equal = report.desktopText === report.phoneText;
  await desktop.screenshot({ path: 'artifacts/command-encoding-desktop.png' });
  await phone.screenshot({ path: 'artifacts/command-encoding-phone.png' });
} catch (error) { report.failure = error.message; process.exitCode = 1; }
finally {
  await browser.close(); await device?.close();
  await writeFile('artifacts/command-encoding-ui.json', JSON.stringify(report, null, 2)); console.log(JSON.stringify(report));
}
