import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { _android } from 'playwright';
import { execFileSync } from 'node:child_process';
import { androidAppWebView } from './android-app-webview.mjs';

const pkg = 'dev.dshmobile.validation.pairingtest', serial = 'emulator-5556';
const canonical = `http://127.0.0.1:8787/pair#key=${'A'.repeat(43)}`;
const room = process.argv.includes('--image-room');
const output = room ? 'camera-room' : 'camera-scene';
const device = (await _android.devices({ omitDriverInstall: true })).find(d => d.serial() === serial);
assert.ok(device); device.setDefaultTimeout(20000);
const report = { at: new Date().toISOString(), serial, package: pkg, source: 'emulator virtualscene camera poster; no injected Activity result', errors: [] };
try {
  await device.shell(`am start -W -f 0x10008000 -n ${pkg}/dev.dshmobile.validation.ValidationActivity`);
  const ordinary = await (await androidAppWebView(device, pkg)).page();
  await ordinary.getByRole('button', { name: '打开侧边抽屉', exact: true }).click();
  const opened = ordinary.context().waitForEvent('page');
  await ordinary.getByRole('button', { name: 'Remote', exact: true }).click();
  const page = await opened; page.on('pageerror', () => report.errors.push('page-error'));
  const input = page.getByRole('textbox', { name: '一次性配对链接', exact: true });
  await input.fill('尚未提交的配对链接');
  await page.getByRole('button', { name: '扫描二维码', exact: true }).click();
  await device.shell('uiautomator dump /data/local/tmp/dshm-camera-scene.xml');
  const xml = (await device.shell('cat /data/local/tmp/dshm-camera-scene.xml')).toString();
  const nodes = [...xml.matchAll(/<node\s+([^>]+)>/g)].map(match => Object.fromEntries([...match[1].matchAll(/([\w-]+)="([^"]*)"/g)].map(x => [x[1], x[2]])));
  const allow = nodes.find(n => /:id\/permission_allow_foreground_only_button$/.test(n['resource-id'] ?? ''));
  assert.ok(allow, 'Expected actual system permission request');
  const [x1,y1,x2,y2] = allow.bounds.match(/\d+/g).map(Number);
  await device.shell(`input tap ${Math.floor((x1+x2)/2)} ${Math.floor((y1+y2)/2)}`);
  report.permissionGrantedFromSystemDialog = true;
  if (room) {
    const result = execFileSync('C:/Users/KKirin/AppData/Local/Android/Sdk/platform-tools/adb.exe',
      ['-s', serial, 'emu', 'automation', 'play', 'C:/Users/KKirin/AppData/Local/Android/Sdk/emulator/resources/macros/Walk_to_image_room'], { encoding: 'utf8' });
    assert.ok(result.includes('OK') && !result.includes('KO:'), 'Official camera room macro must start');
    report.officialImageRoomMacro = true;
  }
  await page.waitForFunction(expected => document.querySelector('input[aria-label="一次性配对链接"]')?.value === expected, canonical, { timeout: 45000 });
  assert.equal(await input.inputValue(), canonical);
  assert.equal(await page.getByTestId('remote-fingerprint').count(), 0);
  await page.getByText('服务器：http://127.0.0.1:8787', { exact: true }).waitFor();
  report.cameraDecoded = true; report.prefilledWithoutClaim = true;
  let windows;
  for (let attempt = 0; attempt < 40; attempt++) {
    windows = (await device.shell('dumpsys window')).toString();
    if (windows.split('\n').find(line => line.includes('mCurrentFocus='))?.includes('.RemoteActivity')) break;
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  assert.ok(windows.split('\n').find(line => line.includes('mCurrentFocus='))?.includes('.RemoteActivity'));
  const section = windows.split(/Window #\d+/).find(value => value.includes('.RemoteActivity') && value.includes('mHasSurface=true') && !value.includes('Starting '));
  assert.ok(section);
  report.returnedWindowAppearance = section.split('\n').filter(line => /appearance=|LIGHT_STATUS|LIGHT_NAVIGATION/.test(line)).map(line => line.trim()).join(' ');
  await writeFile(`artifacts/${output}-android.png`, await device.screenshot());
  const dark = await page.evaluate(() => document.body.hasAttribute('data-ds-dark-theme'));
  assert.equal(report.returnedWindowAppearance.includes('LIGHT_STATUS_BARS'), !dark);
  assert.equal(report.returnedWindowAppearance.includes('LIGHT_NAVIGATION_BARS'), !dark);
  assert.deepEqual(report.errors, []);
} catch (error) {
  report.failure = error.message; process.exitCode = 1;
  await writeFile(`artifacts/${output}-failed.png`, await device.screenshot()).catch(() => {});
} finally {
  await device.shell(`am force-stop ${pkg}`);
  await device.shell(`pm revoke ${pkg} android.permission.CAMERA`);
  report.permissionRestoredDenied = /android\.permission\.CAMERA: granted=false/.test((await device.shell(`dumpsys package ${pkg}`)).toString());
  await writeFile(`artifacts/${output}-android.json`, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report)); await device.close(); process.exit(process.exitCode || 0);
}
