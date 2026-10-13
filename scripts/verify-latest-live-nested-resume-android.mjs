// 原父任务恢复后手机直接续聊同一孙任务；所有消息单次提交，未知结果不得重发。
import assert from 'node:assert/strict';
import { randomUUID, createHash } from 'node:crypto';
import { access, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { openLatestLiveAndroid } from '../tests/support/latest-live-context.mjs';

const [phase, mode] = process.argv.slice(2);
assert.equal(process.argv.length, 4); assert.ok(['release', 'source'].includes(mode));
assert.ok(['prepare', 'hold-start', 'hold-observe', 'send', 'reply', 'stop', 'stop-observe', 'finish', 'settled', 'settled-recovery', 'replay', 'cleanup', 'restored'].includes(phase));
const live = await openLatestLiveAndroid(undefined, { openRecorded: true });
const { runtime, state, session, main, page, device, readSession, readChild, capture } = live;
const prefix = `latest-live-${mode}-nested-resume`, seedPath = resolve(runtime, prefix + '-seed.json');
const reportPath = resolve(runtime, prefix + '-android-' + phase + '.json');
const report = { at: new Date().toISOString(), phase, mode, hostPid: state.hostPid, command: state.command,
  parentId: session.sessionId, passed: false, errors: [] };
const pkg = 'dev.dshmobile.validation.latesttest';
const input = main.getByRole('textbox', { name: '消息', exact: true });
const delay = ms => new Promise(done => setTimeout(done, ms));
const text = event => (event.data.message?.content ?? event.data.content ?? []).filter(part => part.type === 'text').map(part => part.text).join('');
const hashes = value => value.records.map(({ event }) => ({ seq: event.seq,
  hash: createHash('sha256').update(JSON.stringify(event)).digest('hex') }));
const alive = pid => { assert.ok(Number.isSafeInteger(pid) && pid > 0); try { process.kill(pid, 0); return true; }
  catch (error) { if (error.code === 'ESRCH') return false; throw error; } };
const appPid = async () => (await device.shell(`pidof ${pkg}`)).toString().trim();
const selected = () => main.evaluate(element => {
  const key = Object.keys(element).find(name => name.startsWith('__reactFiber$'));
  for (let fiber = element[key]; fiber; fiber = fiber.return) if (fiber.memoizedProps?.model?.client) {
    const value = fiber.memoizedProps.model.getSnapshot();
    return { id: value.selected, running: value.session?.running, subagent: value.session?.subagent,
      target: value.selectedTarget, trail: value.selectionTrail };
  }
  return {};
});
let seed;
const persist = () => writeFile(seedPath, JSON.stringify(seed, null, 2));
function unchangedPrefix(value, before) {
  const map = new Map(hashes(value).map(row => [row.seq, row.hash]));
  for (const row of before) assert.equal(map.get(row.seq), row.hash, 'nested_resume_original_event_changed');
}
function identity(value, id, label) {
  assert.equal(value.entry.id, id); assert.equal(value.entry.label, label); assert.equal(value.entry.mode, 'continuable');
  assert.equal(value.records.length, value.projections.asOfSeq + 1);
  value.records.forEach((row, index) => assert.equal(row.event.seq, index));
  const events = value.records.map(row => row.event);
  assert.ok(events.some(event => event.type === 'sandbox/mode' && event.data.mode === 'read-only' && event.data.source === 'delegation'));
  assert.ok(events.some(event => event.type === 'approval/policy' && event.data.policy === 'never' && event.data.source === 'delegation'));
  return value;
}
async function middleRead() {
  const middle = identity(await readChild(seed.middleId), seed.middleId, seed.middleLabel);
  unchangedPrefix(middle, seed.initialMiddleHashes); return middle;
}
async function grandRead() {
  const grand = identity(await readChild(seed.grandId, { ancestors: [seed.middleId] }), seed.grandId, seed.grandLabel);
  unchangedPrefix(grand, seed.initialGrandHashes); return grand;
}
async function openChild(id, label) {
  await main.getByRole('button', { name: 'Remote 选项', exact: true }).click();
  await page.getByRole('button', { name: '子会话', exact: true }).click();
  await page.getByRole('dialog', { name: '子会话', exact: true }).getByRole('group', { name: label, exact: true })
    .getByRole('button').filter({ hasText: label }).click();
  await main.getByRole('button', { name: '返回父会话', exact: true }).waitFor();
  const deadline = Date.now() + 10000;
  while ((await selected()).id !== id) { assert.ok(Date.now() < deadline); await delay(100); }
}
async function openGrand() { await openChild(seed.middleId, seed.middleLabel); await openChild(seed.grandId, seed.grandLabel); }
async function back(id) {
  await main.getByRole('button', { name: '返回父会话', exact: true }).click();
  const deadline = Date.now() + 10000;
  while ((await selected()).id !== id) { assert.ok(Date.now() < deadline); await delay(100); }
  await input.waitFor();
}
async function rootIdle(after = -1) {
  const deadline = Date.now() + 90000;
  while (true) {
    const root = await readSession();
    if (!root.row.running && root.projections.asOfSeq > after) return await readSession({ allRecords: true });
    assert.ok(Date.now() < deadline, 'nested_resume_root_not_idle'); await delay(150);
  }
}
function auditHold(root, middle) {
  unchangedPrefix(root, seed.initialRootHashes);
  const rows = root.records.map(row => row.event).filter(event => event.seq > seed.hold.rootSeq);
  const users = rows.filter(event => event.type === 'user/message' && event.data.source?.kind === 'user');
  assert.equal(users.length, 1); assert.equal(text(users[0]), seed.hold.prompt);
  assert.match(users[0].data.source.rpcId, /^[a-f0-9-]{36}$/);
  const calls = rows.filter(event => event.type === 'tool/call'); assert.equal(calls.length, 1);
  assert.equal(calls[0].data.name, 'send_message'); assert.deepEqual(JSON.parse(calls[0].data.arguments), seed.hold.args);
  const result = rows.filter(event => event.type === 'tool/result' && event.data.message.toolCallId === calls[0].data.callId);
  assert.equal(result.length, 1); assert.equal(result[0].data.message.isError, false);
  const relay = middle.records.map(row => row.event).filter(event => event.seq > seed.initialMiddleSeq
    && event.type === 'user/message' && event.data.source?.kind === 'agent-message'
    && event.data.source.form === 'relay' && event.data.source.senderSessionId === seed.parentId
    && text(event) === `Agent ${seed.parentId} sent a message: ${seed.hold.args.message}`);
  assert.equal(relay.length, 1); report.rootRpcId = users[0].data.source.rpcId;
}
function holdCall(middle) {
  const calls = middle.records.map(row => row.event).filter(event => event.seq > seed.initialMiddleSeq && event.type === 'tool/call');
  const pwsh = calls.filter(event => event.data.name === 'pwsh'); assert.equal(pwsh.length, 1);
  const args = JSON.parse(pwsh[0].data.arguments);
  assert.equal(args.command, seed.command); assert.equal(args.timeoutMs, 210000); assert.equal(args.run_in_background, false);
  assert.equal(typeof args.description, 'string'); assert.ok(args.description.trim());
  assert.ok(Object.keys(args).every(key => ['command', 'timeoutMs', 'run_in_background', 'description'].includes(key)));
  assert.ok(calls.every(event => event.data.name === 'pwsh' || event.data.name === 'send_message'
    && JSON.parse(event.data.arguments).agent_id === seed.parentId));
  return pwsh[0];
}
page.on('pageerror', () => report.errors.push('page-error'));
try {
  await assert.rejects(access(reportPath), { code: 'ENOENT' }); assert.equal(state.executionMode, mode);
  assert.equal(state.subagentDepthDiagnostic, false); assert.equal(state.autoReviewDiagnostic, false);
  assert.equal(state.reviewCandidate, undefined);
  if (mode === 'source') {
    assert.equal(state.command, 'pnpm dsh web');
    const installed = await (await import('../../plugin/compatibility/latest-upstream/source-host.mjs')).verifyInstalledSource();
    assert.equal(installed.sourceCommit, state.sourceCommit); report.sourceFiles = installed.files;
  }
  if (phase === 'prepare') {
    await assert.rejects(access(seedPath), { code: 'ENOENT' });
    const previous = JSON.parse(await readFile(resolve(runtime, `latest-live-${mode}-nested-child-seed.json`), 'utf8'));
    assert.equal(previous.home, state.home); assert.equal(previous.parentId, session.sessionId);
    assert.equal(previous.cleaned, true); assert.equal(previous.parentUnavailableObserved, true);
    seed = { home: state.home, parentId: session.sessionId, middleId: previous.middleId, middleLabel: previous.middleLabel,
      grandId: previous.grandId, grandLabel: previous.grandLabel, appPid: await appPid(),
      marker: 'DSHM_NESTED_RESUME_' + randomUUID().replaceAll('-', '') };
    const root = await rootIdle(), middle = identity(await readChild(seed.middleId), seed.middleId, seed.middleLabel);
    const grand = identity(await readChild(seed.grandId, { ancestors: [seed.middleId] }), seed.grandId, seed.grandLabel);
    assert.equal(grand.parentSummary.agentAvailable, false); assert.deepEqual(hashes(grand), previous.finalGrandHashes);
    assert.equal(root.projections.values.permissions.currentValue, 'workspace-write'); assert.equal((await input.innerText()).trim(), '');
    seed.initialRootHashes = hashes(root); seed.initialMiddleHashes = hashes(middle); seed.initialGrandHashes = hashes(grand);
    seed.initialMiddleSeq = middle.projections.asOfSeq; assert.match(seed.appPid, /^[1-9]\d*$/);
    await writeFile(seedPath, JSON.stringify(seed, null, 2), { flag: 'wx' }); report.originalInactiveParent = true;
  } else if (phase === 'restored') {
    assert.equal(mode, 'release'); const root = await rootIdle();
    report.trees = [];
    for (const originalMode of ['release', 'source']) {
      seed = JSON.parse(await readFile(resolve(runtime, `latest-live-${originalMode}-nested-resume-seed.json`), 'utf8'));
      const cleanup = JSON.parse(await readFile(resolve(runtime, `latest-live-${originalMode}-nested-resume-android-cleanup.json`), 'utf8'));
      assert.equal(cleanup.passed, true); assert.equal(seed.cleaned, true); assert.equal(seed.home, state.home);
      assert.equal(seed.parentId, session.sessionId); unchangedPrefix(root, seed.finalRootHashes);
      unchangedPrefix(await middleRead(), seed.finalMiddleHashes); assert.deepEqual(hashes(await grandRead()), seed.finalGrandHashes);
      assert.equal(alive(seed.pid), false); assert.equal(await appPid(), seed.appPid);
      report.trees.push({ middleId: seed.middleId, grandId: seed.grandId, originalHistoryPreserved: true });
    }
    assert.equal(root.projections.values.permissions.currentValue, 'workspace-write'); assert.equal((await input.innerText()).trim(), '');
    const restored = JSON.parse(await readFile(resolve(import.meta.dirname, '../artifacts/latest-child-notice-main-apk-restore.json'), 'utf8'));
    assert.equal(restored.passed, true); const apk = (await device.shell(`pm path ${pkg}`)).toString().trim();
    assert.match(apk, /^package:\/data\/app\/[A-Za-z0-9_~.=/+-]+\/base\.apk$/);
    assert.equal((await device.shell(`sha256sum ${apk.slice(8)}`)).toString().split(/\s+/)[0], restored.originalSha256);
    report.originalApkUnchanged = true; report.parentRecords = root.records.length;
  } else {
    seed = JSON.parse(await readFile(seedPath, 'utf8')); assert.equal(seed.home, state.home);
    assert.equal(seed.parentId, session.sessionId); assert.equal(await appPid(), seed.appPid);
    if (phase === 'hold-start') {
      assert.equal(seed.hold, undefined); const root = await rootIdle();
      assert.equal((await selected()).id, seed.parentId); assert.equal((await input.innerText()).trim(), '');
      seed.command = `Write-Output '中文🍀${seed.marker}_PARENT_LIVE'; Write-Output "DSHM_PARENT_PID=$PID"; Start-Sleep -Seconds 180; Write-Output '${seed.marker}_PARENT_FINISH'`;
      const message = `这是DSHM专用父任务恢复验收。只调用一次pwsh，command逐字为：${seed.command}，timeoutMs=210000，run_in_background=false，description填简短说明。该命令仅打印标记与自身PID并等待，无文件、网络或环境修改。不要创建子任务或重试；收到子会话回报后只按系统要求send_message回报你的直接父会话并回复 ${seed.marker}_PARENT_SETTLED，不追加其他工具。`;
      const args = { agent_id: seed.middleId, message };
      seed.hold = { rootSeq: root.projections.asOfSeq, args, attempted: true,
        prompt: `这是DSHM专用父任务恢复验收。仅调用一次send_message，参数严格为 ${JSON.stringify(args)}；之后仅回复 ${seed.marker}_PARENT_RESTORED。不要调用其他工具、创建子任务、读写文件、执行命令、联网或重试；收到后续回报也不调用工具。` };
      await persist(); await input.fill(seed.hold.prompt); await main.getByRole('button', { name: '发送消息', exact: true }).click();
      seed.hold.sent = true; await persist(); report.rootMessageSentOnce = true;
    } else if (phase === 'hold-observe') {
      assert.equal(seed.hold.sent, true); const root = await rootIdle(seed.hold.rootSeq);
      const deadline = Date.now() + 45000; let middle, call;
      while (true) {
        middle = await middleRead();
        if (middle.records.some(row => row.event.seq > seed.initialMiddleSeq && row.event.type === 'tool/call' && row.event.data.name === 'pwsh')) {
          call = holdCall(middle); break;
        }
        assert.ok(Date.now() < deadline, 'nested_resume_real_parent_command_missing'); await delay(150);
      }
      auditHold(root, middle); seed.callId = call.data.callId; await persist();
      await openChild(seed.middleId, seed.middleLabel); assert.equal((await selected()).running, true);
      const seat = main.locator('[data-chat-node-key]').filter({ has: page.locator(`[data-chat-call-id="${seed.callId}"]`) });
      assert.equal(await seat.count(), 1); await seat.getByRole('button', { name: '工具详情', exact: true }).click();
      const dialog = page.getByRole('dialog', { name: '命令详情', exact: true });
      const output = dialog.getByLabel('独立命令输出', { exact: true });
      await output.filter({ hasText: seed.marker + '_PARENT_LIVE' }).waitFor({ timeout: 15000 });
      const value = await output.innerText(); assert.ok(value.includes('中文🍀' + seed.marker + '_PARENT_LIVE'));
      seed.pid = Number(value.match(/DSHM_PARENT_PID=(\d+)/)?.[1]); assert.equal(alive(seed.pid), true);
      const grand = await grandRead(); assert.equal(grand.parentSummary.agentAvailable, true);
      await capture(prefix + '-real-parent-output'); await dialog.getByRole('button', { name: '关闭命令详情', exact: true }).click();
      await back(seed.parentId); seed.hold.observed = true; await persist(); report.originalParentAvailable = true; report.pid = seed.pid;
    } else if (phase === 'send') {
      assert.equal(seed.hold.observed, true); assert.equal(seed.followup, undefined); assert.equal(alive(seed.pid), true);
      const grand = await grandRead(); assert.equal(grand.parentSummary.agentAvailable, true);
      seed.reply = seed.marker + '_PHONE_GRAND_OK中文🍀'; seed.rootDraft = seed.marker + '_ROOT_DRAFT';
      await input.fill(seed.rootDraft); await openGrand(); const value = await selected();
      assert.equal(value.target.parentSessionId, seed.middleId); assert.equal(value.target.childSessionId, seed.grandId);
      assert.equal(value.target.mode, 'continuable'); assert.equal(value.trail.length, 2); assert.equal(value.subagent.parentAvailable, true);
      assert.equal((await input.innerText()).trim(), '');
      seed.followup = { beforeSeq: grand.projections.asOfSeq, attempted: true,
        prompt: `这是DSHM手机直接续聊原两层子会话的验收。请只回复 ${seed.reply}。不要执行命令、读写文件、联网、创建子任务或重试；仅可按原系统要求send_message回报你的直接父会话。` };
      await persist(); await input.fill(seed.followup.prompt);
      const send = main.getByRole('button', { name: '发送消息', exact: true }); assert.equal(await send.isEnabled(), true);
      assert.equal(alive(seed.pid), true); await send.click(); seed.followup.sent = true; await persist();
      await back(seed.middleId); await back(seed.parentId); assert.equal((await input.innerText()).trim(), seed.rootDraft);
      await input.fill(''); report.directGrandMessageSentOnce = true; report.rootDraftPreserved = true;
    } else if (phase === 'reply') {
      assert.equal(seed.followup.sent, true); const deadline = Date.now() + 90000; let grand;
      while (true) {
        grand = await grandRead(); const rows = grand.records.map(row => row.event).filter(event => event.seq > seed.followup.beforeSeq);
        if (rows.some(event => event.type === 'assistant/message' && text(event).includes(seed.reply))
          && rows.some(event => event.type === 'turn/end' && event.data.reason.kind === 'completed')) break;
        assert.ok(Date.now() < deadline, 'nested_resume_actual_grand_reply_missing'); await delay(150);
      }
      const rows = grand.records.map(row => row.event).filter(event => event.seq > seed.followup.beforeSeq);
      const users = rows.filter(event => event.type === 'user/message' && event.data.source?.kind === 'user');
      assert.equal(users.length, 1); assert.equal(text(users[0]), seed.followup.prompt); assert.match(users[0].data.source.rpcId, /^[a-f0-9-]{36}$/);
      const calls = rows.filter(event => event.type === 'tool/call');
      assert.ok(calls.every(event => event.data.name === 'send_message' && JSON.parse(event.data.arguments).agent_id === seed.middleId));
      for (const call of calls) {
        const results = rows.filter(event => event.type === 'tool/result' && event.data.message.toolCallId === call.data.callId);
        assert.equal(results.length, 1); assert.equal(results[0].data.message.isError, false);
      }
      await openGrand(); await main.getByRole('article', { name: '模型回复', exact: true }).filter({ hasText: seed.reply }).last().waitFor();
      assert.equal((await selected()).running, false); await capture(prefix + '-actual-grand-reply');
      await back(seed.middleId); await back(seed.parentId);
      seed.followup.observed = true; seed.finalGrandHashes = hashes(grand); await persist();
      report.rpcId = users[0].data.source.rpcId; report.actualGrandReply = true; report.originalGrandRecords = grand.records.length;
    } else if (phase === 'stop') {
      assert.equal(seed.followup.observed, true); assert.equal(seed.stop, undefined);
      seed.stop = { processAliveBefore: alive(seed.pid), attempted: true }; await persist();
      if (seed.stop.processAliveBefore) {
        await openChild(seed.middleId, seed.middleLabel); assert.equal((await selected()).running, true);
        const stop = main.getByRole('button', { name: '停止生成', exact: true }); assert.equal(await stop.isEnabled(), true);
        await stop.click(); seed.stop.sent = true; await persist(); await back(seed.parentId);
      }
      report.phoneStopSent = seed.stop.sent === true;
    } else if (phase === 'stop-observe') {
      assert.equal(seed.stop.sent, true); assert.equal(alive(seed.pid), false);
      const middle = await middleRead(), grand = await grandRead();
      const events = middle.records.map(row => row.event);
      const result = events.filter(event => event.type === 'tool/result' && event.data.message.toolCallId === seed.callId);
      assert.equal(result.length, 1); assert.equal(result[0].data.message.isError, true);
      assert.equal(result[0].data.error.code, 'ABORTED');
      assert.ok(events.some(event => event.seq > result[0].seq && event.type === 'turn/end'
        && event.data.reason.kind === 'aborted' && event.data.reason.reason.kind === 'user'));
      assert.deepEqual(hashes(grand), seed.finalGrandHashes);
      const inbox = middle.projections.values.inbox;
      assert.equal(inbox['next-turn'].length, 0); assert.equal(inbox['next-step'].length, 2);
      assert.ok(inbox['next-step'].every(message => message.source.senderSessionId === seed.grandId
        && ['agent-message', 'subagent-settled'].includes(message.source.kind)));
      assert.equal(grand.parentSummary.agentAvailable, true);
      seed.stop.observed = true; await persist(); report.originalPendingReportsRetained = true;
    } else if (phase === 'finish') {
      assert.equal(seed.stop.observed, true); assert.equal(seed.finish, undefined); assert.equal(alive(seed.pid), false);
      const middle = await middleRead(); await openChild(seed.middleId, seed.middleLabel);
      assert.equal((await selected()).running, false); assert.equal((await input.innerText()).trim(), '');
      seed.finish = { beforeSeq: middle.projections.asOfSeq, attempted: true,
        prompt: `停止验收已结束。请处理已有子会话回报并收尾；不要补做、重试或执行任何命令，不读写文件、不联网、不创建子任务。仅可按原系统要求用send_message回报你的直接父会话，之后只回复 ${seed.marker}_PARENT_SETTLED。` };
      await persist(); await input.fill(seed.finish.prompt);
      await main.getByRole('button', { name: '发送消息', exact: true }).click(); seed.finish.sent = true; await persist();
      await back(seed.parentId); report.explicitFinishMessageSentOnce = true;
    } else if (phase === 'settled' || phase === 'settled-recovery') {
      assert.equal(seed.stop.attempted, true); const deadline = Date.now() + 90000; let middle, grand;
      assert.equal(seed.finish.sent, true);
      if (phase === 'settled-recovery') {
        const failed = JSON.parse(await readFile(resolve(runtime, prefix + '-android-settled.json'), 'utf8'));
        assert.equal(failed.passed, false); assert.equal(failed.hostPid, state.hostPid);
        assert.equal(failed.failure.name, 'AssertionError'); assert.equal(failed.failure.message, 'nested_resume_parent_not_settled');
        report.originalFailedExpectationRetained = true;
      }
      while (true) {
        middle = await middleRead(); grand = await grandRead();
        if (!alive(seed.pid) && grand.parentSummary.agentAvailable === false) break;
        assert.ok(Date.now() < deadline, 'nested_resume_parent_not_settled'); await delay(150);
      }
      assert.equal(holdCall(middle).data.callId, seed.callId);
      const results = middle.records.map(row => row.event).filter(event => event.type === 'tool/result' && event.data.message.toolCallId === seed.callId);
      assert.equal(results.length, 1);
      if (seed.stop.sent) { assert.equal(results[0].data.message.isError, true); assert.equal(results[0].data.error.code, 'ABORTED'); }
      const finishRows = middle.records.map(row => row.event).filter(event => event.seq > seed.finish.beforeSeq);
      const finishUsers = finishRows.filter(event => event.type === 'user/message' && event.data.source?.kind === 'user');
      assert.equal(finishUsers.length, 1); assert.equal(text(finishUsers[0]), seed.finish.prompt);
      assert.match(finishUsers[0].data.source.rpcId, /^[a-f0-9-]{36}$/);
      assert.ok(finishRows.some(event => event.type === 'assistant/message' && text(event).includes(seed.marker + '_PARENT_SETTLED')));
      assert.ok(finishRows.some(event => event.type === 'turn/end' && event.data.reason.kind === 'completed'));
      assert.equal(middle.projections.values.inbox['next-step'].length, 0);
      assert.equal(middle.projections.values.inbox['next-turn'].length, 0);
      for (const call of finishRows.filter(event => event.type === 'tool/call')) {
        assert.equal(call.data.name, 'send_message'); assert.equal(JSON.parse(call.data.arguments).agent_id, seed.parentId);
        const result = finishRows.filter(event => event.type === 'tool/result' && event.data.message.toolCallId === call.data.callId);
        assert.equal(result.length, 1); assert.equal(result[0].data.message.isError, false);
      }
      assert.deepEqual(hashes(grand), seed.finalGrandHashes);
      const root = await rootIdle(seed.hold.rootSeq); auditHold(root, middle);
      seed.settled = true; await persist(); report.actualParentProcessExited = true; report.originalParentReleased = true;
      report.explicitFinishRpcId = finishUsers[0].data.source.rpcId;
    } else if (phase === 'replay' || phase === 'cleanup') {
      assert.equal(seed.settled, true); assert.equal(alive(seed.pid), false);
      const grand = await grandRead(); assert.deepEqual(hashes(grand), seed.finalGrandHashes);
      const middle = await middleRead(), root = await rootIdle(seed.hold.rootSeq); auditHold(root, middle);
      if (phase === 'replay') {
        await openGrand(); await main.getByRole('article', { name: '模型回复', exact: true }).filter({ hasText: seed.reply }).last().waitFor();
        assert.equal((await selected()).subagent.parentAvailable, false);
        assert.equal(await main.getByRole('button', { name: '发送消息', exact: true }).isDisabled(), true);
        await back(seed.middleId); await back(seed.parentId); seed.replayed = true;
      } else {
        assert.equal(seed.replayed, true); assert.equal(root.projections.values.permissions.currentValue, 'workspace-write');
        assert.equal((await selected()).id, seed.parentId); assert.equal((await input.innerText()).trim(), '');
        seed.finalRootHashes = hashes(root); seed.finalMiddleHashes = hashes(middle); seed.cleaned = true;
      }
      await persist(); report.originalHistoryPreserved = true; report.emptyRootDraft = true;
    }
  }
  assert.equal(await appPid(), seed.appPid); assert.equal(await page.locator('iframe').count(), 0); assert.deepEqual(report.errors, []);
  report.middleId = seed.middleId; report.grandId = seed.grandId; report.sameAppProcess = true;
  await capture(prefix + '-' + phase); report.passed = true;
} catch (error) {
  report.failure = { name: error.name, message: error.message?.split('\n')[0],
    location: error.stack?.split('\n').find(line => line.includes('verify-latest-live-nested-resume-android.mjs:'))?.trim() };
  process.exitCode = 1;
} finally { await writeFile(reportPath, JSON.stringify(report, null, 2), { flag: 'wx' }); console.log(JSON.stringify(report)); await device.close(); }
setTimeout(() => process.exit(process.exitCode ?? 0), 200);
