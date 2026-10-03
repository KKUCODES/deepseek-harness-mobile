import assert from 'node:assert/strict';
import { _android } from 'playwright';
import { writeFile } from 'node:fs/promises';

assert.equal(process.env.DSHM_RUN_LIVE, '1');
const target = process.env.DSHM_REMOTE_TEST_SESSION;
assert.ok(target, 'Explicit test session required');
const ordinaryTestChat = process.env.DSHM_ORDINARY_TEST_CHAT;
assert.ok(ordinaryTestChat, 'Existing dedicated ordinary test chat required');
const device = (await _android.devices({ omitDriverInstall: true })).find(item => item.serial() === process.env.DSHM_ANDROID_SERIAL);
assert.ok(device); device.setDefaultTimeout(15000);
const report = { testedAt: new Date().toISOString(), environment: 'MuMu Android12 + actual local DSH/gateway', target };
const save = () => writeFile('artifacts/remote-live.json', JSON.stringify(report, null, 2));
async function pages() {
  const first = await (await device.webView({ pkg: 'dev.dshmobile.validation' })).page();
  return { ordinary: first.context().pages().find(page => page.url().startsWith('https://appassets.androidplatform.net/')),
    remote: first.context().pages().find(page => page.url().startsWith('https://remote.dshm.invalid/')) };
}
async function hashOwnChat(page) {
  return page.evaluate(async id => {
    const db = await new Promise(resolve => { const r = indexedDB.open('dshm-ordinary-history-v1'); r.onsuccess = () => resolve(r.result); });
    try {
      const chat = await new Promise(resolve => { const r = db.transaction('chats').objectStore('chats').get(id); r.onsuccess = () => resolve(r.result); });
      if (!chat) throw new Error('ordinary_test_chat_missing');
      return [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(chat))))].map(n => n.toString(16).padStart(2, '0')).join('');
    } finally { db.close(); }
  }, ordinaryTestChat);
}
try {
  let { ordinary, remote } = await pages();
  assert.ok(ordinary); assert.ok(remote);
  const before = await hashOwnChat(ordinary);
  const fingerprint = await remote.getByTestId('remote-fingerprint').innerText();
  if (await remote.getByTestId('remote-state').innerText() !== '已连接') await remote.getByTestId('remote-connect').click();
  await remote.getByTestId('remote-list').waitFor();
  await remote.getByTestId('remote-list').click();
  await remote.getByRole('combobox', { name: '远端会话' }).selectOption(target);
  await remote.getByTestId('remote-records').getByText(/DSH_REMOTE_OK_20260922/).first().waitFor();
  report.readExistingConversation = true; await save();
  const marker = `DSHM_ANDROID_REMOTE_${Date.now()}`;
  const prompt = `这是手机端双模式隔离联调，请只回复 ${marker}，不要调用工具，不要修改文件。`;
  await remote.getByRole('textbox', { name: '远端聊天消息' }).fill(prompt);
  await remote.getByTestId('remote-send').click();
  const assistant = remote.getByTestId('remote-records').locator('article').filter({ has: remote.getByRole('heading', { name: 'DSH', exact: true }) }).filter({ hasText: marker });
  await assistant.waitFor({ timeout: 120000 });
  assert.equal(await remote.getByRole('textbox', { name: '远端聊天消息' }).inputValue(), '');
  report.realContinuation = { marker, reply: await assistant.innerText() }; await save();
  assert.equal(await hashOwnChat(ordinary), before);
  report.ordinaryHistoryUnchanged = true;
  await remote.getByTestId('remote-connect').click();
  await remote.getByTestId('remote-list').waitFor();
  await remote.getByTestId('remote-list').click();
  await remote.getByRole('combobox', { name: '远端会话' }).selectOption(target);
  await assistant.waitFor();
  assert.equal(await assistant.count(), 1);
  report.reconnectSnapshotReplaced = true; await save();
  await device.shell('am force-stop dev.dshmobile.validation');
  await device.shell('am start -n dev.dshmobile.validation/.ValidationActivity');
  ({ ordinary } = await pages());
  const opened = ordinary.context().waitForEvent('page');
  await ordinary.getByTestId('remote-open').click();
  await opened;
  ({ ordinary, remote } = await pages());
  await remote.getByTestId('remote-fingerprint').waitFor();
  assert.equal(await remote.getByTestId('remote-fingerprint').innerText(), fingerprint);
  assert.equal(await ordinary.getByTestId('ordinary-key-state').innerText(), 'Key 已配置');
  assert.equal(await hashOwnChat(ordinary), before);
  await remote.getByTestId('remote-connect').click();
  await remote.getByTestId('remote-list').waitFor();
  await remote.getByTestId('remote-list').click();
  await remote.getByRole('combobox', { name: '远端会话' }).selectOption(target);
  await remote.getByTestId('remote-records').locator('article').filter({ has: remote.getByRole('heading', { name: 'DSH', exact: true }) }).filter({ hasText: marker }).waitFor();
  report.restartBindingAndBothHistories = true; report.fingerprint = fingerprint;
  report.revocationVerified = false;
  await save();
  await writeFile('artifacts/remote-live-device.png', await device.screenshot());
  console.log(JSON.stringify(report));
} finally { await device.close(); }
