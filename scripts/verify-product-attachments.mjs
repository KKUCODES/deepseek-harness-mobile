import assert from 'node:assert/strict';
import { _android } from 'playwright';
import { readFile, writeFile } from 'node:fs/promises';
import { chooseDownload, pickerNodes } from './android-picker-test.mjs';

assert.equal(process.env.DSHM_RUN_LIVE, '1');
const device = (await _android.devices({ omitDriverInstall: true })).find(value => value.serial() === process.env.DSHM_ANDROID_SERIAL);
assert.ok(device); device.setDefaultTimeout(15000);
const resume = process.env.DSHM_ATTACH_RESUME === '1';
const report = resume ? JSON.parse(await readFile('artifacts/ordinary-attachments-android.json', 'utf8')) : { at: new Date().toISOString(), environment: 'MuMu Android; real SAF and native DeepSeek request', stages: [] };
delete report.error;
try {
  const page = await (await device.webView({ pkg: 'dev.dshmobile.validation' })).page();
  if (!resume) {
  // 每次独立打开测试会话；若正在系统选择器则继续已有选择，不强制结束 App。
  if (!(await pickerNodes(device)).length) {
    const close = page.getByRole('button', { name: '关闭窗口', exact: true });
    if (await close.count()) await close.click();
    await page.getByRole('button', { name: '新聊天', exact: true }).click();
    await page.getByRole('button', { name: '添加附件', exact: true }).click();
    await page.getByRole('button', { name: '选择文件', exact: true }).click();
  }
  await chooseDownload(device, 'dshm-red.png');
  await page.getByRole('button', { name: '移除附件 dshm-red.png', exact: true }).waitFor();
  await page.getByRole('button', { name: '添加附件', exact: true }).click();
  await page.getByRole('button', { name: '选择文件', exact: true }).click();
  await chooseDownload(device, 'dshm-test.txt');
  await page.getByRole('button', { name: '移除附件 dshm-test.txt', exact: true }).waitFor();
  report.stages.push({ name: 'actualSystemPicker', image: true, text: true });
  const marker = `DSHM_ATTACH_${Date.now()}`;
  await page.getByRole('textbox', { name: '消息', exact: true }).fill(`${marker}：请读取附件，只回复两项：图片的主色（中文），以及文本文件中写的测试代码。`);
  await page.getByRole('button', { name: '发送消息', exact: true }).click();
  await page.waitForFunction(async marker => {
    const db = await new Promise((resolve, reject) => { const r = indexedDB.open('dshm-ordinary-history-v1'); r.onsuccess = () => resolve(r.result); r.onerror = reject; });
    try { return await new Promise((resolve, reject) => { const r = db.transaction('chats').objectStore('chats').getAll(); r.onsuccess = () => { const turn = r.result.find(row => row.title.startsWith(marker))?.turns[0]; resolve(turn && ['completed', 'failed', 'interrupted'].includes(turn.status)); }; r.onerror = reject; }); } finally { db.close(); }
  }, marker, { timeout: 120000 });
  }
  assert.equal(await page.getByText(/^DSHM_ATTACH_\d+：/).count(), 1, 'Only resume the dedicated attachment test chat');
  const response = page.getByRole('article', { name: '模型回复' });
  await response.filter({ hasText: 'DSHM_FILE_CONTENT_8371' }).waitFor();
  const content = await response.innerText();
  assert.match(content, /红/); assert.match(content, /DSHM_FILE_CONTENT_8371/);
  report.stages.push({ name: 'actualModelUnderstandsAttachments', redImage: true, fileOnlyMarker: true });
  // 切换至不支持图片的模型时应明确拦截，不能偷偷丢弃历史图片。
  await page.getByRole('textbox', { name: '消息', exact: true }).fill('尝试不支持图片的模型');
  await page.getByRole('button', { name: /选择模型，当前/ }).click();
  await page.getByRole('button', { name: 'DeepSeek Pro', exact: true }).click();
  await page.getByRole('button', { name: '发送消息', exact: true }).click();
  await page.getByRole('alert').filter({ hasText: '当前聊天包含图片' }).waitFor();
  assert.equal(await page.getByRole('article', { name: '模型回复' }).count(), 1);
  report.stages.push({ name: 'unsupportedVisionModel', explicitRefusal: true, noNewTurn: true });
  report.passed = true;
  await page.screenshot({ path: 'artifacts/ordinary-attachments-android.png' });
} catch (error) { report.passed = false; report.error = error.message; throw error; }
finally { await writeFile('artifacts/ordinary-attachments-android.json', JSON.stringify(report, null, 2)); console.log(JSON.stringify(report)); await device.close(); }
