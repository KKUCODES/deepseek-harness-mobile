import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { openLatestLiveAndroid } from '../tests/support/latest-live-context.mjs';

const phase = process.argv[2];
assert.ok(['start', 'inspect', 'stop', 'observe', 'replay', 'resume', 'resume-observe', 'return'].includes(phase));
const executionMode = process.argv[3] ?? 'source'; assert.ok(['source', 'release'].includes(executionMode));
assert.ok(process.argv.length <= 4);
const prefix = executionMode === 'source' ? 'latest-live-source-ptc-inner' : 'latest-live-release-ptc-inner';
const live = await openLatestLiveAndroid('latest-live-ptc-session.json', { openRecorded: true });
const { runtime, state, session, main, page, device, capture, readSession } = live;
const seedPath = resolve(runtime, prefix + '-seed.json');
const report = { at: new Date().toISOString(), phase, passed: false, hostPid: state.hostPid, sessionId: session.sessionId };
const persist = seed => writeFile(seedPath, JSON.stringify(seed, null, 2));
const delay = () => new Promise(done => setTimeout(done, 150));
const alive = pid => {
  assert.ok(Number.isSafeInteger(pid) && pid > 0);
  try { process.kill(pid, 0); return true; }
  catch (error) { if (error.code === 'ESRCH') return false; throw error; }
};
let seed;
try {
  assert.equal(state.executionMode, executionMode); report.executionMode = executionMode;
  if (executionMode === 'source') {
    assert.equal(state.command, 'pnpm dsh web');
    const { verifyInstalledSource } = await import('../../plugin/compatibility/latest-upstream/source-host.mjs');
    const installed = await verifyInstalledSource(); assert.equal(installed.sourceCommit, state.sourceCommit);
    report.sourceCommit = installed.sourceCommit; report.sourceFiles = installed.files;
  } else {
    const pkg = JSON.parse(await readFile(resolve(runtime, 'node_modules/@deepseek-ai/dsh/package.json'), 'utf8'));
    assert.equal(pkg.name, '@deepseek-ai/dsh'); assert.equal(pkg.version, '0.2.1-alpha.1');
    const original = await readFile(resolve(runtime, 'patch-originals/tools-index.js'));
    const digest = value => createHash('sha256').update(value).digest('hex');
    assert.equal(digest(original), '2e9b6a72ba6b917197965c08eb894d4e8d01dc6f81e0e1c9870a5ae8514687a7');
    const { transformLatestToolCancellation } = await import('../../plugin/compatibility/latest-upstream/tool-cancellation.mjs');
    const current = await readFile(resolve(runtime, 'node_modules/@deepseek-ai/dsh-tools/lib/index.js'));
    assert.equal(digest(current), digest(transformLatestToolCancellation(original.toString())));
    report.releaseVersion = pkg.version; report.originalToolsVerified = true; report.cancellationPayloadSha256 = digest(current);
  }
  const original = await readSession(); assert.equal(original.projections.values.agentPreset, 'ptc');
  if (phase === 'start') {
    assert.equal(original.row.running, false);
    assert.equal(original.projections.values.permissions.currentValue, 'workspace-write');
    await main.getByRole('button', { name: 'Remote 选项', exact: true }).click();
    await page.getByRole('button', { name: '会话权限', exact: true }).click();
    const permissions = page.getByRole('dialog', { name: '会话权限', exact: true });
    await permissions.getByRole('button', { name: '仅可查看', exact: true }).click();
    await permissions.getByRole('button', { name: '仅可查看', exact: true }).and(permissions.locator('[aria-pressed="true"]')).waitFor();
    await permissions.getByRole('button', { name: '关闭窗口', exact: true }).click();
    const before = await readSession(); assert.equal(before.projections.values.permissions.currentValue, 'read-only');
    seed = { at: new Date().toISOString(), home: state.home, sessionId: session.sessionId,
      marker: 'DSHM_PTC_INNER_' + randomUUID().replaceAll('-', '').slice(0, 12),
      finish: 'DSHM_PTC_INNER_UNEXPECTED_FINISH', initialSeq: before.projections.asOfSeq };
    seed.command = `Write-Output '${seed.marker}'; Write-Output "DSHM_PTC_INNER_PID=$PID"; Start-Sleep -Seconds 90; Write-Output '${seed.finish}'`;
    seed.args = { description: '等待手机停止内部只读命令', command: seed.command,
      workdir: state.workspacePath, timeoutMs: 120000, run_in_background: false };
    seed.code = `console.log("${seed.marker}"); await tools.pwsh(${JSON.stringify(seed.args)}); console.log("${seed.finish}");`;
    await writeFile(seedPath, JSON.stringify(seed, null, 2), { flag: 'wx' });
    const input = main.getByRole('textbox', { name: '消息', exact: true }); assert.equal((await input.innerText()).trim(), '');
    await input.fill(`这是独立的 DSHM PTC 内部真实进程停止验收。不要补做历史请求。只调用一次 run_code，code 必须逐字为：${seed.code}。timeoutMs=180000。只允许此程序内部的一次 pwsh，不直接调用其他工具；不读写文件、不联网、不提权、不重试。等待我从手机停止。`);
    seed.attempted = true; await persist(seed);
    await main.getByRole('button', { name: '发送消息', exact: true }).click();
    seed.sent = true; await persist(seed); report.sent = true;
  } else {
    seed = JSON.parse(await readFile(seedPath, 'utf8'));
    assert.equal(seed.home, state.home); assert.equal(seed.sessionId, session.sessionId); assert.equal(seed.sent, true);
    const audit = current => {
      const events = current.records.map(item => item.event).filter(event => event.seq > seed.initialSeq);
      const calls = events.filter(event => event.type === 'tool/call');
      assert.equal(calls.length, 1); assert.equal(calls[0].data.name, 'run_code');
      const args = JSON.parse(calls[0].data.arguments); assert.equal(args.code, seed.code); assert.equal(args.timeoutMs, 180000);
      const children = events.filter(event => event.type === 'tool/ptc-dispatch-start');
      assert.equal(children.length, 1); assert.equal(children[0].data.name, 'pwsh');
      assert.equal(children[0].data.parentCallId, calls[0].data.callId);
      assert.deepEqual(children[0].data.arguments, seed.args);
      return { events, callId: calls[0].data.callId, childId: children[0].data.subCallId };
    };
    if (phase === 'inspect' || phase === 'stop') {
      const end = Date.now() + 45000;
      let held;
      do {
        held = await readSession();
        if (held.records.some(item => item.event.type === 'tool/ptc-dispatch-start' && item.event.seq > seed.initialSeq)) break;
        assert.ok(held.row.running && Date.now() < end, 'latest_ptc_inner_start_missing'); await delay();
      } while (true);
      const current = audit(held); seed.callId = current.callId; seed.childId = current.childId;
      report.running = held.row.running; report.snapshot = await main.ariaSnapshot();
      await capture(prefix + '-running'); await persist(seed);
      if (phase === 'stop') {
        assert.equal(seed.stopAttempted, undefined); assert.equal(held.row.running, true);
        assert.ok(seed.pidObservedAlive === true && alive(seed.pid), 'Observe the original child PID before stopping');
        seed.stopAttempted = true; await persist(seed);
        await main.getByRole('button', { name: '停止生成', exact: true }).click();
        seed.stopped = true; await persist(seed); report.stopSent = true;
      }
    } else if (phase === 'observe' || phase === 'replay') {
      assert.equal(seed.stopped, true);
      if (phase === 'replay') {
        await main.locator('.remote-topbar').getByRole('button', { name: '返回', exact: true }).click();
        await main.locator('.remote-session-row').filter({ hasText: session.title }).click();
      }
      await main.getByRole('button', { name: '停止生成', exact: true }).waitFor({ state: 'hidden', timeout: 60000 });
      const after = await readSession(); assert.equal(after.row.running, false);
      const current = audit(after); assert.equal(current.callId, seed.callId); assert.equal(current.childId, seed.childId);
      const results = current.events.filter(event => event.type === 'tool/result'); assert.equal(results.length, 1);
      const children = current.events.filter(event => event.type === 'tool/ptc-dispatch'); assert.equal(children.length, 1);
      report.originalOuter = results[0].data; report.originalChild = children[0].data;
      assert.equal(report.originalOuter.message.toolCallId, seed.callId);
      assert.equal(report.originalOuter.error.code, 'ABORTED'); assert.equal(report.originalOuter.message.isError, true);
      assert.equal(report.originalChild.subCallId, seed.childId); assert.equal(report.originalChild.error.code, 'ABORTED');
      assert.equal(report.originalChild.isError, true);
      const output = report.originalOuter.message.content.map(part => part.text ?? '').join('\n');
      assert.ok(output.includes('Captured output:\n' + seed.marker)); assert.ok(!output.includes(seed.finish));
      assert.equal(alive(seed.pid), false);
      report.processGone = true; report.noRetry = true; report.partialOutputRetained = true;
      const turn = main.getByRole('button', { name: /用时/ }).last();
      if (await turn.getAttribute('aria-expanded') === 'false') await turn.click();
      assert.match(seed.callId, /^[A-Za-z0-9_:-]+$/); assert.match(seed.childId, /^[A-Za-z0-9_:-]+$/);
      const parentRow = main.locator(`[data-chat-call-id="${seed.callId}"]`);
      const childRow = parentRow.locator(`[data-chat-call-id="${seed.childId}"]`);
      await parentRow.locator('[data-tool="run_code"][data-state="stopped"]').waitFor();
      await childRow.locator('[data-tool="pwsh"][data-state="stopped"]').waitFor();
      await childRow.getByRole('button', { name: '运行命令 工具调用已停止', exact: true }).waitFor();
      report.phoneParentAndChildStopped = true;
      report.snapshot = await main.ariaSnapshot(); await capture(prefix + '-' + phase);
      report.passed = true;
    } else if (phase === 'resume') {
      const observed = JSON.parse(await readFile(resolve(runtime, prefix + '-android-observe.json'), 'utf8'));
      assert.equal(observed.passed, true); assert.equal(original.row.running, false); assert.equal(seed.resumeAttempted, undefined);
      seed.resumeMarker = 'DSHM_PTC_INNER_RESUMED_' + randomUUID().replaceAll('-', '').slice(0, 12);
      seed.resumeInitialSeq = original.projections.asOfSeq;
      await main.getByRole('textbox', { name: '消息', exact: true }).fill('内部停止验收已完成。不要调用工具，只回复 ' + seed.resumeMarker);
      seed.resumeAttempted = true; await persist(seed); await main.getByRole('button', { name: '发送消息', exact: true }).click();
      seed.resumeSent = true; await persist(seed); report.resumeSent = true;
    } else if (phase === 'resume-observe') {
      assert.equal(seed.resumeSent, true);
      await main.getByRole('article', { name: '模型回复', exact: true }).filter({ hasText: seed.resumeMarker }).waitFor({ timeout: 60000 });
      await main.getByRole('button', { name: '停止生成', exact: true }).waitFor({ state: 'hidden' });
      const after = await readSession(); assert.equal(after.row.running, false);
      assert.equal(after.records.filter(item => item.event.type === 'tool/call' && item.event.seq > seed.resumeInitialSeq).length, 0);
      await capture(prefix + '-resumed'); report.passed = true;
    } else {
      assert.equal(original.row.running, false);
      await main.getByRole('button', { name: 'Remote 选项', exact: true }).click();
      await page.getByRole('button', { name: '会话权限', exact: true }).click();
      const permissions = page.getByRole('dialog', { name: '会话权限', exact: true });
      await permissions.getByRole('button', { name: '工作区内修改', exact: true }).click();
      await permissions.getByRole('button', { name: '工作区内修改', exact: true }).and(permissions.locator('[aria-pressed="true"]')).waitFor();
      await permissions.getByRole('button', { name: '关闭窗口', exact: true }).click();
      assert.equal((await readSession()).projections.values.permissions.currentValue, 'workspace-write'); report.permissionRestored = true;
      await main.locator('.remote-topbar').getByRole('button', { name: '返回', exact: true }).click();
      await main.locator('.remote-session-row').filter({ hasText: 'DSHM 新版手机真实模型验收' }).click();
      await main.getByRole('textbox', { name: '消息', exact: true }).waitFor(); report.returnedToPrimary = true;
    }
  }
} catch (error) {
  report.failure = { name: error.name, code: error.code ?? 'validation_failed', message: error.message,
    location: error.stack?.split('\n').find(line => line.includes('verify-latest-live-ptc-inner-android.mjs:'))?.trim() };
  process.exitCode = 1;
} finally {
  await writeFile(resolve(runtime, prefix + '-android-' + phase + '.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report)); await device.close();
}
setTimeout(() => process.exit(process.exitCode ?? 0), 200);
