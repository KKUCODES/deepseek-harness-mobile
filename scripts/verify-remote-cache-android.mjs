import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { _android } from 'playwright';
import { androidAppWebView } from './android-app-webview.mjs';

assert.equal(process.env.DSHM_RUN_LIVE, '1');
const pkg = 'dev.dshmobile.validation';
const device = (await _android.devices({ omitDriverInstall: true })).find(d => d.serial() === process.env.DSHM_ANDROID_SERIAL);
assert.ok(device);
const report = { at: new Date().toISOString(), errors: [], checks: [] };
const title = 'DSHM Remote 联调提示';
const marker = `DSHM_CACHE_DRAFT_${Date.now()}`;
const skipClear = process.argv.includes('--skip-clear');
report.skipClear = skipClear;
let phone, remote, originalDraft;
const observed = new WeakSet();
const pause = () => new Promise(resolve => setTimeout(resolve, 100));
async function storedMarker() {
  return remote.evaluate(marker => new Promise((resolve, reject) => {
    const request = indexedDB.open('dshm.remote.drafts.v1', 1);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const db = request.result;
      const read = db.transaction('drafts', 'readonly').objectStore('drafts').getAll();
      read.onsuccess = () => { const found = read.result.some(value => value === marker || value?.text === marker); db.close(); resolve(found); };
      read.onerror = () => { db.close(); reject(read.error); };
    };
  }), marker);
}
async function startOrdinary() {
  await device.shell(`am start -f 0x20020000 -n ${pkg}/.ValidationActivity`);
  const deadline = Date.now() + 20000;
  while (!(await device.shell(`pidof ${pkg}`)).toString().trim() && Date.now() < deadline) await pause();
  const context = (await (await androidAppWebView(device)).page()).context();
  do { phone = context.pages().find(p => p.url().startsWith('https://appassets.androidplatform.net/')); if (!phone) await pause(); } while (!phone && Date.now() < deadline);
  assert.ok(phone); phone.setDefaultTimeout(25000);
  await phone.getByRole('button', { name: /^(打开侧边抽屉|退出设置|返回设置首页)$/ }).waitFor();
  return phone;
}
async function settingsHome() {
  await startOrdinary();
  const sidebar = phone.getByRole('button', { name: '打开侧边抽屉', exact: true });
  if (await sidebar.count()) {
    await sidebar.click(); await phone.getByRole('button', { name: '设置', exact: true }).click();
  }
  const back = phone.getByRole('button', { name: '返回设置首页', exact: true });
  if (await back.count()) await back.click();
  await phone.getByRole('button', { name: '普通聊天 已配置', exact: true }).waitFor();
}
async function chat() {
  await settingsHome();
  await phone.getByRole('button', { name: '电脑连接', exact: true }).click();
  const deadline = Date.now() + 30000;
  do { remote = phone.context().pages().find(p => p.url().startsWith('https://remote.dshm.invalid/')); if (!remote) await pause(); } while (!remote && Date.now() < deadline);
  assert.ok(remote); remote.setDefaultTimeout(30000);
  if (!observed.has(remote)) {
    observed.add(remote);
    remote.on('pageerror', error => report.errors.push(error.message));
  }
  const workspace = remote.getByTestId('remote-workspace');
  await workspace.waitFor();
  const heading = workspace.locator('.remote-heading strong');
  if (await heading.innerText() === 'Remote') await remote.locator('.remote-session-row').filter({ has: remote.getByText(title, { exact: true }) }).click();
  await heading.getByText(title, { exact: true }).waitFor();
  await remote.locator('.conversation article:visible').first().waitFor();
  return workspace.getByRole('textbox', { name: '消息', exact: true });
}
async function localStats() {
  await settingsHome();
  await phone.getByRole('button', { name: /^本地数据/ }).click();
  const stats = phone.locator('.settings-storage');
  await stats.getByText(/条聊天.*轮消息.*条草稿/).waitFor();
  return stats.innerText();
}
try {
  let input = await chat();
  const currentDraft = await input.evaluate(node => node.textContent);
  assert.equal(currentDraft, '', '专用测试会话必须没有原草稿，避免覆盖结构化引用');
  originalDraft = currentDraft;
  await input.fill(marker);
  assert.equal(await input.evaluate(node => node.textContent), marker);
  const origin = await remote.evaluate(() => performance.timeOrigin);
  const oldReply = await remote.locator('.conversation article:visible').first().innerText();
  const stats = await localStats(); report.localStats = stats;
  report.storedBeforeClear = await storedMarker();
  assert.equal(report.storedBeforeClear, true, '测试草稿必须先真实保存，才能验证清缓存与重启');
  if (!skipClear) {
    await phone.getByRole('button', { name: '清理临时缓存', exact: true }).click();
    const confirmation = phone.getByRole('dialog', { name: '清理临时缓存', exact: true });
    await confirmation.getByText('仅清理临时缓存，保留聊天、草稿、Key 和电脑绑定。', { exact: true }).waitFor();
    await confirmation.getByRole('button', { name: '确认清理', exact: true }).click();
    await phone.getByText('临时缓存已清理', { exact: true }).waitFor();
  }
  assert.equal(await phone.locator('.settings-storage').innerText(), stats);
  report.checks.push(skipClear ? 'controlWithoutCacheClear' : 'actualSettingsCacheClear', 'ordinaryCountsUnchanged');
  report.storedAfterClear = await storedMarker(); assert.equal(report.storedAfterClear, true);
  input = await chat();
  assert.equal(await remote.evaluate(() => performance.timeOrigin), origin);
  assert.equal(await input.evaluate(node => node.textContent), marker);
  assert.equal(await remote.locator('.conversation article:visible').first().innerText(), oldReply);
  report.checks.push('sameRemotePage', 'remoteDraftAndReplyPreserved');
  await remote.screenshot({ path: 'artifacts/remote-cache-before-restart-android.png' });
  await device.shell(`am force-stop ${pkg}`);
  assert.equal((await device.shell(`pidof ${pkg}`)).toString().trim(), '');
  phone = undefined; remote = undefined;
  assert.equal(await localStats(), stats);
  input = await chat();
  assert.notEqual(await remote.evaluate(() => performance.timeOrigin), origin);
  report.storedAfterRestart = await storedMarker();
  await remote.waitForFunction(marker => document.querySelector('.remote-app:not([hidden]) [role="textbox"]')?.textContent === marker, marker);
  assert.equal(await input.evaluate(node => node.textContent), marker);
  await remote.screenshot({ path: 'artifacts/remote-cache-after-restart-android.png' });
  report.checks.push('actualProcessRestart', 'keyConfiguredAndLocalCountsPreserved', 'existingBindingReconnects', 'remoteDraftRestored');
  assert.deepEqual(report.errors, []);
} catch (error) { report.failure = error.stack; process.exitCode = 1; }
finally {
  try {
    if (originalDraft !== undefined) {
      const input = await chat();
      await input.click(); await input.press('ControlOrMeta+A'); await input.press('Backspace');
      if (originalDraft) await input.fill(originalDraft);
      assert.equal(await input.evaluate(node => node.textContent), originalDraft);
      const deadline = Date.now() + 5000;
      while (await storedMarker() && Date.now() < deadline) await pause();
      assert.equal(await storedMarker(), false, '清理后的草稿必须已经持久化');
      report.draftRestored = true;
    }
    await settingsHome(); await phone.getByRole('button', { name: '退出设置', exact: true }).click();
    if (originalDraft !== undefined) { assert.equal(await storedMarker(), false); report.testDraftRemoved = true; }
    report.ordinaryHomeRestored = true;
  } catch (error) { report.cleanupFailure = error.stack; process.exitCode = 1; }
  await writeFile(`artifacts/remote-cache-${skipClear ? 'control-' : ''}android.json`, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report)); await device.close();
}
