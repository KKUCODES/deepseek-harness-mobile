import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { _android } from 'playwright';
import { androidAppWebView } from './android-app-webview.mjs';
const pkg = 'dev.dshmobile.validation.pairingtest';
const serial = process.env.ANDROID_SERIAL || '127.0.0.1:16384';
const output = serial === 'emulator-5556' ? 'artifacts/camera-denial-standard-android' : 'artifacts/camera-denial-android';
const device = (await _android.devices({ omitDriverInstall: true })).find(d => d.serial() === serial);
assert.ok(device); device.setDefaultTimeout(15000);
const report = { at: new Date().toISOString(), serial, package: pkg, errors: [] };
try {
  await device.shell(`am start -W -f 0x10008000 -n ${pkg}/dev.dshmobile.validation.ValidationActivity`);
  const ordinary = await (await androidAppWebView(device, pkg)).page();
  await ordinary.getByRole('button', { name: '打开侧边抽屉', exact: true }).click();
  const opened = ordinary.context().waitForEvent('page');
  await ordinary.getByRole('button', { name: 'Remote', exact: true }).click();
  const page = await opened; page.setDefaultTimeout(15000); page.on('pageerror', () => report.errors.push('page-error'));
  await page.getByRole('heading', { name: '连接你的电脑', exact: true }).waitFor();
  const input = page.getByRole('textbox', { name: '一次性配对链接', exact: true });
  await input.fill('尚未提交的配对链接');
  await page.getByRole('button', { name: '扫描二维码', exact: true }).click();
  await device.shell('uiautomator dump /data/local/tmp/dshm-camera-denial.xml');
  const xml = (await device.shell('cat /data/local/tmp/dshm-camera-denial.xml')).toString();
  const nodes = [...xml.matchAll(/<node\s+([^>]+)>/g)].map(match => Object.fromEntries([...match[1].matchAll(/([\w-]+)="([^"]*)"/g)].map(x => [x[1], x[2]])));
  const deny = nodes.find(n => /:id\/permission_deny(?:_and_dont_ask_again)?_button$/.test(n['resource-id'] ?? ''));
  if (deny) {
    const [x1, y1, x2, y2] = deny.bounds.match(/\d+/g).map(Number);
    await device.shell(`input tap ${Math.floor((x1+x2)/2)} ${Math.floor((y1+y2)/2)}`);
    await page.getByRole('alert').filter({ hasText: '未获得相机权限' }).waitFor();
    assert.equal(await input.inputValue(), '尚未提交的配对链接');
    assert.equal(await input.isEnabled(), true);
    assert.equal(await page.getByRole('button', { name: '从图片识别', exact: true }).isEnabled(), true);
    report.alternativeEntrancesEnabled = true;
    report.denialObserved = true;
  } else {
    const permissions = (await device.shell(`dumpsys package ${pkg}`)).toString();
    report.cameraGranted = /android\.permission\.CAMERA: granted=true/.test(permissions);
    report.scannerVisible = xml.includes(`${pkg}:id/zxing_barcode_scanner`);
    report.denialObserved = false;
    if (report.scannerVisible) await device.shell('input keyevent 4');
  }
  await page.screenshot({ path: `${output}.png` });
  assert.equal(report.denialObserved, true, '必须实际观察到系统权限弹窗并点击拒绝');
  assert.deepEqual(report.errors, []);
} catch (error) { report.failure = error.message; process.exitCode = 1; }
finally {
  await device.shell(`am force-stop ${pkg}`);
  await device.shell(`pm revoke ${pkg} android.permission.CAMERA`);
  const after = (await device.shell(`dumpsys package ${pkg}`)).toString();
  report.permissionRestoredDenied = /android\.permission\.CAMERA: granted=false/.test(after);
  if (serial === '127.0.0.1:16384') await device.shell('am start -W -f 0x10008000 -n dev.dshmobile.validation/.ValidationActivity');
  await writeFile(`${output}.json`, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report)); await device.close();
  process.exit(process.exitCode || 0);
}
