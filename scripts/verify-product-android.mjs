import assert from 'node:assert/strict';
import { _android } from 'playwright';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';

assert.equal(process.env.DSHM_RUN_LIVE, '1', 'Explicit live API opt-in required');
const serial = process.env.DSHM_ANDROID_SERIAL;
assert.ok(serial, 'Set DSHM_ANDROID_SERIAL');
const device = (await _android.devices({ omitDriverInstall: true })).find(value => value.serial() === serial);
assert.ok(device, 'Device unavailable');
device.setDefaultTimeout(15000);
const marker = `DSHM_PRODUCT_${Date.now()}`;
const report = { testedAt: new Date().toISOString(), serial, marker, environment: 'MuMu; actual default APK entry and native DeepSeek API; not a physical phone', stages: [] };
await mkdir('artifacts', { recursive: true });
const save = () => writeFile('artifacts/ordinary-product-android.json', JSON.stringify(report, null, 2));
let page;
let chatId;
async function rows() {
  return page.evaluate(async () => {
    const db = await new Promise((resolve, reject) => { const request = indexedDB.open('dshm-ordinary-history-v1'); request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); });
    try { return await new Promise((resolve, reject) => { const request = db.transaction('chats').objectStore('chats').getAll(); request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); }); }
    finally { db.close(); }
  });
}
async function until(read, predicate, message, timeout = 120000) {
  const end = Date.now() + timeout;
  while (Date.now() < end) { const value = await read(); if (predicate(value)) return value; await new Promise(resolve => setTimeout(resolve, 250)); }
  throw new Error(message);
}
const current = async () => (await rows()).find(row => row.id === chatId);
async function send(text) {
  await page.getByRole('textbox', { name: '消息', exact: true }).fill(text);
  await page.getByRole('button', { name: '发送消息', exact: true }).click();
}
async function terminal(count) {
  const value = await until(current, chat => chat?.turns.length === count && ['completed', 'interrupted', 'failed'].includes(chat.turns.at(-1).status), 'Reply did not settle');
  return value.turns.at(-1);
}
try {
  page = await (await device.webView({ pkg: 'dev.dshmobile.validation' })).page();
  assert.match(page.url(), /\/mobile.html$/);
  await page.getByTestId('ordinary-product').waitFor();
  await page.getByRole('textbox', { name: '消息', exact: true }).waitFor();
  assert.equal(await page.getByRole('button', { name: '停止生成', exact: true }).count(), 0, 'Do not interrupt a user request');
  assert.equal(await page.getByRole('button', { name: '配置 DeepSeek Key', exact: true }).count(), 0, 'Configure the Key in the native dialog first');
  const old = await rows();
  const oldHashes = old.map(row => ({ id: row.id, hash: createHash('sha256').update(JSON.stringify(row)).digest('hex') }));
  await page.getByRole('button', { name: '新聊天', exact: true }).click();
  await page.getByRole('textbox', { name: '消息', exact: true }).fill(`${marker}：请记住测试标记 ${marker}，只回复这个标记。`);
  const draft = await until(rows, value => value.some(row => row.draft.startsWith(marker)), 'Draft not saved', 15000);
  chatId = draft.find(row => row.draft.startsWith(marker)).id;
  report.chatId = chatId;
  await page.getByRole('button', { name: '开启深度思考', exact: true }).click();
  await page.getByRole('button', { name: '发送消息', exact: true }).click();
  const first = await terminal(1);
  report.stages.push({ name: 'realReplyWithThinking', status: first.status, error: first.error, matches: first.content.trim() === marker, reasoningCharacters: first.reasoning.length, model: first.model, usage: first.usage }); await save();
  assert.equal(first.status, 'completed'); assert.equal(first.content.trim(), marker); assert.ok(first.thinking); assert.ok(first.reasoning.length > 0);
  await send('只回复我上一条消息要求记住的测试标记。');
  const second = await terminal(2);
  report.stages.push({ name: 'context', status: second.status, matches: second.content.trim() === marker }); await save();
  assert.equal(second.status, 'completed'); assert.equal(second.content.trim(), marker);
  await page.getByRole('textbox', { name: '消息', exact: true }).click();
  await page.getByRole('button', { name: '关闭深度思考', exact: true }).click();
  await send('请逐项写出 300 个不同的旅行建议，每项至少 30 字。');
  await until(current, chat => chat?.turns.length === 3 && chat.turns[2].content.length > 20 && ['sending', 'streaming'].includes(chat.turns[2].status), 'No streaming content before stop');
  await page.getByRole('textbox', { name: '消息', exact: true }).fill('保留在输入框的下一条草稿，不自动发送');
  await page.getByRole('button', { name: '停止生成', exact: true }).click();
  const stopped = await terminal(3);
  assert.equal(stopped.status, 'interrupted'); assert.equal(stopped.error, 'stopped');
  assert.equal((await current()).draft, '保留在输入框的下一条草稿，不自动发送');
  report.stages.push({ name: 'stopAndNextDraft', status: stopped.status, partialCharacters: stopped.content.length, noAutoQueue: true }); await save();
  await page.getByRole('button', { name: '打开侧边抽屉', exact: true }).click();
  await page.getByRole('button', { name: '搜索聊天', exact: true }).click();
  await page.getByRole('textbox', { name: '搜索聊天', exact: true }).fill(marker);
  await page.locator('.chat-search-result').filter({ hasText: marker }).click();
  assert.equal(await page.getByRole('textbox', { name: '消息', exact: true }).inputValue(), '保留在输入框的下一条草稿，不自动发送');
  report.stages.push({ name: 'realHistorySearch', found: true, draftPreserved: true });
  await page.screenshot({ path: 'artifacts/ordinary-product-android.png' });
  const beforeRestart = await current();
  await device.shell('am force-stop dev.dshmobile.validation');
  await device.shell('am start -n dev.dshmobile.validation/.ValidationActivity');
  page = await (await device.webView({ pkg: 'dev.dshmobile.validation' })).page();
  await page.getByTestId('ordinary-product').waitFor();
  await page.getByRole('textbox', { name: '消息', exact: true }).waitFor();
  assert.equal(await page.getByRole('textbox', { name: '消息', exact: true }).inputValue(), '', 'Cold start opens an empty chat');
  assert.equal(await page.getByRole('button', { name: '配置 DeepSeek Key', exact: true }).count(), 0);
  assert.deepEqual(await current(), beforeRestart);
  const after = await rows();
  for (const prior of oldHashes) assert.equal(createHash('sha256').update(JSON.stringify(after.find(row => row.id === prior.id))).digest('hex'), prior.hash);
  report.stages.push({ name: 'processRestart', emptyNewChat: true, savedHistoryAndDraft: true, keyStillConfigured: true, untouchedPriorChats: oldHashes.length });
  report.passed = true; await save(); console.log(JSON.stringify(report));
} catch (error) { report.passed = false; report.error = error.message; await save(); throw error; }
finally { await device.close(); }
