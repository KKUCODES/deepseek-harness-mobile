import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { _android } from 'playwright';
import { androidAppWebView } from './android-app-webview.mjs';

assert.equal(process.env.DSHM_RUN_LIVE, '1');
const report = { at: new Date().toISOString(), cases: [], errors: [] };
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
let device, page;
const watchdog = setTimeout(() => process.exit(2), 120000);
try {
  device = (await _android.devices({ omitDriverInstall: true })).find(d => d.serial() === process.env.DSHM_ANDROID_SERIAL);
  assert.ok(device);
  page = (await (await androidAppWebView(device)).page()).context().pages().find(p => p.url().startsWith('https://remote.dshm.invalid/'));
  assert.ok(page); page.setDefaultTimeout(15000); page.on('pageerror', () => report.errors.push('page-error'));
  const main = page.getByTestId('remote-workspace');
  const editor = main.getByRole('textbox', { name: '消息', exact: true });
  const name = 'DSHM Remote 联调提示';
  assert.equal((await main.locator('.remote-heading').innerText()).split('\n')[0], name);
  assert.equal((await editor.innerText()).trim(), '');
  const reopen = async () => {
    await main.getByRole('button', { name: '返回', exact: true }).click();
    await main.locator('button.remote-session-row').filter({ hasText: name }).click();
    await editor.waitFor();
  };
  for (const method of ['fill', 'keyboard', 'fill', 'keyboard']) {
    await reopen();
    const marker = `DSHM_DRAFT_TIMING_${report.cases.length}`;
    assert.equal((await editor.innerText()).trim(), '');
    await editor.evaluate(node => {
      const events = [];
      const handler = event => events.push({ type: event.type, inputType: event.inputType, trusted: event.isTrusted, length: node.innerText.trim().length });
      node.addEventListener('beforeinput', handler); node.addEventListener('input', handler);
      window.__draftTiming = { node, events, release() { node.removeEventListener('beforeinput', handler); node.removeEventListener('input', handler); } };
    });
    if (method === 'fill') await editor.fill(marker);
    else { await editor.click(); await editor.pressSequentially(marker, { delay: 15 }); }
    await delay(350);
    const after = (await editor.innerText()).trim();
    const item = { method, preserved: after === marker, empty: after === '', probe: await page.evaluate(() => ({ events: window.__draftTiming.events, sameRoot: window.__draftTiming.node.isConnected })) };
    await page.evaluate(() => { window.__draftTiming.release(); delete window.__draftTiming; });
    assert.ok(after === marker || after === '', 'Only the known test draft may be modified');
    await reopen();
    await page.getByRole('region', { name: '聊天内容', exact: true }).getByRole('article', { name: '模型回复', exact: true }).nth(15).waitFor();
    const restored = (await editor.innerText()).trim();
    item.persisted = restored === marker; item.restoredEmpty = restored === '';
    assert.ok(restored === marker || restored === '', 'Do not replace unrelated content');
    if (restored === marker) await editor.fill('');
    await delay(250);
    assert.equal((await editor.innerText()).trim(), '');
    report.cases.push(item);
  }
  report.replies = await page.getByRole('region', { name: '聊天内容', exact: true }).getByRole('article', { name: '模型回复', exact: true }).count();
  assert.equal(report.replies, 16); assert.deepEqual(report.errors, []);
  report.cleaned = true;
  report.ok = report.cases.every(item => item.preserved && item.persisted);
  if (!report.ok) process.exitCode = 1;
} catch (error) { report.failure = error.message; process.exitCode = 1; }
finally {
  if (page) await page.evaluate(() => { window.__draftTiming?.release(); delete window.__draftTiming; }).catch(() => {});
  await writeFile('artifacts/draft-entry-timing-android.json', JSON.stringify(report, null, 2)); console.log(JSON.stringify(report));
  if (device) await Promise.race([device.close(), delay(1500)]);
  clearTimeout(watchdog); process.exit(process.exitCode ?? 0);
}
