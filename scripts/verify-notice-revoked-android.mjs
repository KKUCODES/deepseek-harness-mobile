import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFile, writeFile, unlink } from 'node:fs/promises';
import { _android } from 'playwright';
import { androidAppWebView } from './android-app-webview.mjs';
import { localDesktopManagement } from './local-desktop-management.mjs';

assert.equal(process.env.DSHM_RUN_LIVE, '1');
const phase = process.argv[2]; assert.ok(['prepare', 'inspect', 'cleanup', 'restored'].includes(phase));
const pkg = 'dev.dshmobile.validation.pairingtest';
const dailyFingerprint = 'EYvtQJ2f8cICRebQxcWaUTtmkPQ01XcdfKG_V2tE-lE';
const name = 'DSHM 通知撤销验收 040';
const artifact = `artifacts/notice-revoked-${phase}-android.json`;
const seedPath = 'artifacts/notice-revoked-seed.json';
const report = { at: new Date().toISOString(), phase, package: pkg, errors: [] };
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
const api = await localDesktopManagement();
let device, seed;
const watchdog = setTimeout(() => { report.failure = 'overall_timeout'; writeFile(artifact, JSON.stringify(report, null, 2)).finally(() => process.exit(2)); }, 90000);
async function until(check) {
  const end = Date.now() + 30000;
  while (!await check() && Date.now() < end) await delay(100);
  assert.ok(await check(), 'Expected condition within 30 seconds');
}
async function dailyUnchanged() {
  const daily = (await api()).devices.filter(row => row.fingerprint === dailyFingerprint);
  assert.equal(daily.length, 1); assert.equal(daily[0].status, 'active'); assert.equal(daily[0].management, false);
  report.dailyAuthorizationRetained = true;
}
try {
  await dailyUnchanged();
  device = (await _android.devices({ omitDriverInstall: true })).find(item => item.serial() === process.env.DSHM_ANDROID_SERIAL);
  assert.ok(device); device.setDefaultTimeout(15000);
  const keys = async () => (await device.shell('cmd notification list')).toString().split('\n').filter(line => line.includes(`|${pkg}|`));
  if (phase === 'restored') {
    assert.equal((await device.shell(`pidof ${pkg}`)).toString().trim(), '');
    assert.equal((await keys()).length, 0);
    assert.equal((await device.shell('cmd notification list')).toString().includes('|dev.dshmobile.validation|'), false);
    await device.shell('cmd statusbar collapse');
    const root = await (await androidAppWebView(device)).page();
    const page = root.context().pages().find(page => page.url().startsWith('https://remote.dshm.invalid/'));
    assert.ok(page); page.on('pageerror', () => report.errors.push('page-error'));
    const main = page.getByTestId('remote-workspace'); await main.waitFor();
    await main.getByTestId('remote-offline-status').waitFor({ state: 'detached', timeout: 45000 });
    assert.equal(await main.locator('.remote-heading strong').innerText(), 'DSHM Remote 联调提示');
    assert.equal((await main.getByRole('textbox', { name: '消息', exact: true }).innerText()).trim(), '');
    assert.equal(await page.getByRole('article', { name: '模型回复', exact: true }).count(), 16);
    const inventory = execFileSync(process.execPath, ['apps/cli/lib/bin.js', 'plugin', '--profile', 'web', 'list', '--depth', '0', '--json'],
      { cwd: 'F:/Program Files/deepseek-harness', encoding: 'utf8', windowsHide: true });
    JSON.parse(inventory); assert.equal(inventory.includes('@dsh-mobile/notice-overflow-verification'), false);
    seed = JSON.parse(await readFile(seedPath, 'utf8'));
    assert.equal((await api()).devices.find(row => row.id === seed.deviceId)?.status, 'revoked');
    report.dailyChatAndDraftPreserved = true; report.fixtureAbsent = true;
    report.isolatedAppStopped = true; report.allTestNotificationsCleared = true;
  } else if (phase === 'prepare') {
    await device.shell(`am start -W -n ${pkg}/dev.dshmobile.validation.ValidationActivity`);
    await until(async () => /^\d+$/.test((await device.shell(`pidof ${pkg}`)).toString().trim()));
    const root = await (await androidAppWebView(device, pkg)).page();
    const ordinary = root.context().pages().find(page => page.url().startsWith('https://appassets.androidplatform.net/'));
    assert.ok(ordinary);
    if (!root.context().pages().some(page => page.url().startsWith('https://remote.dshm.invalid/'))) {
      await ordinary.getByRole('button', { name: '打开侧边抽屉', exact: true }).click();
      await ordinary.getByRole('button', { name: 'Remote', exact: true }).click();
    }
    await until(async () => root.context().pages().some(page => page.url().startsWith('https://remote.dshm.invalid/')));
    const page = root.context().pages().find(page => page.url().startsWith('https://remote.dshm.invalid/'));
    page.on('pageerror', () => report.errors.push('page-error'));
    const field = page.getByRole('textbox', { name: '一次性配对链接', exact: true });
    await until(async () => await field.isVisible()
      || await page.getByRole('heading', { name: '连接授权已失效', exact: true }).isVisible()
      || await page.getByTestId('remote-workspace').isVisible());
    // 仅移除独立测试包已经失效的旧绑定，仍有效的绑定使本次准备失败。
    if (!await field.isVisible()) {
      await page.getByRole('heading', { name: '连接授权已失效', exact: true }).waitFor();
      await page.getByRole('button', { name: '连接选项', exact: true }).click();
      await page.getByText('移除本机绑定', { exact: true }).click();
      await page.getByRole('button', { name: '确认移除', exact: true }).click();
    }
    await field.waitFor();
    const oldIds = new Set((await api()).devices.map(row => row.id));
    const pair = await api({ action: 'pair' });
    assert.equal(new URL(pair.link).origin, 'http://127.0.0.1:8787');
    await field.fill(pair.link);
    await page.getByRole('textbox', { name: '设备名称', exact: true }).fill(name);
    await page.getByRole('button', { name: '继续配对', exact: true }).click();
    await page.getByRole('heading', { name: '等待电脑批准', exact: true }).waitFor();
    const fingerprint = await page.getByTestId('remote-fingerprint').innerText();
    const rows = (await api()).devices.filter(row => !oldIds.has(row.id) && row.fingerprint === fingerprint && row.name === name && row.status === 'pending');
    assert.equal(rows.length, 1); assert.notEqual(fingerprint, dailyFingerprint);
    seed = { deviceId: rows[0].id, fingerprint }; await writeFile(seedPath, JSON.stringify(seed));
    await api({ action: 'approve', deviceId: seed.deviceId });
    await page.getByRole('button', { name: '我已在电脑批准', exact: true }).click();
    await page.getByTestId('remote-workspace').locator('.connection-dot.online').waitFor({ timeout: 45000 });
    assert.equal((await keys()).length, 0);
    await device.shell('input keyevent KEYCODE_HOME');
    seed.oldPid = (await device.shell(`pidof ${pkg}`)).toString().trim(); assert.match(seed.oldPid, /^\d+$/);
    const logs = async () => (await device.shell(`logcat -d --pid=${seed.oldPid} -v brief -s DSHMNoticeConnection:D '*:S'`)).toString();
    await until(async () => (await logs()).split('\n').filter(line => line.includes('DSHMNoticeConnection')).at(-1)?.includes('listening'));
    const id = randomUUID();
    await writeFile('artifacts/notice-overflow-control.json', JSON.stringify({ id, action: 'fresh' }));
    let host;
    await until(async () => { host = await readFile('artifacts/notice-overflow-host.json', 'utf8').then(JSON.parse).catch(() => null); return host?.id === id; });
    assert.equal(host.failed, undefined); assert.equal(host.count, 1);
    await until(async () => (await keys()).some(key => key.includes(host.sessionId)));
    seed.notification = (await keys())[0]; seed.sessionId = host.sessionId;
    await writeFile(seedPath, JSON.stringify(seed));
    // 后台进程退出后才撤销，让系统中真实旧通知留到点击时核验；不构造Intent或伪造通知。
    await device.shell(`am kill ${pkg}`);
    await until(async () => !(await device.shell(`pidof ${pkg}`)).toString().trim());
    assert.deepEqual(await keys(), [seed.notification]);
    await api({ action: 'revoke', deviceId: seed.deviceId });
    assert.equal((await api()).devices.find(row => row.id === seed.deviceId)?.status, 'revoked');
    assert.deepEqual(await keys(), [seed.notification]);
    seed.revoked = true; await writeFile(seedPath, JSON.stringify(seed));
    report.realNotificationRetainedAfterProcessExit = true; report.revokedWhileStopped = true;
  } else {
    seed = JSON.parse(await readFile(seedPath, 'utf8'));
    assert.notEqual(seed.fingerprint, dailyFingerprint);
    const current = (await api()).devices.find(row => row.id === seed.deviceId);
    assert.equal(current?.fingerprint, seed.fingerprint); assert.equal(current.name, name);
    if (phase === 'cleanup' && current.status !== 'revoked') await api({ action: 'revoke', deviceId: seed.deviceId });
    else assert.equal(current.status, 'revoked');
    const root = await (await androidAppWebView(device, pkg)).page();
    const page = root.context().pages().find(page => page.url().startsWith('https://remote.dshm.invalid/'));
    assert.ok(page); page.on('pageerror', () => report.errors.push('page-error'));
    await page.getByRole('heading', { name: '连接授权已失效', exact: true }).waitFor();
    assert.equal(await page.getByTestId('remote-workspace').count(), 0);
    assert.equal(await page.getByRole('textbox', { name: '消息', exact: true }).count(), 0);
    await until(async () => (await keys()).length === 0);
    report.oldNotificationCleared = true; report.noRemoteChatAccess = true;
    report.newProcess = (await device.shell(`pidof ${pkg}`)).toString().trim() !== seed.oldPid;
    assert.equal(report.newProcess, true);
    if (phase === 'inspect') {
      await page.getByRole('button', { name: '重新连接', exact: true }).click();
      await page.getByRole('alert').filter({ hasText: '连接授权已失效，请移除本机绑定后重新配对。' }).waitFor();
      assert.equal(await page.getByTestId('remote-workspace').count(), 0); report.reconnectRejected = true;
    } else {
      await page.getByRole('button', { name: '连接选项', exact: true }).click();
      await page.getByText('移除本机绑定', { exact: true }).click();
      await page.getByRole('button', { name: '确认移除', exact: true }).click();
      await page.getByRole('textbox', { name: '一次性配对链接', exact: true }).waitFor();
      report.revokedTestBindingRemoved = true;
    }
  }
  await dailyUnchanged(); assert.deepEqual(report.errors, []);
  await device.screenshot({ path: `artifacts/notice-revoked-${phase}-android.png` });
} catch (error) { report.failure = error.message; process.exitCode = 1; }
finally {
  await unlink('artifacts/notice-overflow-control.json').catch(error => { if (error.code !== 'ENOENT') report.cleanupError = error.code; });
  await writeFile(artifact, JSON.stringify(report, null, 2)); console.log(JSON.stringify(report));
  if (device) await Promise.race([device.close(), delay(2000)]);
  clearTimeout(watchdog); process.exit(process.exitCode ?? 0);
}
