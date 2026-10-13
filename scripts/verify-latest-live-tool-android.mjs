// 专用新版工作区的真实模型 write 审批；只决定该文件的一次工具调用。
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile, writeFile, realpath } from 'node:fs/promises';
import { resolve, relative, dirname } from 'node:path';
import { _android } from 'playwright';
import { androidAppWebView } from './android-app-webview.mjs';
import { openLatestLiveAndroid } from '../tests/support/latest-live-context.mjs';

const phase = process.argv[2]; assert.ok(['start', 'observe'].includes(phase));
const outcome = process.argv[3] ?? 'allow'; assert.ok(['allow', 'reject'].includes(outcome));
const sourceMode = process.argv[4] === 'source';
assert.ok(process.argv[4] === undefined || sourceMode); assert.ok(process.argv.length <= 5);
const prefix = (sourceMode ? 'latest-live-source-tool' : 'latest-live-tool') + (outcome === 'reject' ? '-reject' : '');
const runtime = resolve(import.meta.dirname, '../../plugin/artifacts/latest-runtime-check');
const state = JSON.parse(await readFile(resolve(runtime, 'latest-live-state.json'), 'utf8'));
const session = JSON.parse(await readFile(resolve(runtime, 'latest-live-android-session.json'), 'utf8'));
const modelEvidence = JSON.parse(await readFile(resolve(runtime, 'latest-live-model-android.json'), 'utf8'));
assert.equal(modelEvidence.passed, true); assert.equal(modelEvidence.inferenceVerified, true);
assert.equal(modelEvidence.home, state.home); assert.equal(modelEvidence.sessionId, session.sessionId);
assert.equal(state.target, '0.2.1-alpha.1'); assert.equal(state.ready, true);
const homeName = relative(resolve(runtime, 'live-homes'), state.home);
assert.match(homeName, /^[0-9a-f-]{36}$/);
assert.equal(await realpath(state.home), resolve(await realpath(resolve(runtime, 'live-homes')), homeName));
assert.equal(await realpath(state.workspacePath), resolve(await realpath(state.home), 'test-project'));
assert.equal(session.home, state.home);
const seedPath = resolve(runtime, prefix + '-seed.json');
const reportPath = resolve(runtime, prefix + '-android.json');
assert.equal(process.env.DSHM_ANDROID_SERIAL, 'emulator-5554');
const live = sourceMode ? await openLatestLiveAndroid(undefined, { openRecorded: true }) : undefined;
const device = live?.device ?? (await _android.devices({ omitDriverInstall: true })).find(item => item.serial() === process.env.DSHM_ANDROID_SERIAL);
assert.ok(device);
const report = { at: new Date().toISOString(), phase, outcome, sessionId: session.sessionId,
  inferenceVerified: true, passed: false, approvals: [], executionMode: state.executionMode ?? 'release', hostPid: state.hostPid };
let page, seed;
try {
  if (sourceMode) {
    assert.equal(state.executionMode, 'source'); assert.equal(state.command, 'pnpm dsh web');
    assert.equal(live.state.hostPid, state.hostPid);
    const { verifyInstalledSource } = await import('../../plugin/compatibility/latest-upstream/source-host.mjs');
    const installed = await verifyInstalledSource(); assert.equal(installed.sourceCommit, state.sourceCommit);
    report.sourceCommit = installed.sourceCommit; report.sourceFiles = installed.files;
    page = live.page;
  } else {
    const first = await (await androidAppWebView(device, 'dev.dshmobile.validation.latesttest')).page();
    page = first.context().pages().find(item => item.url().startsWith('https://remote.dshm.invalid/'));
  }
  assert.ok(page); page.setDefaultTimeout(30000);
  const main = page.getByTestId('remote-workspace');
  assert.equal(await main.locator('.remote-heading strong').innerText(), session.title);
  assert.equal(await main.evaluate(element => {
    const key = Object.keys(element).find(name => name.startsWith('__reactFiber$'));
    for (let fiber = element[key]; fiber; fiber = fiber.return)
      if (fiber.memoizedProps?.model?.client) return fiber.memoizedProps.model.getSnapshot().selected;
    throw Error('latest_tool_session_missing');
  }), session.sessionId);
  const editor = main.getByRole('textbox', { name: '消息', exact: true });
  const permissions = page.getByRole('dialog', { name: '会话权限', exact: true });
  const openPermissions = async () => {
    if (!await permissions.isVisible()) {
      await main.getByRole('button', { name: 'Remote 选项', exact: true }).click();
      await page.getByRole('button', { name: '会话权限', exact: true }).click();
    }
  };
  if (phase === 'start') {
    assert.equal(await main.getByRole('button', { name: '停止生成', exact: true }).count(), 0);
    assert.equal((await editor.innerText()).trim(), '');
    await openPermissions();
    await permissions.getByText('当前权限：工作区内修改', { exact: true }).waitFor();
    seed = { at: new Date().toISOString(), home: state.home, sessionId: session.sessionId,
      fileName: 'dshm-latest-write-' + randomUUID() + '.txt', before: 'DSHM_BEFORE',
      after: 'DSHM_LATEST_WRITE_' + randomUUID().replaceAll('-', ''), originalPermission: '工作区内修改', outcome };
    if (sourceMode) seed.initialSeq = (await live.readSession()).projections.asOfSeq;
    await writeFile(seedPath, JSON.stringify(seed, null, 2), { flag: 'wx' });
    await writeFile(resolve(state.workspacePath, seed.fileName), seed.before, { flag: 'wx' });
    await permissions.getByRole('button', { name: '仅可查看', exact: true }).click();
    await permissions.getByText('当前权限：仅可查看', { exact: true }).waitFor();
    await permissions.getByRole('button', { name: '关闭窗口', exact: true }).click();
    await editor.fill(`这是 DSHM 新版真实工具和审批验收。只执行本条消息，不要补做之前的测试请求。仅使用 write 工具把当前工作区文件 ${seed.fileName} 的内容替换为 ${seed.after}。可以读取该文件；不要执行命令、修改其他文件或权限。当前仅可查看，请正常申请本次写入的单次批准并等待。完成只回复 DSHM_LATEST_WRITE_DONE；如果审批被拒绝，请立即停止，不重试，也不用其他工具或路径绕过，并只回复 DSHM_LATEST_WRITE_REJECTED。`);
    seed.attempted = true; await writeFile(seedPath, JSON.stringify(seed, null, 2));
    await main.getByRole('button', { name: '发送消息', exact: true }).click();
    seed.sent = true; await writeFile(seedPath, JSON.stringify(seed, null, 2));
  } else {
    seed = JSON.parse(await readFile(seedPath, 'utf8'));
    assert.equal(seed.home, state.home); assert.equal(seed.sessionId, session.sessionId);
    assert.equal(seed.sent, true);
    assert.equal(seed.outcome ?? 'allow', outcome);
  }
  assert.match(seed.fileName, /^dshm-latest-write-[0-9a-f-]{36}\.txt$/);
  const path = resolve(state.workspacePath, seed.fileName); assert.equal(dirname(path), resolve(state.workspacePath));
  report.fileName = seed.fileName;
  const pending = page.locator('[data-approval-key]');
  if (!seed.answered) {
    assert.notEqual(seed.answerAttempted, true, 'Previous approval outcome must be inspected before retry');
    await pending.waitFor({ timeout: 180000 });
    assert.equal(await pending.count(), 1);
    // 新版共享布局把工具正文放入详情窗口；不把空的摘要容器当成 write 正文。
    const details = page.getByRole('dialog', { name: '工具详情', exact: true });
    if (!await details.isVisible()) await main.getByRole('button', { name: '工具详情', exact: true }).last().click();
    await details.getByText('write · 执行中', { exact: true }).waitFor();
    await details.getByRole('button', { name: '打开文件：' + seed.fileName, exact: true }).waitFor();
    assert.ok((await details.innerText()).includes(seed.after));
    await writeFile(resolve(runtime, prefix + '-diff.png'), await device.screenshot());
    await details.getByRole('button', { name: '关闭工具详情', exact: true }).click();
    assert.equal(await readFile(path, 'utf8'), seed.before);
    const text = await pending.innerText(); assert.match(text, /write|写入/i);
    report.approvals.push({ text, callId: await main.locator('[data-chat-call-id]').last().getAttribute('data-chat-call-id') });
    await writeFile(resolve(runtime, prefix + '-pending.png'), await device.screenshot());
    seed.callIdsBeforeDecision = await main.locator('[data-chat-call-id]').evaluateAll(elements => elements.map(element => element.getAttribute('data-chat-call-id')));
    seed.approval = report.approvals[0]; seed.answerAttempted = true;
    await writeFile(seedPath, JSON.stringify(seed, null, 2));
    await pending.getByRole('button', { name: outcome === 'allow' ? '允许一次' : '拒绝', exact: true }).click();
    seed.answered = true; await writeFile(seedPath, JSON.stringify(seed, null, 2));
    await pending.waitFor({ state: 'detached' });
  }
  await main.getByRole('article', { name: '模型回复', exact: true }).filter({ hasText: outcome === 'allow' ? 'DSHM_LATEST_WRITE_DONE' : 'DSHM_LATEST_WRITE_REJECTED' })
    .waitFor({ timeout: 180000 });
  await main.getByRole('button', { name: '停止生成', exact: true }).waitFor({ state: 'hidden', timeout: 180000 });
  assert.equal((await readFile(path, 'utf8')).trim(), outcome === 'allow' ? seed.after : seed.before);
  if (outcome === 'reject') {
    assert.deepEqual(await main.locator('[data-chat-call-id]').evaluateAll(elements => elements.map(element => element.getAttribute('data-chat-call-id'))), seed.callIdsBeforeDecision);
    assert.equal(await pending.count(), 0);
    report.rejectedWithoutWrite = true; report.noToolRetry = true;
  }
  assert.ok(seed.approval); report.approvals = [seed.approval];
  if (sourceMode) {
    const original = await live.readSession(); assert.equal(original.row.running, false);
    assert.equal(original.projections.values.permissions.currentValue, 'read-only');
    const calls = original.records.filter(item => item.event.type === 'tool/call' && item.event.seq > seed.initialSeq);
    assert.ok(calls.length); assert.ok(calls.every(item => ['read', 'write'].includes(item.event.data.name)));
    for (const { event } of calls) {
      const args = JSON.parse(event.data.arguments); assert.equal(resolve(state.workspacePath, args.file_path), path);
      if (event.data.name === 'write') assert.equal(args.content.trim(), seed.after);
    }
    const escalated = calls.filter(item => item.event.data.name === 'write'
      && JSON.parse(item.event.data.arguments).sandbox_permissions === 'workspace-write');
    assert.equal(escalated.length, 1); assert.equal(escalated[0].event.data.callId, seed.approval.callId);
    const results = original.records.filter(item => item.event.type === 'tool/result'
      && item.event.data.message.toolCallId === escalated[0].event.data.callId);
    assert.equal(results.length, 1); assert.equal(results[0].event.data.message.isError, outcome === 'reject');
    if (outcome === 'reject') assert.ok(JSON.stringify(results[0].event.data).includes('user rejected escalating'));
    report.originalCallIds = calls.map(item => item.event.data.callId); report.originalDecisionVerified = true;
  }
  await openPermissions();
  await permissions.getByText('当前权限：仅可查看', { exact: true }).waitFor();
  await permissions.getByRole('button', { name: seed.originalPermission, exact: true }).click();
  await permissions.getByText('当前权限：' + seed.originalPermission, { exact: true }).waitFor();
  await permissions.getByRole('button', { name: '关闭窗口', exact: true }).click();
  if (sourceMode) {
    assert.equal((await live.readSession()).projections.values.permissions.currentValue, 'workspace-write');
    await writeFile(path, seed.before); assert.equal(await readFile(path, 'utf8'), seed.before); report.testFileRestored = true;
  }
  if (outcome === 'allow') report.actualWriteVerified = true;
  report.permissionRestored = true; report.passed = true;
  await writeFile(resolve(runtime, prefix + '-complete.png'), await device.screenshot());
} catch (error) {
  report.failure = { name: error.name, code: error.code ?? 'validation_failed',
    location: error.stack?.split('\n').find(line => line.includes('verify-latest-live-tool-android.mjs:'))?.trim() };
  process.exitCode = 1;
} finally {
  await writeFile(reportPath, JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ passed: report.passed, actualWriteVerified: report.actualWriteVerified,
    rejectedWithoutWrite: report.rejectedWithoutWrite, noToolRetry: report.noToolRetry,
    permissionRestored: report.permissionRestored, failure: report.failure }));
  await device.close();
}
process.exit(process.exitCode ?? 0);
