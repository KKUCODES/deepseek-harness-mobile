import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pickerNodes, tapPickerNode } from '../../scripts/android-picker-test.mjs';

/** 原下载按钮与真实私有暂存证明传输已经开始；中断不能弹保存窗口或交付半成品。 */
export async function verifyOfficialFileRecovery({ page, device, evidence, inference, packageName,
  disconnect, reconnect, mark }) {
  assert.equal(packageName, 'dev.dshmobile.validation.officialtest');
  const seed = inference.fileRecovery, report = { cases: [], completed: false };
  const target = '/sdcard/Download/' + seed.filename;
  assert.match(target, /^\/sdcard\/Download\/dshm-interruption-[a-f0-9]{8}\.txt$/);
  const panel = page.getByRole('region', { name: '插件面板', exact: true });
  const active = panel.locator('.remote-document-tab:not([hidden])');
  const editor = page.getByTestId('remote-workspace').locator('[data-composer-input]');
  const delay = ms => new Promise(done => setTimeout(done, ms));
  const until = async (check, timeout = 15000) => {
    const deadline = Date.now() + timeout;
    while (!await check()) { assert.ok(Date.now() < deadline, 'official_file_recovery_condition_missing'); await delay(100); }
  };
  const save = () => writeFile(resolve(evidence, 'file-recovery.json'), JSON.stringify(report, null, 2) + '\n');
  const exists = async () => (await device.shell(`if [ -e '${target}' ]; then echo EXISTS; else echo ABSENT; fi`)).toString().trim() === 'EXISTS';
  const parts = async () => {
    const paths = (await device.shell(`run-as ${packageName} find cache/remote-downloads -maxdepth 1 -type f`)).toString().trim();
    if (!paths) return [];
    const entries = [];
    for (const path of paths.split('\n')) {
      assert.match(path, /^cache\/remote-downloads\/remote-[0-9]+\.part$/);
      const bytes = Number((await device.shell(`run-as ${packageName} stat -c %s ${path}`)).toString().trim());
      assert.ok(Number.isSafeInteger(bytes) && bytes >= 0); entries.push({ path, bytes });
    }
    return entries;
  };
  const empty = () => until(async () => (await parts()).length === 0);
  const noDelivery = async () => {
    await empty(); assert.equal(await exists(), false);
    assert.equal((await pickerNodes(device)).length, 0);
    assert.equal(await panel.getByText('请选择保存位置…', { exact: true }).count(), 0);
    assert.equal(await panel.getByText('已保存到所选位置。', { exact: true }).count(), 0);
  };
  const open = async () => {
    if (!await panel.isVisible()) {
      await page.getByRole('button', { name: 'Remote 选项', exact: true }).click();
      await page.getByRole('dialog', { name: 'Remote 选项', exact: true }).getByRole('button', { name: '插件面板', exact: true }).click();
    }
    const tab = panel.locator('nav').getByRole('button', { name: '文件', exact: true });
    if (await tab.count()) await tab.click();
    else await panel.getByRole('button', { name: /工作区文件/ }).click();
    const tree = panel.locator('[data-files-state="tree"]');
    await tree.waitFor();
    assert.equal((await tree.getAttribute('data-files-root')).replaceAll('\\', '/').toLowerCase(),
      seed.root.replaceAll('\\', '/').toLowerCase());
    await tree.getByRole('button', { name: seed.filename, exact: true }).click();
    await active.waitFor();
    await panel.getByRole('button', { name: '下载完整文件', exact: true }).waitFor();
  };
  const begin = async phase => {
    await empty();
    const item = { phase }; report.cases.push(item); await save();
    await panel.getByRole('button', { name: '下载完整文件', exact: true }).click();
    await panel.getByRole('button', { name: '取消下载', exact: true }).waitFor();
    await until(async () => {
      const current = await parts();
      if (current.length === 1 && current[0].bytes > 0 && current[0].bytes < seed.bytes) { item.partial = current[0]; return true; }
      return false;
    });
    item.realPartialFileObserved = true; await save(); return item;
  };
  let ownSaved = false, latest;
  try {
    assert.equal(await exists(), false); await empty();
    await editor.fill('OFFICIAL_FILE_RECOVERY_DRAFT');
    await open();
    const cancelled = await begin('cancel');
    await panel.getByRole('button', { name: '取消下载', exact: true }).click();
    await panel.getByText('已取消下载。', { exact: true }).waitFor();
    await noDelivery();
    assert.deepEqual(await seed.verifySource(), { bytes: seed.bytes, sha256: seed.sha256 });
    cancelled.partialRemoved = true; cancelled.noSystemDelivery = true; await save();
    await mark('official-inflight-file-cancel-clears-real-partial');

    const offline = await begin('disconnect');
    await disconnect();
    await page.getByTestId('remote-offline-status').waitFor();
    await panel.getByText('下载未完成，请检查连接、文件权限和手机存储后重试。', { exact: true }).waitFor();
    await noDelivery();
    await reconnect();
    await page.getByTestId('remote-offline-status').waitFor({ state: 'detached', timeout: 45000 });
    await delay(2000); await noDelivery();
    offline.partialRemoved = true; offline.noAutomaticRetry = true;
    assert.deepEqual(await seed.verifySource(), { bytes: seed.bytes, sha256: seed.sha256 }); await save();
    await mark('official-inflight-file-disconnect-clears-partial-without-retry');

    await open();
    const changed = await begin('source-change');
    latest = await seed.changeSource();
    assert.ok(latest.bytes > seed.bytes); assert.notEqual(latest.sha256, seed.sha256);
    await panel.getByText('下载时文件发生变化，请重新下载。', { exact: true }).waitFor();
    await noDelivery();
    assert.deepEqual(await seed.verifySource(), latest);
    changed.partialRemoved = true; changed.noMixedVersionDelivery = true; changed.latest = latest; await save();
    await mark('official-source-change-rejects-mixed-download-and-clears-partial');

    await panel.getByRole('button', { name: '下载完整文件', exact: true }).click();
    await panel.getByText('请选择保存位置…', { exact: true }).waitFor({ timeout: 120000 });
    const complete = await parts(); assert.equal(complete.length, 1); assert.equal(complete[0].bytes, latest.bytes);
    assert.ok((await pickerNodes(device)).some(node => node.class === 'android.widget.EditText' && node.text === seed.filename));
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
    assert.deepEqual({ bytes, sha256 }, latest); await empty();
    report.retry = { ...latest, originalBytes: seed.bytes, latestVersionSaved: true, systemPicker: true };
    await writeFile(resolve(evidence, 'file-recovery-saved.png'), await device.screenshot());
    await panel.getByRole('button', { name: '返回聊天', exact: true }).click();
    assert.equal(await editor.innerText(), 'OFFICIAL_FILE_RECOVERY_DRAFT'); await editor.fill('');
    report.draftPreserved = true; report.completed = true; await save();
    await mark('official-explicit-retry-saves-complete-latest-file-and-retains-draft');
  } catch (error) { report.failure = error.message; throw error; }
  finally {
    if (ownSaved) {
      assert.ok(latest);
      assert.equal((await device.shell(`sha256sum '${target}'`)).toString().trim().split(/\s+/)[0], latest.sha256,
        'Refusing cleanup of changed or incomplete download');
      await device.shell(`rm '${target}'`); assert.equal(await exists(), false); report.testDownloadRemoved = true;
    }
    await save();
  }
  return report;
}
