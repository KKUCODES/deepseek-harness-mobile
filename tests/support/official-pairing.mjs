import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { writeFile, unlink } from 'node:fs/promises';
import { resolve } from 'node:path';
import { chooseDownload } from '../../scripts/android-picker-test.mjs';

const require = createRequire(new URL('../../../plugin/package.json', import.meta.url));
const QRCode = require('qrcode');

/** 系统选图与原生二维码解码只回填链接，领取仍由用户入口显式触发。 */
export async function verifyOfficialPairing({ page, device, evidence, packageName, checks, mark }) {
  const input = page.getByRole('textbox', { name: '一次性配对链接', exact: true });
  const report = { completed: false }, files = [];
  const available = name => page.waitForFunction(label => {
    const button = [...document.querySelectorAll('button')].find(button => button.textContent === label);
    return button && !button.disabled;
  }, name);
  const image = async (name, value) => {
    const filename = `DSHM-pair-${evidence.split(/[\\/]/).at(-1)}-${name}.png`;
    const hostPath = resolve(evidence, filename), devicePath = '/sdcard/Download/' + filename;
    assert.equal((await device.shell(`if [ -e '${devicePath}' ]; then echo exists; else echo absent; fi`)).toString().trim(), 'absent');
    const bytes = await QRCode.toBuffer(value, { width: 640, margin: 4 });
    await writeFile(hostPath, bytes, { flag: 'wx' }); files.push({ hostPath, devicePath });
    await device.push(bytes, devicePath);
    await page.getByRole('button', { name: '从图片识别', exact: true }).click();
    await chooseDownload(device, filename);
  };
  try {
    const original = await input.inputValue(); assert.equal(original, checks.expired.link);
    await page.getByRole('button', { name: '从图片识别', exact: true }).click();
    await device.shell('input keyevent 4'); await available('从图片识别');
    assert.equal(await input.inputValue(), original);
    report.imageCancel = { inputPreserved: true, ...await checks.unchanged() };
    await image('foreign', 'https://example.com/ordinary-page');
    await page.getByRole('alert').filter({ hasText: '配对链接无效' }).waitFor();
    assert.equal(await input.inputValue(), original);
    report.foreignQr = { invalidRejected: true, inputPreserved: true, ...await checks.unchanged() };

    await page.getByRole('button', { name: '扫描二维码', exact: true }).click();
    const dump = async () => {
      await device.shell('uiautomator dump /data/local/tmp/dshm-picker-test.xml');
      return (await device.shell('cat /data/local/tmp/dshm-picker-test.xml')).toString();
    };
    let xml = await dump();
    const permission = [...xml.matchAll(/<node\s+([^>]+)>/g)].map(match => Object.fromEntries(
      [...match[1].matchAll(/([\w-]+)="([^"]*)"/g)].map(value => [value[1], value[2]])))
      .find(node => /permissioncontroller:id\/permission_allow_foreground_only_button$/.test(node['resource-id']));
    if (permission) {
      const bounds = permission.bounds.match(/\d+/g).map(Number);
      await device.shell(`input tap ${Math.floor((bounds[0] + bounds[2]) / 2)} ${Math.floor((bounds[1] + bounds[3]) / 2)}`);
      xml = await dump();
    }
    assert.ok(xml.includes(`${packageName}:id/zxing_barcode_scanner`), 'Actual native scanner must open');
    await writeFile(resolve(evidence, 'pairing-camera.png'), await device.screenshot());
    await device.shell('input keyevent 4'); await available('扫描二维码');
    assert.equal(await input.inputValue(), original);
    report.camera = { actualNativeScannerOpened: true, cancelPreservesInput: true,
      physicalCameraQrRecognitionVerified: false, ...await checks.unchanged() };
    await mark('native-qr-image-cancel-invalid-and-camera-open-cancel');

    report.expiry = await checks.waitUntilExpired();
    // 模拟器可能在五分钟等待中被切到其他应用。通过真实系统链接入口回到同一页面，
    // 不锁定设备、结束其他 App 或绕过 Android 前台点击；重新打开也不会领取链接。
    const expired = new URL(checks.expired.link), key = new URLSearchParams(expired.hash.slice(1)).get('key');
    assert.match(key, /^[A-Za-z0-9_-]{43}$/);
    const link = `dshm://pair?server=${encodeURIComponent(expired.origin)}#key=${key}`;
    await device.shell(`am start -W -a android.intent.action.VIEW -c android.intent.category.BROWSABLE -d '${link}' -p ${packageName}`);
    await input.waitFor(); assert.equal(await input.inputValue(), original);
    assert.ok((await device.shell('dumpsys window')).toString().split('\n')
      .some(line => line.includes('mCurrentFocus') && line.includes(packageName)));
    report.samePairingPageForegroundRestored = true;
    await page.getByLabel('设备名称', { exact: true }).fill('DSHM 过期配对必须拒绝');
    await page.getByRole('button', { name: '继续配对', exact: true }).click();
    await page.getByRole('alert').filter({ hasText: '链接已过期或已被领取' }).waitFor();
    assert.equal(await page.getByTestId('remote-fingerprint').count(), 0);
    assert.equal(await page.getByTestId('remote-workspace').count(), 0);
    assert.equal(await input.inputValue(), '');
    report.expiredClaim = { userErrorShown: true, noBindingOrRemotePage: true, ...await checks.rejected() };
    await writeFile(resolve(evidence, 'pairing-expired.png'), await device.screenshot());
    await mark('natural-five-minute-expiry-rejected-without-device');

    const fresh = await checks.fresh();
    await image('fresh', fresh.link);
    await page.waitForFunction(expected => document.querySelector('input[aria-label="一次性配对链接"]')?.value === expected, fresh.link);
    await page.getByText('服务器：http://127.0.0.1:16956', { exact: true }).waitFor();
    await page.getByText('HTTP 连接未加密，建议使用 HTTPS。', { exact: true }).waitFor();
    assert.equal(await page.getByTestId('remote-fingerprint').count(), 0);
    report.freshQr = { actualSystemPickerAndNativeDecode: true, correctServerAndHttpNotice: true,
      onlyPrefilled: true, ...await checks.unchanged() };
    await mark('native-image-qr-prefills-fresh-real-link-without-claim');
    report.completed = true;
    return report;
  } catch (error) { report.failure = error.message; throw error; }
  finally {
    for (const file of files) {
      await device.shell(`rm '${file.devicePath}'`); await unlink(file.hostPath);
      assert.equal((await device.shell(`if [ -e '${file.devicePath}' ]; then echo exists; else echo absent; fi`)).toString().trim(), 'absent');
    }
    report.ownQrImagesRemoved = true;
    await writeFile(resolve(evidence, 'pairing.json'), JSON.stringify(report, null, 2) + '\n');
  }
}
