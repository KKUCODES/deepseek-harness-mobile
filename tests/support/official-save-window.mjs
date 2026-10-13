import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pickerNodes, tapPickerNode } from '../../scripts/android-picker-test.mjs';

/** 仅用真正的系统位置选择窗口；不换保存provider、不写URI或延迟原生回执。 */
export async function verifyOfficialSaveWindowRecovery({ page, device, evidence, inference, packageName,
  disconnect, reconnect, mark }) {
  assert.equal(packageName, 'dev.dshmobile.validation.officialtest');
  const seed = inference.fileSave, report = { cases: [], completed: false };
  const target = '/sdcard/Download/' + seed.filename;
  assert.match(target, /^\/sdcard\/Download\/dshm-save-window-[a-f0-9]{8}\.txt$/);
  const panel = page.getByRole('region', { name: '插件面板', exact: true });
  const editor = page.getByTestId('remote-workspace').locator('[data-composer-input]');
  const delay = ms => new Promise(done => setTimeout(done, ms));
  const save = () => writeFile(resolve(evidence, 'save-window.json'), JSON.stringify(report, null, 2) + '\n');
  const until = async (check, timeout = 15000) => {
    const deadline = Date.now() + timeout;
    while (!await check()) { assert.ok(Date.now() < deadline, 'official_save_window_condition_missing'); await delay(100); }
  };
  const exists = async () => (await device.shell(`if [ -e '${target}' ]; then echo EXISTS; else echo ABSENT; fi`)).toString().trim() === 'EXISTS';
  const parts = async () => {
    const names = (await device.shell(`run-as ${packageName} find cache/remote-downloads -maxdepth 1 -type f`)).toString().trim();
    const entries = [];
    for (const name of names ? names.split('\n') : []) {
      assert.match(name, /^cache\/remote-downloads\/remote-[0-9]+\.part$/);
      const bytes = Number((await device.shell(`run-as ${packageName} stat -c %s ${name}`)).toString().trim());
      assert.ok(Number.isSafeInteger(bytes) && bytes >= 0); entries.push({ name, bytes });
    }
    return entries;
  };
  const empty = () => until(async () => (await parts()).length === 0);
  const dismissed = async () => {
    await until(async () => (await pickerNodes(device)).length === 0);
    await empty(); assert.equal(await exists(), false);
    assert.equal(await panel.getByText('请选择保存位置…', { exact: true }).count(), 0);
    assert.equal(await panel.getByText('已保存到所选位置。', { exact: true }).count(), 0);
  };
  const open = async () => {
    if (!await panel.isVisible()) {
      await page.getByRole('button', { name: 'Remote 选项', exact: true }).click();
      await page.getByRole('dialog', { name: 'Remote 选项', exact: true })
        .getByRole('button', { name: '插件面板', exact: true }).click();
    }
    const tab = panel.locator('nav').getByRole('button', { name: '文件', exact: true });
    if (await tab.count()) await tab.click();
    else await panel.getByRole('button', { name: /工作区文件/ }).click();
    const tree = panel.locator('[data-files-state="tree"]'); await tree.waitFor();
    assert.equal((await tree.getAttribute('data-files-root')).replaceAll('\\', '/').toLowerCase(),
      seed.root.replaceAll('\\', '/').toLowerCase());
    await tree.getByRole('button', { name: seed.filename, exact: true }).click();
    await panel.locator('.remote-document-tab:not([hidden])').waitFor();
  };
  const begin = async phase => {
    await empty(); const item = { phase }; report.cases.push(item); await save();
    await panel.getByRole('button', { name: '下载完整文件', exact: true }).click();
    await panel.getByText('请选择保存位置…', { exact: true }).waitFor();
    const complete = await parts(); assert.equal(complete.length, 1); assert.equal(complete[0].bytes, seed.bytes);
    assert.ok((await pickerNodes(device)).some(node => node.class === 'android.widget.EditText' && node.text === seed.filename));
    item.completePrivateFile = complete[0]; item.actualSystemPicker = true;
    await writeFile(resolve(evidence, 'save-window-' + phase + '.png'), await device.screenshot());
    await save(); return item;
  };
  let ownSaved = false;
  try {
    assert.equal(await exists(), false); await empty();
    await editor.fill('OFFICIAL_SAVE_WINDOW_DRAFT'); await open();
    const canceled = await begin('system-cancel');
    await device.shell('input keyevent 4');
    // 系统返回键先收起键盘的设备，需要再返回一次；不盲目退出App。
    if ((await pickerNodes(device)).length) await device.shell('input keyevent 4');
    await panel.getByText('已取消下载。', { exact: true }).waitFor(); await dismissed();
    canceled.completeFileRemoved = true; canceled.noDestination = true; await save();
    await mark('official-system-save-cancel-clears-complete-private-file');

    const offline = await begin('disconnect');
    await disconnect();
    await page.getByTestId('remote-offline-status').waitFor();
    await panel.getByText('下载未完成，请检查连接、文件权限和手机存储后重试。', { exact: true }).waitFor();
    await dismissed(); offline.completeFileRemoved = true; offline.systemWindowClosed = true;
    await writeFile(resolve(evidence, 'save-window-disconnect-closed.png'), await device.screenshot());
    await reconnect();
    await page.getByTestId('remote-offline-status').waitFor({ state: 'detached', timeout: 45000 });
    await delay(2000); await dismissed(); offline.noAutomaticRetry = true; await save();
    assert.deepEqual(await seed.verifySource(), { bytes: seed.bytes, sha256: seed.sha256 });
    await mark('official-system-save-disconnect-closes-window-and-clears-file');

    await open(); await begin('explicit-retry');
    await tapPickerNode(device, node => node['content-desc'] === '显示根目录');
    await tapPickerNode(device, node => node.text === '下载' && node['resource-id'] === 'android:id/title');
    ownSaved = true;
    await tapPickerNode(device, node => node.text === '保存' && node.clickable === 'true');
    if ((await pickerNodes(device)).some(node => node.text === '替换')) {
      await device.shell('input keyevent 4'); await device.shell('input keyevent 4'); ownSaved = false;
      throw Error('Refusing to overwrite an existing download');
    }
    await panel.getByText('已保存到所选位置。', { exact: true }).waitFor();
    const sha256 = (await device.shell(`sha256sum '${target}'`)).toString().trim().split(/\s+/)[0];
    const bytes = Number((await device.shell(`wc -c < '${target}'`)).toString().trim());
    assert.deepEqual({ bytes, sha256 }, { bytes: seed.bytes, sha256: seed.sha256 }); await empty();
    assert.equal((await pickerNodes(device)).length, 0);
    report.retry = { bytes, sha256, saved: true, originalSystemWindowReleased: true };
    await writeFile(resolve(evidence, 'save-window-saved.png'), await device.screenshot());
    await panel.getByRole('button', { name: '返回聊天', exact: true }).click();
    assert.equal(await editor.innerText(), 'OFFICIAL_SAVE_WINDOW_DRAFT'); await editor.fill('');
    report.draftPreserved = true; report.completed = true; await save();
    await mark('official-system-save-explicit-retry-writes-original-and-retains-draft');
  } catch (error) { report.failure = error.message; throw error; }
  finally {
    if (ownSaved) {
      assert.equal((await device.shell(`sha256sum '${target}'`)).toString().trim().split(/\s+/)[0], seed.sha256,
        'Refusing cleanup of changed or incomplete download');
      await device.shell(`rm '${target}'`); assert.equal(await exists(), false); report.testDownloadRemoved = true;
    }
    await save();
  }
  return report;
}
