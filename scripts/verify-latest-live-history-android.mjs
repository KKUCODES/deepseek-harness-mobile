// 原Android页面/既有真实模型历史回归，不发送新消息或修改授权。
import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { openLatestLiveAndroid } from '../tests/support/latest-live-context.mjs';

const scenario = process.argv[2] ?? 'encoding';
const files = { encoding: 'latest-live-encoding-session.json', ptc: 'latest-live-ptc-session.json', primary: 'latest-live-android-session.json' };
assert.ok(Object.hasOwn(files, scenario)); assert.ok(process.argv.length <= 3);
const report = { at: new Date().toISOString(), scenario, passed: false, errors: [] };
let live;
try {
  live = await openLatestLiveAndroid(files[scenario], { openRecorded: true, observePage(page) {
    page.on('pageerror', error => report.errors.push(error.message.split('\n')[0]));
    page.on('console', message => {
      if (message.type() === 'error') report.errors.push(message.text().split('\n')[0]);
    });
  } });
  const { main, page, state, session, readSession, capture } = live;
  report.executionMode = state.executionMode; report.hostPid = state.hostPid; report.sessionId = session.sessionId;
  const original = await readSession(); assert.equal(original.row.running, false);
  const calls = original.records.filter(item => item.event.type === 'tool/call'); assert.ok(calls.length);
  const last = calls.at(-1).event.data.callId;
  const row = main.locator('[data-chat-call-id]').filter({ has: page.locator(`[data-tool]`) }).last();
  await row.waitFor({ state: 'attached' });
  const process = main.getByRole('button', { name: /用时/ }).last();
  if (await process.getAttribute('aria-expanded') === 'false') await process.click();
  const toggle = row.locator('[data-disclosure-row]').first();
  await toggle.waitFor();
  if (await toggle.getAttribute('aria-expanded') !== 'true') await toggle.press('Enter');
  assert.equal(await toggle.getAttribute('aria-expanded'), 'true');
  assert.equal(await main.locator(`[data-chat-call-id="${last}"] [data-tool]`).count(), 1);
  await new Promise(done => setTimeout(done, 1000));
  assert.deepEqual(report.errors, []);
  assert.equal(await page.locator('iframe').count(), 0);
  await capture('latest-live-source-history-' + scenario);
  report.originalToolCard = true; report.originalDisclosure = true; report.noDesktopIframe = true; report.passed = true;
} catch (error) {
  report.failure = { name: error.name, message: error.message.split('\n')[0],
    location: error.stack?.split('\n').find(line => line.includes('verify-latest-live-history-android.mjs:'))?.trim() }; process.exitCode = 1;
} finally {
  await writeFile(resolve(import.meta.dirname, '../../plugin/artifacts/latest-runtime-check/latest-live-source-history-' + scenario + '.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report)); if (live) await live.device.close();
}
process.exit(process.exitCode ?? 0);
