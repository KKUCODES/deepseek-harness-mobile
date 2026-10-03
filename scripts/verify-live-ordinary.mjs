import assert from 'node:assert/strict';
import { _android } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';

// 单独 opt-in：会使用用户在 App 中配置的 Key 调用真实 API，不能放进常规回归。
assert.equal(process.env.DSHM_RUN_LIVE, '1', 'Set DSHM_RUN_LIVE=1 to authorize real API test requests');
const serial = process.env.DSHM_ANDROID_SERIAL;
assert.ok(serial, 'Set DSHM_ANDROID_SERIAL');
const device = (await _android.devices({ omitDriverInstall: true })).find(item => item.serial() === serial);
assert.ok(device, 'Android device not connected');
device.setDefaultTimeout(15000);
let page;
let chatId;
const report = { testedAt: new Date().toISOString(), serial, environment: 'MuMu Android 12, actual APK/native HTTPS/DeepSeek API; NOT physical phone', stages: [] };
await mkdir('artifacts', { recursive: true });
const save = () => writeFile('artifacts/ordinary-live.json', JSON.stringify(report, null, 2));
const readChat = () => page.evaluate(async id => {
  const db = await new Promise((resolve, reject) => {
    const request = indexedDB.open('dshm-ordinary-history-v1'); request.onsuccess = () => resolve(request.result); request.onerror = reject;
  });
  try { return await new Promise((resolve, reject) => {
    const request = db.transaction('chats').objectStore('chats').get(id); request.onsuccess = () => resolve(request.result); request.onerror = reject;
  }); } finally { db.close(); }
}, chatId);
async function send(text) {
  await page.getByRole('textbox', { name: '普通聊天消息', exact: true }).fill(text);
  await page.getByTestId('ordinary-send').click();
}
async function settled() {
  await page.waitForFunction(() => document.querySelector('[data-testid="ordinary-stop"]').disabled, null, { timeout: 120000 });
  const chat = await readChat();
  assert.ok(chat.turns.length > 0);
  return chat.turns.at(-1);
}
try {
  page = await (await device.webView({ pkg: 'dev.dshmobile.validation' })).page();
  assert.equal(await page.getByTestId('ordinary-key-state').innerText(), 'Key 已配置');
  assert.equal(await page.getByTestId('ordinary-stop').isDisabled(), true, 'Do not interrupt an existing user turn');
  const previous = await page.getByRole('combobox', { name: '普通聊天历史' }).inputValue();
  await page.getByTestId('ordinary-new').click();
  await page.waitForFunction(id => document.querySelector('select[aria-label="普通聊天历史"]').value !== id, previous);
  chatId = await page.getByRole('combobox', { name: '普通聊天历史' }).inputValue();
  report.chatId = chatId;
  const marker = `DSHM_LIVE_${Date.now()}`;
  report.marker = marker;
  await save();
  await send(`DSHM 普通聊天联调：请记住测试标记 ${marker}，并只回复这个标记，不要添加其他内容。`);
  const first = await settled();
  report.stages.push({ name: 'realReply', turn: first }); await save();
  console.log(JSON.stringify({ stage: 'realReply', status: first.status, error: first.error, content: first.content }));
  assert.equal(first.status, 'completed');
  assert.equal(first.content.trim(), marker);

  await send('只回复我上一条消息要求你记住的测试标记。');
  const second = await settled();
  report.stages.push({ name: 'context', turn: second }); await save();
  console.log(JSON.stringify({ stage: 'context', status: second.status, error: second.error, matches: second.content.trim() === marker }));
  assert.equal(second.status, 'completed');
  assert.equal(second.content.trim(), marker);

  await page.evaluate(() => {
    window.dshmLiveProbe = { changes: 0, samples: [] };
    window.dshmLiveObserver = new MutationObserver(() => {
      const article = document.querySelector('[data-testid="ordinary-messages"] article:last-child');
      const text = article?.querySelectorAll('.ordinary-text')[1]?.textContent ?? '';
      const probe = window.dshmLiveProbe;
      if (text.length && probe.samples.at(-1)?.length !== text.length) {
        probe.changes++; probe.samples.push({ at: performance.now(), length: text.length });
      }
    });
    window.dshmLiveObserver.observe(document.querySelector('[data-testid="ordinary-messages"]'), { subtree: true, childList: true, characterData: true });
  });
  await send('这是停止生成测试。请逐条写出300条日常生活小建议，每条至少30个汉字，按序号逐条输出，不要合并，不要先概述。');
  await page.waitForFunction(() => {
    const article = document.querySelector('[data-testid="ordinary-messages"] article:last-child');
    return (article?.querySelectorAll('.ordinary-text')[1]?.textContent.length ?? 0) > 30 || document.querySelector('[data-testid="ordinary-stop"]').disabled;
  }, null, { timeout: 120000 });
  assert.equal(await page.getByTestId('ordinary-stop').isDisabled(), false, 'Stream must still be running');
  const before = await page.evaluate(() => window.dshmValidation.snapshot());
  await page.getByTestId('theme-toggle').click();
  await page.waitForFunction(() => !window.dshmValidation.snapshot().themeLifecycle.active);
  assert.equal(await page.getByTestId('ordinary-stop').isDisabled(), false);
  await page.getByTestId('theme-toggle').click();
  await page.waitForFunction(() => window.dshmValidation.snapshot().themeLifecycle.active);
  await page.getByTestId('fixture-toggle').click();
  await page.waitForFunction(() => !document.querySelector('[data-live-client]'));
  await page.getByTestId('fixture-toggle').click();
  await page.locator('[data-live-client]').waitFor();
  assert.equal(await page.getByTestId('ordinary-stop').isDisabled(), false);
  await page.getByTestId('ordinary-stop').click();
  const stopped = await settled();
  assert.equal(stopped.status, 'interrupted');
  assert.equal(stopped.error, 'stopped');
  assert.ok(stopped.content.length > 30);
  await page.waitForTimeout(2000);
  assert.deepEqual((await readChat()).turns.at(-1), stopped, 'Late bytes must not mutate stopped turn');
  const after = await page.evaluate(() => { window.dshmLiveObserver.disconnect(); return { plugins: window.dshmValidation.snapshot(), stream: window.dshmLiveProbe }; });
  assert.ok(after.stream.changes >= 2, 'Visible reply must update more than once');
  assert.deepEqual(after.plugins.errors, []);
  assert.equal(after.plugins.themeStyles, before.themeStyles);
  assert.equal(after.plugins.fixtureStyles, before.fixtureStyles);
  report.stages.push({ name: 'streamPluginsStop', turn: stopped, observations: after }); await save();
  console.log(JSON.stringify({ stage: 'streamPluginsStop', status: stopped.status, characters: stopped.content.length, visibleUpdates: after.stream.changes }));

  const saved = await readChat();
  await device.shell('am force-stop dev.dshmobile.validation');
  await device.shell('am start -n dev.dshmobile.validation/.ValidationActivity --ez diagnostics true');
  page = await (await device.webView({ pkg: 'dev.dshmobile.validation' })).page();
  await page.getByRole('textbox', { name: '普通聊天消息', exact: true }).waitFor();
  await page.waitForFunction(() => document.querySelector('[data-testid="ordinary-key-state"]').textContent === 'Key 已配置');
  assert.equal(await page.getByRole('combobox', { name: '普通聊天历史' }).inputValue(), chatId);
  assert.deepEqual(await readChat(), saved);
  assert.match(await page.getByTestId('ordinary-messages').innerText(), new RegExp(marker));
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, 'Long conversation titles must fit the phone viewport');
  assert.equal(await page.evaluate(() => document.querySelector('select[aria-label="普通聊天历史"]').getBoundingClientRect().right <= document.querySelector('[data-testid="ordinary-chat"]').getBoundingClientRect().right), true);
  assert.deepEqual(await page.evaluate(() => window.dshmValidation.snapshot().errors), []);
  report.stages.push({ name: 'processRestart', identicalHistory: true, configured: true, turnCount: saved.turns.length });
  report.passed = true; await save();
  await page.getByTestId('ordinary-chat').scrollIntoViewIfNeeded();
  await page.waitForTimeout(500);
  await device.screenshot({ path: 'artifacts/ordinary-live-device.png' });
  console.log(JSON.stringify({ passed: true, chatId, stages: report.stages.map(stage => stage.name) }));
} catch (error) {
  report.passed = false; report.failure = error.message;
  if (chatId && page) report.lastChat = await readChat().catch(() => null);
  await save();
  throw error;
} finally { await device.close(); }
