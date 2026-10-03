import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { _android } from 'playwright';
import { androidAppWebView } from './android-app-webview.mjs';
import { localDesktopManagement } from './local-desktop-management.mjs';

assert.equal(process.env.DSHM_RUN_LIVE, '1');
const phase = process.argv[2]; assert.ok(['pair', 'revoke', 'cleanup'].includes(phase));
const pkg = 'dev.dshmobile.validation.pairingtest';
const name = 'DSHM 在途撤权验证 041';
const dailyFingerprint = 'EYvtQJ2f8cICRebQxcWaUTtmkPQ01XcdfKG_V2tE-lE';
const prefix = 'artifacts/notice-epoch-revoke';
const report = { at: new Date().toISOString(), phase, errors: [] };
const api = await localDesktopManagement();
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
let device;
const save = () => writeFile(`${prefix}-binding-${phase}.json`, JSON.stringify(report, null, 2));
const watchdog = setTimeout(() => { report.failure = 'overall_timeout'; void save().finally(() => process.exit(2)); }, 90000);
const daily = async () => {
  const entries = (await api()).devices.filter(row => row.fingerprint === dailyFingerprint);
  assert.equal(entries.length, 1); assert.equal(entries[0].status, 'active'); assert.equal(entries[0].management, false);
  report.dailyBindingUnchanged = true;
};
try {
  await daily();
  if (phase === 'revoke') {
    const seed = JSON.parse(await readFile(`${prefix}-binding-seed.json`, 'utf8'));
    const row = (await api()).devices.find(row => row.id === seed.id);
    assert.equal(row?.name, name); assert.equal(row.fingerprint, seed.fingerprint); assert.notEqual(row.fingerprint, dailyFingerprint);
    assert.equal(row.status, 'active'); assert.equal(row.management, false);
    await api({ action: 'revoke', deviceId: row.id });
    assert.equal((await api()).devices.find(item => item.id === row.id)?.status, 'revoked');
    report.revoked = true;
  } else {
    device = (await _android.devices({ omitDriverInstall: true })).find(item => item.serial() === process.env.DSHM_ANDROID_SERIAL);
    assert.ok(device);
    await device.shell(`am start -W -n ${pkg}/dev.dshmobile.validation.ValidationActivity`);
    const root = await (await androidAppWebView(device, pkg)).page();
    const ordinary = root.context().pages().find(page => page.url().startsWith('https://appassets.androidplatform.net/'));
    assert.ok(ordinary);
    await ordinary.getByRole('button', { name: '打开侧边抽屉', exact: true }).click();
    await ordinary.getByRole('button', { name: 'Remote', exact: true }).click();
    let page;
    const until = Date.now() + 20000;
    while (!page && Date.now() < until) {
      page = root.context().pages().find(page => page.url().startsWith('https://remote.dshm.invalid/'));
      if (!page) await delay(100);
    }
    assert.ok(page); page.setDefaultTimeout(20000); page.on('pageerror', () => report.errors.push('page-error'));
    if (phase === 'pair') {
      const field = page.getByRole('textbox', { name: '一次性配对链接', exact: true });
      await field.waitFor();
      const oldIds = new Set((await api()).devices.map(row => row.id));
      const pair = await api({ action: 'pair' }); assert.equal(new URL(pair.link).origin, 'http://127.0.0.1:8787');
      await field.fill(pair.link);
      await page.getByRole('textbox', { name: '设备名称', exact: true }).fill(name);
      await page.getByRole('button', { name: '继续配对', exact: true }).click();
      await page.getByRole('heading', { name: '等待电脑批准', exact: true }).waitFor();
      const fingerprint = await page.getByTestId('remote-fingerprint').innerText();
      assert.notEqual(fingerprint, dailyFingerprint);
      const rows = (await api()).devices.filter(row => !oldIds.has(row.id) && row.fingerprint === fingerprint && row.name === name && row.status === 'pending');
      assert.equal(rows.length, 1);
      await writeFile(`${prefix}-binding-seed.json`, JSON.stringify({ id: rows[0].id, fingerprint, name }));
      await api({ action: 'approve', deviceId: rows[0].id });
      await page.getByRole('button', { name: '我已在电脑批准', exact: true }).click();
      await page.getByTestId('remote-workspace').locator('.connection-dot.online').waitFor({ timeout: 45000 });
      const row = (await api()).devices.find(row => row.id === rows[0].id);
      assert.equal(row.status, 'active'); assert.equal(row.management, false);
      report.pairedWithoutManagement = true;
    } else {
      const seed = JSON.parse(await readFile(`${prefix}-binding-seed.json`, 'utf8'));
      const row = (await api()).devices.find(row => row.id === seed.id);
      assert.equal(row?.status, 'revoked'); assert.equal(row.fingerprint, seed.fingerprint);
      await page.getByRole('heading', { name: '连接授权已失效', exact: true }).waitFor();
      assert.equal(await page.getByTestId('remote-workspace').count(), 0);
      await page.getByRole('button', { name: '重新连接', exact: true }).click();
      await page.getByRole('alert').filter({ hasText: '连接授权已失效，请移除本机绑定后重新配对。' }).waitFor();
      assert.equal(await page.getByTestId('remote-workspace').count(), 0); report.reconnectRejectedInUi = true;
      await page.getByRole('button', { name: '连接选项', exact: true }).click();
      await page.getByText('移除本机绑定', { exact: true }).click();
      await page.getByRole('button', { name: '确认移除', exact: true }).click();
      await page.getByRole('textbox', { name: '一次性配对链接', exact: true }).waitFor();
      report.bindingRemoved = true;
      assert.equal((await device.shell('cmd notification list')).toString().includes(`|${pkg}|`), false);
      await device.shell(`am force-stop ${pkg}`); report.isolatedAppStopped = true;
    }
  }
  await daily(); assert.deepEqual(report.errors, []); report.ok = true;
} catch (error) { report.failure = error.message; process.exitCode = 1; }
finally {
  await save(); console.log(JSON.stringify(report));
  if (device) await Promise.race([device.close(), delay(2000)]);
  clearTimeout(watchdog); process.exit(process.exitCode ?? 0);
}
