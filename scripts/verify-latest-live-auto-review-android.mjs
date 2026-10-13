// 原模型发起工具、原 Auto review 审核；仅观察并从正式手机入口取消。
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { access, readFile, writeFile, unlink } from 'node:fs/promises';
import { resolve, dirname, basename } from 'node:path';
import { openLatestLiveAndroid } from '../tests/support/latest-live-context.mjs';

const phase = process.argv[2];
assert.ok(['start-cancel', 'inspect', 'resume', 'resume-observe', 'cleanup', 'failed-cleanup', 'unloaded'].includes(phase));
const run = process.argv[3]; if (run !== undefined) assert.match(run, /^retry-[1-9][0-9]?$/);
assert.ok([3, 4].includes(process.argv.length));
const live = await openLatestLiveAndroid(undefined, { openRecorded: true });
const { runtime, state, session, device, page, main, capture, readSession } = live;
const prefix = 'latest-live-' + (state.executionMode === 'source' ? 'source-' : '') + 'auto-review' + (run ? '-' + run : '');
const seedPath = resolve(runtime, prefix + '-seed.json');
const reportPath = resolve(runtime, prefix + '-android-' + phase + '.json');
const controlPath = resolve(state.home, 'latest-auto-review-control.json');
const hostPath = resolve(state.home, 'latest-auto-review-host.json');
const report = { at: new Date().toISOString(), phase, home: state.home, hostPid: state.hostPid,
  executionMode: state.executionMode, command: state.command, sessionId: session.sessionId, passed: false, errors: [] };
const delay = ms => new Promise(done => setTimeout(done, ms));
let seed;
const persist = () => writeFile(seedPath, JSON.stringify(seed, null, 2));
const host = () => readFile(hostPath, 'utf8').then(JSON.parse).catch(error => { if (error.code === 'ENOENT') return null; throw error; });
const input = main.getByRole('textbox', { name: '消息', exact: true });
const stop = main.getByRole('button', { name: '停止生成', exact: true });
const heading = main.locator('.remote-heading strong');
async function until(check, timeout = 30000) {
  const end = Date.now() + timeout;
  while (!await check()) { assert.ok(Date.now() < end, 'latest_auto_condition_missing'); await delay(100); }
}
async function permissions() {
  const existing = page.getByRole('dialog', { name: '会话权限', exact: true });
  if (await existing.isVisible()) return existing;
  await main.getByRole('button', { name: 'Remote 选项', exact: true }).click();
  await page.getByRole('button', { name: '会话权限', exact: true }).click(); return existing;
}
function eventsAfter(original) { return original.records.map(row => row.event).filter(event => event.seq > seed.initialSeq); }
function verifyCancelled(original) {
  assert.equal(original.row.running, false);
  const events = eventsAfter(original);
  const users = events.filter(event => event.type === 'user/message');
  assert.equal(users.filter(event => JSON.stringify(event.data).includes(seed.prompt)).length, 1);
  const calls = events.filter(event => event.type === 'tool/call');
  const results = events.filter(event => event.type === 'tool/result');
  assert.equal(calls.length, 1); assert.equal(results.length, 1);
  assert.equal(calls[0].data.name, 'read'); assert.ok(JSON.stringify(calls[0].data).includes(seed.marker));
  assert.equal(results[0].data.message.toolCallId, calls[0].data.callId);
  assert.equal(results[0].data.error.code, 'ABORTED_BEFORE_DISPATCH');
  assert.equal(results[0].data.message.isError, true);
  const ended = events.filter(event => event.type === 'turn/end');
  assert.ok(ended.some(event => event.data.reason.kind === 'aborted'));
  return { callId: calls[0].data.callId, callSeq: calls[0].seq, resultSeq: results[0].seq,
    errorCode: results[0].data.error.code, asOfSeq: original.projections.asOfSeq };
}
async function verifyVisible(callId = seed.original?.callId) {
  assert.ok(callId);
  await main.locator(`[data-chat-call-id="${callId}"]`).getByText('已取消，工具尚未执行', { exact: true }).waitFor();
  assert.equal(await main.getByText('Auto review 已拒绝', { exact: true }).count(), 0);
  assert.equal(await stop.count(), 0); assert.equal((await input.innerText()).trim(), '');
}
async function verifyHost() {
  const originalHost = await host(); assert.ok(originalHost);
  assert.equal(originalHost.marker, seed.marker); assert.equal(originalHost.sessionId, seed.sessionId);
  assert.equal(originalHost.reviews.length, 1); assert.equal(originalHost.calls.length, 0);
  assert.equal(originalHost.reviews[0].started, true); assert.equal(originalHost.reviews[0].aborted, true);
  assert.equal(originalHost.reviews[0].ended, true);
  assert.equal(await readFile(seed.path, 'utf8'), 'BEFORE_' + seed.marker); return originalHost;
}
page.on('pageerror', () => report.errors.push('page-error'));
try {
  await assert.rejects(access(reportPath), { code: 'ENOENT' });
  assert.ok(['release', 'source'].includes(state.executionMode));
  if (phase !== 'unloaded') assert.equal(state.autoReviewDiagnostic, true);
  if (state.executionMode === 'source') {
    assert.equal(state.command, 'pnpm dsh web');
    const installed = await (await import('../../plugin/compatibility/latest-upstream/source-host.mjs')).verifyInstalledSource();
    assert.equal(installed.sourceCommit, state.sourceCommit); report.sourceCommit = installed.sourceCommit;
  } else {
    assert.equal(state.command, 'node dsh/lib/bin.js web');
    const pkg = JSON.parse(await readFile(resolve(runtime, 'node_modules/@deepseek-ai/dsh/package.json'), 'utf8'));
    assert.equal(pkg.name, '@deepseek-ai/dsh'); assert.equal(pkg.version, '0.2.1-alpha.1'); report.releasePackageVerified = true;
  }
  if (phase === 'start-cancel') {
    for (const path of [seedPath, controlPath, hostPath]) await assert.rejects(access(path), { code: 'ENOENT' });
    const before = await readSession(); assert.equal(before.row.running, false);
    assert.equal(before.projections.values.permissions.currentValue, 'workspace-write');
    assert.equal((await input.innerText()).trim(), '');
    const marker = 'DSHM_LATEST_AUTO_' + randomUUID().replaceAll('-', '');
    seed = { at: new Date().toISOString(), home: state.home, sessionId: session.sessionId, title: session.title,
      permission: before.projections.values.permissions.currentValue, initialSeq: before.projections.asOfSeq,
      path: resolve(state.workspacePath, marker + '.txt'), marker, attempted: false };
    seed.prompt = `这是 DSHM 新版自动审核取消测试。只执行当前这条请求，不补做此前任何任务。只调用一次 read 工具读取专用文件 ${basename(seed.path)}，不要调用其他工具，不修改文件，不执行命令。若工具被取消则停止，不重试。读取完成后只回复 ${marker}_READ_DONE。`;
    await writeFile(seedPath, JSON.stringify(seed, null, 2), { flag: 'wx' });
    await writeFile(seed.path, 'BEFORE_' + marker, { flag: 'wx' });
    await writeFile(controlPath, JSON.stringify({ marker, sessionId: session.sessionId }), { flag: 'wx' });
    const panel = await permissions(); await panel.getByRole('button', { name: 'Auto review', exact: true }).click();
    const confirm = panel.getByRole('group', { name: '确认启用 Auto review（实验）？', exact: true });
    assert.equal(await confirm.getByRole('button', { name: '启用 Auto review', exact: true }).isEnabled(), false);
    await confirm.getByRole('checkbox').check();
    await confirm.getByRole('button', { name: '启用 Auto review', exact: true }).click();
    await panel.getByText('当前权限：Auto review', { exact: true }).waitFor();
    seed.autoSelected = true; await persist(); report.confirmationRequired = true;
    await panel.getByRole('button', { name: '关闭窗口', exact: true }).click();
    assert.equal((await readSession()).projections.values.permissions.currentValue, 'auto');
    await input.fill(seed.prompt); seed.attempted = true; await persist();
    await main.getByRole('button', { name: '发送消息', exact: true }).click(); seed.sent = true; await persist();
    await until(async () => (await host())?.reviews.some(row => row.started && !row.ended), 45000);
    seed.cancelAttempted = true; await persist();
    await stop.click(); report.mobileStopClicked = true;
    await stop.waitFor({ state: 'hidden', timeout: 20000 });
    await until(async () => (await host())?.reviews.some(row => row.aborted && row.ended), 10000);
    report.host = await verifyHost(); report.original = verifyCancelled(await readSession());
    await verifyVisible(report.original.callId); seed.cancelled = true; seed.original = report.original; await persist();
  } else {
    seed = JSON.parse(await readFile(seedPath, 'utf8'));
    assert.equal(seed.home, state.home); assert.equal(seed.sessionId, session.sessionId);
    assert.equal(dirname(seed.path), resolve(state.workspacePath)); assert.equal(basename(seed.path), seed.marker + '.txt');
    assert.equal(await heading.innerText(), seed.title);
    if (phase === 'failed-cleanup') {
      const failed = JSON.parse(await readFile(resolve(runtime, prefix + '-android-start-cancel.json'), 'utf8'));
      assert.equal(failed.passed, false); assert.equal(failed.confirmationRequired, true);
      assert.equal(seed.sent, true);
      const original = await readSession(); assert.equal(original.row.running, false);
      const events = eventsAfter(original);
      const observed = await host(); assert.deepEqual(observed.calls, []);
      if (seed.cancelAttempted === undefined) {
        assert.equal(events.filter(event => ['tool/call', 'tool/result'].includes(event.type)).length, 0);
        assert.ok(events.some(event => event.type === 'turn/end' && event.data.reason.error?.code === 'REQUEST_EXTENSION'));
        assert.deepEqual(observed.reviews, []);
        report.originalFailure = { asOfSeq: original.projections.asOfSeq, code: 'REQUEST_EXTENSION', toolCalls: 0 };
      } else {
        assert.equal(failed.mobileStopClicked, true); assert.equal(observed.reviews.length, 1);
        assert.equal(observed.reviews[0].aborted, true); assert.equal(observed.reviews[0].ended, true);
        const calls = events.filter(event => event.type === 'tool/call'), results = events.filter(event => event.type === 'tool/result');
        assert.equal(calls.length, 2); assert.equal(results.length, 2);
        assert.ok(calls.every(event => event.data.name === 'read' && /DSHM_LATEST_AUTO_[a-f0-9]{32}\.txt/.test(event.data.arguments)));
        assert.equal(results[0].data.error, undefined); assert.equal(results[1].data.error.code, 'ABORTED_BEFORE_DISPATCH');
        assert.ok(results[0].data.message.content[0].text.includes('reviewer ended with aborted ABORTED'));
        report.originalFailure = { asOfSeq: original.projections.asOfSeq, firstCall: calls[0].data.callId,
          untypedCancelledReview: true, pendingCall: calls[1].data.callId, pendingCode: results[1].data.error.code };
      }
      const panel = await permissions(); await panel.getByRole('button', { name: '工作区内修改', exact: true }).click();
      await panel.getByText('当前权限：工作区内修改', { exact: true }).waitFor();
      await panel.getByRole('button', { name: '关闭窗口', exact: true }).click();
      await until(async () => { const value = await host(); return value?.current === seed.permission && value.autoSessions === 0; });
      report.host = await host();
      assert.equal(await readFile(seed.path, 'utf8'), 'BEFORE_' + seed.marker);
      assert.deepEqual(JSON.parse(await readFile(controlPath, 'utf8')), { marker: seed.marker, sessionId: seed.sessionId });
      await writeFile(resolve(runtime, prefix + '-host-failed-final.json'), JSON.stringify(report.host, null, 2), { flag: 'wx' });
      await unlink(controlPath); await delay(500); await unlink(hostPath); await unlink(seed.path);
      assert.equal((await readSession()).projections.values.permissions.currentValue, seed.permission);
      seed.failedCleaned = true; await persist(); report.failurePreserved = true;
    } else if (phase === 'inspect') {
      assert.equal(seed.cancelled, true);
      await main.locator('.remote-topbar').getByRole('button', { name: '返回', exact: true }).click();
      await main.locator('.remote-session-row').filter({ hasText: seed.title }).click();
      report.historyReopened = true; report.original = verifyCancelled(await readSession());
      assert.deepEqual(report.original, seed.original); report.host = await verifyHost(); await verifyVisible();
      seed.inspected = true; await persist();
    } else if (phase === 'resume') {
      assert.equal(seed.inspected, true); assert.equal(seed.resumeAttempted, undefined);
      assert.equal(await stop.count(), 0); assert.equal((await input.innerText()).trim(), '');
      seed.resumeReply = 'DSHM_LATEST_AFTER_AUTO_' + seed.marker.slice(-32);
      seed.resumePrompt = '取消验证已完成，不需要任何工具。请只回复 ' + seed.resumeReply + '。';
      await input.fill(seed.resumePrompt); seed.resumeAttempted = true; await persist();
      await main.getByRole('button', { name: '发送消息', exact: true }).click(); seed.resumeSent = true; await persist(); report.sent = true;
    } else if (phase === 'resume-observe') {
      assert.equal(seed.resumeSent, true);
      await main.getByRole('article', { name: '模型回复' }).filter({ hasText: seed.resumeReply }).waitFor({ timeout: 45000 });
      await stop.waitFor({ state: 'hidden' });
      const original = await readSession(); report.original = verifyCancelled(original);
      const events = eventsAfter(original);
      assert.equal(events.filter(event => event.type === 'user/message' && JSON.stringify(event.data).includes(seed.resumePrompt)).length, 1);
      assert.ok(events.some(event => event.type === 'assistant/message' && JSON.stringify(event.data).includes(seed.resumeReply)));
      report.host = await verifyHost(); await verifyVisible(); seed.resumed = true; await persist();
    } else if (phase === 'cleanup') {
      assert.equal(seed.resumed, true); assert.equal(await stop.count(), 0);
      const panel = await permissions(); await panel.getByRole('button', { name: '工作区内修改', exact: true }).click();
      await panel.getByText('当前权限：工作区内修改', { exact: true }).waitFor();
      await panel.getByRole('button', { name: '关闭窗口', exact: true }).click();
      assert.equal((await readSession()).projections.values.permissions.currentValue, seed.permission);
      await until(async () => { const value = await host(); return value?.current === seed.permission && value.autoSessions === 0; });
      report.host = await verifyHost(); report.original = verifyCancelled(await readSession()); await verifyVisible();
      const control = JSON.parse(await readFile(controlPath, 'utf8'));
      assert.deepEqual(control, { marker: seed.marker, sessionId: seed.sessionId });
      await writeFile(resolve(runtime, prefix + '-host-final.json'), JSON.stringify(report.host, null, 2), { flag: 'wx' });
      await unlink(controlPath); await delay(500); await unlink(hostPath); await unlink(seed.path);
      seed.cleaned = true; await persist(); report.controlsRemoved = true;
    } else {
      assert.equal(seed.cleaned, true); assert.equal(state.autoReviewDiagnostic, false);
      for (const path of [controlPath, hostPath, seed.path]) await assert.rejects(access(path), { code: 'ENOENT' });
      const panel = await permissions(); await panel.getByText('当前权限：工作区内修改', { exact: true }).waitFor();
      await panel.getByRole('button', { name: 'Auto review', exact: true }).waitFor({ state: 'hidden' });
      await panel.getByRole('button', { name: '关闭窗口', exact: true }).click();
      assert.equal((await readSession()).projections.values.permissions.currentValue, seed.permission);
      report.original = verifyCancelled(await readSession()); await verifyVisible(); report.optionRemoved = true;
    }
  }
  await capture(prefix + '-' + phase); assert.deepEqual(report.errors, []); report.passed = true;
} catch (error) { report.failure = error.stack; process.exitCode = 1; }
finally {
  await writeFile(reportPath, JSON.stringify(report, null, 2), { flag: 'wx' });
  console.log(JSON.stringify(report)); await device.close();
}
setTimeout(() => process.exit(process.exitCode ?? 0), 200);
