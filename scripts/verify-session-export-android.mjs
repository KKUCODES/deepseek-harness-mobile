import { _android } from 'playwright';
import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { unzipSync, strFromU8 } from 'fflate';
import { androidAppWebView } from './android-app-webview.mjs';
import { pickerNodes, tapPickerNode } from './android-picker-test.mjs';
import { inspectSessionArchive } from './session-export-check.mjs';

const device = (await _android.devices({ omitDriverInstall: true })).find(d => d.serial() === process.env.DSHM_ANDROID_SERIAL);
assert.ok(device); device.setDefaultTimeout(15000);
const report = { at: new Date().toISOString(), errors: [], resources: [], exports: [] };
const descendantsCase = process.argv.includes('--descendants');
const attachmentCase = process.argv.includes('--attachments');
const reportName = descendantsCase ? 'session-export-descendants' : attachmentCase ? 'session-export-attachments' : 'session-export';
try {
  const first = await (await androidAppWebView(device)).page(), context = first.context();
  let page = context.pages().find(p => p.url().startsWith('https://remote.dshm.invalid/'));
  if (!page) {
    const ordinary = context.pages().find(p => p.url().startsWith('https://appassets.androidplatform.net/')); assert.ok(ordinary);
    await ordinary.getByRole('button', { name: '打开侧边抽屉', exact: true }).click();
    const opened = context.waitForEvent('page');
    await ordinary.getByRole('button', { name: 'Remote', exact: true }).click(); await opened;
    page = context.pages().find(p => p.url().startsWith('https://remote.dshm.invalid/'));
  }
  assert.ok(page);
  page.on('pageerror', e => report.errors.push(e.message));
  page.on('response', r => { if (r.status() >= 400) report.resources.push({ path: new URL(r.url()).pathname, status: r.status() }); });
  const button = name => page.getByRole('button', { name, exact: true });
  if (await button('重新连接').isVisible()) await button('重新连接').click();
  await page.getByTestId('remote-workspace').waitFor({ timeout: 60000 });
  if (await button('关闭窗口').isVisible()) await button('关闭窗口').click();
  if (await button('返回父会话').isVisible()) await button('返回父会话').click();
  if (await page.getByRole('region', { name: '聊天内容', exact: true }).count()) await button('返回').click();
  if (descendantsCase) {
    await button('Remote 选项').click(); await button('查看已归档聊天').click();
    const { chat } = JSON.parse(await readFile('artifacts/remote-child-recovery-prepare.json', 'utf8'));
    await page.getByRole('button', { name: new RegExp(`^${chat}`) }).click();
  } else {
    await button('Remote 选项').click();
    if (await button('查看最近聊天').isVisible()) await button('查看最近聊天').click(); else await button('关闭窗口').click();
    await page.getByRole('button', { name: attachmentCase ? /^DSHM Remote 联调提示/ : /^DSHM 工作区保留验证 20260924/ }).click();
  }
  await page.getByRole('article', { name: '模型回复' }).first().waitFor();
  await button('Remote 选项').click(); await button('导出会话日志').click();
  const dialog = page.getByRole('dialog', { name: '导出会话日志', exact: true });
  const files = async () => (await device.shell('find /sdcard/Download -maxdepth 1 -type f -print0')).toString().split('\0').filter(path => /^\/sdcard\/Download\/session-log[^/]*\.zip(?: \(\d+\))?$/.test(path));
  for (const mode of descendantsCase ? ['single', 'children', 'child'] : attachmentCase ? ['single'] : ['single', 'children']) {
    const descendants = mode === 'children';
    if (mode === 'child') {
      await button('关闭窗口').click(); await button('Remote 选项').click(); await button('子会话').click();
      await page.getByRole('dialog', { name: '子会话', exact: true }).getByRole('button', { name: /DSHM 图片子会话/ }).click();
      await page.getByRole('dialog').waitFor({ state: 'detached' });
      await button('Remote 选项').click(); await button('导出会话日志').click();
    }
    await dialog.getByRole('checkbox', { name: '包含子会话', exact: true }).setChecked(descendants);
    const before = new Set(await files());
    await button('导出并保存').click(); await dialog.getByText('请选择保存位置…', { exact: true }).waitFor({ timeout: 60000 });
    const nodes = await pickerNodes(device);
    assert.match(nodes.find(node => node.class === 'android.widget.EditText')?.text ?? '', /^session-log.*\.zip(?: \(\d+\))?$/);
    if (!nodes.some(node => node.text === '下载')) {
      await tapPickerNode(device, node => node['content-desc'] === '显示根目录');
      await tapPickerNode(device, node => node.text === '下载' && node['resource-id'] === 'android:id/title');
    }
    await tapPickerNode(device, node => node.text === '保存' && node.clickable === 'true');
    // 不覆盖已有文件；Android 为同名下载自动增加编号。
    await dialog.getByText('日志已保存到所选位置。', { exact: true }).waitFor();
    const created = (await files()).filter(path => !before.has(path)); assert.equal(created.length, 1);
    assert.match(created[0], /^\/sdcard\/Download\/session-log[\w.() -]*$/);
    const bytes = await device.shell(`cat '${created[0]}'`), entries = unzipSync(bytes);
    const log = Object.entries(entries).find(([name]) => /^session(?:\.v\d+)?\.jsonl$/.test(name)); assert.ok(log);
    const content = strFromU8(log[1]);
    assert.ok(content.includes(descendantsCase ? mode === 'child' ? 'IMAGE_CHILD_READY' : 'IMAGE_PARENT_READY' : attachmentCase ? 'dshm-shared-upload-20260924.txt' : 'DSHM_WORKSPACE_CHAT_KEPT_20260924'));
    for (const line of content.trim().split('\n')) JSON.parse(line);
    const evidence = { mode, includeDescendants: descendants, savedName: created[0].split('/').at(-1), bytes: bytes.length, entries: Object.keys(entries), markerFound: true, integrity: inspectSessionArchive(bytes) };
    if (attachmentCase) {
      const expected = await readFile('artifacts/dshm-shared-upload-20260924.txt');
      const attachment = Object.entries(entries).find(([name, data]) => name.startsWith('files/') && name.endsWith('/dshm-shared-upload-20260924.txt') && Buffer.from(data).equals(expected));
      assert.ok(attachment, 'ZIP must retain the original generic attachment');
      evidence.originalFileSha256 = createHash('sha256').update(attachment[1]).digest('hex');
    }
    if (descendantsCase) {
      const children = Object.entries(entries).filter(([name]) => /^subagents\/.*\/session(?:\.v\d+)?\.jsonl$/.test(name));
      if (descendants) { assert.ok(children.length >= 2); assert.ok(children.some(([, data]) => strFromU8(data).includes('IMAGE_CHILD_READY'))); }
      else assert.equal(children.length, 0);
      if (mode !== 'single') {
        const expected = await readFile('artifacts/dshm-child-image.png');
        const original = Object.entries(entries).find(([name, data]) => name.startsWith('media/') && Buffer.from(data).equals(expected));
        assert.ok(original, 'ZIP must contain the original image, byte for byte');
        evidence.originalImageSha256 = createHash('sha256').update(original[1]).digest('hex');
      }
      for (const [, data] of children) for (const line of strFromU8(data).trim().split('\n')) JSON.parse(line);
    }
    await writeFile(`artifacts/${reportName}-${mode}.zip`, bytes);
    report.exports.push(evidence);
  }
  await button('导出并保存').click(); await dialog.getByText('请选择保存位置…', { exact: true }).waitFor();
  await device.shell('input keyevent 4'); await dialog.getByText('已取消导出。', { exact: true }).waitFor();
  report.systemCancel = true;
  await page.screenshot({ path: `artifacts/${reportName}-android.png` });
  await button('关闭窗口').click();
  assert.deepEqual(report.errors, []); assert.deepEqual(report.resources, []);
} catch (error) { report.failure = error.message; throw error; }
finally { await writeFile(`artifacts/${reportName}-android.json`, JSON.stringify(report, null, 2)); console.log(JSON.stringify(report)); await device.close(); }
