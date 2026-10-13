import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { unzipSync } from 'fflate';
import { chooseDownload, pickerNodes, tapPickerNode } from '../../scripts/android-picker-test.mjs';

/** 真实上传、导出和SAF保存；解包只在验收进程中进行，手机生产流不被替换。 */
export async function verifyOfficialSessionExport({ page, device, evidence, inference, packageName, mark }) {
  assert.equal(packageName, 'dev.dshmobile.validation.officialtest');
  const seed = inference.sessionExport, main = page.getByTestId('remote-workspace');
  const editor = main.locator('[data-composer-input]');
  const dialog = page.getByRole('dialog', { name: '导出会话日志', exact: true });
  const report = { passed: false, saves: [], draft: 'DSHM_SESSION_EXPORT_DRAFT' }, owned = [];
  const save = () => writeFile(resolve(evidence, 'session-export.json'), JSON.stringify(report, null, 2) + '\n');
  const hash = bytes => createHash('sha256').update(bytes).digest('hex');
  const digest = async path => (await device.shell(`sha256sum '${path}'`)).toString().trim().split(/\s+/)[0];
  const exists = async path => (await device.shell(`if [ -e '${path}' ]; then echo EXISTS; else echo ABSENT; fi`)).toString().trim() === 'EXISTS';
  const emptyCache = async () => assert.equal((await device.shell(`run-as ${packageName} find cache/remote-downloads -maxdepth 1 -type f`)).toString().trim(), '');
  const open = async () => {
    await main.getByRole('button', { name: 'Remote 选项', exact: true }).click();
    await page.getByRole('dialog', { name: 'Remote 选项', exact: true }).getByRole('button', { name: '导出会话日志', exact: true }).click();
    await dialog.waitFor();
  };
  const verifyArchive = (zip, reference, prepared, includeDescendants) => {
    const entries = unzipSync(zip), original = unzipSync(reference);
    const names = Object.keys(entries).sort();
    assert.deepEqual(names, Object.keys(original).sort());
    for (const name of names) assert.deepEqual(Buffer.from(entries[name]), Buffer.from(original[name]));
    const root = names.filter(name => !name.includes('/') && name.endsWith('.jsonl'));
    assert.equal(root.length, 1);
    const parseLog = name => {
      const text = Buffer.from(entries[name]).toString('utf8'); assert.ok(text.endsWith('\n'));
      return text.trimEnd().split('\n').map(line => JSON.parse(line));
    };
    const [rootHeader, ...events] = parseLog(root[0]);
    assert.equal(rootHeader.type, 'session'); assert.equal(rootHeader.id, prepared.rootId);
    assert.deepEqual(events, prepared.rootEvents);
    const childPath = `subagents/${prepared.childId}/${root[0]}`;
    if (includeDescendants) {
      const [childHeader, ...childEvents] = parseLog(childPath);
      assert.equal(childHeader.id, prepared.childId); assert.deepEqual(childEvents, prepared.childEvents);
    } else assert.equal(entries[childPath], undefined);
    const id = prepared.ref.attachmentId.replace(/^sha256:/, ''), filePath = `files/${id.slice(0, 2)}/${id}/${seed.name}`;
    assert.deepEqual(Buffer.from(entries[filePath]), Buffer.from(seed.text));
    assert.equal(hash(entries[filePath]), seed.sha256);
    assert.deepEqual(names, [root[0], filePath, ...(includeDescendants ? [childPath] : [])].sort());
    return { names, originalEntriesByteMatched: true, originalRootEventsMatched: true,
      ...(includeDescendants ? { originalChildEventsMatched: true } : { childExcluded: true }),
      originalAttachmentMatched: true, zipBytes: zip.length, zipSha256: hash(zip),
      referenceZipSha256: hash(reference), attachmentBytes: entries[filePath].length };
  };
  try {
    assert.match(seed.name, /^dshm-export-input-[a-f0-9]{8}\.txt$/);
    const source = Buffer.from(seed.text), input = '/sdcard/Download/' + seed.name;
    assert.equal(source.length, seed.bytes); assert.equal(hash(source), seed.sha256);
    assert.equal(await exists(input), false);
    await device.push(source, input); owned.push({ path: input, sha256: seed.sha256 });
    await main.getByRole('button', { name: '添加附件', exact: true }).click();
    await page.getByRole('button', { name: '选择文件', exact: true }).click();
    await chooseDownload(device, seed.name);
    await page.getByLabel('待发送附件', { exact: true }).getByRole('status').filter({ hasText: /^已上传/ }).waitFor({ timeout: 60000 });
    const prompt = `本条附件用于DSHM原始日志导出联调，不读取附件、不调用工具、不修改文件。只回复 ${seed.marker}_ATTACHED。`;
    await editor.fill(prompt); await main.getByRole('button', { name: '发送消息', exact: true }).click();
    await main.getByRole('article', { name: '模型回复', exact: true }).getByText(seed.marker + '_ATTACHED', { exact: true }).waitFor({ timeout: 180000 });
    await main.getByRole('button', { name: '停止生成', exact: true }).waitFor({ state: 'hidden', timeout: 180000 });
    const prepared = await seed.prepared(prompt);
    report.prepared = { rootId: prepared.rootId, childId: prepared.childId,
      rootEvents: prepared.rootEvents.length, childEvents: prepared.childEvents.length,
      ref: prepared.ref, uniqueActualAttachment: prepared.uniqueActualAttachment, originalChildVerified: prepared.originalChildVerified };
    await editor.fill(report.draft); await mark('official-export-actual-phone-attachment-and-original-child-ready'); await save();
    for (const includeDescendants of [false, true]) {
      const name = seed.name.replace('-input-', includeDescendants ? '-descendants-' : '-root-').replace(/\.txt$/, '.zip');
      assert.match(name, /^dshm-export-(root|descendants)-[a-f0-9]{8}\.zip$/);
      const target = '/sdcard/Download/' + name;
      assert.equal(await exists(target), false); await open();
      const checkbox = dialog.getByRole('checkbox', { name: '包含子会话', exact: true });
      assert.equal(await checkbox.isChecked(), false); if (includeDescendants) await checkbox.check();
      await dialog.getByRole('button', { name: '导出并保存', exact: true }).click();
      await dialog.getByText('请选择保存位置…', { exact: true }).waitFor({ timeout: 60000 });
      assert.equal((await pickerNodes(device)).find(node => node.class === 'android.widget.EditText')?.text, 'session-log.zip');
      await tapPickerNode(device, node => node['content-desc'] === '显示根目录');
      await tapPickerNode(device, node => node.text === '下载' && node['resource-id'] === 'android:id/title');
      await tapPickerNode(device, node => node.class === 'android.widget.EditText' && node['resource-id'] === 'android:id/title');
      await device.shell('input keyevent KEYCODE_MOVE_END');
      await device.shell(`input keyevent ${Array('session-log.zip'.length).fill('KEYCODE_DEL').join(' ')}`);
      await device.shell(`input text ${name}`);
      assert.equal((await pickerNodes(device)).find(node => node.class === 'android.widget.EditText')?.text, name);
      await tapPickerNode(device, node => node.text === '保存' && node.clickable === 'true');
      assert.equal((await pickerNodes(device)).some(node => node.text === '替换'), false);
      await dialog.getByText('日志已保存到所选位置。', { exact: true }).waitFor({ timeout: 60000 });
      const zip = Buffer.from(await device.shell(`cat '${target}'`));
      const sha256 = hash(zip); owned.push({ path: target, sha256 });
      assert.equal(await digest(target), sha256);
      assert.equal(Number((await device.shell(`wc -c < '${target}'`)).toString().trim()), zip.length);
      const reference = await seed.original(includeDescendants);
      const verified = verifyArchive(zip, reference, prepared, includeDescendants);
      assert.ok(zip.length > 4 * 65536); // 实际归档超过信用窗口，不能仅证明单块小文件路径。
      report.saves.push({ includeDescendants, actualSystemSave: true, spansResourceWindow: true, ...verified });
      await writeFile(resolve(evidence, includeDescendants ? 'session-export-descendants.zip' : 'session-export-root.zip'), zip);
      await emptyCache(); await writeFile(resolve(evidence, includeDescendants ? 'session-export-descendants.png' : 'session-export-root.png'), await device.screenshot());
      await dialog.getByRole('button', { name: '关闭窗口', exact: true }).click();
      assert.equal(await editor.innerText(), report.draft); assert.equal(await page.locator('iframe').count(), 0);
      await mark('official-export-' + (includeDescendants ? 'descendants' : 'root') + '-original-log-and-attachment-system-save'); await save();
    }
    await open(); await dialog.getByRole('button', { name: '导出并保存', exact: true }).click();
    await dialog.getByText('请选择保存位置…', { exact: true }).waitFor({ timeout: 60000 });
    assert.equal((await pickerNodes(device)).find(node => node.class === 'android.widget.EditText')?.text, 'session-log.zip');
    await device.shell('input keyevent KEYCODE_BACK');
    await dialog.getByText('已取消导出。', { exact: true }).waitFor(); await emptyCache();
    assert.equal(await dialog.getByText('日志已保存到所选位置。', { exact: true }).count(), 0);
    report.cancelled = { actualSystemWindowCancelled: true, privateCacheEmpty: true, noSuccessNotice: true };
    await writeFile(resolve(evidence, 'session-export-cancelled.png'), await device.screenshot());
    await dialog.getByRole('button', { name: '关闭窗口', exact: true }).click();
    assert.equal(await editor.innerText(), report.draft); report.unchanged = await seed.verify();
    await mark('official-export-system-window-cancel-cache-cleaned-and-original-history-unchanged');
    report.draftPreserved = true; report.passed = true; await editor.fill(''); return report;
  } catch (error) { report.failure = error.message; throw error; }
  finally {
    for (const item of owned) {
      if (!await exists(item.path)) continue;
      assert.equal(await digest(item.path), item.sha256, 'Refusing cleanup of changed export fixture');
      await device.shell(`rm '${item.path}'`); assert.equal(await exists(item.path), false);
    }
    report.ownCopiesRemoved = true; await save();
  }
}
