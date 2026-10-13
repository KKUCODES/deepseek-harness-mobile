// 真实模型创建可继续子会话，手机续聊并与原父目录、子历史逐项核对。
import assert from 'node:assert/strict';
import { randomUUID, createHash } from 'node:crypto';
import { access, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { openLatestLiveAndroid } from '../tests/support/latest-live-context.mjs';

const phase = process.argv[2];
assert.ok(['start', 'observe', 'observe-recover', 'observe-navigation', 'continue-start', 'continue-observe', 'replay', 'cleanup', 'unknown-read', 'unknown-read-envelope',
  'cold-baseline', 'cold-observe', 'cold-recovery', 'cold-continue-start', 'cold-continue-observe', 'cold-replay', 'cold-cleanup'].includes(phase));
assert.equal(process.argv.length, 3);
const runtimeState = JSON.parse(await readFile(resolve(import.meta.dirname, '../../plugin/artifacts/latest-runtime-check/latest-live-state.json'), 'utf8'));
assert.ok(['source', 'release'].includes(runtimeState.executionMode));
const retainedPrefix = 'latest-live-' + (runtimeState.executionMode === 'source' ? 'source-' : '') + 'child-model';
const retainedChild = ['cold-observe', 'cold-recovery'].includes(phase)
  ? JSON.parse(await readFile(resolve(import.meta.dirname, '../../plugin/artifacts/latest-runtime-check', retainedPrefix + '-seed.json'), 'utf8')).childId : undefined;
const live = await openLatestLiveAndroid(undefined, { openRecorded: retainedChild === undefined, expectedChildId: retainedChild });
const { state, runtime, session, main, page, device, capture, readSession, readChild } = live;
assert.equal(state.hostPid, runtimeState.hostPid);
assert.equal(state.executionMode, runtimeState.executionMode);
const prefix = 'latest-live-' + (state.executionMode === 'source' ? 'source-' : '') + 'child-model';
const seedPath = resolve(runtime, prefix + '-seed.json'), reportPath = resolve(runtime, prefix + '-android-' + phase + '.json');
const report = { at: new Date().toISOString(), phase, executionMode: state.executionMode, command: state.command,
  hostPid: state.hostPid, parentSessionId: session.sessionId, passed: false, errors: [] };
const input = main.getByRole('textbox', { name: '消息', exact: true }), stop = main.getByRole('button', { name: '停止生成', exact: true });
let seed;
const persist = () => writeFile(seedPath, JSON.stringify(seed, null, 2));
const text = event => JSON.stringify(event.data.message?.content ?? event.data.content ?? []);
async function openChild() {
  await main.getByRole('button', { name: 'Remote 选项', exact: true }).click();
  await page.getByRole('button', { name: '子会话', exact: true }).click();
  const panel = page.getByRole('dialog', { name: '子会话', exact: true });
  const button = panel.getByRole('button', { name: new RegExp(seed.label) });
  await button.waitFor(); assert.equal(await button.count(), 1); assert.match(await button.innerText(), /可继续聊天/);
  await button.click();
  await main.getByRole('button', { name: '返回父会话', exact: true }).waitFor();
  assert.equal(await input.isEnabled(), true);
  const selected = await main.evaluate(element => {
    const key = Object.keys(element).find(name => name.startsWith('__reactFiber$'));
    for (let fiber = element[key]; fiber; fiber = fiber.return)
      if (fiber.memoizedProps?.model?.client) return fiber.memoizedProps.model.getSnapshot().selected;
    throw Error('latest_child_model_missing');
  });
  assert.equal(selected, seed.childId);
}
async function originalChild() {
  const current = await readChild(seed.childId); assert.equal(current.entry.mode, 'continuable');
  assert.equal(current.entry.label, seed.label);
  const rows = current.records.map(row => row.event);
  assert.ok(rows.some(event => event.type === 'assistant/message' && text(event).includes(seed.initialReply)));
  assert.ok(rows.some(event => event.type === 'approval/policy' && event.data.policy === 'never' && event.data.source === 'delegation'));
  assert.ok(rows.filter(event => event.type === 'tool/call').every(event => event.data.name === 'send_message'));
  assert.ok(rows.filter(event => event.type === 'tool/result').every(event => !event.data.message.isError));
  return current;
}
async function continued(cold = false) {
  const reply = cold ? seed.cold.reply : seed.continueReply;
  const prompt = cold ? seed.cold.prompt : seed.continuePrompt;
  const initialSeq = cold ? seed.cold.initialSeq : seed.continueInitialSeq;
  await main.getByRole('article', { name: '模型回复', exact: true }).filter({ hasText: reply }).last().waitFor({ timeout: 90000 });
  await stop.waitFor({ state: 'hidden', timeout: 15000 }); const current = await originalChild();
  const rows = current.records.map(row => row.event).filter(event => event.seq > initialSeq);
  const users = rows.filter(event => event.type === 'user/message'
    && event.data.content?.some(part => part.type === 'text' && part.text === prompt));
  assert.equal(users.length, 1);
  assert.ok(rows.some(event => event.type === 'assistant/message' && text(event).includes(reply)));
  assert.ok(rows.some(event => event.type === 'turn/end' && event.data.reason.kind === 'completed'));
  assert.equal((await input.innerText()).trim(), '');
  assert.equal(await main.getByText('正在发送…', { exact: true }).count(), 0);
  return { childId: seed.childId, asOfSeq: current.projections.asOfSeq,
    userSeq: users[0].seq, source: users[0].data.source,
    replies: rows.filter(event => event.type === 'assistant/message').map(event => ({ seq: event.seq, content: text(event) })),
    results: rows.filter(event => event.type === 'tool/result').map(event => ({ seq: event.seq, callId: event.data.message.toolCallId })) };
}
page.on('pageerror', () => report.errors.push('page-error'));
try {
  await assert.rejects(access(reportPath), { code: 'ENOENT' });
  assert.equal(state.autoReviewDiagnostic, false); assert.ok(['source', 'release'].includes(state.executionMode));
  if (state.executionMode === 'source') {
    const installed = await (await import('../../plugin/compatibility/latest-upstream/source-host.mjs')).verifyInstalledSource();
    assert.equal(installed.sourceCommit, state.sourceCommit); report.sourceFiles = installed.files;
  }
  if (phase === 'start') {
    await assert.rejects(access(seedPath), { code: 'ENOENT' }); const before = await readSession();
    assert.equal(before.row.running, false); assert.equal(before.projections.values.permissions.currentValue, 'workspace-write');
    assert.equal((await input.innerText()).trim(), '');
    const marker = 'DSHM_LATEST_CHILD_' + randomUUID().replaceAll('-', '');
    seed = { home: state.home, parentId: session.sessionId, initialSeq: before.projections.asOfSeq,
      marker, label: 'DSHM 新版可续子会话 ' + marker.slice(-8), initialReply: marker + '_INITIAL',
      rootReply: marker + '_ROOT_DONE', continueReply: marker + '_CONTINUED' };
    const args = { description: seed.label, run_in_background: true,
      prompt: `这是专用 DSHM 子会话测试。不要读写文件、执行命令、联网或创建其它子会话。请回复 ${seed.initialReply}，可以使用 send_message 将结果回报父会话。` };
    seed.prompt = `当前开始独立的 DSHM 可继续子会话验收，先前文件验收已经结束。只调用一次 subagent，参数为 ${JSON.stringify(args)}，不要调用其他工具，不创建其它子会话，不读写文件、不执行命令、不联网。创建后只回复 ${seed.rootReply}；收到子会话结果后也不要调用其它工具。`;
    await writeFile(seedPath, JSON.stringify(seed, null, 2), { flag: 'wx' });
    seed.startAttempted = true; await persist(); await input.fill(seed.prompt);
    await main.getByRole('button', { name: '发送消息', exact: true }).click(); seed.sent = true; await persist(); report.sent = true;
  } else {
    seed = JSON.parse(await readFile(seedPath, 'utf8')); assert.equal(seed.home, state.home); assert.equal(seed.parentId, session.sessionId);
    if (phase === 'observe' || phase === 'observe-recover' || phase === 'observe-navigation') {
      // 子任务可在父首次结算前完成并改变父回复；以原调用/目录核对创建，不限定父措辞。
      await stop.waitFor({ state: 'hidden', timeout: 45000 });
      const parent = await readSession(), rows = parent.records.map(row => row.event).filter(event => event.seq > seed.initialSeq);
      const calls = rows.filter(event => event.type === 'tool/call'); assert.equal(calls.length, 1); assert.equal(calls[0].data.name, 'subagent');
      assert.equal(JSON.parse(calls[0].data.arguments).description, seed.label);
      const entry = parent.projections.values.subagentCatalog.filter(item => item.label === seed.label);
      assert.equal(entry.length, 1); assert.equal(entry[0].mode, 'continuable'); seed.childId = entry[0].id;
      const catalogEvents = rows.filter(event => event.type === 'subagent/catalog' && event.data.childId === seed.childId);
      assert.equal(catalogEvents.length, 1); seed.parentCall = { callId: calls[0].data.callId, callSeq: calls[0].seq, catalogSeq: catalogEvents[0].seq };
      await persist(); await openChild();
      await main.getByRole('article', { name: '模型回复', exact: true }).filter({ hasText: seed.initialReply }).last().waitFor({ timeout: 90000 });
      await stop.waitFor({ state: 'hidden', timeout: 15000 }); const child = await originalChild();
      seed.observed = true; seed.childInitialSeq = child.projections.asOfSeq; await persist();
      report.original = { ...seed.parentCall, childId: seed.childId, childAsOfSeq: seed.childInitialSeq };
    } else if (phase === 'continue-start') {
      assert.equal(seed.observed, true); assert.equal(seed.continueAttempted, undefined); await openChild();
      assert.equal((await input.innerText()).trim(), ''); seed.continueInitialSeq = (await originalChild()).projections.asOfSeq;
      seed.continuePrompt = `这是手机直接续聊测试，不调用任何工具、不发送消息给其他会话，只回复 ${seed.continueReply}。`;
      seed.continueAttempted = true; await persist(); await input.fill(seed.continuePrompt);
      await main.getByRole('button', { name: '发送消息', exact: true }).click(); seed.continueSent = true; await persist(); report.sent = true;
    } else if (phase === 'continue-observe' || phase === 'replay') {
      assert.equal(seed.continueSent, true); await openChild(); report.original = await continued();
      if (phase === 'replay') { assert.deepEqual(report.original, seed.continued); seed.replayed = true; }
      else { seed.continued = report.original; seed.continueObserved = true; } await persist();
    } else if (phase === 'unknown-read' || phase === 'unknown-read-envelope') {
      assert.equal(seed.cold.replayed, true);
      const child = await originalChild();
      const request = { address: { kind: 'subagent', parentSessionId: session.sessionId,
        childSessionId: seed.childId, mode: 'unknown' }, throughSeq: child.projections.asOfSeq, maxMessages: 60 };
      const observed = await main.evaluate(async (element, request) => {
        const key = Object.keys(element).find(name => name.startsWith('__reactFiber$'));
        let model;
        for (let fiber = element[key]; fiber; fiber = fiber.return)
          if (fiber.memoizedProps?.model?.client) { model = fiber.memoizedProps.model; break; }
        if (!model) throw Error('latest_child_model_missing');
        const controller = new AbortController(), timer = setTimeout(() => controller.abort(), 15000);
        try {
          // 原公开地址允许 unknown 冷读取，但必须由原 Host 核对 descriptor 和父身份。
          const result = await model.remote.session.page(request, controller.signal);
          if (!result.ok) throw result.error;
          const mismatch = await model.remote.session.page({ ...request,
            address: { ...request.address, mode: 'one-shot' } }, controller.signal);
          return { records: result.value.records, hasMore: result.value.hasMore,
            mismatchedModeAccepted: mismatch.ok, mismatchedModeCode: mismatch.ok ? undefined : mismatch.error.code };
        } finally { clearTimeout(timer); }
      }, request);
      assert.equal(observed.hasMore, false);
      assert.deepEqual(observed.records, child.records);
      assert.equal(observed.mismatchedModeAccepted, false);
      assert.equal(observed.mismatchedModeCode, 'subagent/unauthorized');
      const after = await originalChild(); assert.deepEqual(after, child);
      assert.equal((await input.innerText()).trim(), ''); assert.equal(await stop.count(), 0);
      report.original = { childId: seed.childId, addressMode: 'unknown', resolvedMode: child.entry.mode,
        asOfSeq: child.projections.asOfSeq, verifiedEvents: observed.records.length,
        mismatchedModeCode: observed.mismatchedModeCode, historyUnchanged: true };
    } else if (phase === 'cold-baseline') {
      assert.equal(seed.replayed, true); assert.equal(seed.cold, undefined);
      await openChild(); const child = await originalChild();
      const rows = child.records.map(row => row.event); assert.equal(rows.length, child.projections.asOfSeq + 1);
      seed.cold = { hostPid: state.hostPid, asOfSeq: child.projections.asOfSeq,
        hashes: rows.map(event => ({ seq: event.seq, type: event.type, hash: createHash('sha256').update(JSON.stringify(event)).digest('hex') })) };
      await persist(); report.original = seed.cold;
    } else if (phase === 'cold-observe' || phase === 'cold-recovery') {
      assert.notEqual(state.hostPid, seed.cold.hostPid);
      const child = await originalChild(), rows = child.records.map(row => row.event);
      assert.deepEqual(rows.filter(event => event.seq <= seed.cold.asOfSeq).map(event => ({ seq: event.seq, type: event.type,
        hash: createHash('sha256').update(JSON.stringify(event)).digest('hex') })), seed.cold.hashes);
      // 原 session/page 与 projections 均不激活 Agent；只读冷历史不能要求 Session 构造器的恢复事件。
      assert.equal(rows.length, seed.cold.hashes.length);
      assert.equal(child.projections.asOfSeq, seed.cold.asOfSeq);
      await main.getByRole('article', { name: '模型回复', exact: true }).filter({ hasText: seed.continueReply }).last().waitFor();
      report.original = { childId: seed.childId, asOfSeq: child.projections.asOfSeq, verifiedEvents: seed.cold.hashes.length };
      report.inputEnabledBeforeParentOpen = await input.isEnabled();
      seed.cold.observed = true; await persist();
    } else if (phase === 'cold-continue-start') {
      assert.equal(seed.cold.observed, true); assert.equal(seed.cold.attempted, undefined); await openChild();
      seed.cold.initialSeq = (await originalChild()).projections.asOfSeq;
      seed.cold.reply = seed.marker + '_COLD_CONTINUED';
      seed.cold.prompt = `这是重启后手机续聊验收，不调用工具、不发送消息给其他会话，只回复 ${seed.cold.reply}。`;
      assert.equal((await input.innerText()).trim(), ''); seed.cold.attempted = true; await persist();
      await input.fill(seed.cold.prompt); await main.getByRole('button', { name: '发送消息', exact: true }).click();
      seed.cold.sent = true; await persist(); report.sent = true;
    } else if (phase === 'cold-continue-observe' || phase === 'cold-replay') {
      assert.equal(seed.cold.sent, true); await openChild(); report.original = await continued(true);
      if (phase === 'cold-replay') { assert.deepEqual(report.original, seed.cold.original); seed.cold.replayed = true; }
      else seed.cold.original = report.original; await persist();
    } else {
      if (phase === 'cold-cleanup') assert.equal(seed.cold.replayed, true);
      assert.equal(seed.replayed, true); assert.equal((await readSession()).projections.values.permissions.currentValue, 'workspace-write');
      assert.equal((await input.innerText()).trim(), ''); assert.equal(await stop.count(), 0);
      assert.equal(await page.getByRole('button', { name: '返回父会话', exact: true }).count(), 0);
      const child = await originalChild(); assert.equal(child.entry.mode, 'continuable');
      seed.cleaned = true; await persist(); report.retainedDedicatedTestHistory = true;
    }
  }
  assert.deepEqual(report.errors, []); await capture(prefix + '-' + phase); report.passed = true;
} catch (error) { report.failure = error.stack; process.exitCode = 1; }
finally { await writeFile(reportPath, JSON.stringify(report, null, 2), { flag: 'wx' }); console.log(JSON.stringify(report)); await device.close(); }
setTimeout(() => process.exit(process.exitCode ?? 0), 200);
