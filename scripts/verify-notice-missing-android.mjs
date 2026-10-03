import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFile, writeFile, unlink } from 'node:fs/promises';
import { _android } from 'playwright';
import { androidAppWebView } from './android-app-webview.mjs';

assert.equal(process.env.DSHM_RUN_LIVE, '1');
const phase = process.argv[2]; assert.ok(['prepare', 'inspect', 'cleanup'].includes(phase));
const prefix = process.argv.includes('--language') ? 'notice-missing-language' : 'notice-missing';
const report = { at: new Date().toISOString(), phase, errors: [] };
const artifact = `artifacts/${prefix}-${phase}-android.json`;
const marker = 'DSHM_NOTICE_MISSING_DRAFT_20261003';
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
let device;
const watchdog = setTimeout(() => { report.failure = 'overall_timeout'; writeFile(artifact, JSON.stringify(report, null, 2)).finally(() => process.exit(2)); }, 90000);
async function until(check) {
  const end = Date.now() + 45000;
  while (!await check() && Date.now() < end) await delay(100);
  assert.ok(await check(), 'Expected condition within 45 seconds');
}
try {
  device = (await _android.devices({ omitDriverInstall: true })).find(item => item.serial() === process.env.DSHM_ANDROID_SERIAL);
  assert.ok(device);
  const root = await (await androidAppWebView(device)).page();
  const page = root.context().pages().find(item => item.url().startsWith('https://remote.dshm.invalid/'));
  assert.ok(page); page.setDefaultTimeout(15000); page.on('pageerror', () => report.errors.push('page-error'));
  const main = page.getByTestId('remote-workspace');
  await main.getByTestId('remote-offline-status').waitFor({ state: 'detached', timeout: 45000 });
  const heading = main.locator('.remote-heading strong');
  const editor = main.getByRole('textbox', { name: '消息', exact: true });
  const keys = async () => (await device.shell('cmd notification list')).toString().split('\n').filter(line => line.includes('|dev.dshmobile.validation|'));
  report.title = await heading.innerText(); assert.equal(report.title, 'DSHM Remote 联调提示');
  if (phase === 'prepare') {
    assert.equal(await editor.textContent(), '');
    assert.equal((await keys()).length, 0);
    report.replyCount = await page.getByRole('article', { name: '模型回复', exact: true }).count();
    await editor.fill(marker);
    assert.equal(await editor.textContent(), marker);
    await device.shell('input keyevent KEYCODE_HOME');
    const pid = (await device.shell('pidof dev.dshmobile.validation')).toString().trim(); assert.match(pid, /^\d+$/);
    const logs = async () => (await device.shell(`logcat -d --pid=${pid} -v brief -s DSHMNoticeConnection:D DSHMNotifications:D '*:S'`)).toString();
    await until(async () => (await logs()).split('\n').filter(line => line.includes('DSHMNoticeConnection')).at(-1)?.includes('listening'));
    const before = await logs();
    const id = randomUUID();
    await writeFile('artifacts/notice-overflow-control.json', JSON.stringify({ id, action: 'fresh' }));
    let host;
    await until(async () => { host = await readFile('artifacts/notice-overflow-host.json', 'utf8').then(JSON.parse).catch(() => null); return host?.id === id; });
    assert.equal(host.count, 1); assert.equal(host.failed, undefined);
    await until(async () => (await keys()).some(key => key.includes(host.sessionId)));
    assert.ok((await logs()).slice(before.length).includes('display kind=completed foreground=null started=0'));
    report.host = host; report.systemNotificationReady = true; report.draftPrepared = true;
  } else {
    const before = JSON.parse(await readFile(`artifacts/${prefix}-prepare-android.json`, 'utf8'));
    assert.equal(before.systemNotificationReady, true);
    assert.equal(await editor.textContent(), marker);
    assert.equal(await page.getByRole('article', { name: '模型回复', exact: true }).count(), before.replyCount);
    await page.getByRole('alert').filter({ hasText: '暂时无法打开提醒对应的聊天' }).waitFor();
    report.explicitError = true; report.originalChatAndDraftPreserved = true;
    assert.equal((await keys()).length, 0);
    report.notificationConsumed = true;
    if (phase === 'cleanup') {
      const inventory = execFileSync(process.execPath, ['apps/cli/lib/bin.js', 'plugin', '--profile', 'web', 'list', '--depth', '0', '--json'],
        { cwd: 'F:/Program Files/deepseek-harness', encoding: 'utf8', windowsHide: true });
      JSON.parse(inventory); assert.equal(inventory.includes('@dsh-mobile/notice-overflow-verification'), false);
      await editor.fill(''); assert.equal(await editor.textContent(), '');
      report.draftRestored = true; report.fixturePackageAbsent = true;
    }
  }
  await device.screenshot({ path: `artifacts/${prefix}-${phase}-android.png` });
  assert.deepEqual(report.errors, []);
} catch (error) { report.failure = error.message; process.exitCode = 1; }
finally {
  await unlink('artifacts/notice-overflow-control.json').catch(error => { if (error.code !== 'ENOENT') report.cleanupError = error.code; });
  await writeFile(artifact, JSON.stringify(report, null, 2)); console.log(JSON.stringify(report));
  if (device) await Promise.race([device.close(), delay(2000)]);
  clearTimeout(watchdog); process.exit(process.exitCode ?? 0);
}
