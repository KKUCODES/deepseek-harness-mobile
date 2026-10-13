import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { openLatestLiveAndroid } from '../tests/support/latest-live-context.mjs';

const phase = process.argv[2]; assert.ok(['start', 'inspect'].includes(phase));
const executionMode = process.argv[3] ?? 'release'; assert.ok(['source', 'release'].includes(executionMode));
assert.ok(process.argv.length <= 4);
const prefix = executionMode === 'source' ? 'latest-live-source-notification' : 'latest-live-notification';
// 点击阶段由原生通知恢复Activity，不先点击后台、暂停的普通聊天WebView。
const live = await openLatestLiveAndroid(undefined, { openRecorded: executionMode === 'source' && phase === 'start' });
const { runtime, state, session, main, page, device, capture, readSession } = live;
const pkg = 'dev.dshmobile.validation.latesttest';
const seedPath = resolve(runtime, prefix + '-seed.json');
const report = { at: new Date().toISOString(), phase, sessionId: session.sessionId, passed: false, errors: [] };
assert.equal(state.executionMode, executionMode);
report.executionMode = state.executionMode; report.hostPid = state.hostPid;
page.on('pageerror', () => report.errors.push('page-error'));
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
const notices = async () => (await device.shell('cmd notification list')).toString().split('\n')
  .filter(line => line.includes(`|${pkg}|`) && line.includes('dshm.remote.notice.'));
const pid = async () => (await device.shell(`pidof ${pkg}`)).toString().trim();
async function nodes() {
  await device.shell('uiautomator dump /data/local/tmp/latest-notice.xml');
  const xml = (await device.shell('cat /data/local/tmp/latest-notice.xml')).toString();
  return [...xml.matchAll(/<node\s+([^>]+)>/g)].map(match => Object.fromEntries(
    [...match[1].matchAll(/([\w-]+)="([^"]*)"/g)].map(item => [item[1], item[2]])));
}
async function tap(node) {
  assert.ok(node); const [a, b, c, d] = node.bounds.match(/\d+/g).map(Number);
  await device.shell(`input tap ${Math.floor((a + c) / 2)} ${Math.floor((b + d) / 2)}`);
}
let seed;
try {
  if (executionMode === 'source') {
    assert.equal(state.command, 'pnpm dsh web');
    const { verifyInstalledSource } = await import('../../plugin/compatibility/latest-upstream/source-host.mjs');
    const installed = await verifyInstalledSource(); assert.equal(installed.sourceCommit, state.sourceCommit);
    report.sourceCommit = installed.sourceCommit; report.sourceFiles = installed.files;
  }
  if (phase === 'start') {
    const options = page.getByRole('dialog', { name: 'Remote 选项', exact: true });
    if (await options.count()) await options.getByRole('button', { name: '关闭窗口', exact: true }).click();
    const before = await readSession(); assert.equal(before.row.running, false);
    assert.equal((await main.getByRole('textbox', { name: '消息', exact: true }).innerText()).trim(), '');
    assert.equal((await notices()).length, 0);
    await main.getByRole('button', { name: 'Remote 选项', exact: true }).click();
    await page.getByRole('button', { name: 'Remote 提醒', exact: true }).click();
    const settings = await nodes();
    assert.ok(settings.some(row => row.text === 'Remote 提醒 · 已连接'));
    assert.ok(settings.some(row => row.text === '任务完成' && row.checked === 'true'));
    assert.ok(settings.some(row => row.text === '系统通知设置'));
    await tap(settings.find(row => row.text === '完成'));
    await options.getByRole('button', { name: '关闭窗口', exact: true }).click();
    seed = { at: new Date().toISOString(), home: state.home, sessionId: session.sessionId,
      title: session.title, marker: 'DSHM_LATEST_NOTICE_' + randomUUID().replaceAll('-', '').slice(0, 12),
      initialSeq: before.projections.asOfSeq, pid: await pid(), settingsUnchanged: true };
    assert.match(seed.pid, /^\d+$/);
    // 先记录尝试再点击；检查阶段只观察，不自动重发未知结果的请求。
    await writeFile(seedPath, JSON.stringify(seed, null, 2), { flag: 'wx' });
    await main.getByRole('textbox', { name: '消息', exact: true }).fill(
      `这是 DSHM 新版后台通知验收，不调用任何工具。回复第一行只写 ${seed.marker}，随后用约150字介绍白云。`);
    seed.attempted = true; await writeFile(seedPath, JSON.stringify(seed, null, 2));
    await main.getByRole('button', { name: '发送消息', exact: true }).click();
    await device.shell('input keyevent KEYCODE_HOME');
    seed.backgroundAt = new Date().toISOString(); seed.sent = true;
    await writeFile(seedPath, JSON.stringify(seed, null, 2));
    assert.equal(await pid(), seed.pid);
    report.backgroundRetainedProcess = true;
    const until = Date.now() + 45000;
    while (!(await notices()).length && Date.now() < until) await delay(300);
    report.notificationCount = (await notices()).length;
    assert.equal(report.notificationCount, 1);
    const original = await readSession(); assert.equal(original.row.running, false);
    const records = original.records.filter(item => item.event.seq > seed.initialSeq);
    assert.equal(records.filter(item => item.event.type === 'tool/call').length, 0);
    report.originalReplyContainsMarker = records.some(item => item.event.type === 'assistant/message'
      && JSON.stringify(item.event.data).includes(seed.marker));
    assert.equal(report.originalReplyContainsMarker, true);
    await device.shell('cmd statusbar expand-notifications');
    const shade = await nodes();
    const title = shade.find(row => row.text === seed.title);
    const body = shade.find(row => row.text.includes(seed.marker));
    assert.ok(title); assert.ok(body); assert.match(body.text, /电脑任务已完成/);
    report.noticeTitle = title.text; report.noticeBody = body.text;
    assert.equal(await pid(), seed.pid); await capture(prefix + '-shade');
    seed.readyToClick = true; await writeFile(seedPath, JSON.stringify(seed, null, 2));
    report.passed = true;
  } else {
    seed = JSON.parse(await readFile(seedPath, 'utf8'));
    assert.equal(seed.home, state.home); assert.equal(seed.sessionId, session.sessionId);
    assert.equal(seed.readyToClick, true); assert.equal(seed.clicked, undefined);
    assert.equal(await pid(), seed.pid); assert.equal((await notices()).length, 1);
    await device.shell('cmd statusbar expand-notifications');
    const title = (await nodes()).find(row => row.text === seed.title); assert.ok(title);
    seed.clickAttempted = true; await writeFile(seedPath, JSON.stringify(seed, null, 2));
    await tap(title);
    await main.locator('.remote-heading strong').getByText(seed.title, { exact: true }).waitFor();
    await main.getByRole('article', { name: '模型回复', exact: true }).filter({ hasText: seed.marker }).waitFor();
    const original = await readSession(); assert.equal(original.row.running, false);
    assert.equal((await main.getByRole('textbox', { name: '消息', exact: true }).innerText()).trim(), '');
    assert.equal((await notices()).length, 0); assert.equal(await pid(), seed.pid);
    await capture(prefix + '-opened');
    seed.clicked = true; await writeFile(seedPath, JSON.stringify(seed, null, 2));
    report.originalSessionAndReplyOpened = true; report.notificationConsumed = true;
    report.sameProcess = true; report.passed = true;
  }
  assert.deepEqual(report.errors, []);
} catch (error) {
  report.passed = false;
  report.failure = { name: error.name, code: error.code ?? 'validation_failed',
    location: error.stack?.split('\n').find(line => line.includes('verify-latest-live-notification-android.mjs:'))?.trim() };
  process.exitCode = 1;
} finally {
  await writeFile(resolve(runtime, prefix + '-android-' + phase + '.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report)); await device.close();
}
// 已收取原结果后结束Windows调试连接的空闲句柄；不操作App进程。
setTimeout(() => process.exit(process.exitCode ?? 0), 200);
