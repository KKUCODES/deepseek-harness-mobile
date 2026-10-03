import assert from 'node:assert/strict';
import { _android } from 'playwright';
import { writeFile } from 'node:fs/promises';

assert.equal(process.env.DSHM_RUN_LIVE, '1');
const device = (await _android.devices({ omitDriverInstall: true })).find(item => item.serial() === process.env.DSHM_ANDROID_SERIAL);
assert.ok(device); device.setDefaultTimeout(15000);
try {
  const page = await (await device.webView({ pkg: 'dev.dshmobile.validation' })).page();
  assert.equal(await page.getByTestId('ordinary-key-state').innerText(), 'Key 已配置');
  assert.equal(await page.getByTestId('ordinary-stop').isDisabled(), true);
  const previous = await page.getByRole('combobox', { name: '普通聊天历史' }).inputValue();
  await page.getByTestId('ordinary-new').click();
  await page.waitForFunction(id => document.querySelector('select[aria-label="普通聊天历史"]').value !== id, previous);
  await page.waitForFunction(() => window.dshmValidation.ordinaryInput.snapshot().bindings === 1);
  const chatId = await page.getByRole('combobox', { name: '普通聊天历史' }).inputValue();
  const editor = page.getByRole('textbox', { name: '普通聊天消息', exact: true });
  await editor.fill('/translate');
  await page.getByTestId('ordinary-composer').getByRole('option', { name: /翻译/ }).click();
  assert.equal(await editor.inputValue(), '请翻译以下内容：');
  await editor.press('End'); await editor.pressSequentially('Hello, world!');
  await page.getByTestId('ordinary-send').click();
  await page.waitForFunction(() => !document.querySelector('[data-testid="ordinary-stop"]').disabled);
  await page.getByTestId('ordinary-input-toggle').click();
  await page.getByRole('button', { name: '加载输入插件', exact: true }).waitFor();
  await page.getByTestId('ordinary-input-toggle').click();
  await page.getByRole('button', { name: '卸载输入插件', exact: true }).waitFor();
  await page.waitForFunction(() => document.querySelector('[data-testid="ordinary-stop"]').disabled, null, { timeout: 120000 });
  const result = await page.evaluate(async id => {
    const db = await new Promise(resolve => { const req = indexedDB.open('dshm-ordinary-history-v1'); req.onsuccess = () => resolve(req.result); });
    try { return await new Promise(resolve => { const req = db.transaction('chats').objectStore('chats').get(id); req.onsuccess = () => resolve(req.result); }); }
    finally { db.close(); }
  }, chatId);
  assert.equal(result.turns[0].prompt, '请翻译以下内容：Hello, world!');
  assert.equal(result.turns[0].status, 'completed');
  assert.ok(result.turns[0].content.length > 0);
  assert.equal(result.draft, '');
  assert.deepEqual(await page.evaluate(() => window.dshmValidation.snapshot().errors), []);
  const report = { testedAt: new Date().toISOString(), environment: 'MuMu Android 12, actual DeepSeek API', calls: 1,
    originalInputPlugin: true, unloadReloadAfterSend: true, result };
  await writeFile('artifacts/ordinary-live-input.json', JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ chatId, status: result.turns[0].status, reply: result.turns[0].content }));
} finally { await device.close(); }
