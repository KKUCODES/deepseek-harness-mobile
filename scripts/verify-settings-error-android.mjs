import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { _android } from 'playwright';
import { androidAppWebView } from './android-app-webview.mjs';
import { localDesktopManagement } from './local-desktop-management.mjs';

const api = await localDesktopManagement();
const matches = (await api()).devices.filter(row => row.fingerprint === 'EYvtQJ2f8cICRebQxcWaUTtmkPQ01XcdfKG_V2tE-lE');
assert.equal(matches.length, 1);
const identity = matches[0];
assert.equal(identity.name, 'DSHM Android'); assert.equal(identity.status, 'active'); assert.equal(identity.management, false);
const device = (await _android.devices({ omitDriverInstall: true })).find(d => d.serial() === '127.0.0.1:16384');
assert.ok(device); device.setDefaultTimeout(20000);
const report = { at: new Date().toISOString(), errors: [] };
let settings;
try {
  await api({ action: 'management', deviceId: identity.id, enabled: true });
  await device.shell('am start -W -f 0x20020000 -n dev.dshmobile.validation/.ValidationActivity');
  const initial = await (await androidAppWebView(device)).page(), context = initial.context();
  const ordinary = context.pages().find(p => p.url().includes('appassets.androidplatform.net'));
  const existingRemote = context.pages().find(p => p.url().includes('remote.dshm.invalid'));
  const opened = existingRemote ? Promise.resolve(existingRemote) : context.waitForEvent('page');
  await ordinary.getByRole('button', { name: '打开侧边抽屉', exact: true }).click();
  await ordinary.getByRole('button', { name: 'Remote', exact: true }).click();
  const page = await opened; page.on('pageerror', () => report.errors.push('page-error'));
  const reconnect = page.getByRole('button', { name: '重新连接', exact: true });
  if (await reconnect.count()) await reconnect.click();
  await page.locator('.connection-dot.online').waitFor({ timeout: 60000 });
  const welcome = page.getByRole('dialog', { name: '内测声明', exact: true });
  if (await welcome.count()) await welcome.getByRole('button').click();
  await page.getByRole('button', { name: 'Remote 选项', exact: true }).click();
  await page.getByRole('button', { name: '电脑设置', exact: true }).click();
  settings = page.getByRole('dialog', { name: '电脑设置', exact: true });
  const input = settings.getByRole('spinbutton', { name: '单次回复上限（Token）', exact: true });
  const original = await input.inputValue();
  await input.fill('');
  await settings.getByRole('button', { name: '保存到电脑', exact: true }).click();
  await settings.getByText('请输入有效的设置值。', { exact: true }).waitFor();
  assert.equal(await input.inputValue(), '');
  report.invalidDraftRemainsVisible = true;
  await input.fill(original);
  assert.equal(await settings.getByRole('button', { name: '保存到电脑', exact: true }).isDisabled(), false);
  report.correctedDraftCanSubmit = true;
  // 无效输入在本地schema拒绝；修正后不点击保存，实际配置只读取核对。
  await settings.getByRole('button', { name: '重新读取设置', exact: true }).click();
  await settings.getByRole('button', { name: '保存到电脑', exact: true }).waitFor();
  await page.waitForFunction(value => document.querySelector('#computer-maxTokens')?.value === value, original);
  assert.equal(await settings.getByRole('button', { name: '保存到电脑', exact: true }).isDisabled(), true);
  report.originalValuePreserved = true;
  assert.deepEqual(report.errors, []);
} catch (error) { report.failure = error.message; process.exitCode = 1; }
finally {
  await settings?.getByRole('button', { name: '关闭窗口', exact: true }).click().catch(() => {});
  await api({ action: 'management', deviceId: identity.id, enabled: false });
  const restored = (await api()).devices.find(row => row.id === identity.id);
  assert.equal(restored.management, false); assert.equal(restored.status, 'active');
  report.managementWithdrawn = true;
  await writeFile('artifacts/settings-error-android.json', JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report)); await device.close(); process.exit(process.exitCode || 0);
}
