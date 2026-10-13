// 父模型控制已有只读子会话；回执、真实回复和实际取消分别核对，不重发未知请求。
import assert from 'node:assert/strict';
import { randomUUID, createHash } from 'node:crypto';
import { access, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { openLatestLiveAndroid } from '../tests/support/latest-live-context.mjs';

const [phase, mode] = process.argv.slice(2);
assert.equal(process.argv.length, 4); assert.ok(['release', 'source'].includes(mode));
assert.ok(['prepare', 'send-start', 'send-observe', 'running-start', 'running-observe', 'interrupt', 'interrupt-observe',
  'resume-start', 'resume-observe', 'replay', 'cleanup', 'restored'].includes(phase));
const live = await openLatestLiveAndroid(undefined, { openRecorded: true });
const { runtime, state, session, main, page, device, readSession, readChild, capture } = live;
assert.equal(state.executionMode, mode);
const prefix = `latest-live-${mode}-child-control`;
const seedPath = resolve(runtime, prefix + '-seed.json'), reportPath = resolve(runtime, prefix + '-android-' + phase + '.json');
const report = { at: new Date().toISOString(), phase, mode, command: state.command, hostPid: state.hostPid,
  parentId: session.sessionId, passed: false, errors: [] };
const input = main.getByRole('textbox', { name: '消息', exact: true });
const pkg = 'dev.dshmobile.validation.latesttest';
const delay = ms => new Promise(done => setTimeout(done, ms));
const text = event => (event.data.message?.content ?? event.data.content ?? []).filter(part => part.type === 'text').map(part => part.text).join('');
const hashes = current => current.records.map(({ event }) => ({ seq: event.seq,
  hash: createHash('sha256').update(JSON.stringify(event)).digest('hex') }));
const alive = id => { assert.ok(Number.isSafeInteger(id) && id > 0); try { process.kill(id, 0); return true; }
  catch (error) { if (error.code === 'ESRCH') return false; throw error; } };
const appPid = async () => (await device.shell(`pidof ${pkg}`)).toString().trim();
const selected = () => main.evaluate(element => {
  const key = Object.keys(element).find(name => name.startsWith('__reactFiber$'));
  for (let fiber = element[key]; fiber; fiber = fiber.return)
    if (fiber.memoizedProps?.model?.client) {
      const value = fiber.memoizedProps.model.getSnapshot(); return { id: value.selected, running: value.session?.running };
    }
  return {};
});
let seed;
const persist = () => writeFile(seedPath, JSON.stringify(seed, null, 2));
function originalPrefix(current, before) {
  const currentHashes = new Map(hashes(current).map(row => [row.seq, row.hash]));
  for (const row of before) assert.equal(currentHashes.get(row.seq), row.hash, 'child_control_original_event_changed');
}
function auditChildIdentity(child) {
  assert.equal(child.entry.id, seed.childId); assert.equal(child.entry.mode, 'continuable'); assert.equal(child.entry.label, seed.label);
  assert.equal(child.records.length, child.projections.asOfSeq + 1);
  child.records.forEach((row, index) => assert.equal(row.event.seq, index));
  const events = child.records.map(row => row.event);
  assert.ok(events.some(event => event.type === 'sandbox/mode' && event.data.mode === 'read-only' && event.data.source === 'delegation'));
  assert.ok(events.some(event => event.type === 'approval/policy' && event.data.policy === 'never' && event.data.source === 'delegation'));
  originalPrefix(child, seed.initialChildHashes); return events;
}
async function parentIdle(after) {
  const deadline = Date.now() + 90000;
  while (true) {
    const current = await readSession();
    if (current.projections.asOfSeq > after && !current.row.running) return await readSession({ allRecords: true });
    assert.ok(Date.now() < deadline, 'child_control_parent_not_settled'); await delay(150);
  }
}
function auditParent(current, item, name) {
  originalPrefix(current, seed.initialParentHashes);
  const rows = current.records.map(row => row.event).filter(event => event.seq > item.parentSeq);
  const users = rows.filter(event => event.type === 'user/message' && event.data.source?.kind === 'user');
  assert.equal(users.length, 1); assert.equal(text(users[0]), item.prompt);
  assert.match(users[0].data.source.rpcId, /^[a-f0-9-]{36}$/);
  const calls = rows.filter(event => event.type === 'tool/call'); assert.equal(calls.length, 1);
  assert.equal(calls[0].data.name, name); assert.deepEqual(JSON.parse(calls[0].data.arguments), item.args);
  const results = rows.filter(event => event.type === 'tool/result' && event.data.message.toolCallId === calls[0].data.callId);
  assert.equal(results.length, 1); assert.equal(results[0].data.message.isError, false);
  assert.equal(text(results[0]), `${name === 'send_message' ? 'message delivered to' : 'interrupt requested for'} agent ${seed.childId}`);
  assert.ok(rows.some(event => event.type === 'turn/end' && event.data.reason.kind === 'completed'));
  assert.equal(current.row.running, false); assert.equal(current.projections.values.permissions.currentValue, 'workspace-write');
  return { rpcId: users[0].data.source.rpcId, callId: calls[0].data.callId };
}
function auditRelay(child, item) {
  const rows = auditChildIdentity(child).filter(event => event.seq > item.childSeq);
  const relays = rows.filter(event => event.type === 'user/message' && event.data.source?.kind === 'agent-message'
    && event.data.source.form === 'relay' && event.data.source.senderSessionId === session.sessionId
    && text(event) === `Agent ${session.sessionId} sent a message: ${item.args.message}`);
  assert.equal(relays.length, 1); return rows;
}
async function openChild() {
  await main.getByRole('button', { name: 'Remote 选项', exact: true }).click();
  await page.getByRole('button', { name: '子会话', exact: true }).click();
  await page.getByRole('dialog', { name: '子会话', exact: true }).getByRole('group', { name: seed.label, exact: true })
    .getByRole('button').filter({ hasText: seed.label }).click();
  await main.getByRole('button', { name: '返回父会话', exact: true }).waitFor();
  assert.equal((await selected()).id, seed.childId);
}
async function backParent() {
  await main.getByRole('button', { name: '返回父会话', exact: true }).click(); await input.waitFor();
  assert.equal((await selected()).id, seed.parentId);
}
async function originalCommandOutput() {
  assert.match(seed.running.callId, /^[A-Za-z0-9_:-]+$/);
  const seat = main.locator('[data-chat-node-key]').filter({ has: page.locator(`[data-chat-call-id="${seed.running.callId}"]`) });
  assert.equal(await seat.count(), 1);
  const detailsButton = seat.getByRole('button', { name: '工具详情', exact: true });
  if (!await detailsButton.isVisible()) {
    const turn = main.getByRole('button', { name: /用时|已停止/ }).last();
    assert.equal(await turn.getAttribute('aria-expanded'), 'false'); await turn.click();
  }
  await detailsButton.click();
  const dialog = page.getByRole('dialog', { name: '命令详情', exact: true }); await dialog.waitFor();
  const output = dialog.getByLabel('独立命令输出', { exact: true });
  await output.filter({ hasText: seed.running.outputMarker }).waitFor({ timeout: 15000 });
  const value = await output.innerText(); assert.ok(value.includes('中文🍀' + seed.running.outputMarker));
  const pid = Number(value.match(/DSHM_CONTROL_PID=(\d+)/)?.[1]); assert.equal(alive(pid), true);
  seed.running.pid = pid; seed.running.actualOutputObserved = true; await persist();
  await capture(prefix + '-actual-running-output');
  await dialog.getByRole('button', { name: '关闭命令详情', exact: true }).click();
}
async function send(name, message) {
  const parent = await readSession({ allRecords: true }), child = await readChild(seed.childId);
  assert.equal(parent.row.running, false); auditChildIdentity(child); assert.equal((await input.innerText()).trim(), '');
  const item = seed[name] = { parentSeq: parent.projections.asOfSeq, childSeq: child.projections.asOfSeq,
    args: { agent_id: seed.childId, message } };
  item.prompt = `这是新的独立DSHM父模型子会话控制验收，仅调用一次send_message，参数严格为 ${JSON.stringify(item.args)}。送达后仅回复 ${seed.marker}_${name.toUpperCase()}_PARENT。不要调用其他工具，不读写文件、不执行命令、不联网、不创建子任务；收到回报后也不调用工具。`;
  item.attempted = true; await persist(); await input.fill(item.prompt);
  await main.getByRole('button', { name: '发送消息', exact: true }).click(); item.sent = true; await persist();
}
page.on('pageerror', () => report.errors.push('page-error'));
try {
  await assert.rejects(access(reportPath), { code: 'ENOENT' });
  assert.equal(state.autoReviewDiagnostic, false); assert.equal(state.reviewCandidate, undefined);
  if (mode === 'source') {
    assert.equal(state.command, 'pnpm dsh web');
    const installed = await (await import('../../plugin/compatibility/latest-upstream/source-host.mjs')).verifyInstalledSource();
    assert.equal(installed.sourceCommit, state.sourceCommit); report.sourceFiles = installed.files;
  }
  if (phase === 'restored') {
    assert.equal(mode, 'release');
    const restored = JSON.parse(await readFile(resolve(import.meta.dirname, '../artifacts/latest-child-notice-main-apk-restore.json'), 'utf8'));
    assert.equal(restored.passed, true);
    const apk = (await device.shell(`pm path ${pkg}`)).toString().trim();
    assert.match(apk, /^package:\/data\/app\/[A-Za-z0-9_~.=/+-]+\/base\.apk$/);
    assert.equal((await device.shell(`sha256sum ${apk.slice(8)}`)).toString().split(/\s+/)[0], restored.originalSha256);
    const parent = await readSession({ allRecords: true });
    assert.equal(parent.row.running, false); assert.equal(parent.projections.values.permissions.currentValue, 'workspace-write');
    assert.equal((await selected()).id, session.sessionId); assert.equal((await input.innerText()).trim(), '');
    const notices = (await device.shell('cmd notification list')).toString().split('\n')
      .filter(line => line.includes(`|${pkg}|`) && line.includes('dshm.remote.notice.'));
    assert.deepEqual(notices, []); report.children = [];
    for (const originalMode of ['release', 'source']) {
      const originalPrefixName = `latest-live-${originalMode}-child-control`;
      const cleanup = JSON.parse(await readFile(resolve(runtime, originalPrefixName + '-android-cleanup.json'), 'utf8'));
      assert.equal(cleanup.passed, true);
      seed = JSON.parse(await readFile(resolve(runtime, originalPrefixName + '-seed.json'), 'utf8'));
      assert.equal(seed.home, state.home); assert.equal(seed.parentId, session.sessionId); assert.equal(seed.cleaned, true);
      assert.equal(alive(seed.running.pid), false); originalPrefix(parent, seed.resume.parentHashes);
      const child = await readChild(seed.childId); auditChildIdentity(child);
      assert.deepEqual(hashes(child), seed.resume.childHashes); assert.equal(await appPid(), seed.appPid);
      report.children.push({ executionMode: originalMode, id: seed.childId, records: child.records.length,
        originalHistoryUnchanged: true, actualProcessExited: true });
    }
    report.originalApkUnchanged = true; report.parentRecords = parent.records.length;
    report.emptyDraft = true; report.permissionUnchanged = true;
  } else if (phase === 'prepare') {
    await assert.rejects(access(seedPath), { code: 'ENOENT' });
    const previous = JSON.parse(await readFile(resolve(runtime, `latest-live-${mode}-child-stop-readonly-retained-seed.json`), 'utf8'));
    assert.equal(previous.home, state.home); assert.equal(previous.parentId, session.sessionId); assert.equal(previous.cleaned, true);
    const cleanup = JSON.parse(await readFile(resolve(runtime, `latest-live-${mode}-child-stop-readonly-retained-android-cleanup.json`), 'utf8'));
    assert.equal(cleanup.passed, true);
    const parent = await readSession({ allRecords: true }), child = await readChild(previous.childId);
    assert.equal(parent.row.running, false); assert.equal(parent.projections.values.permissions.currentValue, 'workspace-write');
    assert.equal((await input.innerText()).trim(), '');
    seed = { home: state.home, parentId: session.sessionId, childId: previous.childId, label: previous.label,
      appPid: await appPid(), marker: 'DSHM_CHILD_CONTROL_' + randomUUID().replaceAll('-', ''),
      initialParentHashes: hashes(parent), initialChildHashes: hashes(child) };
    assert.match(seed.appPid, /^[1-9]\d*$/); auditChildIdentity(child);
    await writeFile(seedPath, JSON.stringify(seed, null, 2), { flag: 'wx' }); report.existingChildReadOnly = true;
  } else {
    seed = JSON.parse(await readFile(seedPath, 'utf8')); assert.equal(seed.home, state.home); assert.equal(seed.parentId, session.sessionId);
    assert.equal(await appPid(), seed.appPid);
    if (phase === 'send-start' || phase === 'resume-start') {
      const name = phase === 'send-start' ? 'quick' : 'resume';
      assert.equal(seed[name], undefined); if (name === 'resume') assert.equal(seed.interrupted, true);
      const reply = seed.marker + '_' + name.toUpperCase() + '_CHILD中文🍀';
      seed[name + 'Reply'] = reply;
      await send(name, `这是DSHM专用父模型send_message验收，只回复 ${reply}。不要读写文件、执行命令、联网、创建子任务或重试；仅可按原系统要求用send_message回报父会话。`);
      report.sent = true;
    } else if (phase === 'send-observe' || phase === 'resume-observe') {
      const name = phase === 'send-observe' ? 'quick' : 'resume', item = seed[name]; assert.equal(item.sent, true);
      const deadline = Date.now() + 90000;
      let child;
      while (true) {
        child = await readChild(seed.childId); const rows = auditChildIdentity(child).filter(event => event.seq > item.childSeq);
        if (rows.some(event => event.type === 'assistant/message' && text(event).includes(seed[name + 'Reply']))
          && rows.some(event => event.type === 'turn/end' && event.data.reason.kind === 'completed')) break;
        assert.ok(Date.now() < deadline, 'child_control_actual_reply_missing'); await delay(150);
      }
      const rows = auditRelay(child, item);
      assert.ok(rows.filter(event => event.type === 'tool/call').every(event => event.data.name === 'send_message'
        && JSON.parse(event.data.arguments).agent_id === seed.parentId));
      assert.ok(rows.filter(event => event.type === 'tool/result').every(event => !event.data.message.isError));
      const parent = await parentIdle(item.parentSeq); report.parentAudit = auditParent(parent, item, 'send_message');
      await openChild(); await main.getByRole('article', { name: '模型回复', exact: true }).filter({ hasText: seed[name + 'Reply'] }).last().waitFor();
      assert.equal((await selected()).running, false); assert.equal((await input.innerText()).trim(), '');
      await capture(prefix + '-' + name + '-child-reply'); await backParent();
      item.observed = true; item.parentHashes = hashes(parent); item.childHashes = hashes(child); await persist();
      report.deliveredRelayOnce = true; report.actualChildReply = true; report.originalChildHistoryRetained = true;
    } else if (phase === 'running-start' || phase === 'running-observe') {
      if (phase === 'running-start') {
        assert.equal(seed.quick.observed, true); assert.equal(seed.running, undefined);
        const marker = seed.marker + '_RUNNING';
        seed.runningCommand = `Write-Output '中文🍀${marker}'; Write-Output "DSHM_CONTROL_PID=$PID"; Start-Sleep -Seconds 120; Write-Output '${seed.marker}_UNEXPECTED_FINISH'`;
        await send('running', `这是DSHM专用父模型interrupt_agent验收，只调用一次pwsh，参数command逐字为：${seed.runningCommand}，timeoutMs=150000，run_in_background=false。不要读写文件、联网、提权、创建子任务或重试。仅可按原系统要求send_message回报父会话；收到停止后不补做。`);
        seed.running.outputMarker = marker; await persist();
      } else {
        const failed = JSON.parse(await readFile(resolve(runtime, prefix + '-android-running-start.json'), 'utf8'));
        assert.equal(failed.passed, false); assert.equal(seed.running.sent, true);
      }
      const parent = await parentIdle(seed.running.parentSeq); report.parentAudit = auditParent(parent, seed.running, 'send_message');
      const deadline = Date.now() + 30000;
      while (true) {
        const child = await readChild(seed.childId), calls = auditRelay(child, seed.running).filter(event => event.type === 'tool/call' && event.data.name === 'pwsh');
        if (calls.length) {
          assert.equal(calls.length, 1); const args = JSON.parse(calls[0].data.arguments);
          assert.equal(args.command, seed.runningCommand); assert.equal(args.timeoutMs, 150000); assert.equal(args.run_in_background, false);
          // description是原工具必填的显示元数据；实际执行字段仍逐项严格核对。
          assert.ok(Object.keys(args).every(key => ['command', 'timeoutMs', 'run_in_background', 'description'].includes(key)));
          assert.equal(typeof args.description, 'string'); assert.ok(args.description.trim().length > 0);
          report.actualCommandArgs = args;
          seed.running.callId = calls[0].data.callId; break;
        }
        assert.ok(Date.now() < deadline, 'child_control_real_command_missing'); await delay(150);
      }
      await persist(); await openChild(); assert.equal((await selected()).running, true);
      await originalCommandOutput(); await backParent();
      assert.equal(alive(seed.running.pid), true); report.actualProcessObservedAlive = true; report.pid = seed.running.pid;
    } else if (phase === 'interrupt') {
      assert.equal(seed.running.actualOutputObserved, true); assert.equal(seed.interrupt, undefined);
      assert.equal(alive(seed.running.pid), true);
      const parent = await readSession({ allRecords: true }); assert.equal(parent.row.running, false);
      const item = seed.interrupt = { parentSeq: parent.projections.asOfSeq, args: { agent_id: seed.childId } };
      item.prompt = `这是DSHM专用父模型停止验收，仅调用一次interrupt_agent，参数严格为 ${JSON.stringify(item.args)}。之后仅回复 ${seed.marker}_INTERRUPT_REQUESTED，不调用其他工具、不发送子会话消息、不重试、不读写文件、不执行命令、不联网；收到结算后也不调用工具。`;
      item.attempted = true; await persist(); await input.fill(item.prompt);
      await main.getByRole('button', { name: '发送消息', exact: true }).click(); item.sent = true; await persist();
      report.actualProcessAliveBeforeInterrupt = true; report.sent = true;
    } else if (phase === 'interrupt-observe') {
      assert.equal(seed.interrupt.sent, true); const deadline = Date.now() + 30000; let child;
      while (true) {
        child = await readChild(seed.childId); const rows = auditRelay(child, seed.running);
        if (!alive(seed.running.pid) && rows.some(event => event.type === 'turn/end' && event.data.reason.kind === 'aborted'
          && event.data.reason.reason.kind === 'parent')) break;
        assert.ok(Date.now() < deadline, 'child_control_interrupt_not_actually_stopped'); await delay(150);
      }
      const rows = auditRelay(child, seed.running);
      const calls = rows.filter(event => event.type === 'tool/call' && event.data.name === 'pwsh'); assert.equal(calls.length, 1);
      assert.equal(calls[0].data.callId, seed.running.callId);
      const results = rows.filter(event => event.type === 'tool/result' && event.data.message.toolCallId === seed.running.callId);
      assert.equal(results.length, 1); assert.equal(results[0].data.message.isError, true); assert.equal(results[0].data.error.code, 'ABORTED');
      const parent = await parentIdle(seed.interrupt.parentSeq); report.parentAudit = auditParent(parent, seed.interrupt, 'interrupt_agent');
      await openChild();
      await main.locator(`[data-chat-call-id="${seed.running.callId}"] [data-tool="pwsh"][data-state="stopped"]`).waitFor();
      assert.equal((await selected()).running, false); await capture(prefix + '-parent-interrupted-child'); await backParent();
      seed.interrupted = true; seed.interrupt.childHashes = hashes(child); await persist();
      report.actualProcessExited = true; report.originalAborted = true; report.reasonParent = true; report.noRetry = true;
    } else if (phase === 'replay') {
      assert.equal(seed.resume.observed, true); const child = await readChild(seed.childId); auditChildIdentity(child);
      assert.deepEqual(hashes(child), seed.resume.childHashes);
      const parent = await readSession({ allRecords: true }); assert.deepEqual(hashes(parent), seed.resume.parentHashes);
      await openChild(); await main.getByRole('article', { name: '模型回复', exact: true }).filter({ hasText: seed.resumeReply }).last().waitFor();
      await main.locator(`[data-chat-call-id="${seed.running.callId}"] [data-tool="pwsh"][data-state="stopped"]`).waitFor();
      await backParent(); assert.equal(alive(seed.running.pid), false); seed.replayed = true; await persist();
      report.originalHistoryUnchanged = true; report.stoppedCardAndNewReply = true;
    } else {
      assert.equal(seed.replayed, true); assert.equal(alive(seed.running.pid), false);
      const parent = await readSession({ allRecords: true }), child = await readChild(seed.childId); auditChildIdentity(child);
      assert.deepEqual(hashes(parent), seed.resume.parentHashes); assert.deepEqual(hashes(child), seed.resume.childHashes);
      assert.equal(parent.projections.values.permissions.currentValue, 'workspace-write');
      assert.equal((await selected()).id, seed.parentId); assert.equal((await input.innerText()).trim(), '');
      seed.cleaned = true; await persist(); report.emptyDraft = true; report.permissionUnchanged = true;
    }
  }
  report.childId = seed.childId; assert.equal(await appPid(), seed.appPid); report.sameAppProcess = true;
  assert.equal(await page.locator('iframe').count(), 0); assert.deepEqual(report.errors, []);
  await capture(prefix + '-' + phase); report.passed = true;
} catch (error) {
  report.failure = { name: error.name, message: error.message?.split('\n')[0],
    location: error.stack?.split('\n').find(line => line.includes('verify-latest-live-child-control-android.mjs:'))?.trim() };
  process.exitCode = 1;
} finally {
  await writeFile(reportPath, JSON.stringify(report, null, 2), { flag: 'wx' }); console.log(JSON.stringify(report)); await device.close();
}
setTimeout(() => process.exit(process.exitCode ?? 0), 200);
