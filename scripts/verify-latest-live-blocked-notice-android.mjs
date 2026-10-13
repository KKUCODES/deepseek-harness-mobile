// 原 pre-step 拒绝产生真实 blocked 结算；不构造事件、不调用或替换模型。
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { access, readFile, writeFile, unlink } from 'node:fs/promises';
import { resolve } from 'node:path';
import { openLatestLiveAndroid } from '../tests/support/latest-live-context.mjs';

const phase = process.argv[2]; assert.ok(['start', 'inspect', 'inspect-state', 'inspect-state-verified', 'inspect-state-layout', 'recover-inspect', 'audit'].includes(phase)); assert.equal(process.argv.length, 3);
const live = await openLatestLiveAndroid(undefined, { openRecorded: phase !== 'inspect' });
const { runtime, state, session, main, page, device, capture, readSession } = live;
assert.ok(['source', 'release'].includes(state.executionMode));
const prefix = 'latest-live-' + (state.executionMode === 'source' ? 'source-' : '') + 'blocked-notice';
const seedPath = resolve(runtime, prefix + '-seed.json');
const reportPath = resolve(runtime, prefix + '-android-' + phase + '.json');
const control = resolve(state.home, 'latest-blocked-control.json');
const hostReport = resolve(state.home, 'latest-blocked-host.json');
const pkg = 'dev.dshmobile.validation.latesttest';
const report = { at: new Date().toISOString(), phase, home: state.home, hostPid: state.hostPid,
  sessionId: session.sessionId, executionMode: state.executionMode, command: state.command, passed: false, errors: [] };
const delay = ms => new Promise(done => setTimeout(done, ms));
const pid = async () => (await device.shell(`pidof ${pkg}`)).toString().trim();
const notices = async () => (await device.shell('cmd notification list')).toString().split('\n')
  .filter(line => line.includes(`|${pkg}|`) && line.includes('dshm.remote.notice.'));
async function until(check, timeout = 30000) {
  const end = Date.now() + timeout;
  while (!await check()) { assert.ok(Date.now() < end, 'blocked_notice_condition_missing'); await delay(100); }
}
async function nodes() {
  await device.shell('uiautomator dump /data/local/tmp/latest-blocked-notice.xml');
  const xml = (await device.shell('cat /data/local/tmp/latest-blocked-notice.xml')).toString();
  return [...xml.matchAll(/<node\s+([^>]+)>/g)].map(match => Object.fromEntries(
    [...match[1].matchAll(/([\w-]+)="([^"]*)"/g)].map(item => [item[1], item[2]])));
}
async function tap(node) {
  assert.ok(node); const [a, b, c, d] = node.bounds.match(/\d+/g).map(Number);
  await device.shell(`input tap ${Math.floor((a + c) / 2)} ${Math.floor((b + d) / 2)}`);
}
function originalBlocked(original, seed) {
  assert.equal(original.row.running, false);
  const events = original.records.filter(item => item.event.seq > seed.initialSeq).map(item => item.event);
  assert.equal(events.filter(event => ['user/message', 'assistant/message', 'tool/call', 'tool/result', 'step/start'].includes(event.type)).length, 0);
  const blocked = events.filter(event => event.type === 'turn/end' && event.data.reason.kind === 'blocked');
  assert.equal(blocked.length, 1); return blocked[0];
}
let seed;
page.on('pageerror', () => report.errors.push('page-error'));
try {
  await assert.rejects(access(reportPath), { code: 'ENOENT' }); assert.equal(state.blockedDiagnostic, true);
  if (state.executionMode === 'source') {
    assert.equal(state.command, 'pnpm dsh web');
    const { verifyInstalledSource } = await import('../../plugin/compatibility/latest-upstream/source-host.mjs');
    const installed = await verifyInstalledSource(); assert.equal(installed.sourceCommit, state.sourceCommit);
    report.sourceCommit = installed.sourceCommit; report.sourceFiles = installed.files;
  } else {
    assert.equal(state.command, 'node dsh/lib/bin.js web');
    const release = JSON.parse(await readFile(resolve(runtime, 'node_modules/@deepseek-ai/dsh/package.json'), 'utf8'));
    const candidate = JSON.parse(await readFile(resolve(runtime, 'candidate/package.json'), 'utf8'));
    assert.equal(release.name, '@deepseek-ai/dsh'); assert.equal(release.version, '0.2.1-alpha.1');
    assert.equal(candidate.name, '@dsh-mobile/plugin'); assert.equal(candidate.version, '0.1.76-latest.0');
    report.releasePackageVerified = true;
  }
  if (phase === 'start') {
    for (const path of [seedPath, control, hostReport]) await assert.rejects(access(path), { code: 'ENOENT' });
    const before = await readSession(); assert.equal(before.row.running, false);
    assert.equal((await main.getByRole('textbox', { name: '消息', exact: true }).innerText()).trim(), '');
    assert.equal((await notices()).length, 0);
    await main.getByRole('button', { name: 'Remote 选项', exact: true }).click();
    await page.getByRole('button', { name: 'Remote 提醒', exact: true }).click();
    const settings = await nodes();
    assert.ok(settings.some(row => row.text === 'Remote 提醒 · 已连接'));
    assert.ok(settings.some(row => row.text === '执行失败或受阻' && row.checked === 'true'));
    await tap(settings.find(row => row.text === '完成'));
    await page.getByRole('dialog', { name: 'Remote 选项', exact: true }).getByRole('button', { name: '关闭窗口', exact: true }).click();
    seed = { at: new Date().toISOString(), home: state.home, sessionId: session.sessionId, title: session.title,
      initialSeq: before.projections.asOfSeq, initialBlockedCount: await main.locator('[data-turn-blocked]').count(),
      pid: await pid(), permission: before.projections.values.permissions.currentValue,
      marker: 'DSHM_LATEST_BLOCK_' + randomUUID().replaceAll('-', ''), settingsUnchanged: true };
    assert.match(seed.pid, /^\d+$/); await writeFile(seedPath, JSON.stringify(seed, null, 2), { flag: 'wx' });
    await writeFile(control, JSON.stringify({ marker: seed.marker, sessionId: seed.sessionId, release: false }), { flag: 'wx' });
    await main.getByRole('textbox', { name: '消息', exact: true }).fill(seed.marker);
    seed.attempted = true; await writeFile(seedPath, JSON.stringify(seed, null, 2));
    await main.getByRole('button', { name: '发送消息', exact: true }).click(); seed.sent = true;
    await writeFile(seedPath, JSON.stringify(seed, null, 2));
    await until(async () => {
      const host = await readFile(hostReport, 'utf8').then(JSON.parse).catch(error => { if (error.code === 'ENOENT') return null; throw error; });
      return host?.marker === seed.marker && host.sessionId === seed.sessionId && host.entered === true;
    });
    await device.shell('input keyevent KEYCODE_HOME');
    await writeFile(control, JSON.stringify({ marker: seed.marker, sessionId: seed.sessionId, release: true }));
    await until(async () => (await notices()).length === 1);
    const original = await readSession(); const event = originalBlocked(original, seed);
    const host = JSON.parse(await readFile(hostReport, 'utf8')); assert.equal(host.marker, seed.marker);
    assert.equal(host.sessionId, seed.sessionId); assert.equal(host.rejected, true); assert.equal(host.timedOut, undefined);
    assert.equal(original.projections.values.permissions.currentValue, seed.permission);
    seed.blockedSeq = event.seq; seed.settledSeq = original.projections.asOfSeq; seed.readyToClick = true;
    await device.shell('cmd statusbar expand-notifications'); const shade = await nodes();
    assert.ok(shade.some(row => row.text === seed.title));
    const body = shade.find(row => row.text.includes('电脑任务受阻，请打开查看')); assert.ok(body);
    await writeFile(seedPath, JSON.stringify(seed, null, 2)); await capture(prefix + '-shade');
    report.host = host; report.originalBlockedSeq = event.seq; report.noticeTitle = seed.title; report.noticeBody = body.text;
    report.notificationCount = 1;
  } else if (phase.startsWith('inspect-state')) {
    seed = JSON.parse(await readFile(seedPath, 'utf8'));
    assert.equal(seed.home, state.home); assert.equal(seed.sessionId, session.sessionId);
    const original = await readSession(); report.originalBlockedSeq = originalBlocked(original, seed).seq;
    report.actualBlockedText = await main.locator('[data-turn-blocked]').allTextContents();
    report.actualBlockedInnerText = await main.locator('[data-turn-blocked]').last().innerText();
    report.blockedLayout = await main.locator('[data-turn-blocked]').last().evaluate(element => {
      const parents = [];
      for (let parent = element; parent && parent !== document.body; parent = parent.parentElement) {
        if (parent.hasAttribute('hidden') || parent.hasAttribute('data-chat-flow-kind')) parents.push({
          kind: parent.getAttribute('data-chat-flow-kind'), hidden: parent.getAttribute('hidden'),
          processMember: parent.getAttribute('data-turn-process-member'), processHidden: parent.getAttribute('data-turn-process-hidden'),
        });
      }
      const turn = element.getAttribute('data-turn-blocked');
      const summary = document.querySelector(`button[data-turn-process="${turn}"]`);
      return { parents, summary: summary?.innerText ?? null };
    });
    report.actualEditorText = await main.getByRole('textbox', { name: '消息', exact: true }).innerText();
    report.currentSeq = original.projections.asOfSeq; report.expectedSeq = seed.settledSeq;
    report.currentPermission = original.projections.values.permissions.currentValue; report.expectedPermission = seed.permission;
    report.noticeCount = (await notices()).length; report.diagnosticOnly = true;
  } else {
    seed = JSON.parse(await readFile(seedPath, 'utf8')); assert.equal(seed.home, state.home); assert.equal(seed.sessionId, session.sessionId);
    if (phase === 'recover-inspect' && await pid() !== seed.pid) {
      const apk = JSON.parse(await readFile(resolve(import.meta.dirname, '../artifacts/latest-live-draft-receipt-apk-blocked.json'), 'utf8'));
      assert.equal(apk.passed, true); assert.equal(apk.applicationId, pkg);
      assert.equal(apk.webMatchesBuild, true); assert.equal(apk.installedMatchesApk, true);
      assert.match(apk.sha256, /^[a-f0-9]{64}$/);
      const failed = JSON.parse(await readFile(resolve(runtime, prefix + '-android-inspect.json'), 'utf8'));
      assert.equal(failed.passed, false); assert.equal(failed.nativeNotificationClicked, true);
      seed.beforeUpgradePid = seed.pid; seed.pid = await pid(); assert.match(seed.pid, /^\d+$/);
      seed.upgradedApk = apk.sha256; await writeFile(seedPath, JSON.stringify(seed, null, 2));
      report.upgradeVerified = { previousPid: seed.beforeUpgradePid, currentPid: seed.pid, sha256: seed.upgradedApk };
    }
    assert.equal(seed.readyToClick, true); assert.equal(await pid(), seed.pid);
    if (phase === 'inspect') {
      const started = JSON.parse(await readFile(resolve(runtime, prefix + '-android-start.json'), 'utf8')); assert.equal(started.passed, true);
      assert.equal((await notices()).length, 1); await device.shell('cmd statusbar expand-notifications');
      await tap((await nodes()).find(row => row.text === seed.title)); report.nativeNotificationClicked = true;
    } else if (phase === 'recover-inspect') {
      const failed = JSON.parse(await readFile(resolve(runtime, prefix + '-android-inspect.json'), 'utf8'));
      assert.equal(failed.passed, false); assert.equal(failed.nativeNotificationClicked, true);
      assert.equal((await notices()).length, 0); report.originalNotificationClickPreserved = true;
    } else {
      const name = seed.recoveredInspect ? 'recover-inspect' : 'inspect';
      const inspected = JSON.parse(await readFile(resolve(runtime, prefix + '-android-' + name + '.json'), 'utf8')); assert.equal(inspected.passed, true);
      assert.equal(seed.cleaned, true);
      await main.locator('.remote-topbar').getByRole('button', { name: '返回', exact: true }).click();
      await main.locator('.remote-session-row').filter({ hasText: seed.title }).click(); report.historyReopened = true;
    }
    await main.locator('.remote-heading strong').getByText(seed.title, { exact: true }).waitFor();
    await until(async () => await main.locator('[data-turn-blocked]').count() === seed.initialBlockedCount + 1);
    assert.equal(await main.locator('[data-turn-blocked]').last().innerText(), '本轮任务受阻，未继续执行。');
    const blockedTurn = await main.locator('[data-turn-blocked]').last().getAttribute('data-turn-blocked');
    assert.equal(await main.locator(`button[data-turn-process="${blockedTurn}"]`).count(), 0);
    const original = await readSession(); assert.equal(originalBlocked(original, seed).seq, seed.blockedSeq);
    assert.equal(original.projections.asOfSeq, seed.settledSeq); assert.equal(original.projections.values.permissions.currentValue, seed.permission);
    assert.equal((await main.getByRole('textbox', { name: '消息', exact: true }).innerText()).trim(), '');
    assert.equal((await notices()).length, 0); assert.equal(await page.locator('iframe').count(), 0);
    if (phase === 'inspect' || phase === 'recover-inspect') {
      const config = JSON.parse(await readFile(control, 'utf8')); assert.equal(config.marker, seed.marker); assert.equal(config.sessionId, seed.sessionId);
      const host = JSON.parse(await readFile(hostReport, 'utf8')); assert.equal(host.marker, seed.marker); assert.equal(host.rejected, true);
      await unlink(control); await unlink(hostReport); seed.cleaned = true; seed.recoveredInspect = phase === 'recover-inspect';
      await writeFile(seedPath, JSON.stringify(seed, null, 2));
    }
    for (const path of [control, hostReport]) await assert.rejects(access(path), { code: 'ENOENT' });
    await capture(prefix + '-' + phase); report.originalBlockedSeq = seed.blockedSeq; report.controlsRemoved = true;
  }
  assert.equal(await pid(), seed.pid); assert.deepEqual(report.errors, []); report.sameProcess = true; report.passed = !phase.startsWith('inspect-state');
} catch (error) {
  report.failure = { name: error.name, code: error.code, message: error.message?.split('\n')[0], expected: error.expected, actual: error.actual,
    location: error.stack?.split('\n').find(line => line.includes('verify-latest-live-blocked-notice-android.mjs:'))?.trim() }; process.exitCode = 1;
} finally {
  await writeFile(reportPath, JSON.stringify(report, null, 2), { flag: 'wx' }); console.log(JSON.stringify(report)); await device.close();
}
setTimeout(() => process.exit(process.exitCode ?? 0), 200);
