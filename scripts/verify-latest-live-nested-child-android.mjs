// 两层真实子任务：逐层导航、原发现/祖先取消、原手机续聊；不注入事件或重发未知请求。
import assert from 'node:assert/strict';
import { randomUUID, createHash } from 'node:crypto';
import { access, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { openLatestLiveAndroid } from '../tests/support/latest-live-context.mjs';

const [phase, mode] = process.argv.slice(2);
assert.equal(process.argv.length, 4); assert.ok(['release', 'source'].includes(mode));
assert.ok(['prepare', 'start', 'running', 'list-start', 'list-observe', 'list-observe-recovery', 'views', 'interrupt', 'stopped',
  'resume', 'resume-observe', 'replay', 'cleanup', 'restored', 'unavailable', 'unavailable-recovery', 'cleanup-unavailable', 'restored-unavailable'].includes(phase));
const live = await openLatestLiveAndroid(undefined, { openRecorded: true });
const { runtime, state, session, main, page, device, readSession, readChild, capture } = live;
const prefix = `latest-live-${mode}-nested-child`, seedPath = resolve(runtime, prefix + '-seed.json');
const reportPath = resolve(runtime, prefix + '-android-' + phase + '.json');
const report = { at: new Date().toISOString(), phase, mode, command: state.command,
  hostPid: state.hostPid, parentId: session.sessionId, passed: false, errors: [] };
const pkg = 'dev.dshmobile.validation.latesttest';
const input = main.getByRole('textbox', { name: '消息', exact: true });
const delay = ms => new Promise(done => setTimeout(done, ms));
const text = event => (event.data.message?.content ?? event.data.content ?? []).filter(part => part.type === 'text').map(part => part.text).join('');
const hashes = current => current.records.map(({ event }) => ({ seq: event.seq,
  hash: createHash('sha256').update(JSON.stringify(event)).digest('hex') }));
const appPid = async () => (await device.shell(`pidof ${pkg}`)).toString().trim();
const alive = pid => { assert.ok(Number.isSafeInteger(pid) && pid > 0); try { process.kill(pid, 0); return true; }
  catch (error) { if (error.code === 'ESRCH') return false; throw error; } };
const selected = () => main.evaluate(element => {
  const key = Object.keys(element).find(name => name.startsWith('__reactFiber$'));
  for (let fiber = element[key]; fiber; fiber = fiber.return)
    if (fiber.memoizedProps?.model?.client) {
      const value = fiber.memoizedProps.model.getSnapshot();
      return { id: value.selected, running: value.session?.running, target: value.selectedTarget, trail: value.selectionTrail,
        subagent: value.session?.subagent, parentRow: value.list?.byId[value.selectedTarget?.parentSessionId] };
    }
  return {};
});
let seed;
const persist = () => writeFile(seedPath, JSON.stringify(seed, null, 2));
function originalPrefix(current, before) {
  const map = new Map(hashes(current).map(row => [row.seq, row.hash]));
  for (const row of before) assert.equal(map.get(row.seq), row.hash, 'nested_child_original_event_changed');
}
function identity(current, id, label) {
  assert.equal(current.entry.id, id); assert.equal(current.entry.label, label); assert.equal(current.entry.mode, 'continuable');
  assert.equal(current.records.length, current.projections.asOfSeq + 1);
  current.records.forEach((row, index) => assert.equal(row.event.seq, index));
  const events = current.records.map(row => row.event);
  assert.ok(events.some(event => event.type === 'sandbox/mode' && event.data.mode === 'read-only' && event.data.source === 'delegation'));
  assert.ok(events.some(event => event.type === 'approval/policy' && event.data.policy === 'never' && event.data.source === 'delegation'));
  return events;
}
async function middleRead() {
  const child = await readChild(seed.middleId); identity(child, seed.middleId, seed.middleLabel);
  originalPrefix(child, seed.initialMiddleHashes); return child;
}
async function grandRead() {
  const child = await readChild(seed.grandId, { ancestors: [seed.middleId] });
  identity(child, seed.grandId, seed.grandLabel); return child;
}
async function rootIdle(after) {
  const deadline = Date.now() + 90000;
  while (true) {
    const current = await readSession();
    if (!current.row.running && current.projections.asOfSeq > after) return await readSession({ allRecords: true });
    assert.ok(Date.now() < deadline, 'nested_child_parent_not_settled'); await delay(150);
  }
}
function parentAudit(parent, item, names) {
  originalPrefix(parent, seed.initialRootHashes);
  const rows = parent.records.map(row => row.event).filter(event => event.seq > item.seq);
  const users = rows.filter(event => event.type === 'user/message' && event.data.source?.kind === 'user');
  assert.equal(users.length, 1); assert.equal(text(users[0]), item.prompt); assert.match(users[0].data.source.rpcId, /^[a-f0-9-]{36}$/);
  const calls = rows.filter(event => event.type === 'tool/call'); assert.deepEqual(calls.map(event => event.data.name), names);
  const results = calls.map((call, index) => {
    assert.deepEqual(JSON.parse(call.data.arguments), item.args[index]);
    const matches = rows.filter(event => event.type === 'tool/result' && event.data.message.toolCallId === call.data.callId);
    assert.equal(matches.length, 1); assert.equal(matches[0].data.message.isError, false);
    return { call, result: matches[0] };
  });
  assert.equal(parent.row.running, false); assert.equal(parent.projections.values.permissions.currentValue, 'workspace-write');
  return { rpcId: users[0].data.source.rpcId, results };
}
async function submitRoot(name, prompt, args) {
  const parent = await readSession({ allRecords: true }); assert.equal(parent.row.running, false);
  assert.equal((await selected()).id, seed.parentId); assert.equal((await input.innerText()).trim(), '');
  assert.equal(seed[name], undefined);
  seed[name] = { seq: parent.projections.asOfSeq, prompt, args, attempted: true }; await persist();
  await input.fill(prompt); await main.getByRole('button', { name: '发送消息', exact: true }).click();
  seed[name].sent = true; await persist();
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
async function back(expected) {
  await main.getByRole('button', { name: '返回父会话', exact: true }).click();
  const deadline = Date.now() + 10000;
  while ((await selected()).id !== expected) { assert.ok(Date.now() < deadline); await delay(100); }
  await input.waitFor();
}
async function backRoot() { await back(seed.middleId); await back(seed.parentId); }
function commandAudit(grand) {
  const calls = grand.records.map(row => row.event).filter(event => event.type === 'tool/call' && event.data.name === 'pwsh');
  assert.equal(calls.length, 1); const args = JSON.parse(calls[0].data.arguments);
  assert.equal(args.command, seed.command); assert.equal(args.timeoutMs, 210000); assert.equal(args.run_in_background, false);
  assert.equal(typeof args.description, 'string'); assert.ok(args.description.trim());
  assert.ok(Object.keys(args).every(key => ['command', 'timeoutMs', 'run_in_background', 'description'].includes(key)));
  return calls[0];
}
page.on('pageerror', () => report.errors.push('page-error'));
try {
  await assert.rejects(access(reportPath), { code: 'ENOENT' }); assert.equal(state.executionMode, mode);
  assert.equal(state.autoReviewDiagnostic, false); assert.equal(state.reviewCandidate, undefined);
  assert.equal(state.subagentDepthDiagnostic === true, !phase.startsWith('restored'));
  if (mode === 'source') {
    assert.equal(state.command, 'pnpm dsh web');
    const installed = await (await import('../../plugin/compatibility/latest-upstream/source-host.mjs')).verifyInstalledSource();
    assert.equal(installed.sourceCommit, state.sourceCommit); report.sourceFiles = installed.files;
  }
  if (phase === 'prepare') {
    await assert.rejects(access(seedPath), { code: 'ENOENT' });
    const previous = JSON.parse(await readFile(resolve(runtime, `latest-live-${mode}-child-control-seed.json`), 'utf8'));
    assert.equal(previous.cleaned, true); assert.equal(previous.home, state.home); assert.equal(previous.parentId, session.sessionId);
    const root = await readSession({ allRecords: true }), middle = await readChild(previous.childId);
    assert.equal(root.row.running, false); assert.equal(root.projections.values.permissions.currentValue, 'workspace-write');
    assert.equal((await input.innerText()).trim(), '');
    const marker = 'DSHM_NESTED_' + randomUUID().replaceAll('-', '');
    seed = { home: state.home, parentId: session.sessionId, middleId: previous.childId, middleLabel: previous.label,
      marker, grandLabel: 'DSHM 两层子任务 ' + marker.slice(-8), appPid: await appPid(),
      initialRootHashes: hashes(root), initialMiddleHashes: hashes(middle), initialMiddleSeq: middle.projections.asOfSeq };
    assert.match(seed.appPid, /^[1-9]\d*$/); identity(middle, seed.middleId, seed.middleLabel);
    await writeFile(seedPath, JSON.stringify(seed, null, 2), { flag: 'wx' }); report.inheritedReadOnly = true;
  } else if (phase.startsWith('restored')) {
    assert.equal(mode, 'release'); const parent = await readSession({ allRecords: true });
    assert.equal(parent.row.running, false); assert.equal(parent.projections.values.permissions.currentValue, 'workspace-write');
    assert.equal((await input.innerText()).trim(), ''); assert.equal((await selected()).id, session.sessionId);
    report.trees = [];
    for (const originalMode of ['release', 'source']) {
      const cleanup = JSON.parse(await readFile(resolve(runtime, `latest-live-${originalMode}-nested-child-android-${phase === 'restored-unavailable' ? 'cleanup-unavailable' : 'cleanup'}.json`), 'utf8'));
      assert.equal(cleanup.passed, true);
      seed = JSON.parse(await readFile(resolve(runtime, `latest-live-${originalMode}-nested-child-seed.json`), 'utf8'));
      assert.equal(seed.home, state.home); assert.equal(seed.parentId, session.sessionId); assert.equal(seed.cleaned, true);
      originalPrefix(parent, seed.finalRootHashes); originalPrefix(await middleRead(), seed.finalMiddleHashes);
      const grand = await grandRead(); assert.deepEqual(hashes(grand), seed.finalGrandHashes); assert.equal(alive(seed.pid), false);
      assert.equal(await appPid(), seed.appPid); report.trees.push({ middleId: seed.middleId, grandId: seed.grandId, originalHistoryUnchanged: true });
    }
    const restored = JSON.parse(await readFile(resolve(import.meta.dirname, '../artifacts/latest-child-notice-main-apk-restore.json'), 'utf8'));
    const apk = (await device.shell(`pm path ${pkg}`)).toString().trim();
    assert.equal(restored.passed, true); assert.match(apk, /^package:\/data\/app\/[A-Za-z0-9_~.=/+-]+\/base\.apk$/);
    assert.equal((await device.shell(`sha256sum ${apk.slice(8)}`)).toString().split(/\s+/)[0], restored.originalSha256);
    report.originalApkUnchanged = true; report.parentRecords = parent.records.length;
  } else {
    seed = JSON.parse(await readFile(seedPath, 'utf8'));
    assert.equal(seed.home, state.home); assert.equal(seed.parentId, session.sessionId); assert.equal(await appPid(), seed.appPid);
    if (phase === 'start') {
      assert.equal(seed.start, undefined);
      seed.command = `Write-Output '中文🍀${seed.marker}_RUNNING'; Write-Output "DSHM_NESTED_PID=$PID"; Start-Sleep -Seconds 180; Write-Output '${seed.marker}_UNEXPECTED_FINISH'`;
      seed.grandArgs = { description: seed.grandLabel, run_in_background: true,
        prompt: `这是DSHM专用两层子任务验收。只调用一次pwsh，command逐字为：${seed.command}，timeoutMs=210000，run_in_background=false，description填写简短说明。不要读写文件、联网、提权、创建子任务或重试。仅可按原系统要求send_message回报你的直接父会话；收到停止后不补做。` };
      const message = `这是新的DSHM专用嵌套任务验收，仅调用一次subagent，参数严格为 ${JSON.stringify(seed.grandArgs)}。这是独立新任务，不要重复此前验收。取得新子会话ID后按系统要求send_message回报直接父会话，之后仅回复 ${seed.marker}_MIDDLE_STARTED。不要读写文件、执行命令、联网或重试；后续结算仅回报原父会话，不再调用其他工具。`;
      const args = { agent_id: seed.middleId, message };
      await submitRoot('start', `这是DSHM专用两层子任务验收，仅调用一次send_message，参数严格为 ${JSON.stringify(args)}。之后仅回复 ${seed.marker}_ROOT_STARTED。不要调用其他工具、读写文件、执行命令、联网、创建子任务或重试，收到回报后也不调用工具。`, [args]);
      report.sentOnce = true;
    } else if (phase === 'running') {
      assert.equal(seed.start.sent, true); const parent = await rootIdle(seed.start.seq);
      report.rootRpcId = parentAudit(parent, seed.start, ['send_message']).rpcId;
      const deadline = Date.now() + 45000; let grand;
      while (true) {
        const middle = await middleRead();
        const entries = middle.projections.values.subagentCatalog.filter(entry => entry.label === seed.grandLabel);
        assert.ok(entries.length <= 1);
        if (entries.length) {
          seed.grandId = entries[0].id; assert.equal(entries[0].mode, 'continuable');
          grand = await grandRead();
          if (grand.records.some(row => row.event.type === 'tool/call' && row.event.data.name === 'pwsh')) {
            const calls = middle.records.map(row => row.event).filter(event => event.seq > seed.initialMiddleSeq && event.type === 'tool/call');
            assert.equal(calls.filter(call => call.data.name === 'subagent').length, 1);
            const subagent = calls.find(call => call.data.name === 'subagent'); assert.deepEqual(JSON.parse(subagent.data.arguments), seed.grandArgs);
            assert.ok(calls.every(call => ['subagent', 'send_message'].includes(call.data.name)));
            seed.callId = commandAudit(grand).data.callId; break;
          }
        }
        assert.ok(Date.now() < deadline, 'nested_child_actual_spawn_or_command_missing'); await delay(150);
      }
      await persist(); await openGrand(); assert.equal((await selected()).running, true);
      const seat = main.locator('[data-chat-node-key]').filter({ has: page.locator(`[data-chat-call-id="${seed.callId}"]`) });
      assert.equal(await seat.count(), 1); await seat.getByRole('button', { name: '工具详情', exact: true }).click();
      const dialog = page.getByRole('dialog', { name: '命令详情', exact: true });
      const output = dialog.getByLabel('独立命令输出', { exact: true });
      await output.filter({ hasText: seed.marker + '_RUNNING' }).waitFor({ timeout: 15000 });
      const value = await output.innerText(); assert.ok(value.includes('中文🍀' + seed.marker + '_RUNNING'));
      seed.pid = Number(value.match(/DSHM_NESTED_PID=(\d+)/)?.[1]); assert.equal(alive(seed.pid), true);
      seed.runningObserved = true; await persist(); await capture(prefix + '-actual-grand-output');
      await dialog.getByRole('button', { name: '关闭命令详情', exact: true }).click(); await backRoot();
      report.actualGrandProcessAlive = true; report.pid = seed.pid;
    } else if (phase === 'list-start') {
      assert.equal(seed.runningObserved, true); assert.equal(alive(seed.pid), true);
      await submitRoot('list', `这是DSHM专用两层原发现验收。仅依次调用list_agents两次：第一次参数严格为 {"scope":"children"}，第二次为 {"scope":"descendants"}。之后仅回复 ${seed.marker}_LIST_DONE。不要调用其他工具、发送子会话消息、创建子任务、读写文件、执行命令、联网或重试。`, [{ scope: 'children' }, { scope: 'descendants' }]);
      report.sentOnce = true;
    } else if (phase === 'list-observe' || phase === 'list-observe-recovery') {
      assert.equal(seed.list.sent, true); assert.equal(alive(seed.pid), true);
      if (phase === 'list-observe-recovery') {
        const failed = JSON.parse(await readFile(resolve(runtime, prefix + '-android-list-observe.json'), 'utf8'));
        assert.equal(mode, 'source'); assert.equal(failed.passed, false); assert.equal(failed.hostPid, state.hostPid);
        assert.equal(failed.failure.name, 'AssertionError'); assert.match(failed.failure.location, /:218:16\)?$/);
      }
      const parent = await rootIdle(seed.list.seq), audit = parentAudit(parent, seed.list, ['list_agents', 'list_agents']);
      const expected = parent.projections.values.subagentCatalog.filter(entry => entry.mode === 'continuable');
      const grands = [{ id: seed.grandId, parent: seed.middleId, label: seed.grandLabel, status: 'running' }];
      if (mode === 'source') {
        const prior = JSON.parse(await readFile(resolve(runtime, 'latest-live-release-nested-child-seed.json'), 'utf8'));
        assert.equal(prior.home, state.home); assert.equal(prior.parentId, seed.parentId); assert.equal(prior.cleaned, true);
        assert.equal(alive(prior.pid), false);
        const original = await readChild(prior.grandId, { ancestors: [prior.middleId] });
        assert.equal(original.entry.label, prior.grandLabel); assert.deepEqual(hashes(original), prior.finalGrandHashes);
        grands.push({ id: prior.grandId, parent: prior.middleId, label: prior.grandLabel, status: 'inactive' });
      }
      report.lists = [];
      for (const { call, result } of audit.results) {
        const scope = JSON.parse(call.data.arguments).scope;
        const entries = text(result).split('\n').filter(Boolean).map(line => {
          const match = line.match(/^([a-f0-9-]{36}) \[(running|inactive)\](?: parent=([^ ]+) depth=(\d+))? — (.*)$/);
          assert.ok(match, 'nested_child_unexpected_list_shape');
          return { id: match[1], status: match[2], parent: match[3], depth: match[4] && Number(match[4]), label: match[5] };
        });
        assert.equal(entries.length, expected.length + (scope === 'descendants' ? grands.length : 0));
        for (const child of expected) {
          const found = entries.find(entry => entry.id === child.id); assert.ok(found); assert.equal(found.label, child.label);
          if (scope === 'descendants') { assert.equal(found.parent, seed.parentId); assert.equal(found.depth, 1); }
        }
        for (const known of grands) {
          const grand = entries.find(entry => entry.id === known.id);
          if (scope === 'children') assert.equal(grand, undefined);
          else { assert.ok(grand); assert.equal(grand.parent, known.parent); assert.equal(grand.depth, 2);
            assert.equal(grand.status, known.status); assert.equal(grand.label, known.label); }
        }
        report.lists.push({ scope, count: entries.length, actualDepthTwoRunning: scope === 'descendants' });
      }
      assert.equal(alive(seed.pid), true); seed.listsObserved = true; await persist(); report.rootRpcId = audit.rpcId;
    } else if (phase === 'views') {
      assert.equal(seed.listsObserved, true); assert.equal(alive(seed.pid), true);
      seed.draft = seed.marker + '_ROOT_DRAFT'; await persist(); await input.fill(seed.draft);
      await openGrand(); const value = await selected();
      assert.equal(value.target.parentSessionId, seed.middleId); assert.equal(value.target.childSessionId, seed.grandId);
      assert.equal(value.target.mode, 'continuable'); assert.equal(value.trail.length, 2); assert.equal(value.running, true);
      assert.equal((await input.innerText()).trim(), ''); await capture(prefix + '-two-level-navigation');
      await backRoot(); assert.equal((await input.innerText()).trim(), seed.draft); await input.fill('');
      seed.viewsObserved = true; await persist(); report.twoLevelNavigation = true; report.rootDraftPreserved = true;
    } else if (phase === 'interrupt') {
      assert.equal(seed.viewsObserved, true); assert.equal(alive(seed.pid), true);
      const args = { agent_id: seed.grandId };
      await submitRoot('interrupt', `这是DSHM专用祖先停止验收，仅调用一次interrupt_agent，参数严格为 ${JSON.stringify(args)}。之后仅回复 ${seed.marker}_GRAND_INTERRUPT。不要调用其他工具、发送子消息、读写文件、执行命令、联网、创建子任务或重试；收到结算后也不调用工具。`, [args]);
      report.actualProcessAliveBeforeInterrupt = true;
    } else if (phase === 'stopped') {
      assert.equal(seed.interrupt.sent, true); const deadline = Date.now() + 30000; let grand;
      while (true) {
        grand = await grandRead();
        if (!alive(seed.pid) && grand.records.some(row => row.event.type === 'turn/end' && row.event.data.reason.kind === 'aborted'
          && row.event.data.reason.reason.kind === 'parent')) break;
        assert.ok(Date.now() < deadline, 'nested_child_ancestor_interrupt_not_stopped'); await delay(150);
      }
      assert.equal(commandAudit(grand).data.callId, seed.callId);
      const results = grand.records.map(row => row.event).filter(event => event.type === 'tool/result' && event.data.message.toolCallId === seed.callId);
      assert.equal(results.length, 1); assert.equal(results[0].data.message.isError, true); assert.equal(results[0].data.error.code, 'ABORTED');
      const parent = await rootIdle(seed.interrupt.seq); report.rootRpcId = parentAudit(parent, seed.interrupt, ['interrupt_agent']).rpcId;
      await openGrand(); await main.locator(`[data-chat-call-id="${seed.callId}"] [data-tool="pwsh"][data-state="stopped"]`).waitFor();
      assert.equal((await selected()).running, false); await capture(prefix + '-grand-stopped'); await backRoot();
      seed.stopped = true; seed.stoppedGrandHashes = hashes(grand); await persist(); report.actualProcessExited = true;
      report.originalAbortedByAncestor = true;
    } else if (phase === 'unavailable' || phase === 'unavailable-recovery') {
      assert.equal(seed.stopped, true); assert.equal(alive(seed.pid), false);
      const grand = await grandRead(); assert.deepEqual(hashes(grand), seed.stoppedGrandHashes);
      if (mode === 'release') {
        const failed = JSON.parse(await readFile(resolve(runtime, prefix + '-android-resume.json'), 'utf8'));
        const inspection = JSON.parse(await readFile(resolve(runtime, prefix + '-send-inspection.json'), 'utf8'));
        assert.equal(failed.passed, false); assert.equal(seed.resume.attempted, true); assert.equal(seed.resume.sent, undefined);
        assert.equal(inspection.noAdmission, true); assert.equal(grand.projections.asOfSeq, seed.resume.beforeSeq);
      } else assert.equal(seed.resume, undefined);
      if (phase === 'unavailable-recovery') {
        const failed = JSON.parse(await readFile(resolve(runtime, prefix + '-android-unavailable.json'), 'utf8'));
        assert.equal(mode, 'release'); assert.equal(failed.passed, false); assert.equal(failed.hostPid, state.hostPid);
        assert.equal(failed.failure.name, 'AssertionError'); assert.match(failed.failure.location, /:270:67\)?$/);
      }
      await openGrand(); const value = await selected();
      assert.equal(value.subagent.parentAvailable, false); assert.equal(grand.parentSummary.agentAvailable, false);
      assert.equal(value.target.parentSessionId, seed.middleId); assert.equal(value.running, false);
      await main.getByText('父会话暂不可用，恢复后可以继续聊天。', { exact: true }).waitFor();
      assert.equal(await main.getByRole('button', { name: '发送消息', exact: true }).isDisabled(), true);
      const draft = (await input.innerText()).trim();
      assert.equal(draft, mode === 'release' ? seed.resume.prompt : '');
      await capture(prefix + '-actual-parent-unavailable');
      if (draft) await input.fill(''); await backRoot();
      seed.parentUnavailableObserved = true; seed.finalGrandHashes = hashes(grand); await persist();
      report.originalParentUnavailable = true; report.noFollowupAdmitted = true; report.continuationUnverified = true;
    } else if (phase === 'cleanup-unavailable') {
      assert.equal(seed.parentUnavailableObserved, true); assert.equal(alive(seed.pid), false);
      const grand = await grandRead(); assert.deepEqual(hashes(grand), seed.finalGrandHashes);
      const middle = await middleRead(), root = await readSession({ allRecords: true });
      assert.equal(root.row.running, false); originalPrefix(root, seed.initialRootHashes);
      assert.equal(root.projections.values.permissions.currentValue, 'workspace-write');
      assert.equal((await selected()).id, seed.parentId); assert.equal((await input.innerText()).trim(), '');
      seed.finalRootHashes = hashes(root); seed.finalMiddleHashes = hashes(middle); seed.cleaned = true;
      seed.cleanupPhase = 'cleanup-unavailable'; await persist();
      report.originalHistoryUnchanged = true; report.emptyRootDraft = true; report.continuationUnverified = true;
    } else if (phase === 'resume') {
      assert.equal(seed.stopped, true); assert.equal(seed.resume, undefined); assert.equal(alive(seed.pid), false);
      const grand = await grandRead(); originalPrefix(grand, seed.stoppedGrandHashes);
      seed.reply = seed.marker + '_GRAND_RESUMED中文🍀';
      seed.resume = { beforeSeq: grand.projections.asOfSeq, prompt: `这是DSHM手机直接续聊原两层子会话验收。只回复 ${seed.reply}。不要执行命令、读写文件、联网、创建子任务或重试；仅可按原系统要求send_message回报你的直接父会话。`, attempted: true };
      await persist(); await openGrand(); assert.equal((await input.innerText()).trim(), ''); await input.fill(seed.resume.prompt);
      await main.getByRole('button', { name: '发送消息', exact: true }).click(); seed.resume.sent = true; await persist();
      await backRoot(); report.directPhoneMessageSentOnce = true;
    } else if (phase === 'resume-observe') {
      assert.equal(seed.resume.sent, true); const deadline = Date.now() + 90000; let grand;
      while (true) {
        grand = await grandRead(); const rows = grand.records.map(row => row.event).filter(event => event.seq > seed.resume.beforeSeq);
        if (rows.some(event => event.type === 'assistant/message' && text(event).includes(seed.reply))
          && rows.some(event => event.type === 'turn/end' && event.data.reason.kind === 'completed')) break;
        assert.ok(Date.now() < deadline, 'nested_child_real_resumed_reply_missing'); await delay(150);
      }
      originalPrefix(grand, seed.stoppedGrandHashes);
      const rows = grand.records.map(row => row.event).filter(event => event.seq > seed.resume.beforeSeq);
      const users = rows.filter(event => event.type === 'user/message' && event.data.source?.kind === 'user');
      assert.equal(users.length, 1); assert.equal(text(users[0]), seed.resume.prompt); assert.match(users[0].data.source.rpcId, /^[a-f0-9-]{36}$/);
      assert.ok(rows.filter(event => event.type === 'tool/call').every(event => event.data.name === 'send_message'
        && JSON.parse(event.data.arguments).agent_id === seed.middleId));
      await openGrand(); await main.getByRole('article', { name: '模型回复', exact: true }).filter({ hasText: seed.reply }).last().waitFor();
      assert.equal((await selected()).running, false); await capture(prefix + '-grand-real-reply'); await backRoot();
      seed.resume.observed = true; seed.finalGrandHashes = hashes(grand); await persist(); report.originalRpcId = users[0].data.source.rpcId;
      report.realGrandReply = true;
    } else if (phase === 'replay' || phase === 'cleanup') {
      assert.equal(seed.resume.observed, true); const grand = await grandRead(); assert.deepEqual(hashes(grand), seed.finalGrandHashes);
      assert.equal(alive(seed.pid), false); const middle = await middleRead(), root = await readSession({ allRecords: true });
      assert.equal(root.row.running, false); originalPrefix(root, seed.initialRootHashes);
      if (phase === 'replay') {
        await openGrand(); await main.getByRole('article', { name: '模型回复', exact: true }).filter({ hasText: seed.reply }).last().waitFor();
        await main.locator(`[data-chat-call-id="${seed.callId}"] [data-tool="pwsh"][data-state="stopped"]`).waitFor(); await backRoot();
        seed.replayed = true;
      } else {
        assert.equal(seed.replayed, true); assert.equal(root.projections.values.permissions.currentValue, 'workspace-write');
        assert.equal((await selected()).id, seed.parentId); assert.equal((await input.innerText()).trim(), '');
        seed.finalRootHashes = hashes(root); seed.finalMiddleHashes = hashes(middle); seed.cleaned = true;
      }
      await persist(); report.originalHistoryUnchanged = true; report.emptyRootDraft = true;
    }
  }
  assert.equal(await appPid(), seed.appPid); report.sameAppProcess = true;
  assert.equal(await page.locator('iframe').count(), 0); assert.deepEqual(report.errors, []);
  report.middleId = seed.middleId; report.grandId = seed.grandId; await capture(prefix + '-' + phase); report.passed = true;
} catch (error) {
  report.failure = { name: error.name, message: error.message?.split('\n')[0],
    location: error.stack?.split('\n').find(line => line.includes('verify-latest-live-nested-child-android.mjs:'))?.trim() };
  process.exitCode = 1;
} finally {
  await writeFile(reportPath, JSON.stringify(report, null, 2), { flag: 'wx' }); console.log(JSON.stringify(report)); await device.close();
}
setTimeout(() => process.exit(process.exitCode ?? 0), 200);
