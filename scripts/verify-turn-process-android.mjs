import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { _android } from 'playwright';
import { androidAppWebView } from './android-app-webview.mjs';

// 读取专用会话的真实历史，不发送消息，不改变设备授权或电脑设置。
const device = (await _android.devices({ omitDriverInstall: true })).find(item => item.serial() === process.env.DSHM_ANDROID_SERIAL);
assert.ok(device, 'Set DSHM_ANDROID_SERIAL');
const report = { at: new Date().toISOString(), errors: [] };
try {
  const first = await (await androidAppWebView(device)).page();
  const page = first.context().pages().find(item => item.url().startsWith('https://remote.dshm.invalid/'));
  assert.ok(page); page.setDefaultTimeout(15000);
  page.on('pageerror', error => report.errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') report.errors.push(message.text()); });
  assert.equal(await page.getByTestId('remote-workspace').locator('.remote-heading').innerText(), 'DSHM Remote 联调提示');
  const editor = page.getByRole('textbox', { name: '消息', exact: true }), draft = await editor.inputValue();
  const older = page.getByRole('button', { name: '加载更早的消息', exact: true });
  if (await older.count()) {
    assert.equal(await page.locator('[data-turn-process-member][hidden]').count(), 0);
    report.incompleteHistoryVisible = true;
  }
  for (let i = 0; i < 15 && await older.count(); i++) {
    await older.click();
    await page.waitForFunction(() => !document.querySelector('[data-history-loader]')?.disabled);
  }
  assert.equal(await older.count(), 0);
  const controls = page.locator('button[data-turn-process]');
  report.foldableTurns = await controls.count(); assert.ok(report.foldableTurns > 0);
  const seat = page.locator('[data-turn-process-member][hidden]').filter({ has: page.locator('[data-chat-call-id]') }).first();
  const turn = await seat.getAttribute('data-chat-turn');
  const control = page.locator(`button[data-turn-process="${turn}"]`);
  const members = page.locator(`[data-chat-turn="${turn}"][data-turn-process-member]`);
  report.turn = turn; report.memberCount = await members.count();
  assert.equal(await control.getAttribute('aria-expanded'), 'false');
  const answer = page.locator(`[data-chat-turn="${turn}"][data-chat-flow-kind="assistant-step"]:not([data-turn-process-member])`);
  await answer.waitFor();
  const gap = await page.evaluate(turn => {
    const control = document.querySelector(`[data-chat-turn="${turn}"][data-chat-flow-kind="turn-process"]`);
    const answer = document.querySelector(`[data-chat-turn="${turn}"][data-chat-flow-kind="assistant-step"]:not([data-turn-process-member])`);
    return answer.getBoundingClientRect().top - control.getBoundingClientRect().bottom;
  }, turn);
  assert.ok(gap >= 23 && gap <= 25, `过程折叠后的间距 ${gap}`);
  report.collapsedGap = gap;
  await control.scrollIntoViewIfNeeded();
  await page.screenshot({ path: 'artifacts/turn-process-collapsed-android.png' });
  await control.click();
  await page.waitForFunction(turn => !document.querySelector(`[data-chat-turn="${turn}"][data-turn-process-member][hidden]`), turn);
  assert.equal(await control.getAttribute('aria-expanded'), 'true');
  await members.filter({ has: page.locator('[data-chat-call-id]') }).first().scrollIntoViewIfNeeded();
  await page.screenshot({ path: 'artifacts/turn-process-expanded-android.png' });
  await control.click();
  assert.equal(await members.evaluateAll(items => items.filter(item => item.hasAttribute('hidden')).length), report.memberCount);
  assert.equal(await editor.inputValue(), draft);
  report.draftPreserved = true; report.expandAndCollapse = true; report.finalAnswerVisible = true;
  assert.equal(await page.locator('iframe').count(), 0);
  assert.deepEqual(report.errors, []);
} catch (error) { report.failure = error.stack; process.exitCode = 1; }
finally {
  await writeFile('artifacts/turn-process-android.json', JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report)); await device.close();
}
