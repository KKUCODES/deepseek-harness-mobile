import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { writeFile } from 'node:fs/promises';
import { _android } from 'playwright';
import { androidAppWebView } from './android-app-webview.mjs';
import { localDesktopManagement } from './local-desktop-management.mjs';

const pkg = 'dev.dshmobile.validation';
const name = `DSHM Android通知验收 ${randomUUID().slice(0, 8)}`;
const marker = `DSHM_API36_NOTICE_${randomUUID().slice(0, 8)}`;
const device = (await _android.devices({ omitDriverInstall: true })).find(d => d.serial() === 'emulator-5556');
assert.ok(device); device.setDefaultTimeout(20000);
const api = await localDesktopManagement();
const previous = new Set((await api()).devices.map(row => row.id));
const report = { at: new Date().toISOString(), name, marker, errors: [] };
let page;
const pause = () => new Promise(resolve => setTimeout(resolve, 200));
async function nodes() {
  await device.shell('uiautomator dump /data/local/tmp/notice-live.xml');
  const xml = (await device.shell('cat /data/local/tmp/notice-live.xml')).toString();
  return [...xml.matchAll(/<node\s+([^>]+)>/g)].map(match => Object.fromEntries([...match[1].matchAll(/([\w-]+)="([^"]*)"/g)].map(x => [x[1], x[2]])));
}
async function tap(node) {
  assert.ok(node, '目标系统控件必须实际存在');
  const [a,b,c,d] = node.bounds.match(/\d+/g).map(Number);
  await device.shell(`input tap ${Math.floor((a+c)/2)} ${Math.floor((b+d)/2)}`);
}
async function findNative(predicate) {
  const deadline = Date.now() + 20000;
  do {
    const found = (await nodes()).find(predicate);
    if (found) return found;
    await pause();
  } while (Date.now() < deadline);
  throw new Error('等待实际系统控件超时');
}
const notices = async () => (await device.shell('cmd notification list')).toString().split('\n').filter(line => line.includes(`|${pkg}|`) && line.includes('dshm.remote.notice.'));
try {
  await device.shell('cmd statusbar collapse');
  await device.shell(`am start -W -f 0x10008000 -n ${pkg}/.ValidationActivity`);
  const ordinary = await (await androidAppWebView(device)).page();
  await ordinary.getByRole('button', { name: '打开侧边抽屉', exact: true }).click();
  await ordinary.getByRole('button', { name: '设置', exact: true }).click();
  await ordinary.getByRole('button', { name: 'Remote 提醒', exact: true }).click();
  await tap(await findNative(row => row.text === '允许系统通知'));
  await tap(await findNative(row => /:id\/permission_allow_button$/.test(row['resource-id'] ?? '')));
  assert.match((await device.shell(`dumpsys package ${pkg}`)).toString(), /android\.permission\.POST_NOTIFICATIONS: granted=true/);
  report.permissionGrantedFromSystemDialog = true;
  const opened = ordinary.context().waitForEvent('page');
  await ordinary.getByRole('button', { name: '电脑连接', exact: true }).click();
  page = await opened; page.on('pageerror', () => report.errors.push('page-error'));
  report.browserTimeZone = await page.evaluate(() => Intl.DateTimeFormat().resolvedOptions().timeZone);
  const pairing = await api({ action: 'pair' });
  await page.getByRole('textbox', { name: '一次性配对链接', exact: true }).fill(pairing.link);
  await page.getByRole('textbox', { name: '设备名称', exact: true }).fill(name);
  await page.getByRole('button', { name: '继续配对', exact: true }).click();
  await page.getByRole('heading', { name: '等待电脑批准', exact: true }).waitFor();
  const fingerprint = await page.getByTestId('remote-fingerprint').innerText();
  const candidates = (await api()).devices.filter(row => !previous.has(row.id) && row.name === name && row.fingerprint === fingerprint && row.status === 'pending');
  assert.equal(candidates.length, 1);
  await api({ action: 'approve', deviceId: candidates[0].id });
  const approved = (await api()).devices.find(row => row.id === candidates[0].id);
  assert.equal(approved.status, 'active'); assert.equal(approved.management, false);
  await page.getByRole('button', { name: '我已在电脑批准', exact: true }).click();
  const main = page.getByTestId('remote-workspace');
  await main.locator('.connection-dot.online').waitFor({ timeout: 60000 });
  await main.locator('button.remote-session-row').filter({ has: page.getByText('DSHM Remote 联调提示', { exact: true }) }).click();
  const editor = main.getByRole('textbox', { name: '消息', exact: true });
  await editor.waitFor(); assert.equal(await editor.textContent(), '');
  const pid = (await device.shell(`pidof ${pkg}`)).toString().trim();
  assert.match(pid, /^\d+$/);
  const deadline = Date.now() + 30000;
  while (Date.now() < deadline) {
    if ((await device.shell(`logcat -d --pid=${pid} -s DSHMNoticeConnection:D '*:S'`)).toString().includes('listening')) { report.noticeConnectionListening = true; break; }
    await pause();
  }
  assert.equal(report.noticeConnectionListening, true);
  const before = await notices(); assert.equal(before.length, 0);
  await editor.fill(`这是通知联调测试，请只回复 ${marker}，不要调用工具。`);
  await main.getByRole('button', { name: '发送消息', exact: true }).click(); report.sendClicked = true;
  // 点击完成不是发送完成；先核对提交后的编辑器和另一台手机的真实会话。
  const peer = (await _android.devices({ omitDriverInstall: true })).find(d => d.serial() === '127.0.0.1:16384');
  assert.ok(peer, '需要已绑定的独立手机核对电脑会话');
  const peerPage = await (await androidAppWebView(peer)).page();
  const remotePeer = peerPage.context().pages().find(p => p.url().includes('remote.dshm.invalid'));
  assert.ok(remotePeer, '独立手机必须已打开Remote');
  report.peerHeading = await remotePeer.getByTestId('remote-workspace').locator('.remote-heading strong').innerText();
  await remotePeer.getByTestId('remote-workspace').getByText(`这是通知联调测试，请只回复 ${marker}，不要调用工具。`, { exact: true }).waitFor({ timeout: 30000 });
  report.messageObservedOnPeer = true;
  await device.shell('input keyevent KEYCODE_HOME');
  let key;
  const noticeDeadline = Date.now() + 90000;
  while (Date.now() < noticeDeadline) {
    key = (await notices()).find(value => !before.includes(value));
    if (key) break;
    await pause();
  }
  assert.ok(key, '真实电脑回复应产生系统通知'); report.systemNotificationDelivered = true;
  let notification;
  const shadeDeadline = Date.now() + 20000;
  while (!notification && Date.now() < shadeDeadline) {
    await device.shell('cmd statusbar expand-notifications');
    notification = (await nodes()).find(row => row.text === '电脑任务已完成');
    if (!notification) await pause();
  }
  assert.ok(notification, '必须是任务完成通知，不接受错误通知替代');
  await device.screenshot({ path: 'artifacts/standard-notification-live.png' });
  await tap(notification);
  await main.locator('.remote-heading strong').filter({ hasText: 'DSHM Remote 联调提示' }).waitFor();
  await main.getByRole('article', { name: '模型回复' }).filter({ hasText: marker }).waitFor({ timeout: 30000 });
  report.notificationOpenedCorrectReply = true;
  assert.equal(await editor.textContent(), '');
  assert.deepEqual(report.errors, []);
} catch (error) {
  report.failure = error.message.replace(/[A-Za-z0-9_-]{43,}/g, '[redacted]'); process.exitCode = 1;
  if (page) {
    const main = page.getByTestId('remote-workspace');
    report.senderState = {
      draftContainsMarker: (await main.getByRole('textbox', { name: '消息', exact: true }).textContent().catch(() => ''))?.includes(marker),
      messagesContainingMarker: await main.getByRole('article').filter({ hasText: marker }).count(),
      alerts: await main.getByRole('alert').allTextContents(),
      status: await main.getByRole('status').allTextContents(),
    };
  }
}
finally {
  try {
    const devices = (await api()).devices.filter(row => !previous.has(row.id) && row.name === name);
    for (const row of devices) {
      await api({ action: 'revoke', deviceId: row.id });
      assert.equal((await api()).devices.find(item => item.id === row.id)?.status, 'revoked');
    }
    report.testAuthorizationRevoked = devices.length > 0;
    if (page && devices.length) {
      await device.shell('cmd statusbar collapse');
      await device.shell(`am start -W -f 0x20020000 -n ${pkg}/.RemoteActivity`);
      await page.getByText('电脑已撤销这台手机，请重新配对。', { exact: true }).waitFor();
      assert.equal(await page.getByTestId('remote-workspace').count(), 0);
      report.revokedWorkspaceRemoved = true;
    }
  } catch { report.cleanupFailure = report.testAuthorizationRevoked ? '授权已撤销，界面移除尚未确认' : '需复核临时设备授权'; process.exitCode = 1; }
  await device.shell(`am force-stop ${pkg}`);
  await writeFile('artifacts/standard-notification-live.json', JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report)); await device.close(); process.exit(process.exitCode || 0);
}
