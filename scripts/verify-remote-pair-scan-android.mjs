import assert from 'node:assert/strict';
import { _android } from 'playwright';
import { readFile, writeFile } from 'node:fs/promises';
import { androidAppWebView } from './android-app-webview.mjs';
import { chooseDownload } from './android-picker-test.mjs';

const device = (await _android.devices({ omitDriverInstall: true })).find(item => item.serial() === process.env.DSHM_ANDROID_SERIAL);
assert.ok(device);
const pkg = 'dev.dshmobile.validation.pairingtest';
const canonical = `http://127.0.0.1:8787/pair#key=${'A'.repeat(43)}`;
const report = { at: new Date().toISOString(), errors: [], package: pkg };
try {
  // 独立测试包先恢复到未授权状态；模拟器安装时可能已授予相机权限。
  await device.shell(`am force-stop ${pkg}`);
  const revoke = (await device.shell(`pm revoke ${pkg} android.permission.CAMERA`)).toString();
  assert.ok(!/Unknown command|Exception|Error:/i.test(revoke), 'Camera revoke command failed');
  const before = (await device.shell(`dumpsys package ${pkg}`)).toString();
  assert.ok(/android\.permission\.CAMERA: granted=false/.test(before));
  report.cameraInitiallyDenied = true;
  await device.shell(`am start -W -n ${pkg}/dev.dshmobile.validation.ValidationActivity`);
  const first = await (await androidAppWebView(device, pkg)).page();
  await first.getByRole('button', { name: '打开侧边抽屉', exact: true }).click();
  const opened = first.context().waitForEvent('page');
  await first.getByRole('button', { name: 'Remote', exact: true }).click();
  const page = await opened; page.setDefaultTimeout(20000);
  page.on('pageerror', error => report.errors.push(error.message));
  await page.getByRole('heading', { name: '连接你的电脑', exact: true }).waitFor();
  const input = page.getByRole('textbox', { name: '一次性配对链接', exact: true });
  await input.fill('保留尚未提交的输入');
  await page.getByRole('button', { name: '从图片识别', exact: true }).click();
  await device.shell('input keyevent 4');
  await page.getByRole('button', { name: '从图片识别', exact: true }).waitFor();
  await page.waitForFunction(() => ![...document.querySelectorAll('button')].find(item => item.textContent === '从图片识别')?.disabled);
  assert.equal(await input.inputValue(), '保留尚未提交的输入');
  report.cancelPreservesInput = true;
  for (const [file, valid] of [['dshm-pair-scan-valid.png', true], ['dshm-pair-scan-foreign.png', false]]) {
    await device.push(await readFile(`artifacts/${file}`), `/sdcard/Download/${file}`);
    await page.getByRole('button', { name: '从图片识别', exact: true }).click();
    await chooseDownload(device, file);
    if (valid) {
      await page.waitForFunction(expected => document.querySelector('input[aria-label="一次性配对链接"]')?.value === expected, canonical);
      await page.getByText('服务器：http://127.0.0.1:8787', { exact: true }).waitFor();
      await page.getByText('HTTP 连接未加密，建议使用 HTTPS。', { exact: true }).waitFor();
      assert.equal(await page.getByTestId('remote-fingerprint').count(), 0);
      report.qrPrefilledWithoutClaim = true;
      await page.screenshot({ path: 'artifacts/remote-pair-scan-image-android.png' });
    } else {
      await page.getByRole('alert').filter({ hasText: '配对链接无效' }).waitFor();
      assert.equal(await input.inputValue(), canonical);
      report.foreignQrRejectedWithoutNavigation = true;
    }
  }
  await page.getByRole('button', { name: '扫描二维码', exact: true }).click();
  // 不假设pm支持拒绝标记；以实际系统状态区分权限拒绝与相机取消。
  await device.shell('uiautomator dump /data/local/tmp/dshm-scan-permission.xml');
  const permissionState = (await device.shell(`dumpsys package ${pkg}`)).toString();
  if (/android\.permission\.CAMERA: granted=true/.test(permissionState)) {
    const xml = (await device.shell('cat /data/local/tmp/dshm-scan-permission.xml')).toString();
    assert.ok(xml.includes(`${pkg}:id/zxing_barcode_scanner`));
    await device.shell('input keyevent 4');
    await page.waitForFunction(() => ![...document.querySelectorAll('button')].find(item => item.textContent === '扫描二维码')?.disabled);
    report.cameraOpenAndCancel = true;
    report.cameraPermissionDenial = '未验证：MuMu 在请求相机后自动授予权限，撤销状态不等于用户拒绝流程';
  } else {
    await page.getByRole('alert').filter({ hasText: '未获得相机权限' }).waitFor();
    report.preDeniedCameraReturnsToPairing = true;
  }
  assert.equal(await input.inputValue(), canonical);
  await page.screenshot({ path: 'artifacts/remote-pair-scan-permission-android.png' });
  assert.deepEqual(report.errors, []);
} catch (error) { report.failure = error.message; process.exitCode = 1; }
finally {
  await writeFile('artifacts/remote-pair-scan-android.json', JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report)); await device.close();
}
