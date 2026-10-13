import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { chooseDownload, pickerNodes, tapPickerNode } from '../../scripts/android-picker-test.mjs';

/** 从真实SAF输入到官方历史附件，再由原附件provider预览/保存；不注入附件或receipt。 */
export async function verifyOfficialAttachments({ page, device, evidence, inference, packageName, mark }) {
  assert.equal(packageName, 'dev.dshmobile.validation.officialtest');
  const seed = inference.attachments, report = { inputs: [], previews: [], downloads: [], completed: false };
  const editor = page.getByTestId('remote-workspace').locator('[data-composer-input]');
  const pending = page.getByLabel('待发送附件', { exact: true });
  const panel = page.getByRole('region', { name: '插件面板', exact: true });
  const active = panel.locator('.remote-document-tab:not([hidden])');
  const owned = [], save = () => writeFile(resolve(evidence, 'attachments.json'), JSON.stringify(report, null, 2) + '\n');
  const hash = async path => (await device.shell(`sha256sum '${path}'`)).toString().trim().split(/\s+/)[0];
  const exists = async path => (await device.shell(`if [ -e '${path}' ]; then echo EXISTS; else echo ABSENT; fi`)).toString().trim() === 'EXISTS';
  const targetFor = name => {
    assert.match(name, /^dshm-attachment-(input|export)-[a-f0-9]{8}\.(txt|pdf|docx)$/);
    return '/sdcard/Download/' + name;
  };
  const emptyCache = async () => {
    assert.equal((await device.shell(`run-as ${packageName} find cache/remote-downloads -maxdepth 1 -type f`)).toString().trim(), '');
  };
  try {
    assert.equal(await pending.count(), 0); await emptyCache();
    for (const file of seed.files) {
      const source = await seed.source(file.name), path = targetFor(file.name);
      assert.equal(source.length, file.bytes); assert.equal(createHash('sha256').update(source).digest('hex'), file.sha256);
      assert.equal(await exists(path), false);
      await device.push(source, path); owned.push({ path, sha256: file.sha256 });
      assert.equal(await hash(path), file.sha256);
      await page.getByRole('button', { name: '添加附件', exact: true }).click();
      await page.getByRole('button', { name: '选择文件', exact: true }).click();
      await chooseDownload(device, file.name);
      await pending.locator('.remote-file').filter({ hasText: file.name }).getByRole('status').filter({ hasText: /^已上传/ })
        .waitFor({ timeout: 60000 });
      report.inputs.push({ ...file, actualPicker: true, ready: true }); await save();
    }
    await mark('official-phone-system-picker-and-three-original-file-uploads');
    const prompt = `只读取本轮上传的 ${seed.files[0].name} 的第一行。另两个附件仅用于预览，不读取。只回复第一行原文，不修改文件。`;
    assert.equal(prompt.includes(seed.marker), false);
    await editor.fill(prompt); await page.getByRole('button', { name: '发送消息', exact: true }).click();
    await pending.waitFor({ state: 'detached', timeout: 60000 });
    await page.getByRole('article', { name: '模型回复', exact: true }).getByText(seed.marker, { exact: true }).waitFor({ timeout: 180000 });
    await page.getByRole('button', { name: '停止生成', exact: true }).waitFor({ state: 'hidden', timeout: 180000 });
    report.officialHistory = await seed.verifySent(prompt);
    await mark('official-same-session-file-refs-model-reading-and-independent-original-byte-check'); await save();
    await editor.fill('OFFICIAL_ATTACHMENT_PREVIEW_DRAFT');
    for (const file of seed.files) {
      await page.getByRole('button', { name: '查看附件 ' + file.name, exact: true }).click();
      await active.waitFor();
      const address = await active.locator('[data-textpreview-url]').getAttribute('data-textpreview-url');
      assert.match(address, /^dsh-resource:\/\/dshm-attachment\//);
      if (file.extension === 'txt') {
        const plain = active.locator('[data-textpreview-plain]'); await plain.waitFor();
        assert.equal(await plain.locator('[data-textpreview-line]').count(), 5000);
        assert.equal(await plain.textContent(), seed.text.split('\n').slice(0, 5000).join('\n') + '\n');
        await panel.getByRole('button', { name: '加载更多', exact: true }).click();
        await plain.locator('[data-textpreview-line="5002"]').waitFor();
        assert.equal(await plain.textContent(), seed.text);
        report.previews.push({ name: file.name, address, lines: 5002, unicodeMatches: true });
      } else {
        await active.locator('[data-pdf-preview] canvas').first().waitFor({ timeout: 180000 });
        const text = (await active.locator('.textLayer').allTextContents()).join('');
        assert.ok(text.trim().length > 0, 'Must display real PDF text');
        if (file.extension === 'docx') assert.ok(text.includes('Office preview'));
        assert.ok(await active.locator('canvas').first().evaluate(canvas => canvas.width > 0 && canvas.height > 0));
        report.previews.push({ name: file.name, address, text, actualCanvas: true });
      }
      await writeFile(resolve(evidence, 'attachment-' + file.extension + '.png'), await device.screenshot());
      await mark('official-history-attachment-' + file.extension + '-preview'); await save();
      const exportName = file.name.replace('-input-', '-export-'), target = targetFor(exportName);
      assert.equal(await exists(target), false);
      await panel.getByRole('button', { name: '下载完整文件', exact: true }).click();
      await panel.getByText('请选择保存位置…', { exact: true }).waitFor();
      assert.ok((await pickerNodes(device)).some(node => node.class === 'android.widget.EditText' && node.text === file.name));
      await tapPickerNode(device, node => node['content-desc'] === '显示根目录');
      await tapPickerNode(device, node => node.text === '下载' && node['resource-id'] === 'android:id/title');
      await tapPickerNode(device, node => node.class === 'android.widget.EditText' && node['resource-id'] === 'android:id/title');
      await device.shell('input keyevent KEYCODE_MOVE_END');
      await device.shell(`input keyevent ${Array(file.name.length).fill('KEYCODE_DEL').join(' ')}`);
      await device.shell(`input text ${exportName}`);
      assert.equal((await pickerNodes(device)).find(node => node.class === 'android.widget.EditText')?.text, exportName);
      await tapPickerNode(device, node => node.text === '保存' && node.clickable === 'true');
      assert.equal((await pickerNodes(device)).some(node => node.text === '替换'), false);
      owned.push({ path: target, sha256: file.sha256 });
      await panel.getByText('已保存到所选位置。', { exact: true }).waitFor({ timeout: 60000 });
      assert.equal(await hash(target), file.sha256);
      assert.equal(Number((await device.shell(`wc -c < '${target}'`)).toString().trim()), file.bytes);
      await emptyCache();
      report.downloads.push({ name: exportName, bytes: file.bytes, sha256: file.sha256, actualSystemSave: true });
      await mark('official-history-attachment-' + file.extension + '-original-system-save'); await save();
      await panel.getByRole('button', { name: '面板操作', exact: true }).click();
      await page.getByRole('menuitem', { name: '关闭当前面板', exact: true }).click();
      await active.waitFor({ state: 'detached' });
      if (await panel.isVisible()) await panel.getByRole('button', { name: '返回聊天', exact: true }).click();
      assert.equal(await editor.innerText(), 'OFFICIAL_ATTACHMENT_PREVIEW_DRAFT');
    }
    await editor.fill(''); report.draftPreserved = true; report.completed = true;
  } catch (error) { report.failure = error.message; throw error; }
  finally {
    for (const item of owned) {
      if (!await exists(item.path)) continue;
      assert.equal(await hash(item.path), item.sha256, 'Refusing cleanup of changed attachment fixture');
      await device.shell(`rm '${item.path}'`); assert.equal(await exists(item.path), false);
    }
    report.ownCopiesRemoved = true; await save();
  }
  return report;
}
