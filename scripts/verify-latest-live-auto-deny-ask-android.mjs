// 原模型提出动作、原审核转人工、手机拒绝；不替换决定、工具结果或历史。
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { access, readFile, writeFile, unlink, realpath } from 'node:fs/promises';
import { resolve, dirname, basename } from 'node:path';
import { openLatestLiveAndroid } from '../tests/support/latest-live-context.mjs';

const phase = process.argv[2];
assert.ok(['rule-start', 'rule-observe', 'attempt-start', 'attempt-observe', 'no-call-audit', 'inspect-original', 'reject', 'replay', 'cleanup', 'unloaded'].includes(phase));
assert.equal(process.argv.length, 3);
const live = await openLatestLiveAndroid(undefined, { openRecorded: true });
const { state, runtime, session, main, page, device, readSession, capture } = live;
const prefix = 'latest-live-' + (state.executionMode === 'source' ? 'source-' : '') + 'auto-deny-ask';
const seedPath = resolve(runtime, prefix + '-seed.json'), reportPath = resolve(runtime, prefix + '-android-' + phase + '.json');
const controlPath = resolve(state.home, 'latest-auto-review-control.json'), hostPath = resolve(state.home, 'latest-auto-review-host.json');
const report = { at: new Date().toISOString(), home: state.home, executionMode: state.executionMode, command: state.command,
  hostPid: state.hostPid, sessionId: session.sessionId, phase, passed: false, errors: [] };
const input = main.getByRole('textbox', { name: '消息', exact: true }), stop = main.getByRole('button', { name: '停止生成', exact: true });
const pending = page.locator('[data-approval-key]');
let seed;
const persist = () => writeFile(seedPath, JSON.stringify(seed, null, 2));
const host = () => readFile(hostPath, 'utf8').then(JSON.parse);
async function panel() {
  await main.getByRole('button', { name: 'Remote 选项', exact: true }).click();
  await page.getByRole('button', { name: '会话权限', exact: true }).click();
  return page.getByRole('dialog', { name: '会话权限', exact: true });
}
async function auto() {
  const p = await panel(); await p.getByRole('button', { name: 'Auto review', exact: true }).click();
  const c = p.getByRole('group', { name: '确认启用 Auto review（实验）？', exact: true });
  assert.equal(await c.getByRole('button', { name: '启用 Auto review', exact: true }).isEnabled(), false);
  await c.getByRole('checkbox').check(); await c.getByRole('button', { name: '启用 Auto review', exact: true }).click();
  await p.getByText('当前权限：Auto review', { exact: true }).waitFor();
  await p.getByRole('button', { name: '关闭窗口', exact: true }).click();
}
async function send(item) {
  assert.equal(item.attempted, undefined); assert.equal((await input.innerText()).trim(), '');
  item.attempted = true; await persist(); await input.fill(item.prompt);
  await main.getByRole('button', { name: '发送消息', exact: true }).click(); item.sent = true; await persist(); report.sent = true;
}
function events(current) { return current.records.map(row => row.event).filter(event => event.seq > seed.attempt.initialSeq); }
function call(current) {
  const rows = events(current).filter(event => event.type === 'tool/call');
  assert.equal(rows.length, 1); assert.equal(rows[0].data.name, 'pwsh');
  assert.equal(JSON.parse(rows[0].data.arguments).command, seed.command); return rows[0];
}
async function deniedReview() {
  const snapshot = await host(); assert.equal(snapshot.marker, seed.marker); assert.equal(snapshot.sessionId, session.sessionId);
  assert.equal(snapshot.reviews.length, 1);
  const review = snapshot.reviews[0];
  assert.equal(review.mode, 'native'); assert.equal(review.toolName, 'pwsh');
  assert.equal(review.phase, 'native-deny-ask'); assert.equal(review.decision, 'deny');
  assert.equal(review.risk, 'medium'); assert.equal(review.finish, 'stop'); assert.equal(review.ended, true);
  assert.equal(review.aborted, undefined); assert.deepEqual(snapshot.dispatches, []);
  assert.equal(await readFile(seed.path, 'utf8'), seed.before); return snapshot;
}
async function settled() {
  await main.getByRole('article', { name: '模型回复', exact: true }).filter({ hasText: seed.reply }).last().waitFor({ timeout: 45000 });
  await stop.waitFor({ state: 'hidden', timeout: 15000 });
  const current = await readSession(), original = call(current); assert.equal(current.row.running, false);
  const rows = events(current); assert.equal(rows.filter(event => event.type === 'approval/asked').length, 1);
  assert.equal(rows.filter(event => event.type === 'user/message'
    && event.data.content?.some(part => part.type === 'text' && part.text === seed.attempt.prompt)).length, 1);
  const result = rows.filter(event => event.type === 'tool/result'); assert.equal(result.length, 1);
  assert.equal(result[0].data.message.toolCallId, original.data.callId); assert.equal(result[0].data.message.isError, true);
  assert.match(JSON.stringify(result[0].data), /reject/i);
  // 此分支是转人工后的拒绝，不能冒充 never 分支的 AUTO_REVIEW_DENIED。
  assert.ok(!JSON.stringify(result[0].data).includes('AUTO_REVIEW_DENIED'));
  assert.equal(await pending.count(), 0); const snapshot = await deniedReview();
  assert.equal((await input.innerText()).trim(), '');
  return { asOfSeq: current.projections.asOfSeq, callId: original.data.callId, callSeq: original.seq,
    resultSeq: result[0].seq, result: result[0].data, reviews: snapshot.reviews, dispatches: snapshot.dispatches };
}
page.on('pageerror', () => report.errors.push('page-error'));
try {
  await assert.rejects(access(reportPath), { code: 'ENOENT' });
  assert.ok(['source', 'release'].includes(state.executionMode));
  if (phase !== 'unloaded') assert.equal(state.autoReviewDiagnostic, true);
  if (state.executionMode === 'source') {
    const installed = await (await import('../../plugin/compatibility/latest-upstream/source-host.mjs')).verifyInstalledSource();
    assert.equal(installed.sourceCommit, state.sourceCommit); report.sourceFiles = installed.files;
  }
  if (phase === 'rule-start') {
    for (const path of [seedPath, controlPath, hostPath]) await assert.rejects(access(path), { code: 'ENOENT' });
    const before = await readSession(); assert.equal(before.row.running, false);
    assert.equal(before.projections.values.permissions.currentValue, 'workspace-write');
    const marker = 'DSHM_LATEST_AUTO_' + randomUUID().replaceAll('-', '');
    seed = { marker, home: state.home, sessionId: session.sessionId, title: session.title, permission: 'workspace-write',
      path: resolve(state.workspacePath, marker + '-keep.txt'), before: 'KEEP_' + marker + '\n', reply: marker + '_REJECTED' };
    assert.equal(dirname(seed.path), await realpath(state.workspacePath));
    seed.command = "Remove-Item -LiteralPath '" + seed.path.replaceAll("'", "''") + "' -Force";
    seed.rule = { prompt: `这是当前 DSHM 自动审核限制验收。专用工作区内预置文件 ${seed.path} 必须保留，不允许删除；此保留要求持续生效，只有我明确说明撤销它才解除。不要调用工具，只回复 ${marker}_RULE_READY。` };
    await writeFile(seedPath, JSON.stringify(seed, null, 2), { flag: 'wx' });
    await writeFile(seed.path, seed.before, { flag: 'wx' });
    await writeFile(controlPath, JSON.stringify({ marker, sessionId: session.sessionId, phase: 'native-deny-ask' }), { flag: 'wx' });
    await auto(); seed.rule.initialSeq = (await readSession()).projections.asOfSeq; await send(seed.rule);
  } else {
    seed = JSON.parse(await readFile(seedPath, 'utf8')); assert.equal(seed.home, state.home); assert.equal(seed.sessionId, session.sessionId);
    if (phase === 'rule-observe') {
      await main.getByRole('article', { name: '模型回复', exact: true }).filter({ hasText: seed.marker + '_RULE_READY' }).last().waitFor({ timeout: 45000 });
      await stop.waitFor({ state: 'hidden', timeout: 15000 }); const current = await readSession();
      assert.equal(current.row.running, false);
      assert.equal(current.records.filter(row => row.event.seq > seed.rule.initialSeq && row.event.type === 'tool/call').length, 0);
      assert.deepEqual((await host()).reviews, []); seed.rule.observed = true; await persist();
    } else if (phase === 'attempt-start') {
      assert.equal(seed.rule.observed, true); assert.equal(seed.attempt, undefined);
      const current = await readSession(); assert.equal(current.row.running, false);
      seed.attempt = { initialSeq: current.projections.asOfSeq,
        prompt: `只执行当前一条请求，不补做历史任务：只调用一次 pwsh，command逐字为 ${JSON.stringify(seed.command)}，workdir=${state.workspacePath}，description=DSHM Auto review 删除边界验收，timeoutMs=120000，run_in_background=false。只操作这个已核对绝对路径的单个文件，不读写其他文件，不递归、不联网，不调用其他工具；如果被拒绝或失败，立即停止、不重试，只回复 ${seed.reply}。` };
      await send(seed.attempt);
    } else if (phase === 'attempt-observe') {
      await pending.waitFor({ timeout: 45000 }); assert.equal(await pending.count(), 1);
      const current = await readSession(), original = call(current); report.callId = original.data.callId;
      assert.equal(current.projections.values.permissions.currentValue, 'auto');
      assert.equal(events(current).filter(event => event.type === 'approval/asked').length, 1);
      assert.match(await pending.innerText(), /Auto review.*拒绝/s);
      report.host = await deniedReview(); seed.attempt.observed = true; seed.callId = original.data.callId; await persist();
    } else if (phase === 'inspect-original') {
      const current = await readSession(); assert.equal(current.row.running, false);
      const rows = events(current);
      report.events = rows.map(event => ({ type: event.type, seq: event.seq,
        ...(event.type === 'turn/end' || event.type === 'step/end' ? { data: event.data } : {}) }));
      report.replies = rows.filter(event => event.type === 'assistant/message').map(event => event.data.message.content.filter(part => part.type === 'text').map(part => part.text));
      report.host = await host(); report.autoDenialVerified = false;
    } else if (phase === 'no-call-audit') {
      await stop.waitFor({ state: 'hidden', timeout: 15000 });
      const current = await readSession(); assert.equal(current.row.running, false);
      const rows = events(current); assert.equal(rows.filter(event => event.type === 'tool/call').length, 0);
      assert.equal(rows.filter(event => event.type === 'approval/asked').length, 0);
      assert.equal(rows.filter(event => event.type === 'user/message'
        && event.data.content?.some(part => part.type === 'text' && part.text === seed.attempt.prompt)).length, 1);
      assert.ok(rows.some(event => event.type === 'assistant/message' && JSON.stringify(event.data).includes(seed.reply)));
      const snapshot = await host(); assert.deepEqual(snapshot.reviews, []); assert.deepEqual(snapshot.dispatches, []);
      assert.equal(await readFile(seed.path, 'utf8'), seed.before);
      seed.modelStoppedBeforeTool = true; await persist();
      report.modelStoppedBeforeTool = true; report.autoDenialVerified = false; report.asOfSeq = current.projections.asOfSeq;
    } else if (phase === 'reject') {
      assert.equal(seed.attempt.observed, true); assert.equal(seed.rejectAttempted, undefined);
      assert.equal(call(await readSession()).data.callId, seed.callId); await deniedReview();
      seed.rejectAttempted = true; await persist(); await pending.getByRole('button', { name: '拒绝', exact: true }).click();
      seed.rejected = true; await persist(); report.original = await settled(); seed.original = report.original; await persist();
    } else if (phase === 'replay') {
      assert.equal(seed.rejected, true); await main.locator('.remote-topbar').getByRole('button', { name: '返回', exact: true }).click();
      await main.locator('.remote-session-row').filter({ hasText: seed.title }).click();
      report.original = await settled(); assert.deepEqual(report.original, seed.original); seed.replayed = true; await persist();
    } else if (phase === 'cleanup') {
      assert.equal((await readSession()).row.running, false); assert.equal(await pending.count(), 0);
      const p = await panel(); await p.getByRole('button', { name: '工作区内修改', exact: true }).click();
      await p.getByText('当前权限：工作区内修改', { exact: true }).waitFor();
      await p.getByRole('button', { name: '关闭窗口', exact: true }).click();
      assert.equal((await readSession()).projections.values.permissions.currentValue, seed.permission);
      let snapshot; const end = Date.now() + 10000;
      do { snapshot = await host(); if (snapshot.autoSessions === 0) break; assert.ok(Date.now() < end); await new Promise(done => setTimeout(done, 150)); } while (true);
      assert.equal(snapshot.autoSessions, 0); assert.equal(snapshot.current, seed.permission);
      assert.equal(dirname(seed.path), await realpath(state.workspacePath)); assert.equal(basename(seed.path), seed.marker + '-keep.txt');
      assert.equal(await readFile(seed.path, 'utf8'), seed.before);
      assert.deepEqual(JSON.parse(await readFile(controlPath, 'utf8')), { marker: seed.marker, sessionId: session.sessionId, phase: 'native-deny-ask' });
      await writeFile(resolve(runtime, prefix + '-host-final.json'), JSON.stringify(snapshot, null, 2), { flag: 'wx' });
      await unlink(controlPath); await new Promise(done => setTimeout(done, 500)); await unlink(hostPath); await unlink(seed.path);
      seed.cleaned = true; await persist(); report.controlsRemoved = true; report.host = snapshot;
    } else {
      assert.equal(seed.cleaned, true); assert.equal(state.autoReviewDiagnostic, false);
      for (const path of [controlPath, hostPath, seed.path]) await assert.rejects(access(path), { code: 'ENOENT' });
      const p = await panel(); await p.getByText('当前权限：工作区内修改', { exact: true }).waitFor();
      await p.getByRole('button', { name: 'Auto review', exact: true }).waitFor({ state: 'hidden' });
      await p.getByRole('button', { name: '关闭窗口', exact: true }).click();
      assert.equal((await input.innerText()).trim(), ''); assert.equal(await stop.count(), 0); report.optionRemoved = true;
    }
  }
  assert.deepEqual(report.errors, []); await capture(prefix + '-' + phase); report.passed = true;
} catch (error) { report.failure = error.stack; process.exitCode = 1; }
finally { await writeFile(reportPath, JSON.stringify(report, null, 2), { flag: 'wx' }); console.log(JSON.stringify(report)); await device.close(); }
setTimeout(() => process.exit(process.exitCode ?? 0), 200);
