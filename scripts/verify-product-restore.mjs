import assert from 'node:assert/strict';
import { _android } from 'playwright';
import { readFile, writeFile } from 'node:fs/promises';
import { chooseDownload } from './android-picker-test.mjs';
import { decodeBackup, encodeBackup } from '../src/ordinary-backup.mjs';

const device = (await _android.devices({ omitDriverInstall: true })).find(item => item.serial() === process.env.DSHM_ANDROID_SERIAL);
assert.ok(device); device.setDefaultTimeout(15000);
const report = { at: new Date().toISOString(), environment: 'MuMu native file import with generated test backup', stages: [] };
try {
  const previous = JSON.parse(await readFile('artifacts/ordinary-backup-android.json', 'utf8'));
  assert.match(previous.filename, /^DSHM-chats-\d+\.json$/);
  const rows = decodeBackup((await device.shell(`cat /sdcard/Download/${previous.filename}`)).toString());
  const source = rows.find(row => row.title.startsWith('DSHM_PRODUCT_'));
  assert.ok(source, 'Use only the explicitly generated API test chat');
  const clone = { ...source, id: crypto.randomUUID(), title: `DSHM_IMPORT_${Date.now()}`, draft: '导入草稿校验', updatedAt: Date.now() };
  await device.push(Buffer.from(encodeBackup([clone])), '/sdcard/Download/dshm-import-check.json');
  await device.push(Buffer.from('{"format":"foreign"}'), '/sdcard/Download/dshm-invalid-backup.json');
  const page = await (await device.webView({ pkg: 'dev.dshmobile.validation' })).page();
  await page.getByRole('button', { name: '打开侧边抽屉', exact: true }).click();
  await page.getByRole('button', { name: '设置', exact: true }).click();
  await page.getByRole('button', { name: /^本地数据/ }).click();
  await page.getByRole('button', { name: '导入聊天备份', exact: true }).click();
  await chooseDownload(device, 'dshm-invalid-backup.json');
  await page.getByText('这不是受支持的 DSHM 聊天备份。', { exact: true }).waitFor();
  assert.equal(await page.getByRole('button', { name: '确认导入', exact: true }).count(), 0);
  report.stages.push({ name: 'invalidFileRejected', noConfirmationOrWrites: true });
  await page.getByRole('button', { name: '导入聊天备份', exact: true }).click();
  await chooseDownload(device, 'dshm-import-check.json');
  await page.getByRole('button', { name: '确认导入', exact: true }).click();
  await page.getByText('已导入 1 条，跳过 0 条重复记录', { exact: true }).waitFor();
  await page.getByRole('button', { name: '返回设置首页', exact: true }).click();
  await page.getByRole('button', { name: '退出设置', exact: true }).click();
  await page.getByRole('button', { name: '打开侧边抽屉', exact: true }).click();
  await page.locator('.history-row').filter({ hasText: clone.title }).click();
  assert.equal(await page.getByRole('textbox', { name: '消息', exact: true }).inputValue(), clone.draft);
  assert.equal(await page.getByRole('article', { name: '模型回复' }).count(), source.turns.length);
  report.stages.push({ name: 'actualRestore', id: clone.id, historyAndDraft: true, turns: source.turns.length });
  report.passed = true;
} catch (error) { report.passed = false; report.error = error.message; throw error; }
finally { await writeFile('artifacts/ordinary-restore-android.json', JSON.stringify(report, null, 2)); console.log(JSON.stringify(report)); await device.close(); }
