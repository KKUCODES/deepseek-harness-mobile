import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createInterface } from 'node:readline';
import { resolve } from 'node:path';
import { setTimeout as wait } from 'node:timers/promises';
import { _android } from 'playwright';
import { androidAppWebView } from './android-app-webview.mjs';

// 独立无窗口Google模拟器，目标UID必须从未安装；不能指向日常MuMu或用户已有App。
const serial = process.env.DSHM_UPDATE_TEST_SERIAL;
assert.equal(serial, 'emulator-5556', 'Use the dedicated headless update-test emulator');
const pkg = 'dev.dshmobile.validation.officialtest';
const adb = 'C:/Users/KKirin/AppData/Local/Android/Sdk/platform-tools/adb.exe';
const shell = command => execFileSync(adb, ['-s', serial, 'shell', command], { encoding: 'utf8', windowsHide: true });
assert.match(shell('getprop ro.hardware'), /ranchu/);
if (process.argv.includes('--verify-installed')) {
  const output = resolve('artifacts/app-update-native-check');
  const previous = JSON.parse(await readFile(resolve(output, 'report.json')));
  assert.equal(previous.serial, serial); assert.equal(previous.package, pkg); assert.ok(previous.isolated);
  assert.ok(previous.checks.includes('Real public signed APK downloaded and verified by hash, package, version and signer'));
  const info = shell(`dumpsys package ${pkg}`);
  assert.equal(Number(info.match(/versionCode=(\d+)/)?.[1]), 9);
  assert.equal(info.match(/(?:userId|appId)=(\d+)/)?.[1], previous.uid);
  assert.equal(info.match(/firstInstallTime=([^\r\n]+)/)?.[1]?.trim(), previous.firstInstallTime);
  shell('uiautomator dump /data/local/tmp/dshm-update-ui.xml');
  const xml = shell('cat /data/local/tmp/dshm-update-ui.xml');
  assert.ok(xml.includes(`package="${pkg}"`) && xml.includes('History survives update') && xml.includes('Draft survives update'));
  await writeFile(resolve(output, 'after-install-ui.xml'), xml);
  const report = { passed: true, serial, package: pkg, checkedAt: new Date().toISOString(), noModelCalls: true,
    sourceReport: 'report.json', sourceDriverTimingFailure: previous.phase === 'failed', checks: [...previous.checks,
      'Actual system installation completed: versionCode 8 to 9, same UID and first install time',
      'Released non-debuggable app displays the original history and draft in its normal UI'] };
  await writeFile(resolve(output, 'cover-install-verification.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report)); process.exit(0);
}
assert.equal(shell(`pm list packages ${pkg}`).trim(), '', 'Never replace an existing app for this test');
const output = resolve('artifacts/app-update-native-check'); await mkdir(output, { recursive: true });
const report = { serial, package: pkg, isolated: true, noModelCalls: true, checks: [], errors: [] };
const save = async phase => { report.phase = phase; await writeFile(resolve(output, 'report.json'), JSON.stringify(report, null, 2)); console.log(JSON.stringify({ phase, checks: report.checks })); };
const lines = createInterface({ input: process.stdin });
let device;
try {
  execFileSync(adb, ['-s', serial, 'install', resolve('artifacts/app-update-test-feature.apk')], { stdio: 'pipe', windowsHide: true });
  const info = shell(`dumpsys package ${pkg}`);
  assert.match(info, /versionCode=8\b/);
  report.uid = info.match(/(?:userId|appId)=(\d+)/)?.[1]; report.firstInstallTime = info.match(/firstInstallTime=([^\r\n]+)/)?.[1]?.trim();
  assert.ok(report.uid && report.firstInstallTime);
  device = (await _android.devices({ omitDriverInstall: true })).find(d => d.serial() === serial); assert.ok(device);
  device.setDefaultTimeout(30000);
  await device.shell(`am start -W -n ${pkg}/dev.dshmobile.validation.ValidationActivity`);
  const page = await (await androidAppWebView(device, pkg)).page();
  page.on('pageerror', error => report.errors.push(error.message));
  await page.getByRole('button', { name: '打开侧边抽屉', exact: true }).waitFor();
  // 只播种该空UID的已校验聊天结构，验证跨系统安装的数据保留；不伪造联网、签名或模型调用。
  await page.evaluate(async () => {
    const db = await new Promise((resolve, reject) => { const req = indexedDB.open('dshm-ordinary-history-v1', 2); req.onsuccess = () => resolve(req.result); req.onerror = reject; });
    await new Promise((resolve, reject) => {
      const tx = db.transaction('chats', 'readwrite');
      tx.objectStore('chats').put({ id: 'update-preservation-fixture', mode: 'ordinary', title: 'Update preservation check', draft: 'Draft survives update', model: 'deepseek-chat', thinking: false, updatedAt: Date.now(),
        turns: [{ requestId: 'update-history-fixture', prompt: 'Preserve this test message', model: 'deepseek-chat', thinking: false, status: 'completed', content: 'History survives update', reasoning: '', error: null, finishReason: 'stop', responseId: null }] });
      tx.oncomplete = resolve; tx.onerror = reject;
    }); db.close();
  });
  await page.reload(); await page.getByRole('button', { name: '打开侧边抽屉', exact: true }).click();
  await page.getByRole('button', { name: /Update preservation check/ }).click();
  await page.getByText('History survives update', { exact: true }).waitFor();
  assert.equal(await page.getByRole('textbox').inputValue(), 'Draft survives update');
  report.checks.push('Seeded isolated history and draft displayed through the real chat UI');
  await page.getByRole('button', { name: '打开侧边抽屉', exact: true }).click();
  await page.getByRole('button', { name: '设置', exact: true }).click();
  await page.getByRole('button', { name: /^软件更新/ }).click();
  const panel = page.getByRole('dialog', { name: '软件更新', exact: true });
  await panel.getByRole('button', { name: '下载更新', exact: true }).waitFor({ timeout: 180000 });
  report.checks.push('Real GitHub prerelease discovery, metadata digest and current signing identity');
  await panel.getByRole('button', { name: '下载更新', exact: true }).click();
  await panel.getByText('正在下载更新…', { exact: true }).waitFor();
  await panel.getByRole('button', { name: '取消', exact: true }).click();
  await panel.getByText('下载已取消', { exact: true }).waitFor();
  report.checks.push('Real native download cancelled and retry offered');
  await panel.getByRole('button', { name: '重新下载', exact: true }).click();
  await panel.getByRole('button', { name: '安装更新', exact: true }).waitFor({ timeout: 360000 });
  report.checks.push('Real public signed APK downloaded and verified by hash, package, version and signer');
  await page.screenshot({ path: resolve(output, 'ready.png') });
  await panel.getByRole('button', { name: '安装更新', exact: true }).click();
  await save('awaiting_system_permission');
  // 系统窗口由外部ADB驱动实际点击；保留当前页面，不能用pm install替代生产安装入口。
  for await (const line of lines) {
    const command = JSON.parse(line).command;
    if (command === 'after_permission') {
      await panel.getByRole('button', { name: '安装更新', exact: true }).waitFor();
      await panel.getByRole('button', { name: '安装更新', exact: true }).click();
      await save('awaiting_installer_cancel');
    } else if (command === 'after_cancel') {
      await panel.getByText('安装尚未完成，可再次点击安装更新。', { exact: true }).waitFor();
      report.checks.push('Actual unknown-source permission return and system installer cancellation');
      await panel.getByRole('button', { name: '安装更新', exact: true }).click();
      await save('awaiting_installer_confirm');
    } else if (command === 'after_install') {
      for (const deadline = Date.now() + 120000; !/versionCode=9\b/.test(shell(`dumpsys package ${pkg}`));) {
        if (Date.now() >= deadline) throw Error('System installation not completed');
        await wait(1000);
      }
      const after = shell(`dumpsys package ${pkg}`);
      assert.match(after, /versionCode=9\b/); assert.equal(after.match(/(?:userId|appId)=(\d+)/)?.[1], report.uid);
      assert.equal(after.match(/firstInstallTime=([^\r\n]+)/)?.[1]?.trim(), report.firstInstallTime);
      report.checks.push('System update completed: versionCode 8 to 9, same UID and first install time');
      assert.deepEqual(report.errors, []);
      await save('awaiting_history_ui_verification');
    } else if (command === 'history_verified') {
      shell('uiautomator dump /data/local/tmp/dshm-update-ui.xml');
      const xml = shell('cat /data/local/tmp/dshm-update-ui.xml');
      assert.ok(xml.includes(`package="${pkg}"`) && xml.includes('History survives update') && xml.includes('Draft survives update'));
      await writeFile(resolve(output, 'after-install-ui.xml'), xml);
      report.checks.push('Released non-debuggable app displays the same history and draft after update');
      report.passed = true; await save('complete'); break;
    } else throw Error('Unexpected update-test command');
  }
} catch (error) { report.error = error.message; await save('failed'); process.exitCode = 1; }
finally { lines.close(); await device?.close(); }
