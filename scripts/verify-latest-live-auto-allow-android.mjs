// 聊天模型实际调用原文件工具与 PTC；只读观察真实审核，不提供模型响应或工具结果。
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { access, readFile, writeFile, unlink } from 'node:fs/promises';
import { resolve, dirname, basename } from 'node:path';
import { openLatestLiveAndroid } from '../tests/support/latest-live-context.mjs';

const phase = process.argv[2];
assert.ok(['native-start', 'native-observe', 'native-replay', 'ptc-start', 'ptc-observe', 'ptc-replay',
  'cleanup-native', 'cleanup-ptc', 'cleanup-files', 'unloaded'].includes(phase));
assert.equal(process.argv.length, 3);
const ptc = phase.startsWith('ptc-') || phase === 'cleanup-ptc';
const live = await openLatestLiveAndroid(ptc ? 'latest-live-ptc-session.json' : undefined, { openRecorded: true });
const { runtime, state, session, main, page, device, capture, readSession } = live;
const prefix = 'latest-live-' + (state.executionMode === 'source' ? 'source-' : '') + 'auto-allow';
const seedPath = resolve(runtime, prefix + '-seed.json'), reportPath = resolve(runtime, prefix + '-android-' + phase + '.json');
const controlPath = resolve(state.home, 'latest-auto-review-control.json'), hostPath = resolve(state.home, 'latest-auto-review-host.json');
const report = { at: new Date().toISOString(), phase, executionMode: state.executionMode, command: state.command,
  hostPid: state.hostPid, sessionId: session.sessionId, passed: false, errors: [] };
const persist = () => writeFile(seedPath, JSON.stringify(seed, null, 2));
const host = () => readFile(hostPath, 'utf8').then(JSON.parse);
const input = main.getByRole('textbox', { name: '消息', exact: true });
const stop = main.getByRole('button', { name: '停止生成', exact: true });
let seed;
async function permissions() {
  const panel = page.getByRole('dialog', { name: '会话权限', exact: true });
  if (!await panel.isVisible()) {
    await main.getByRole('button', { name: 'Remote 选项', exact: true }).click();
    await page.getByRole('button', { name: '会话权限', exact: true }).click();
  }
  return panel;
}
async function chooseAuto() {
  const panel = await permissions(); await panel.getByRole('button', { name: 'Auto review', exact: true }).click();
  const confirm = panel.getByRole('group', { name: '确认启用 Auto review（实验）？', exact: true });
  assert.equal(await confirm.getByRole('button', { name: '启用 Auto review', exact: true }).isEnabled(), false);
  await confirm.getByRole('checkbox').check(); await confirm.getByRole('button', { name: '启用 Auto review', exact: true }).click();
  await panel.getByText('当前权限：Auto review', { exact: true }).waitFor();
  await panel.getByRole('button', { name: '关闭窗口', exact: true }).click();
  assert.equal((await readSession()).projections.values.permissions.currentValue, 'auto');
}
async function restored() {
  const panel = await permissions(); await panel.getByRole('button', { name: '工作区内修改', exact: true }).click();
  await panel.getByText('当前权限：工作区内修改', { exact: true }).waitFor();
  await panel.getByRole('button', { name: '关闭窗口', exact: true }).click();
  assert.equal((await readSession()).projections.values.permissions.currentValue, 'workspace-write');
}
async function send(item) {
  assert.equal(item.attempted, undefined); assert.equal((await input.innerText()).trim(), '');
  item.attempted = true; await persist(); await input.fill(item.prompt);
  await main.getByRole('button', { name: '发送消息', exact: true }).click(); item.sent = true; await persist(); report.sent = true;
}
async function verify(item, current, kind) {
  assert.equal(current.row.running, false); assert.equal(current.projections.values.permissions.currentValue, 'auto');
  const events = current.records.map(row => row.event).filter(event => event.seq > item.initialSeq);
  assert.equal(events.filter(event => event.type === 'user/message'
    && event.data.content?.some(part => part.type === 'text' && part.text === item.prompt)).length, 1);
  const calls = events.filter(event => event.type === 'tool/call'), results = events.filter(event => event.type === 'tool/result');
  const snapshot = await host(), reviews = snapshot.reviews.filter(row => row.phase === kind), bodies = snapshot.calls.filter(row => row.phase === kind);
  assert.equal(snapshot.marker, seed.marker); assert.equal(snapshot.sessionId, session.sessionId);
  assert.ok(reviews.every(row => row.started && row.ended && row.finish === 'stop' && !row.aborted && row.risk === 'low' && row.decision === 'allow'));
  assert.ok(events.some(event => event.type === 'assistant/message' && JSON.stringify(event.data).includes(item.reply)));
  assert.equal(events.filter(event => event.type === 'approval/request').length, 0);
  assert.equal(results.length, calls.length); assert.ok(results.every(event => !event.data.message.isError && event.data.error === undefined));
  for (const call of calls) {
    assert.ok(results.some(event => event.data.message.toolCallId === call.data.callId));
    assert.ok(JSON.stringify(call.data).includes(seed.marker));
  }
  if (kind === 'native-allow') {
    assert.deepEqual(calls.map(event => event.data.name), ['read', 'write']);
    assert.deepEqual(reviews.map(row => [row.mode, row.toolName]), [['native', 'read'], ['native', 'write']]);
    assert.deepEqual(bodies.map(row => [row.mode, row.name]), [['native', 'read'], ['native', 'write']]);
    assert.equal(await readFile(item.path, 'utf8'), item.after);
  } else {
    assert.equal(calls.length, 1); assert.equal(calls[0].data.name, 'run_code');
    assert.deepEqual(JSON.parse(calls[0].data.arguments).code, item.code);
    const starts = events.filter(event => event.type === 'tool/ptc-dispatch-start');
    const ends = events.filter(event => event.type === 'tool/ptc-dispatch');
    assert.equal(starts.length, 1); assert.equal(ends.length, 1); assert.equal(starts[0].data.name, 'read');
    assert.equal(starts[0].data.parentCallId, calls[0].data.callId); assert.deepEqual(starts[0].data.arguments, item.args);
    assert.equal(ends[0].data.subCallId, starts[0].data.subCallId); assert.equal(ends[0].data.isError, false);
    assert.deepEqual(reviews.map(row => [row.mode, row.toolName]), [['ptc-inner', 'read']]);
    assert.deepEqual(bodies.map(row => [row.mode, row.name]), [['native', 'run_code'], ['ptc-inner', 'read']]);
    assert.ok(JSON.stringify(results[0].data.message.content).includes(item.before));
    assert.equal(await readFile(item.path, 'utf8'), item.before);
  }
  const turn = main.getByRole('button', { name: /用时/ }).last();
  if (await turn.getAttribute('aria-expanded') === 'false') await turn.click();
  for (const call of calls) await main.locator(`[data-chat-call-id="${call.data.callId}"]`).waitFor();
  if (kind === 'ptc-allow') {
    const child = events.find(event => event.type === 'tool/ptc-dispatch-start');
    const row = main.locator(`[data-chat-call-id="${child.data.subCallId}"]`);
    await row.locator('[data-tool="read"][data-state="ok"]').waitFor();
    await row.getByText(basename(item.path), { exact: true }).waitFor();
  }
  assert.equal(await stop.count(), 0); assert.equal((await input.innerText()).trim(), '');
  return { asOfSeq: current.projections.asOfSeq, calls: calls.map(event => ({ callId: event.data.callId, seq: event.seq, name: event.data.name })),
    results: results.map(event => ({ callId: event.data.message.toolCallId, seq: event.seq })), reviews, bodies };
}
page.on('pageerror', () => report.errors.push('page-error'));
try {
  await assert.rejects(access(reportPath), { code: 'ENOENT' });
  assert.ok(['source', 'release'].includes(state.executionMode));
  if (phase !== 'unloaded') assert.equal(state.autoReviewDiagnostic, true);
  if (state.executionMode === 'source') {
    assert.equal(state.command, 'pnpm dsh web');
    const installed = await (await import('../../plugin/compatibility/latest-upstream/source-host.mjs')).verifyInstalledSource();
    assert.equal(installed.sourceCommit, state.sourceCommit); report.sourceFiles = installed.files; report.sourceCommit = installed.sourceCommit;
  } else assert.equal(state.command, 'node dsh/lib/bin.js web');
  if (phase === 'native-start') {
    for (const path of [seedPath, controlPath, hostPath]) await assert.rejects(access(path), { code: 'ENOENT' });
    const before = await readSession(); assert.equal(before.row.running, false);
    assert.equal(before.projections.values.permissions.currentValue, 'workspace-write');
    const marker = 'DSHM_LATEST_AUTO_' + randomUUID().replaceAll('-', '');
    seed = { at: new Date().toISOString(), home: state.home, marker, sessionId: session.sessionId, permission: 'workspace-write' };
    seed.native = { sessionId: session.sessionId, title: session.title, path: resolve(state.workspacePath, marker + '-native.txt'),
      before: 'BEFORE_' + marker + '\n', after: 'AFTER_' + marker + ' 中文与emoji🙂\n', reply: marker + '_NATIVE_DONE' };
    await writeFile(seedPath, JSON.stringify(seed, null, 2), { flag: 'wx' });
    await writeFile(seed.native.path, seed.native.before, { flag: 'wx' });
    await writeFile(controlPath, JSON.stringify({ marker, sessionId: session.sessionId, phase: 'native-allow' }), { flag: 'wx' });
    await chooseAuto(); seed.native.initialSeq = (await readSession()).projections.asOfSeq;
    seed.native.prompt = `这是独立的 DSHM 自动审核低风险放行验收。只执行本条请求，不补做历史任务。先只调用一次 read 读取 ${basename(seed.native.path)}，再只调用一次 write 将同一文件完整替换为 ${JSON.stringify(seed.native.after)}。不要调用其他工具、不执行命令、不联网、不改其他文件；任一步失败就停止、不重试。成功后只回复 ${seed.native.reply}。`;
    await send(seed.native);
  } else {
    seed = JSON.parse(await readFile(seedPath, 'utf8')); assert.equal(seed.home, state.home);
    if (phase === 'ptc-start') {
      assert.equal(seed.native.replayed, true); assert.equal(seed.ptc, undefined);
      const before = await readSession(); assert.equal(before.row.running, false);
      assert.equal(before.projections.values.agentPreset, 'ptc'); assert.equal(before.projections.values.permissions.currentValue, 'workspace-write');
      seed.ptc = { sessionId: session.sessionId, title: session.title, path: resolve(state.workspacePath, seed.marker + '-ptc.txt'),
        before: 'PTC_' + seed.marker, reply: seed.marker + '_PTC_DONE' };
      seed.ptc.args = { file_path: seed.ptc.path };
      seed.ptc.code = `const value = await tools.read(${JSON.stringify(seed.ptc.args)}); console.log(JSON.stringify(value));`;
      seed.ptc.prompt = `这是 DSHM 自动审核 PTC 内层读取验收，只执行当前请求，不补做历史任务。只调用一次 run_code，code必须逐字为：${seed.ptc.code}。timeoutMs=120000。程序内部只允许这一次 read，不直接读文件、不调用其他工具、不写入、不联网、不执行命令；失败或被拒绝就停止，不重试。成功后只回复 ${seed.ptc.reply}。`;
      await persist(); await writeFile(seed.ptc.path, seed.ptc.before, { flag: 'wx' });
      const currentControl = JSON.parse(await readFile(controlPath, 'utf8'));
      assert.deepEqual(currentControl, { marker: seed.marker, sessionId: seed.sessionId, phase: 'native-allow' });
      await writeFile(controlPath, JSON.stringify({ marker: seed.marker, sessionId: session.sessionId, phase: 'ptc-allow' }));
      await chooseAuto(); seed.ptc.initialSeq = (await readSession()).projections.asOfSeq; await send(seed.ptc);
    } else if (phase.endsWith('-observe') || phase.endsWith('-replay')) {
      const item = ptc ? seed.ptc : seed.native; assert.equal(item.sessionId, session.sessionId); assert.equal(item.sent, true);
      if (phase.endsWith('-replay')) {
        assert.equal(item.observed, true); await main.locator('.remote-topbar').getByRole('button', { name: '返回', exact: true }).click();
        await main.locator('.remote-session-row').filter({ hasText: item.title }).click();
      }
      await main.getByRole('article', { name: '模型回复', exact: true }).filter({ hasText: item.reply }).waitFor({ timeout: 45000 });
      await stop.waitFor({ state: 'hidden', timeout: 15000 });
      report.original = await verify(item, await readSession(), ptc ? 'ptc-allow' : 'native-allow');
      if (phase.endsWith('-replay')) { assert.deepEqual(report.original, item.original); item.replayed = true; }
      else { item.original = report.original; item.observed = true; }
      await persist();
    } else if (phase === 'cleanup-native' || phase === 'cleanup-ptc') {
      const item = ptc ? seed.ptc : seed.native; assert.equal(item.sessionId, session.sessionId); assert.equal(item.replayed, true);
      assert.equal((await readSession()).row.running, false); await restored(); item.permissionRestored = true; await persist();
    } else if (phase === 'cleanup-files') {
      assert.equal(seed.sessionId, session.sessionId); assert.equal(seed.native.permissionRestored, true); assert.equal(seed.ptc.permissionRestored, true);
      const end = Date.now() + 10000; let snapshot;
      do { snapshot = await host(); if (snapshot.autoSessions === 0) break; assert.ok(Date.now() < end); await new Promise(done => setTimeout(done, 150)); } while (true);
      assert.equal(snapshot.autoSessions, 0); assert.equal(snapshot.current, 'workspace-write');
      for (const item of [seed.native, seed.ptc]) {
        assert.equal(dirname(item.path), resolve(state.workspacePath)); assert.ok(basename(item.path).startsWith(seed.marker));
        assert.equal(await readFile(item.path, 'utf8'), item.after ?? item.before);
      }
      assert.deepEqual(JSON.parse(await readFile(controlPath, 'utf8')), { marker: seed.marker, sessionId: seed.ptc.sessionId, phase: 'ptc-allow' });
      await writeFile(resolve(runtime, prefix + '-host-final.json'), JSON.stringify(snapshot, null, 2), { flag: 'wx' });
      await unlink(controlPath); await new Promise(done => setTimeout(done, 500)); await unlink(hostPath);
      for (const item of [seed.native, seed.ptc]) await unlink(item.path);
      seed.cleaned = true; await persist(); report.controlsRemoved = true; report.host = snapshot;
    } else {
      assert.equal(phase, 'unloaded'); assert.equal(seed.cleaned, true); assert.equal(state.autoReviewDiagnostic, false);
      for (const path of [controlPath, hostPath, seed.native.path, seed.ptc.path]) await assert.rejects(access(path), { code: 'ENOENT' });
      const panel = await permissions(); await panel.getByText('当前权限：工作区内修改', { exact: true }).waitFor();
      await panel.getByRole('button', { name: 'Auto review', exact: true }).waitFor({ state: 'hidden' });
      await panel.getByRole('button', { name: '关闭窗口', exact: true }).click();
      assert.equal((await readSession()).projections.values.permissions.currentValue, 'workspace-write');
      assert.equal((await input.innerText()).trim(), ''); assert.equal(await stop.count(), 0); report.optionRemoved = true;
    }
  }
  assert.deepEqual(report.errors, []); await capture(prefix + '-' + phase); report.passed = true;
} catch (error) { report.failure = error.stack; process.exitCode = 1; }
finally { await writeFile(reportPath, JSON.stringify(report, null, 2), { flag: 'wx' }); console.log(JSON.stringify(report)); await device.close(); }
setTimeout(() => process.exit(process.exitCode ?? 0), 200);
