import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { _android } from 'playwright';
import { androidAppWebView } from './android-app-webview.mjs';

// 真实无效链接、提醒设置及空白Key窗口；不领取配对、改变通知勾选或填写凭据。
const tag = process.argv[2] ?? 'current';
assert.match(tag, /^[a-z-]+$/);
const device = (await _android.devices({ omitDriverInstall: true })).find(item => item.serial() === process.env.DSHM_ANDROID_SERIAL);
assert.ok(device);
const pkg = 'dev.dshmobile.validation', xmlPath = '/data/local/tmp/dshm-dialog-theme.xml';
const report = { at: new Date().toISOString(), checks: [] };
let phone, original, nativeOpen = false, nativeKind = 'notice';
async function nodes() {
  await device.shell(`uiautomator dump ${xmlPath}`);
  const xml = (await device.shell(`cat ${xmlPath}`)).toString();
  return [...xml.matchAll(/<node\s+([^>]+)>/g)].map(match => Object.fromEntries([...match[1].matchAll(/([\w-]+)="([^"]*)"/g)].map(value => [value[1], value[2]])))
    .filter(node => node.package === pkg);
}
async function closeNative() {
  if (!nativeOpen) return;
  const positive = (await nodes()).find(node => node['resource-id'] === (nativeKind === 'key' ? 'android:id/button2' : 'android:id/button1'));
  assert.ok(positive);
  assert.ok(['知道了', '完成', '取消'].includes(positive.text));
  const [x1, y1, x2, y2] = positive.bounds.match(/\d+/g).map(Number);
  await device.shell(`input tap ${Math.floor((x1 + x2) / 2)} ${Math.floor((y1 + y2) / 2)}`);
  nativeOpen = false;
  nativeKind = 'notice';
}
async function theme(value) {
  await phone.getByRole('button', { name: /^主题/ }).click();
  await phone.getByRole('dialog').getByRole('button', { name: value, exact: true }).click();
  await phone.getByRole('dialog').waitFor({ state: 'detached' });
}
try {
  report.systemMode = (await device.shell('cmd uimode night')).toString().trim();
  await device.shell(`am start -f 0x20020000 -n ${pkg}/.ValidationActivity`);
  const deadline = Date.now() + 15000;
  while (!(await device.shell(`pidof ${pkg}`)).toString().trim() && Date.now() < deadline) await new Promise(resolve => setTimeout(resolve, 100));
  phone = (await (await androidAppWebView(device)).page()).context().pages().find(page => page.url().startsWith('https://appassets.androidplatform.net/'));
  assert.ok(phone); phone.setDefaultTimeout(15000);
  await phone.getByRole('button', { name: '打开侧边抽屉', exact: true }).click();
  await phone.getByRole('button', { name: '设置', exact: true }).click();
  await phone.getByRole('button', { name: /^外观与语言/ }).click();
  original = (await phone.getByRole('button', { name: /^主题/ }).innerText()).replace('主题', '').trim();
  report.original = original;
  for (const value of ['浅色', '深色']) {
    await theme(value);
    await device.shell(`am start -W -n ${pkg}/.PairingEntryActivity -a android.intent.action.VIEW -d 'dshm://pair'`);
    nativeOpen = true;
    let current = await nodes();
    assert.ok(current.some(node => node.text === '配对链接无效'));
    await device.screenshot({ path: `artifacts/native-dialog-${tag}-${value === '浅色' ? 'light' : 'dark'}-pair.png` });
    await closeNative();
    await phone.getByRole('button', { name: '返回设置首页', exact: true }).click();
    await phone.getByRole('button', { name: 'Remote 提醒', exact: true }).click(); nativeOpen = true;
    current = await nodes();
    assert.ok(current.some(node => node.text.startsWith('Remote 提醒')));
    const selected = current.filter(node => node.checkable === 'true').map(node => ({ label: node.text, checked: node.checked }));
    await device.screenshot({ path: `artifacts/native-dialog-${tag}-${value === '浅色' ? 'light' : 'dark'}-notice.png` });
    report.checks.push({ preference: value, selected });
    await closeNative();
    await phone.getByRole('button', { name: /^普通聊天/ }).click();
    const keyButton = phone.getByRole('button', { name: /^DeepSeek Key/ });
    const configured = await keyButton.innerText();
    await keyButton.click(); nativeOpen = true; nativeKind = 'key';
    current = await nodes();
    assert.ok(current.some(node => node.text === '普通聊天 · DeepSeek Key'));
    assert.ok(current.some(node => node.class === 'android.widget.EditText' && node.password === 'true'));
    await closeNative();
    assert.equal(await keyButton.innerText(), configured);
    report.checks.at(-1).ordinaryKeyCancelled = true;
    await phone.getByRole('button', { name: '返回设置首页', exact: true }).click();
    await phone.getByRole('button', { name: '电脑连接', exact: true }).click();
    const remote = phone.context().pages().find(page => page.url().startsWith('https://remote.dshm.invalid/'));
    assert.ok(remote); remote.setDefaultTimeout(20000);
    await remote.getByTestId('remote-workspace').waitFor();
    await remote.getByRole('button', { name: 'Remote 选项', exact: true }).click();
    await remote.getByRole('button', { name: 'Remote 提醒', exact: true }).click(); nativeOpen = true;
    current = await nodes();
    assert.ok(current.some(node => node.text.startsWith('Remote 提醒')));
    assert.deepEqual(current.filter(node => node.checkable === 'true').map(node => ({ label: node.text, checked: node.checked })), selected);
    await device.screenshot({ path: `artifacts/native-dialog-${tag}-${value === '浅色' ? 'light' : 'dark'}-remote.png` });
    await closeNative();
    await remote.getByRole('button', { name: '关闭窗口', exact: true }).click();
    report.checks.at(-1).remoteEntry = true;
    await device.shell(`am start -f 0x20020000 -n ${pkg}/.ValidationActivity`);
    await phone.getByRole('button', { name: /^外观与语言/ }).click();
  }
  assert.deepEqual(report.checks[0].selected, report.checks[1].selected);
  report.systemPreserved = report.systemMode === (await device.shell('cmd uimode night')).toString().trim();
  assert.ok(report.systemPreserved);
} catch (error) { report.failure = error.message; process.exitCode = 1; }
finally {
  try {
    await closeNative();
    if (phone && original) {
      const restore = process.env.DSHM_RESTORE_THEME ?? original;
      assert.ok(['浅色', '深色', '跟随系统'].includes(restore));
      await theme(restore);
      await phone.getByRole('button', { name: '返回设置首页', exact: true }).click();
      await phone.getByRole('button', { name: '退出设置', exact: true }).click();
      report.restored = true;
      report.restoredPreference = restore;
    }
  } catch (error) { report.cleanupFailure = error.message; process.exitCode = 1; }
  await device.shell(`rm -f ${xmlPath}`).catch(() => {});
  await writeFile(`artifacts/native-dialog-theme-${tag}.json`, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report)); await device.close();
}
