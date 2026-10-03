import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { _android } from 'playwright';
import { androidAppWebView } from './android-app-webview.mjs';

const pkg = 'dev.dshmobile.validation.pairingtest';
const device = (await _android.devices({ omitDriverInstall: true })).find(d => d.serial() === 'emulator-5556');
assert.ok(device);
device.setDefaultTimeout(15000);
const report = { at: new Date().toISOString(), denials: 0, errors: [] };
async function nodes() {
  await device.shell('uiautomator dump /data/local/tmp/dshm-notice-permission.xml');
  const xml = (await device.shell('cat /data/local/tmp/dshm-notice-permission.xml')).toString();
  return [...xml.matchAll(/<node\s+([^>]+)>/g)].map(match => Object.fromEntries([...match[1].matchAll(/([\w-]+)="([^"]*)"/g)].map(x => [x[1], x[2]])));
}
async function tap(node) {
  assert.ok(node, '系统界面必须存在目标按钮');
  const [x1, y1, x2, y2] = node.bounds.match(/\d+/g).map(Number);
  await device.shell(`input tap ${Math.floor((x1+x2)/2)} ${Math.floor((y1+y2)/2)}`);
}
try {
  await device.shell(`am start -W -f 0x10008000 -n ${pkg}/dev.dshmobile.validation.ValidationActivity`);
  const page = await (await androidAppWebView(device, pkg)).page();
  page.on('pageerror', () => report.errors.push('page-error'));
  await page.getByRole('button', { name: '打开侧边抽屉', exact: true }).click();
  await page.getByRole('button', { name: '设置', exact: true }).click();
  for (let attempt = 0; attempt < 3; attempt++) {
    await page.getByRole('button', { name: 'Remote 提醒', exact: true }).click();
    await tap((await nodes()).find(n => n.text === '允许系统通知'));
    const current = await nodes();
    const deny = current.find(n => /:id\/permission_deny(?:_and_dont_ask_again)?_button$/.test(n['resource-id'] ?? ''));
    if (deny) {
      await tap(deny);
      report.denials++;
      assert.match((await device.shell(`dumpsys package ${pkg}`)).toString(), /android\.permission\.POST_NOTIFICATIONS: granted=false/);
    } else {
      assert.ok(current.some(n => n.package === 'com.android.settings'), '永久拒绝后必须可进入系统通知设置');
      report.systemSettingsOpened = true;
      await device.screenshot({ path: 'artifacts/notification-permission-settings.png' });
      const toggle = current.find(n => n['resource-id'] === 'android:id/switch_widget');
      assert.equal(toggle?.checked, 'false');
      await tap(toggle);
      assert.match((await device.shell(`dumpsys package ${pkg}`)).toString(), /android\.permission\.POST_NOTIFICATIONS: granted=true/);
      await device.shell('input keyevent 4');
      await page.getByRole('button', { name: 'Remote 提醒', exact: true }).click();
      assert.ok((await nodes()).some(n => n.text === '系统通知设置'));
      report.enabledFromSettings = true;
      break;
    }
  }
  assert.ok(report.denials >= 1);
  assert.equal(report.systemSettingsOpened, true);
  assert.deepEqual(report.errors, []);
} catch (error) { report.failure = error.message; process.exitCode = 1; }
finally {
  await device.shell(`am force-stop ${pkg}`);
  await device.shell(`pm revoke ${pkg} android.permission.POST_NOTIFICATIONS`);
  await writeFile('artifacts/notification-permission-android.json', JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report));
  await device.close();
  process.exit(process.exitCode || 0);
}
