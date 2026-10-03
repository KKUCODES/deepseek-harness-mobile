import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { chooseDownload, pickerNodes, tapPickerNode } from './android-picker-test.mjs';
import { loadOfficeFixture } from './office-fixture.mjs';

/** 真实系统选择、原附件上传、历史卡片转换与原文件下载；只操作专用联调会话。 */
export async function verifyOfficeAttachment(page, device, history) {
  assert.equal(process.env.DSHM_RUN_LIVE, '1');
  const { realOfficeBytes } = await loadOfficeFixture();
  const stem = `dshm-office-attachment-${Date.now()}`, files = [];
  for (const extension of ['docx', 'xlsx', 'pptx', 'doc', 'xls', 'ppt', 'corrupt.docx']) {
    const name = `${stem}.${extension}`;
    const bytes = extension === 'corrupt.docx' ? Buffer.from('invalid office attachment') : Buffer.from(realOfficeBytes(extension, 'DSHM Missing Attachment Font'));
    await writeFile(`artifacts/${name}`, bytes); await device.push(bytes, `/sdcard/Download/${name}`);
    await page.getByRole('button', { name: '添加附件', exact: true }).click();
    await page.getByRole('button', { name: '选择文件', exact: true }).click();
    await chooseDownload(device, name);
    await page.getByLabel('待发送附件', { exact: true }).locator('.remote-file').filter({ hasText: name }).getByText(/已上传/).waitFor();
    files.push({ name, extension, bytes });
  }
  const before = await history.getByRole('article', { name: '模型回复' }).count();
  await page.getByRole('textbox', { name: '消息', exact: true }).fill('这是 Office 附件预览联调，只回复 DSHM_OFFICE_ATTACHMENT_READY，不读取附件，不调用工具。');
  await page.getByRole('button', { name: '发送消息', exact: true }).click();
  await page.getByLabel('待发送附件', { exact: true }).waitFor({ state: 'detached', timeout: 60000 });
  await history.getByRole('article', { name: '模型回复' }).nth(before).filter({ hasText: 'DSHM_OFFICE_ATTACHMENT_READY' }).waitFor({ timeout: 90000 });
  await page.getByRole('button', { name: '发送消息', exact: true }).waitFor();
  const preview = page.getByRole('dialog', { name: '文件预览', exact: true }), results = [];
  for (const file of files) {
    await history.getByRole('button', { name: `查看附件 ${file.name}`, exact: true }).click();
    if (file.extension === 'corrupt.docx') {
      await preview.getByRole('alert').waitFor({ timeout: 120000 });
      assert.equal(await preview.locator('canvas').count(), 0);
      results.push({ extension: file.extension, corruptRejected: true, noStalePdf: true });
    } else {
      await preview.locator('.textLayer').getByText(/Office preview/).first().waitFor({ timeout: 120000 });
      const text = (await preview.locator('.textLayer').allTextContents()).join('');
      assert.ok(text.includes('中文文档'));
      assert.ok(await preview.locator('canvas').first().evaluate(element => element.width > 0 && element.height > 0));
      const notice = (await preview.getByRole('status').allTextContents()).join(' ');
      if (file.extension === 'docx') assert.match(notice, /DSHM Missing Attachment Font/);
      await preview.getByRole('button', { name: '放大窗口', exact: true }).click();
      await page.screenshot({ path: `artifacts/remote-office-attachment-${file.extension}-android.png` });
      results.push({ extension: file.extension, text, notice, rendered: true, fullscreen: true });
    }
    await preview.getByRole('button', { name: '关闭文件预览', exact: true }).click();
    assert.equal(page.workers().length, 0);
  }
  const original = files[0];
  // 更改本地同名源文件后重新打开，转换缓存和下载均必须绑定已发送的不可变附件。
  await writeFile(`artifacts/${original.name}`, 'not the original office document');
  await device.push(Buffer.from('not the original office document'), `/sdcard/Download/${original.name}`);
  await history.getByRole('button', { name: `查看附件 ${original.name}`, exact: true }).click();
  await preview.locator('.textLayer').getByText(/Office preview/).first().waitFor({ timeout: 120000 });
  const savedFiles = async () => (await device.shell('find /sdcard/Download -maxdepth 1 -type f -print0')).toString().split('\0')
    .filter(path => path.startsWith(`/sdcard/Download/${original.name}`)).map(path => path.slice('/sdcard/Download/'.length));
  const beforeSave = new Set(await savedFiles());
  await preview.getByRole('button', { name: '下载完整文件', exact: true }).click();
  await preview.getByText('请选择保存位置…', { exact: true }).waitFor();
  const nodes = await pickerNodes(device);
  assert.equal(nodes.find(node => node.class === 'android.widget.EditText')?.text, original.name);
  // Android 可自动给重名文件加后缀；只验证本次新保存的文件，不能拿上传源冒充下载结果。
  await tapPickerNode(device, node => node.text === '保存' && node.clickable === 'true');
  const overwrite = await pickerNodes(device);
  if (overwrite.some(node => node.text === '替换')) await tapPickerNode(device, node => node.text === '替换');
  await preview.getByText('已保存到所选位置。', { exact: true }).waitFor();
  const created = (await savedFiles()).filter(name => !beforeSave.has(name));
  assert.equal(created.length, 1); assert.match(created[0], /^[\w.() -]+$/);
  const sha256 = createHash('sha256').update(original.bytes).digest('hex');
  assert.equal((await device.shell(`sha256sum '/sdcard/Download/${created[0]}'`)).toString().split(/\s/)[0], sha256);
  await preview.getByRole('button', { name: '关闭文件预览', exact: true }).click();
  await writeFile(`artifacts/${original.name}`, original.bytes);
  return { files: results, originalDownload: { name: original.name, savedName: created[0], bytes: original.bytes.length, sha256 }, immutableOriginal: true, workersReleased: true };
}
