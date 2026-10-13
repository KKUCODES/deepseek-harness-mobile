import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { promisify } from 'node:util';
import { pickerNodes, tapPickerNode } from '../../scripts/android-picker-test.mjs';

/** 真实Downloads写入后暂停自己UID；取消、断线、撤权通过原生命周期结算。 */
export async function verifyOfficialDestinationWriteInterruption({ page, device, evidence, inference,
  packageName, disconnect, reconnect, revoke, mark }) {
  assert.equal(packageName, 'dev.dshmobile.validation.officialtest');
  const seed = inference.fileWriteInterruption, report = { cases: [], completed: false, revocationOnly: seed.revocationOnly === true };
  assert.match(seed.filename, /^dshm-write-interrupt-[a-f0-9]{8}\.bin$/);
  assert.equal(seed.bytes, 64 * 1024 * 1024);
  const panel = page.getByRole('region', { name: '插件面板', exact: true });
  const editor = page.locator('[data-composer-input]');
  const adb = promisify(execFile), owned = [];
  const save = () => writeFile(resolve(evidence, seed.revocationOnly ? 'destination-write-revocation.json' : 'destination-write-interruption.json'), JSON.stringify(report, null, 2) + '\n');
  const delay = ms => new Promise(done => setTimeout(done, ms));
  const pid = async () => (await device.shell(`pidof ${packageName}`)).toString().trim();
  const exists = async path => (await device.shell(`if [ -e '${path}' ]; then echo EXISTS; else echo ABSENT; fi`)).toString().trim() === 'EXISTS';
  const size = async path => Number((await device.shell(`stat -c %s '${path}'`)).toString().trim());
  const hash = async path => (await device.shell(`sha256sum '${path}'`)).toString().trim().split(/\s+/)[0];
  const privateFiles = async directory => (await device.shell(`run-as ${packageName} find ${directory} -maxdepth 1 -type f`))
    .toString().trim().split('\n').filter(Boolean);
  const until = async check => {
    const end = Date.now() + 20000;
    while (!await check()) { assert.ok(Date.now() < end, 'official_destination_not_cleaned'); await delay(100); }
  };
  const open = async () => {
    if (!await panel.isVisible()) {
      await page.getByRole('button', { name: 'Remote 选项', exact: true }).click();
      await page.getByRole('dialog', { name: 'Remote 选项', exact: true }).getByRole('button', { name: '插件面板', exact: true }).click();
    }
    const tab = panel.locator('nav').getByRole('button', { name: '文件', exact: true });
    if (await tab.count()) await tab.click(); else await panel.getByRole('button', { name: /工作区文件/ }).click();
    const tree = panel.locator('[data-files-state="tree"]'); await tree.waitFor();
    assert.equal((await tree.getAttribute('data-files-root')).replaceAll('\\', '/').toLowerCase(), seed.root.replaceAll('\\', '/').toLowerCase());
    await tree.getByRole('button', { name: seed.filename, exact: true }).click();
    await panel.locator('.remote-document-tab:not([hidden])').waitFor();
  };
  const prepare = async phase => {
    const name = seed.filename.replace('.bin', '-' + phase + '.bin'), target = '/sdcard/Download/' + name;
    assert.equal(await exists(target), false); assert.deepEqual(await privateFiles('cache/remote-downloads'), []);
    await open(); await panel.getByRole('button', { name: '下载完整文件', exact: true }).click();
    await panel.getByText('请选择保存位置…', { exact: true }).waitFor({ timeout: 240000 });
    const complete = await privateFiles('cache/remote-downloads'); assert.equal(complete.length, 1);
    assert.equal(Number((await device.shell(`run-as ${packageName} stat -c %s ${complete[0]}`)).toString()), seed.bytes);
    assert.equal((await device.shell(`run-as ${packageName} sha256sum ${complete[0]}`)).toString().split(/\s+/)[0], seed.sha256);
    const cancelBox = await panel.getByRole('button', { name: '取消下载', exact: true }).boundingBox(); assert.ok(cancelBox);
    await tapPickerNode(device, node => node['content-desc'] === '显示根目录');
    await tapPickerNode(device, node => node.text === '下载' && node['resource-id'] === 'android:id/title');
    await tapPickerNode(device, node => node.class === 'android.widget.EditText' && node['resource-id'] === 'android:id/title');
    await device.shell('input keyevent KEYCODE_MOVE_END');
    await device.shell(`input keyevent ${Array(seed.filename.length).fill('KEYCODE_DEL').join(' ')}`);
    await device.shell(`input text ${name}`);
    assert.equal((await pickerNodes(device)).find(node => node.class === 'android.widget.EditText')?.text, name);
    owned.push(target); return { phase, target, name, cancelBox, completePrivateFile: complete[0] };
  };
  let watch, stoppedPid;
  try {
    await editor.fill('OFFICIAL_WRITE_INTERRUPTION_DRAFT'); report.historyBefore = await seed.historyDigest();
    for (const phase of seed.revocationOnly ? ['revoke'] : ['cancel', 'disconnect']) {
      const item = await prepare(phase); report.cases.push(item); await save();
      const appPid = await pid(); assert.match(appPid, /^[1-9]\d*$/);
      const script = `end=$(( $(date +%s) + 20 )); while [ $(date +%s) -lt $end ]; do
        bytes=$(stat -c %s '${item.target}' 2>/dev/null || echo 0)
        if [ "$bytes" -gt 0 ] && [ "$bytes" -lt ${seed.bytes} ]; then
          [ "$(pidof ${packageName})" = '${appPid}' ] || exit 6
          run-as ${packageName} kill -STOP ${appPid} || exit 4
          stopped=$(stat -c %s '${item.target}')
          printf '{"pid":${appPid},"observedBytes":%s,"stoppedBytes":%s}\n' "$bytes" "$stopped"
          exit 0
        fi
        [ "$bytes" -lt ${seed.bytes} ] || exit 3
      done; exit 5`;
      watch = adb(process.env.DSHM_ADB_PATH, ['-s', device.serial(), 'shell', script], { timeout: 30000, windowsHide: true });
      watch.catch(() => {});
      await tapPickerNode(device, node => node.text === '保存' && node.clickable === 'true');
      item.writing = JSON.parse((await watch).stdout.trim()); watch = undefined; stoppedPid = appPid;
      assert.ok(item.writing.observedBytes > 0 && item.writing.observedBytes < seed.bytes);
      assert.ok(item.writing.stoppedBytes > 0 && item.writing.stoppedBytes < seed.bytes);
      item.partialSha256 = await hash(item.target); await seed.verifySource(item.writing.stoppedBytes, item.partialSha256);
      assert.equal((await privateFiles('no_backup/remote-save-writes')).length, 1); await save();
      let cancelClick;
      if (phase === 'cancel') {
        // 只排队真实鼠标点击；恢复调度后由原按钮/原生桥处理，不直接调用abort或伪造回执。
        cancelClick = page.mouse.click(item.cancelBox.x + item.cancelBox.width / 2, item.cancelBox.y + item.cancelBox.height / 2);
        cancelClick.catch(() => {});
      } else if (phase === 'disconnect') { await disconnect(); item.hostOffline = await seed.hostOffline(); }
      else { await revoke(); item.productionRevocationSubmitted = true; }
      await device.shell(`run-as ${packageName} kill -CONT ${appPid}`); stoppedPid = undefined;
      await cancelClick;
      if (phase === 'revoke') {
        await page.getByRole('heading', { name: '连接授权已失效', exact: true }).waitFor({ timeout: 30000 });
        item.actualNotice = '连接授权已失效';
        assert.equal(await panel.count(), 0);
      } else {
        const status = panel.getByText(/^(已取消下载。|已保存到所选位置。|下载未完成，请检查连接、文件权限和手机存储后重试。)$/);
        await status.waitFor({ timeout: 30000 }); item.actualNotice = await status.innerText();
        if (item.actualNotice === '已保存到所选位置。') {
          assert.equal(await size(item.target), seed.bytes); assert.equal(await hash(item.target), seed.sha256);
          item.saveWonRace = true; await save(); throw Error('Actual save completed before interruption was processed; not a cancellation pass');
        }
        assert.equal(item.actualNotice, phase === 'cancel' ? '已取消下载。' : '下载未完成，请检查连接、文件权限和手机存储后重试。');
      }
      await until(async () => !await exists(item.target) && (await privateFiles('cache/remote-downloads')).length === 0
        && (await privateFiles('no_backup/remote-save-writes')).length === 0);
      assert.equal(await pid(), appPid); item.partialAndPrivateFilesRemoved = true;
      await writeFile(resolve(evidence, 'destination-write-' + phase + '.png'), await device.screenshot());
      if (phase === 'disconnect') {
        await page.getByTestId('remote-offline-status').waitFor(); await reconnect();
        await page.getByTestId('remote-offline-status').waitFor({ state: 'detached', timeout: 45000 });
        await delay(2000); assert.equal(await exists(item.target), false);
        assert.deepEqual(await privateFiles('cache/remote-downloads'), []); assert.equal((await pickerNodes(device)).length, 0);
        item.noAutomaticRetry = true;
      } else if (phase === 'revoke') {
        await delay(2000); assert.equal(await exists(item.target), false);
        assert.deepEqual(await privateFiles('cache/remote-downloads'), []);
        assert.equal((await pickerNodes(device)).length, 0);
        item.noAutomaticRetry = true;
      }
      assert.deepEqual(await seed.historyDigest(), report.historyBefore); await seed.verifySource(); await save();
      await mark('official-default-destination-write-' + phase + '-settled-and-cleaned');
    }
    if (seed.revocationOnly) { report.completed = true; return report; }
    report.retry = await prepare('retry');
    await tapPickerNode(device, node => node.text === '保存' && node.clickable === 'true');
    await panel.getByText('已保存到所选位置。', { exact: true }).waitFor({ timeout: 60000 });
    assert.equal(await size(report.retry.target), seed.bytes); assert.equal(await hash(report.retry.target), seed.sha256);
    assert.deepEqual(await privateFiles('cache/remote-downloads'), []); assert.deepEqual(await privateFiles('no_backup/remote-save-writes'), []);
    report.retry.bytes = seed.bytes; report.retry.sha256 = seed.sha256; report.retry.actualSystemSave = true;
    await writeFile(resolve(evidence, 'destination-write-retry-saved.png'), await device.screenshot());
    await panel.getByRole('button', { name: '返回聊天', exact: true }).click();
    assert.equal(await editor.innerText(), 'OFFICIAL_WRITE_INTERRUPTION_DRAFT'); await editor.fill('');
    report.draftPreserved = true; report.completed = true; await mark('official-default-destination-write-explicit-original-retry');
  } catch (error) { report.failure = error.message; throw error; }
  finally {
    if (watch) await watch.catch(() => {});
    const appPid = await pid();
    if (stoppedPid || appPid) await device.shell(`run-as ${packageName} kill -CONT ${stoppedPid ?? appPid}`);
    for (const path of owned) {
      if (!await exists(path)) continue;
      await seed.verifySource(await size(path), await hash(path));
      await device.shell(`rm '${path}'`); assert.equal(await exists(path), false);
    }
    report.ownDestinationsRemoved = true; await save();
  }
  return report;
}
