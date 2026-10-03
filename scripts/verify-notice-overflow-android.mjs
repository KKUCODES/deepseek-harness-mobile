import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { writeFile, readFile, unlink } from 'node:fs/promises';
import { _android } from 'playwright';
import { androidAppWebView } from './android-app-webview.mjs';

assert.equal(process.env.DSHM_RUN_LIVE, '1');
const cleanup = process.argv.includes('--cleanup');
const report = { at: new Date().toISOString(), errors: [] };
const artifact = `artifacts/notice-overflow${cleanup ? '-cleanup' : ''}-android.json`;
let device;
const watchdog = setTimeout(() => { report.failure = 'overall_timeout'; writeFile(artifact, JSON.stringify(report, null, 2)).finally(() => process.exit(2)); }, 90000);
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
async function until(check) { const end = Date.now() + 20000; while (!await check() && Date.now() < end) await delay(100); assert.ok(await check(), 'Expected condition within deadline'); }
try {
  device = (await _android.devices({ omitDriverInstall: true })).find(item => item.serial() === process.env.DSHM_ANDROID_SERIAL);
  assert.ok(device);
  await device.shell('am start -n dev.dshmobile.validation/.ValidationActivity');
  await until(async () => !!(await device.shell('pidof dev.dshmobile.validation')).toString().trim());
  const root = await (await androidAppWebView(device)).page();
  let page = root.context().pages().find(item => item.url().startsWith('https://remote.dshm.invalid/'));
  if (!page) {
    const ordinary = root.context().pages().find(item => item.url().startsWith('https://appassets.androidplatform.net/'));
    assert.ok(ordinary);
    await ordinary.getByRole('button', { name: '打开侧边抽屉', exact: true }).click();
    await ordinary.getByRole('button', { name: 'Remote', exact: true }).click();
    await until(() => !!(page = root.context().pages().find(item => item.url().startsWith('https://remote.dshm.invalid/'))));
  }
  assert.ok(page); page.setDefaultTimeout(15000); page.on('pageerror', () => report.errors.push('page-error'));
  const main = page.getByTestId('remote-workspace');
  if (await page.getByRole('button', { name: '重新连接', exact: true }).isVisible())
    await page.getByRole('button', { name: '重新连接', exact: true }).click();
  await main.waitFor({ timeout: 45000 });
  const welcome = page.getByRole('dialog', { name: '内测声明', exact: true });
  if (await welcome.isVisible()) await welcome.getByRole('button', { name: '继续', exact: true }).click();
  if (await main.locator('.remote-heading strong').innerText() === 'Remote') {
    await main.locator('.connection-dot.online').waitFor({ timeout: 45000 });
    await main.locator('button.remote-session-row').filter({ has: page.getByText('DSHM Remote 联调提示', { exact: true }) }).click();
  }
  const editor = main.getByRole('textbox', { name: '消息', exact: true });
  await editor.waitFor();
  const title = await main.locator('.remote-heading strong').innerText(), draft = await editor.textContent();
  assert.equal(title, 'DSHM Remote 联调提示');
  if (cleanup) {
    const inventory = spawnSync(process.execPath, ['apps/cli/lib/bin.js', 'plugin', '--profile', 'web', 'list', '--depth', '0', '--json'],
      { cwd: 'F:/Program Files/deepseek-harness', encoding: 'utf8' });
    assert.equal(inventory.status, 0, 'Profile inventory must succeed');
    JSON.parse(inventory.stdout);
    assert.equal(inventory.stdout.includes('@dsh-mobile/notice-overflow-verification'), false);
    report.fixturePackageAbsent = true;
    await main.getByTestId('remote-offline-status').waitFor({ state: 'detached', timeout: 45000 });
    assert.equal(await page.getByRole('alert').count(), 0);
    assert.equal(draft, '');
    report.online = true; report.originalChat = true; report.draftEmpty = true;
  } else {
  const pid = (await device.shell('pidof dev.dshmobile.validation')).toString().trim(); assert.match(pid, /^[1-9]\d*$/);
  const logs = async () => (await device.shell(`logcat -d --pid=${pid} -v brief -s DSHMNoticeConnection:D DSHMNotifications:D '*:S'`)).toString();
  await until(async () => (await logs()).split('\n').filter(line => line.includes('DSHMNoticeConnection')).at(-1)?.includes('listening'));
  const before = await logs();
  const trigger = async action => {
    const id = randomUUID(); await writeFile('artifacts/notice-overflow-control.json', JSON.stringify({ id, action }));
    let host;
    await until(async () => { host = await readFile('artifacts/notice-overflow-host.json', 'utf8').then(JSON.parse).catch(() => null); return host?.id === id; });
    assert.equal(host.failed, undefined); return host;
  };
  const burst = await trigger('burst'); assert.equal(burst.count, 257);
  await until(async () => {
    const current = (await logs()).slice(before.length);
    return /stream_overflow[\s\S]*retrying[\s\S]*listening/.test(current);
  });
  report.actualHostOverflowReceived = true; report.automaticResubscribe = true;
  const recovered = await logs();
  // 初始基线不回放被丢弃的旧结算；前台固定摘要日志不含内容或身份。
  assert.equal(recovered.slice(before.length).includes('display kind=completed'), false);
  report.noBurstReplay = true;
  const fresh = await trigger('fresh'); assert.equal(fresh.sessionId, burst.sessionId); assert.equal(fresh.turn, 258);
  await until(async () => (await logs()).slice(recovered.length).includes('display kind=completed foreground=RemoteActivity'));
  report.freshNotificationDelivered = true;
  await delay(1000);
  assert.equal((await logs()).slice(recovered.length).match(/display kind=completed/g)?.length, 1);
  report.freshDeliveredOnce = true;
  assert.equal((await device.shell('pidof dev.dshmobile.validation')).toString().trim(), pid);
  assert.equal(await main.locator('.remote-heading strong').innerText(), title);
  assert.equal(await editor.textContent(), draft);
  assert.deepEqual(report.errors, []);
  report.sameProcess = true; report.pageAndDraftPreserved = true;
  }
} catch (error) { report.failure = error.message; process.exitCode = 1; }
finally {
  await unlink('artifacts/notice-overflow-control.json').catch(error => { if (error.code !== 'ENOENT') report.cleanupError = error.code; });
  await writeFile(artifact, JSON.stringify(report, null, 2)); console.log(JSON.stringify(report));
  if (device) await Promise.race([device.close(), delay(2000)]);
  clearTimeout(watchdog); process.exit(process.exitCode ?? 0);
}
