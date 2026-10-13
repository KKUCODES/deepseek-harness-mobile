import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { promisify } from 'node:util';
import { androidAppWebView } from '../../scripts/android-app-webview.mjs';
import { pickerNodes, tapPickerNode } from '../../scripts/android-picker-test.mjs';

/** 默认Downloads提供方真实写入；外部观察到半成品后以OS信号固定现场，不替换保存函数/URI。 */
export async function verifyOfficialDestinationWriteDeath({ page, device, evidence, inference, packageName,
  title, phoneMarker, mark, replacePage }) {
  assert.equal(packageName, 'dev.dshmobile.validation.officialtest');
  const seed = inference.fileWriteDeath, report = { completed: false };
  assert.match(seed.filename, /^dshm-write-death-[a-f0-9]{8}\.bin$/);
  assert.equal(seed.bytes, 64 * 1024 * 1024);
  const target = '/sdcard/Download/' + seed.filename;
  const retryName = seed.filename.replace('-death-', '-retry-'), retryTarget = '/sdcard/Download/' + retryName;
  const xmlPath = '/data/local/tmp/' + seed.filename + '.xml';
  const save = () => writeFile(resolve(evidence, 'destination-write-death.json'), JSON.stringify(report, null, 2) + '\n');
  const delay = ms => new Promise(done => setTimeout(done, ms));
  const pid = async () => (await device.shell(`pidof ${packageName}`)).toString().trim();
  const exists = async path => (await device.shell(`if [ -e '${path}' ]; then echo EXISTS; else echo ABSENT; fi`)).toString().trim() === 'EXISTS';
  const size = async path => Number((await device.shell(`stat -c %s '${path}'`)).toString().trim());
  const hash = async path => (await device.shell(`sha256sum '${path}'`)).toString().trim().split(/\s+/)[0];
  const downloads = async () => (await device.shell(`run-as ${packageName} find cache/remote-downloads -maxdepth 1 -type f`))
    .toString().trim().split('\n').filter(Boolean);
  const journal = async () => (await device.shell(`run-as ${packageName} find no_backup/remote-save-writes -type f`))
    .toString().trim().split('\n').filter(Boolean);
  const screen = async () => {
    await device.shell(`uiautomator dump ${xmlPath}`);
    const xml = (await device.shell(`cat ${xmlPath}`)).toString();
    return [...xml.matchAll(/<node\s+([^>]+)>/g)].map(match => Object.fromEntries(
      [...match[1].matchAll(/([\w-]+)="([^"]*)"/g)].map(item => [item[1], item[2]])));
  };
  const warning = async () => {
    const own = (await screen()).filter(node => node.package === packageName);
    assert.ok(own.some(node => node.text === '上次文件保存结果未确认'));
    assert.ok(own.some(node => node.text?.includes('不完整文件')));
    return own;
  };
  const launcher = async () => {
    await device.shell(`am start -W -a android.intent.action.MAIN -c android.intent.category.LAUNCHER -n ${packageName}/dev.dshmobile.validation.ValidationActivity`);
    const next = await pid(); assert.match(next, /^[1-9]\d*$/); return next;
  };
  const enter = async () => {
    const ordinary = await (await androidAppWebView(device, packageName)).page();
    await ordinary.getByRole('button', { name: '打开侧边抽屉', exact: true }).click();
    const opening = ordinary.context().waitForEvent('page', {
      predicate: item => item.url().startsWith('https://remote.dshm.invalid/'), timeout: 30000,
    });
    await ordinary.getByRole('button', { name: 'Remote', exact: true }).click();
    page = await opening; replacePage(page);
  };
  const restore = async () => {
    await page.getByTestId('remote-workspace').waitFor({ timeout: 45000 });
    await page.locator('.remote-session-row').filter({ hasText: title }).click();
    await page.getByRole('article', { name: '模型回复', exact: true }).getByText(phoneMarker, { exact: true }).waitFor();
    assert.equal(await page.locator('iframe').count(), 0);
    assert.equal(await page.locator('[data-composer-input]').innerText(), 'OFFICIAL_WRITE_DEATH_DRAFT');
  };
  const panel = () => page.getByRole('region', { name: '插件面板', exact: true });
  const open = async () => {
    if (!await panel().isVisible()) {
      await page.getByRole('button', { name: 'Remote 选项', exact: true }).click();
      await page.getByRole('dialog', { name: 'Remote 选项', exact: true })
        .getByRole('button', { name: '插件面板', exact: true }).click();
    }
    const tab = panel().locator('nav').getByRole('button', { name: '文件', exact: true });
    if (await tab.count()) await tab.click(); else await panel().getByRole('button', { name: /工作区文件/ }).click();
    const tree = panel().locator('[data-files-state="tree"]'); await tree.waitFor();
    assert.equal((await tree.getAttribute('data-files-root')).replaceAll('\\', '/').toLowerCase(),
      seed.root.replaceAll('\\', '/').toLowerCase());
    await tree.getByRole('button', { name: seed.filename, exact: true }).click();
    await panel().locator('.remote-document-tab:not([hidden])').waitFor();
  };
  const prepare = async () => {
    await panel().getByRole('button', { name: '下载完整文件', exact: true }).click();
    await panel().getByText('请选择保存位置…', { exact: true }).waitFor({ timeout: 240000 });
    const files = await downloads(); assert.equal(files.length, 1);
    assert.equal(Number((await device.shell(`run-as ${packageName} stat -c %s ${files[0]}`)).toString()), seed.bytes);
    assert.equal((await device.shell(`run-as ${packageName} sha256sum ${files[0]}`)).toString().split(/\s+/)[0], seed.sha256);
    assert.ok((await pickerNodes(device)).some(node => node.class === 'android.widget.EditText' && node.text === seed.filename));
    await tapPickerNode(device, node => node['content-desc'] === '显示根目录');
    await tapPickerNode(device, node => node.text === '下载' && node['resource-id'] === 'android:id/title');
    return files[0];
  };
  let stoppedPid, watch, ownTarget = false, ownRetry = false;
  const checkPartial = async () => {
    assert.equal(await size(target), report.writing.stoppedBytes);
    assert.equal(await hash(target), report.partialSha256);
  };
  try {
    assert.equal(await exists(target), false); assert.equal(await exists(retryTarget), false);
    assert.deepEqual(await downloads(), []);
    await page.locator('[data-composer-input]').fill('OFFICIAL_WRITE_DEATH_DRAFT');
    report.historyBefore = await seed.historyDigest();
    await open(); report.completePrivateFile = await prepare(); report.source = await seed.verifySource(); await save();
    const oldPid = await pid(); assert.match(oldPid, /^[1-9]\d*$/); report.oldPid = oldPid;
    const script = `end=$(( $(date +%s) + 20 )); while [ $(date +%s) -lt $end ]; do
      bytes=$(stat -c %s '${target}' 2>/dev/null || echo 0)
      if [ "$bytes" -gt 0 ] && [ "$bytes" -lt ${seed.bytes} ]; then
        [ "$(pidof ${packageName})" = '${oldPid}' ] || exit 6
        run-as ${packageName} kill -STOP ${oldPid} || exit 4
        stopped=$(stat -c %s '${target}')
        printf '{"pid":${oldPid},"observedBytes":%s,"stoppedBytes":%s}\n' "$bytes" "$stopped"
        exit 0
      fi
      [ "$bytes" -lt ${seed.bytes} ] || exit 3
    done; exit 5`;
    const adb = promisify(execFile);
    watch = adb(process.env.DSHM_ADB_PATH, ['-s', device.serial(), 'shell', script], { timeout: 30000, windowsHide: true });
    // 观察器失败也必须被等待；不能把未捕捉到实际半成品当作通过。
    watch.catch(() => {}); ownTarget = true;
    await tapPickerNode(device, node => node.text === '保存' && node.clickable === 'true');
    const captured = await watch; watch = undefined;
    report.writing = JSON.parse(captured.stdout.trim()); stoppedPid = oldPid;
    assert.equal(report.writing.pid, Number(oldPid));
    assert.ok(report.writing.observedBytes > 0 && report.writing.observedBytes < seed.bytes);
    assert.ok(report.writing.stoppedBytes > 0 && report.writing.stoppedBytes < seed.bytes);
    report.partialSha256 = await hash(target);
    await seed.verifySource(report.writing.stoppedBytes, report.partialSha256);
    report.pendingJournal = await journal(); assert.equal(report.pendingJournal.length, 1);
    assert.match(report.pendingJournal[0], /^no_backup\/remote-save-writes\/[a-f0-9-]{36}\.pending$/);
    await writeFile(resolve(evidence, 'destination-writing.png'), await device.screenshot());
    await save(); await mark('official-default-downloads-real-partial-and-pending-save-journal');
    await device.shell(`am force-stop ${packageName}`); stoppedPid = undefined;
    assert.equal(await pid(), ''); await checkPartial();
    report.newPid = await launcher(); assert.notEqual(report.newPid, oldPid);
    await warning(); await writeFile(resolve(evidence, 'destination-death-ordinary-warning.png'), await device.screenshot());
    await device.shell('input keyevent KEYCODE_BACK'); await enter(); await warning();
    await writeFile(resolve(evidence, 'destination-death-remote-warning.png'), await device.screenshot());
    await device.shell('input keyevent KEYCODE_BACK'); await restore(); await checkPartial();
    assert.deepEqual(await journal(), report.pendingJournal); assert.deepEqual(await downloads(), []);
    assert.deepEqual(await seed.historyDigest(), report.historyBefore);
    await mark('official-writing-process-ended-normal-launcher-and-same-history-recovery');
    await device.shell(`am force-stop ${packageName}`); await launcher();
    const buttons = (await warning()).filter(node => node.text === '知道了'); assert.equal(buttons.length, 1);
    const [a, b, c, d] = buttons[0].bounds.match(/\d+/g).map(Number);
    await device.shell(`input tap ${Math.floor((a + c) / 2)} ${Math.floor((b + d) / 2)}`);
    assert.deepEqual(await journal(), []); await checkPartial();
    await device.shell(`am force-stop ${packageName}`); await launcher();
    assert.equal((await screen()).some(node => node.text === '上次文件保存结果未确认'), false);
    await enter(); await restore(); await checkPartial();
    await delay(2000); assert.deepEqual(await downloads(), []); assert.equal((await pickerNodes(device)).length, 0);
    report.recovery = { ordinaryAndRemoteWarnings: true, unacknowledgedAcrossRestart: true,
      acknowledgedAcrossRestart: true, partialPreserved: true, privateDownloadCleared: true, noAutomaticSave: true,
      bindingReconnected: true, historyUnchanged: true, draftPreserved: true };
    await save(); await mark('official-native-save-warning-acknowledgment-and-no-automatic-replay');
    await open(); await prepare();
    await tapPickerNode(device, node => node.class === 'android.widget.EditText' && node['resource-id'] === 'android:id/title');
    await device.shell('input keyevent KEYCODE_MOVE_END');
    await device.shell(`input keyevent ${Array(seed.filename.length).fill('KEYCODE_DEL').join(' ')}`);
    await device.shell(`input text ${retryName}`);
    assert.equal((await pickerNodes(device)).find(node => node.class === 'android.widget.EditText')?.text, retryName);
    ownRetry = true; await tapPickerNode(device, node => node.text === '保存' && node.clickable === 'true');
    await panel().getByText('已保存到所选位置。', { exact: true }).waitFor({ timeout: 60000 });
    assert.equal(await size(retryTarget), seed.bytes); assert.equal(await hash(retryTarget), seed.sha256);
    assert.deepEqual(await downloads(), []); assert.deepEqual(await journal(), []); await checkPartial();
    assert.deepEqual(await seed.historyDigest(), report.historyBefore);
    report.retry = { bytes: seed.bytes, sha256: seed.sha256, actualDefaultSystemSave: true, priorPartialUnchanged: true };
    await writeFile(resolve(evidence, 'destination-death-explicit-retry-saved.png'), await device.screenshot());
    await mark('official-explicit-full-download-save-after-process-death');
    await panel().getByRole('button', { name: '返回聊天', exact: true }).click();
    assert.equal(await page.locator('[data-composer-input]').innerText(), 'OFFICIAL_WRITE_DEATH_DRAFT');
    await page.locator('[data-composer-input]').fill(''); report.completed = true;
  } catch (error) { report.failure = error.message; throw error; }
  finally {
    // 即使观察器后续断言失败，也先恢复自己UID的调度；从不触碰原App进程。
    if (watch) await watch.catch(() => {});
    const current = await pid();
    if (stoppedPid || current) await device.shell(`run-as ${packageName} kill -CONT ${stoppedPid ?? current}`);
    for (const [path, owned] of [[target, ownTarget], [retryTarget, ownRetry]]) {
      if (!owned || !await exists(path)) continue;
      const bytes = await size(path), sha256 = await hash(path);
      await seed.verifySource(bytes, sha256);
      await device.shell(`rm '${path}'`); assert.equal(await exists(path), false);
    }
    await device.shell(`rm -f ${xmlPath}`); report.ownDestinationsRemoved = true; await save();
  }
  return report;
}
