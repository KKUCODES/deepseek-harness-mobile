// 真实子模型执行有界只读命令，手机通过原父子地址停止；不替代模型或写入历史。
import assert from 'node:assert/strict';
import { randomUUID, createHash } from 'node:crypto';
import { access, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { openLatestLiveAndroid } from '../tests/support/latest-live-context.mjs';

const phase = process.argv[2], mode = process.argv[3] ?? 'release';
assert.ok(['start', 'stop', 'rescue-stop', 'recover-stop', 'failure-cleanup', 'inspect-details', 'inspect-details-scoped', 'observe', 'replay', 'observe-output', 'replay-output', 'observe-status', 'replay-status', 'resume', 'resume-observe', 'cleanup'].includes(phase));
const scenario = process.argv[4] ?? 'initial';
assert.ok(['release', 'source'].includes(mode)); assert.ok(['initial', 'readonly', 'readonly-scoped', 'readonly-retained'].includes(scenario)); assert.ok(process.argv.length <= 5);
const readOnly = scenario !== 'initial';
const runtime = resolve(import.meta.dirname, '../../plugin/artifacts/latest-runtime-check');
const prefix = 'latest-live-' + mode + '-child-stop' + (readOnly ? '-' + scenario : '');
const seedPath = resolve(runtime, prefix + '-seed.json');
const reportPath = resolve(runtime, prefix + '-android-' + phase + '.json');
await assert.rejects(access(reportPath), { code: 'ENOENT' });
let seed = phase === 'start' ? undefined : JSON.parse(await readFile(seedPath, 'utf8'));
const live = await openLatestLiveAndroid(undefined, phase === 'start' || phase === 'cleanup' || phase === 'failure-cleanup'
  ? { openRecorded: true } : { expectedChildId: seed.childId });
const { state, session, main, page, device, readSession, readChild, capture } = live;
const report = { at: new Date().toISOString(), phase, scenario, executionMode: state.executionMode,
  parentSessionId: session.sessionId, hostPid: state.hostPid, passed: false, errors: [] };
const input = main.getByRole('textbox', { name: '消息', exact: true });
const stop = main.getByRole('button', { name: '停止生成', exact: true });
const details = page.getByRole('dialog', { name: '命令详情', exact: true });
const persist = () => writeFile(seedPath, JSON.stringify(seed, null, 2));
const pause = () => new Promise(done => setTimeout(done, 150));
const digest = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const alive = pid => { assert.ok(Number.isSafeInteger(pid) && pid > 0); try { process.kill(pid, 0); return true; }
  catch (error) { if (error.code === 'ESRCH') return false; throw error; } };
const selected = () => main.evaluate(element => {
  const key = Object.keys(element).find(name => name.startsWith('__reactFiber$'));
  for (let fiber = element[key]; fiber; fiber = fiber.return) {
    const model = fiber.memoizedProps?.model;
    if (model?.client && model.getSnapshot) {
      const state = model.getSnapshot(); return { id: state.selected, running: state.session?.running,
        openState: state.session?.openState, draft: state.drafts[state.selected] };
    }
  }
  throw Error('latest_child_stop_model_missing');
});
async function openChild() {
  await main.getByRole('button', { name: 'Remote 选项', exact: true }).click();
  await page.getByRole('button', { name: '子会话', exact: true }).click();
  const panel = page.getByRole('dialog', { name: '子会话', exact: true });
  const button = panel.getByRole('button', { name: new RegExp(seed.label) });
  assert.equal(await button.count(), 1); await button.click();
  await main.getByRole('button', { name: '返回父会话', exact: true }).waitFor();
  assert.equal((await selected()).id, seed.childId);
}
async function permission(label) {
  await main.getByRole('button', { name: 'Remote 选项', exact: true }).click();
  await page.getByRole('button', { name: '会话权限', exact: true }).click();
  const panel = page.getByRole('dialog', { name: '会话权限', exact: true });
  await panel.getByRole('button', { name: label, exact: true }).click();
  await panel.getByText('当前权限：' + label, { exact: true }).waitFor();
  await panel.getByRole('button', { name: '关闭窗口', exact: true }).click();
}
function auditChild(current) {
  assert.equal(current.entry.mode, 'continuable'); assert.equal(current.entry.label, seed.label);
  const events = current.records.map(row => row.event);
  assert.ok(events.some(event => event.type === 'approval/policy'
    && event.data.policy === 'never' && event.data.source === 'delegation'));
  const all = events.filter(event => event.type === 'tool/call');
  assert.ok(all.every(event => ['pwsh', 'send_message'].includes(event.data.name)));
  for (const event of all.filter(event => event.data.name === 'send_message'))
    assert.equal(JSON.parse(event.data.arguments).agent_id, session.sessionId);
  const calls = all.filter(event => event.data.name === 'pwsh');
  assert.equal(calls.length, 1);
  if (readOnly) assert.ok(events.some(event => event.type === 'sandbox/mode'
    && event.data.mode === 'read-only' && event.data.source === 'delegation'));
  const args = JSON.parse(calls[0].data.arguments);
  assert.equal(args.command, seed.command); assert.equal(args.run_in_background, false);
  assert.equal(args.timeoutMs, 120000); return { events, callId: calls[0].data.callId };
}
async function openCommandDialog() {
  assert.match(seed.callId, /^[A-Za-z0-9_:-]+$/);
  const nodeKey = await main.evaluate((element, callId) => {
    const key = Object.keys(element).find(name => name.startsWith('__reactFiber$'));
    for (let fiber = element[key]; fiber; fiber = fiber.return) {
      const model = fiber.memoizedProps?.model;
      if (model?.client && model.getSnapshot) {
        const nodes = [...model.getSnapshot().conversation.nodes.values()]
          .filter(node => node.kind === 'tool-call' && node.data.root.callId === callId);
        if (nodes.length !== 1) throw Error('original_command_node_not_unique');
        return nodes[0].key;
      }
    }
    throw Error('original_command_node_missing');
  }, seed.callId);
  const seat = main.locator('[data-chat-node-key]').filter({ has: page.locator(`[data-chat-call-id="${seed.callId}"]`) });
  assert.equal(await seat.getAttribute('data-chat-node-key'), nodeKey);
  if (!await seat.getByRole('button', { name: '工具详情', exact: true }).isVisible()) {
    const turn = main.getByRole('button', { name: /用时|已停止/ }).last();
    assert.equal(await turn.getAttribute('aria-expanded'), 'false'); await turn.click();
  }
  await seat.getByRole('button', { name: '工具详情', exact: true }).click();
  await details.waitFor();
}
async function observeCommand() {
  await openCommandDialog();
  const output = details.getByLabel('独立命令输出', { exact: true });
  await output.filter({ hasText: 'DSHM_CHILD_PID=' }).waitFor({ timeout: 15000 });
  const value = await output.innerText(); assert.ok(value.includes('中文🍀' + seed.marker));
  seed.pid = Number(value.match(/DSHM_CHILD_PID=(\d+)/)?.[1]); assert.equal(alive(seed.pid), true);
  assert.equal((await selected()).running, true); seed.processObservedAlive = true; await persist();
  await capture(prefix + '-running'); await details.getByRole('button', { name: '关闭命令详情', exact: true }).click();
  report.pid = seed.pid; report.actualLiveOutput = true;
}
page.on('pageerror', () => report.errors.push('page-error'));
try {
  assert.equal(state.executionMode, mode); assert.equal(state.autoReviewDiagnostic, false);
  if (scenario === 'readonly-retained') {
    assert.equal(state.reviewCandidate, 'candidate-package-check-1xqe3A');
    report.reviewCandidate = state.reviewCandidate;
  }
  if (mode === 'source') {
    assert.equal(state.command, 'pnpm dsh web');
    const installed = await (await import('../../plugin/compatibility/latest-upstream/source-host.mjs')).verifyInstalledSource();
    assert.equal(installed.sourceCommit, state.sourceCommit); report.sourceFiles = installed.files;
  }
  if (phase === 'start') {
    await assert.rejects(access(seedPath), { code: 'ENOENT' });
    const before = await readSession(); assert.equal(before.row.running, false);
    assert.equal(before.projections.values.permissions.currentValue, 'workspace-write');
    assert.equal((await input.innerText()).trim(), '');
    const marker = 'DSHM_CHILD_STOP_' + randomUUID().replaceAll('-', '');
    seed = { home: state.home, parentId: session.sessionId, initialSeq: before.projections.asOfSeq,
      marker, label: 'DSHM 子任务停止 ' + marker.slice(-8), finish: marker + '_UNEXPECTED_END' };
    seed.command = `Write-Output '中文🍀${marker}'; Write-Output "DSHM_CHILD_PID=$PID"; Start-Sleep -Seconds 90; Write-Output '${seed.finish}'`;
    const args = { description: seed.label, run_in_background: true,
      prompt: `这是专用 DSHM 子任务停止验收。只调用一次 pwsh，command 必须逐字为：${seed.command}。timeoutMs=120000，run_in_background=false。不要读写文件、联网、提权、创建子任务或重试。除原系统要求的 send_message 回报父会话之外，不调用其他工具。等待手机停止。如果被停止，不要补做或重试。` };
    seed.prompt = `这是新的独立 DSHM 子任务停止验收，不补做此前任务。只调用一次 subagent，参数严格为 ${JSON.stringify(args)}。不要调用其他工具、读写文件、执行命令、联网或创建其他子任务。创建后只回复 ${marker}_PARENT_READY；收到子任务结算通知后也不要调用工具。`;
    await writeFile(seedPath, JSON.stringify(seed, null, 2), { flag: 'wx' });
    if (readOnly) {
      seed.permissionChangeAttempted = true; await persist(); await permission('仅可查看');
      assert.equal((await readSession()).projections.values.permissions.currentValue, 'read-only');
      seed.parentReadOnly = true; await persist();
    }
    seed.attempted = true; await persist(); await input.fill(seed.prompt);
    await main.getByRole('button', { name: '发送消息', exact: true }).click(); seed.sent = true; await persist();
    const until = Date.now() + 60000; let parent;
    do {
      parent = await readSession(); const entries = parent.projections.values.subagentCatalog?.filter(item => item.label === seed.label) ?? [];
      if (entries.length) { assert.equal(entries.length, 1); seed.childId = entries[0].id; break; }
      assert.ok(Date.now() < until, 'latest_child_stop_original_catalog_missing'); await pause();
    } while (true);
    const calls = parent.records.map(row => row.event).filter(event => event.seq > seed.initialSeq && event.type === 'tool/call');
    assert.equal(calls.length, 1); assert.equal(calls[0].data.name, 'subagent');
    assert.deepEqual(JSON.parse(calls[0].data.arguments), args); seed.parentCallId = calls[0].data.callId; await persist();
    await openChild();
    const untilCall = Date.now() + 45000; let child;
    do { child = await readChild(seed.childId); if (child.records.some(row => row.event.type === 'tool/call')) break;
      assert.ok(Date.now() < untilCall, 'latest_child_stop_real_command_missing'); await pause(); } while (true);
    seed.callId = auditChild(child).callId; await persist();
    await observeCommand(); report.childId = seed.childId;
    assert.equal(alive(seed.pid), true); assert.equal((await selected()).running, true);
    seed.stopAttempted = true; await persist(); await stop.click(); seed.stopped = true; await persist(); report.stopSent = true;
  } else {
    assert.equal(seed.home, state.home); assert.equal(seed.parentId, session.sessionId); assert.equal(seed.sent, true);
    report.childId = seed.childId;
    if (phase === 'failure-cleanup') {
      assert.equal(seed.parentReadOnly, true); assert.equal((await selected()).id, session.sessionId);
      assert.equal((await readSession()).row.running, false);
      await permission('工作区内修改');
      assert.equal((await readSession()).projections.values.permissions.currentValue, 'workspace-write');
      assert.equal((await input.innerText()).trim(), ''); report.permissionRestored = true;
    } else if (phase === 'inspect-details' || phase === 'inspect-details-scoped') {
      auditChild(await readChild(seed.childId)); await openCommandDialog();
      const complete = details.locator('summary').filter({ hasText: '完整命令' });
      if (await complete.count()) await complete.click();
      assert.ok((await details.innerText()).includes(seed.command));
      await capture(prefix + '-details'); await details.getByRole('button', { name: '关闭命令详情', exact: true }).click();
      report.originalCommandDetailsOpened = true;
    } else if (phase === 'stop' || phase === 'rescue-stop' || phase === 'recover-stop') {
      if (phase === 'recover-stop') { auditChild(await readChild(seed.childId)); await observeCommand(); }
      if (phase === 'rescue-stop') {
        // 仅接收操作者已核验的本轮真实进程；救援只停止，不重发未知请求。
        assert.match(process.env.DSHM_OBSERVED_CHILD_PID ?? '', /^\d+$/);
        seed.pid = Number(process.env.DSHM_OBSERVED_CHILD_PID);
        auditChild(await readChild(seed.childId));
        assert.equal(alive(seed.pid), true); seed.processObservedAlive = true; await persist();
      }
      assert.equal(seed.processObservedAlive, true); assert.equal(seed.stopAttempted, undefined);
      assert.equal((await selected()).running, true); assert.equal(alive(seed.pid), true);
      seed.stopAttempted = true; await persist(); await stop.click(); seed.stopped = true; await persist(); report.stopSent = true;
    } else if (['observe', 'replay', 'observe-output', 'replay-output', 'observe-status', 'replay-status'].includes(phase)) {
      const replay = phase.startsWith('replay');
      assert.equal(seed.stopped, true);
      if (replay) { await main.getByRole('button', { name: '返回父会话', exact: true }).click(); await openChild(); }
      await stop.waitFor({ state: 'hidden', timeout: 30000 });
      const child = await readChild(seed.childId), audit = auditChild(child);
      assert.equal(audit.callId, seed.callId); assert.equal(alive(seed.pid), false);
      const results = audit.events.filter(event => event.type === 'tool/result' && event.data.message.toolCallId === seed.callId); assert.equal(results.length, 1);
      assert.equal(results[0].data.message.toolCallId, seed.callId); assert.equal(results[0].data.error.code, 'ABORTED');
      assert.equal(results[0].data.message.isError, true);
      // 仅核对停止事实的阶段不掩盖独立输出失败；完整验收仍要求下面的原输出核对。
      if (!phase.endsWith('-status')) {
        // 原停止结果只记录 ABORTED；独立输出保留应另行核对，不伪造工具结果正文。
        await openCommandDialog();
        await details.getByRole('button', { name: '从头查看', exact: true }).click();
        const independent = details.getByLabel('独立命令输出', { exact: true });
        await independent.filter({ hasText: 'DSHM_CHILD_PID=' }).waitFor({ timeout: 15000 });
        const output = await independent.innerText();
        assert.ok(output.includes('中文🍀' + seed.marker)); assert.ok(!output.includes(seed.finish));
        assert.equal(Number(output.match(/DSHM_CHILD_PID=(\d+)/)?.[1]), seed.pid);
        await capture(prefix + '-' + phase + '-history-output');
        await details.getByRole('button', { name: '关闭命令详情', exact: true }).click();
      }
      assert.ok(audit.events.some(event => event.type === 'turn/end' && event.data.reason.kind === 'aborted'
        && event.data.reason.reason.kind === 'user'));
      assert.match(seed.callId, /^[A-Za-z0-9_:-]+$/);
      await main.locator(`[data-chat-call-id="${seed.callId}"] [data-tool="pwsh"][data-state="stopped"]`).waitFor();
      assert.equal((await input.innerText()).trim(), '');
      const hashes = child.records.map(row => ({ seq: row.event.seq, hash: digest(row.event) }));
      if (replay) assert.deepEqual(hashes, seed.stoppedHashes);
      else { seed.stoppedHashes = hashes; seed.stoppedSeq = child.projections.asOfSeq; seed.observed = true; await persist(); }
      report.processGone = true; report.originalAborted = true;
      report.partialOutputRetained = phase.endsWith('-status') ? false : true;
      report.fullAcceptancePassed = !phase.endsWith('-status'); report.noRetry = true;
      await capture(prefix + '-' + phase);
    } else if (phase === 'resume') {
      assert.equal(seed.observed, true); assert.equal(seed.resumeAttempted, undefined);
      seed.resumeSeq = (await readChild(seed.childId)).projections.asOfSeq; seed.reply = seed.marker + '_RESUMED';
      seed.resumePrompt = `停止验收已结束，不补做或重试那条命令。不调用任何工具，只回复 ${seed.reply}。`;
      assert.equal((await input.innerText()).trim(), ''); seed.resumeAttempted = true; await persist();
      await input.fill(seed.resumePrompt); await main.getByRole('button', { name: '发送消息', exact: true }).click();
      seed.resumeSent = true; await persist(); report.resumeSent = true;
    } else if (phase === 'resume-observe') {
      assert.equal(seed.resumeSent, true);
      await main.getByRole('article', { name: '模型回复', exact: true }).filter({ hasText: seed.reply }).last().waitFor({ timeout: 90000 });
      await stop.waitFor({ state: 'hidden', timeout: 15000 }); const child = await readChild(seed.childId);
      const added = child.records.map(row => row.event).filter(event => event.seq > seed.resumeSeq);
      const users = added.filter(event => event.type === 'user/message' && event.data.content?.some(part => part.type === 'text' && part.text === seed.resumePrompt));
      assert.equal(users.length, 1); assert.equal(added.filter(event => event.type === 'tool/call').length, 0);
      assert.ok(added.some(event => event.type === 'turn/end' && event.data.reason.kind === 'completed'));
      assert.deepEqual(child.records.filter(row => row.event.seq <= seed.stoppedSeq).map(row => ({ seq: row.event.seq, hash: digest(row.event) })), seed.stoppedHashes);
      seed.resumed = true; await persist(); report.originalUserSeq = users[0].seq; report.originalUserSource = users[0].data.source;
      report.inferenceVerified = true; await capture(prefix + '-resumed');
    } else {
      assert.equal(seed.resumed, true); const parent = await readSession(); assert.equal(parent.row.running, false);
      if (readOnly) {
        assert.equal(parent.projections.values.permissions.currentValue, 'read-only');
        await permission('工作区内修改');
      }
      assert.equal((await readSession()).projections.values.permissions.currentValue, 'workspace-write');
      assert.equal((await selected()).id, session.sessionId); assert.equal((await input.innerText()).trim(), '');
      assert.equal(alive(seed.pid), false); assert.equal(await stop.count(), 0);
      const calls = parent.records.map(row => row.event).filter(event => event.type === 'tool/call' && event.seq > seed.initialSeq);
      assert.equal(calls.length, 1); assert.equal(calls[0].data.callId, seed.parentCallId);
      seed.cleaned = true; await persist(); report.retainedDedicatedHistory = true; report.permissionUnchanged = true;
      await capture(prefix + '-cleanup');
    }
  }
  assert.deepEqual(report.errors, []); assert.equal(await page.locator('iframe').count(), 0); report.passed = true;
} catch (error) { report.failure = error.stack; process.exitCode = 1; }
finally { await writeFile(reportPath, JSON.stringify(report, null, 2), { flag: 'wx' }); console.log(JSON.stringify(report)); await device.close(); }
setTimeout(() => process.exit(process.exitCode ?? 0), 200);
