import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFile, writeFile, unlink } from 'node:fs/promises';
import { _android } from 'playwright';
import { androidAppWebView } from './android-app-webview.mjs';

assert.equal(process.env.DSHM_RUN_LIVE, '1');
const phase = process.argv[2];
assert.ok(['before', 'disabled', 'restored', 'cleanup'].includes(phase));
const systemChannel = process.argv.includes('--system-channel');
const prefix = systemChannel ? 'notice-channel' : 'notice-category';
const report = { at: new Date().toISOString(), phase, systemChannel, errors: [] };
const artifact = `artifacts/${prefix}-${phase}-android.json`;
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
let device;
const watchdog = setTimeout(() => { report.failure = 'overall_timeout'; writeFile(artifact, JSON.stringify(report, null, 2)).finally(() => process.exit(2)); }, 60000);
async function until(check) {
  const end = Date.now() + 15000;
  while (!await check() && Date.now() < end) await delay(100);
  assert.ok(await check(), 'Expected state within 15 seconds');
}
const notifications = async () => (await device.shell('cmd notification list')).toString().split('\n')
  .filter(line => line.includes('|dev.dshmobile.validation|') && line.includes('dshm.remote.notice.'));
async function channelImportance() {
  const dump = (await device.shell('dumpsys notification')).toString();
  const section = dump.split(/\r?\n\s*AppSettings: /).find(part => /^dev\.dshmobile\.validation \(\d+\)/.test(part));
  assert.ok(section, 'Exact application notification settings required');
  const channels = section.split('\n').filter(line => line.includes("mId='dshm.remote.notice.completed'"));
  assert.equal(channels.length, 1);
  const value = channels[0].match(/mImportance=(\d+)/)?.[1]; assert.ok(value);
  return Number(value);
}
try {
  device = (await _android.devices({ omitDriverInstall: true })).find(item => item.serial() === process.env.DSHM_ANDROID_SERIAL);
  assert.ok(device);
  const first = await (await androidAppWebView(device)).page();
  const page = first.context().pages().find(item => item.url().startsWith('https://remote.dshm.invalid/'));
  assert.ok(page); page.setDefaultTimeout(10000); page.on('pageerror', () => report.errors.push('page-error'));
  const main = page.getByTestId('remote-workspace');
  const title = await main.locator('.remote-heading strong').innerText();
  const editor = main.getByRole('textbox', { name: '消息', exact: true });
  const draft = await editor.textContent();
  assert.equal(title, 'DSHM Remote 联调提示'); assert.equal(draft, '');
  if (phase === 'cleanup') {
    await main.getByTestId('remote-offline-status').waitFor({ state: 'detached', timeout: 45000 });
    assert.equal(await page.getByRole('alert').count(), 0);
    const inventory = execFileSync(process.execPath, ['apps/cli/lib/bin.js', 'plugin', '--profile', 'web', 'list', '--depth', '0', '--json'],
      { cwd: 'F:/Program Files/deepseek-harness', encoding: 'utf8', windowsHide: true });
    JSON.parse(inventory); assert.equal(inventory.includes('@dsh-mobile/notice-overflow-verification'), false);
    report.fixturePackageAbsent = true; report.online = true; report.draftEmpty = true;
    if (systemChannel) {
      assert.equal(await channelImportance(), 3);
      assert.equal((await notifications()).length, 0);
      report.noResidualNotifications = true;
    } else assert.equal(JSON.parse(await readFile('artifacts/notice-category-restored-android.json', 'utf8')).settings['任务完成'], true);
    report.settingsRestored = true;
  } else {
  if (systemChannel) {
    report.channelImportance = await channelImportance();
    assert.equal(report.channelImportance, phase === 'disabled' ? 0 : 3);
    const activity = (await device.shell('dumpsys activity activities')).toString().match(/topResumedActivity=.*?\s([^\s}]+\/[^\s}]+)/)?.[1];
    assert.ok(activity?.startsWith('com.android.settings/'), 'Android settings must be foreground');
    report.systemSettingsForeground = true;
    assert.equal((await notifications()).length, 0, 'No existing app notifications before this event');
  } else {
  await device.shell('uiautomator dump /data/local/tmp/dshm-category.xml');
  const xml = (await device.shell('cat /data/local/tmp/dshm-category.xml')).toString();
  const nodes = [...xml.matchAll(/<node\s+([^>]+)>/g)].map(match => Object.fromEntries([...match[1].matchAll(/([\w-]+)="([^"]*)"/g)].map(pair => [pair[1], pair[2]])));
  assert.ok(nodes.some(node => node.text === 'Remote 提醒 · 已连接'));
  const checks = Object.fromEntries(['需要批准', '需要回答', '任务完成', '执行失败或受阻'].map(label => {
    const node = nodes.find(item => item.text === label); assert.equal(node?.checkable, 'true');
    return [label, node.checked === 'true'];
  }));
  assert.equal(checks['任务完成'], phase !== 'disabled');
  for (const label of ['需要批准', '需要回答', '执行失败或受阻']) assert.equal(checks[label], true);
  report.settings = checks;
  }
  const pid = (await device.shell('pidof dev.dshmobile.validation')).toString().trim(); assert.match(pid, /^\d+$/);
  const logs = async () => (await device.shell(`logcat -d --pid=${pid} -v brief -s DSHMNoticeConnection:D DSHMNotifications:D '*:S'`)).toString();
  const before = await logs();
  assert.ok(before.split('\n').filter(line => line.includes('DSHMNoticeConnection')).at(-1)?.includes('listening'));
  const id = randomUUID();
  await writeFile('artifacts/notice-overflow-control.json', JSON.stringify({ id, action: 'fresh' }));
  let host;
  await until(async () => { host = await readFile('artifacts/notice-overflow-host.json', 'utf8').then(JSON.parse).catch(() => null); return host?.id === id; });
  assert.equal(host.failed, undefined); assert.equal(host.count, 1);
  report.host = host;
  if (systemChannel) await until(async () => (await logs()).slice(before.length).includes('display kind=completed foreground=null started=0'));
  else if (phase !== 'disabled') await until(async () => (await logs()).slice(before.length).includes('display kind=completed foreground=RemoteActivity'));
  if (systemChannel && phase !== 'disabled') await until(async () => (await notifications()).some(line => line.includes(host.sessionId)));
  // 关闭阶段只声称有界观察无显示；两侧正向事件证明同一真实链路可投递。
  await delay(2000);
  const fresh = (await logs()).slice(before.length);
  const displays = fresh.match(/display kind=completed/g)?.length ?? 0;
  assert.equal(displays, !systemChannel && phase === 'disabled' ? 0 : 1);
  if (systemChannel) {
    report.systemNotificationCount = (await notifications()).filter(line => line.includes(host.sessionId)).length;
    assert.equal(report.systemNotificationCount, phase === 'disabled' ? 0 : 1);
    report.actualEventReachedAndroid = true;
  }
  assert.equal(/retrying|disconnected|stream_overflow/.test(fresh), false);
  assert.equal((await device.shell('pidof dev.dshmobile.validation')).toString().trim(), pid);
  assert.equal(await main.locator('.remote-heading strong').innerText(), title);
  assert.equal(await editor.textContent(), draft);
  report.displayCount = displays; report.observationMs = 2000; report.sameProcess = true;
  report.pageAndDraftPreserved = true; report.noReconnectObserved = true;
  await device.screenshot({ path: `artifacts/${prefix}-${phase}-android.png` });
  }
  assert.deepEqual(report.errors, []);
} catch (error) { report.failure = error.message; process.exitCode = 1; }
finally {
  await unlink('artifacts/notice-overflow-control.json').catch(error => { if (error.code !== 'ENOENT') report.cleanupError = error.code; });
  await writeFile(artifact, JSON.stringify(report, null, 2)); console.log(JSON.stringify(report));
  if (device) await Promise.race([device.close(), delay(2000)]);
  clearTimeout(watchdog); process.exit(process.exitCode ?? 0);
}
