import assert from 'node:assert/strict';
import { _android } from 'playwright';
import { writeFile } from 'node:fs/promises';
import { pickerNodes, tapPickerNode, chooseDownload } from './android-picker-test.mjs';
import { decodeBackup } from '../src/ordinary-backup.mjs';

const device = (await _android.devices({ omitDriverInstall: true })).find(item => item.serial() === process.env.DSHM_ANDROID_SERIAL);
assert.ok(device); device.setDefaultTimeout(15000);
const report = { at: new Date().toISOString(), environment: 'MuMu, actual Android SAF export/import and default product settings', stages: [] };
try {
  const page = await (await device.webView({ pkg: 'dev.dshmobile.validation' })).page();
  await page.getByRole('button', { name: '打开侧边抽屉', exact: true }).click();
  await page.getByRole('button', { name: '设置', exact: true }).click();
  await page.getByRole('button', { name: /^本地数据/ }).click();
  await page.getByRole('button', { name: '导出聊天备份', exact: true }).click();
  let nodes = await pickerNodes(device);
  const filename = nodes.find(node => node.class === 'android.widget.EditText')?.text;
  assert.match(filename, /^DSHM-chats-\d+\.json$/);
  report.filename = filename;
  // 导出到系统 Download；文件名由 App 生成，绝不覆盖用户已有文件。
  if (!nodes.some(node => node.text === '下载')) {
    await tapPickerNode(device, node => node['content-desc'] === '显示根目录');
    await tapPickerNode(device, node => node.text === '下载');
  }
  await tapPickerNode(device, node => node.text === '保存' && node.clickable === 'true');
  await page.getByText('聊天备份已保存', { exact: true }).waitFor();
  const content = (await device.shell(`cat /sdcard/Download/${filename}`)).toString();
  const chats = decodeBackup(content);
  assert.ok(chats.length > 0);
  assert.deepEqual(Object.keys(JSON.parse(content)).sort(), ['chats', 'exportedAt', 'format', 'version']);
  report.stages.push({ name: 'nativeFileExport', chats: chats.length, validatedFormat: true });
  await page.getByRole('button', { name: '导入聊天备份', exact: true }).click();
  await chooseDownload(device, filename);
  await page.getByRole('button', { name: '确认导入', exact: true }).click();
  await page.getByText(`已导入 0 条，跳过 ${chats.length} 条重复记录`, { exact: true }).waitFor();
  report.stages.push({ name: 'reimportDeduplicates', imported: 0, skipped: chats.length });
  await page.getByRole('button', { name: '清理临时缓存', exact: true }).click();
  await page.getByRole('button', { name: '确认清理', exact: true }).click();
  await page.getByText('临时缓存已清理', { exact: true }).waitFor();
  await page.getByRole('button', { name: '返回设置首页', exact: true }).click();
  await page.getByRole('button', { name: '普通聊天 已配置', exact: true }).waitFor();
  await page.getByRole('button', { name: `本地数据 ${chats.length} 条聊天`, exact: true }).waitFor();
  report.stages.push({ name: 'clearCache', keepsKey: true, keepsChats: true });
  await page.getByRole('button', { name: '退出设置', exact: true }).click();
  report.passed = true;
} catch (error) { report.passed = false; report.error = error.message; throw error; }
finally { await writeFile('artifacts/ordinary-backup-android.json', JSON.stringify(report, null, 2)); console.log(JSON.stringify(report)); await device.close(); }
