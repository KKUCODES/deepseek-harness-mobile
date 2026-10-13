import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile, readdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { openLatestLiveAndroid } from '../tests/support/latest-live-context.mjs';

const phase = process.argv[2]; assert.ok(['open', 'prepare', 'start', 'retry-readonly', 'stop', 'observe', 'replay', 'resume', 'resume-observe', 'return'].includes(phase));
const scenario = process.argv[3] ?? 'read-only';
assert.ok(['read-only', 'workspace-write'].includes(scenario));
const sourceMode = process.argv[4] === 'source';
assert.ok(process.argv[4] === undefined || sourceMode); assert.ok(process.argv.length <= 5);
if (sourceMode) {
  assert.ok(!['open', 'prepare', 'retry-readonly'].includes(phase));
}
assert.ok(scenario !== 'workspace-write' || !['prepare', 'retry-readonly'].includes(phase));
const prefix = sourceMode ? (scenario === 'workspace-write' ? 'latest-live-source-ptc-writable' : 'latest-live-source-ptc')
  : scenario === 'workspace-write' ? 'latest-live-ptc-writable' : 'latest-live-ptc';
const live = await openLatestLiveAndroid(['prepare', 'open'].includes(phase) ? undefined : 'latest-live-ptc-session.json', { preparingPtc: phase === 'prepare', openRecorded: sourceMode });
const { runtime, state, session, device, page, main, capture, readSession } = live;
const sessionPath = resolve(runtime, 'latest-live-ptc-session.json');
const seedPath = resolve(runtime, prefix + '-seed.json');
const report = { at: new Date().toISOString(), phase, scenario, passed: false, executionMode: state.executionMode ?? 'release', hostPid: state.hostPid };
let seed;
try {
  if (sourceMode) {
    assert.equal(state.executionMode, 'source'); assert.equal(state.command, 'pnpm dsh web');
    const { verifyInstalledSource } = await import('../../plugin/compatibility/latest-upstream/source-host.mjs');
    const installed = await verifyInstalledSource(); assert.equal(installed.sourceCommit, state.sourceCommit);
    report.sourceCommit = installed.sourceCommit; report.sourceFiles = installed.files;
  }
  if (phase === 'open') {
    const target = JSON.parse(await readFile(sessionPath, 'utf8'));
    assert.equal(target.home, state.home); assert.match(target.sessionId, /^session-[0-9a-f-]{36}$/);
    assert.equal(target.title, 'DSHM 新版 PTC 取消验收');
    assert.equal((await readSession()).row.running, false);
    await main.locator('.remote-topbar').getByRole('button', { name: '返回', exact: true }).click();
    await main.locator('.remote-session-row').filter({ hasText: target.title }).click();
    await main.locator('.remote-heading strong').getByText(target.title, { exact: true }).waitFor();
    report.opened = true;
  } else if (phase === 'prepare') {
    const modal = page.getByRole('dialog', { name: 'Agent 模式', exact: true });
    if (await modal.isVisible()) await modal.getByRole('button', { name: '关闭窗口', exact: true }).click();
    assert.equal((await readSession()).row.running, false);
    const title = 'DSHM 新版 PTC 取消验收';
    if (await main.locator('.remote-heading strong').innerText() !== title) {
      await main.locator('.remote-topbar').getByRole('button', { name: '返回', exact: true }).click();
      await page.getByRole('button', { name: '在已有工作区新建聊天', exact: true }).click();
      await page.getByLabel('选择工作区', { exact: true }).getByRole('button', { name: 'test-project', exact: true }).click();
      await main.getByRole('textbox', { name: '消息', exact: true }).waitFor();
      await main.getByRole('button', { name: 'Remote 选项', exact: true }).click();
      await page.getByRole('button', { name: '重命名聊天', exact: true }).click();
      await page.getByRole('textbox', { name: '聊天名称', exact: true }).fill(title);
      await page.getByRole('button', { name: '保存名称', exact: true }).click();
      await main.locator('.remote-heading strong').getByText(title, { exact: true }).waitFor();
    }
    // 空白聊天使用新版原首页模式入口；重试只接续同名空白测试会话。
    const mode = main.getByRole('button', { name: '标准模式', exact: true });
    if (await mode.getAttribute('aria-expanded') !== 'true') await mode.click();
    await page.getByRole('menuitem', { name: /^PTC 模式 / }).click();
    await main.getByRole('button', { name: 'PTC 模式', exact: true }).waitFor();
    const selected = await main.evaluate(element => {
      const key = Object.keys(element).find(name => name.startsWith('__reactFiber$'));
      for (let fiber = element[key]; fiber; fiber = fiber.return) if (fiber.memoizedProps?.model?.client) {
        const model = fiber.memoizedProps.model, id = model.getSnapshot().selected;
        return { id, row: model.getSnapshot().list.byId[id] };
      }
      throw Error('latest_ptc_session_missing');
    });
    assert.match(selected.id, /^session-[0-9a-f-]{36}$/); assert.notEqual(selected.id, session.sessionId);
    assert.equal(selected.row.blank, true); assert.equal(selected.row.displayTitle, title);
    await writeFile(sessionPath, JSON.stringify({ at: new Date().toISOString(), home: state.home,
      sessionId: selected.id, title, originalModeChosen: 'ptc', originalPhoneCreateVerified: true }, null, 2), { flag: 'wx' });
    await capture('latest-live-ptc-prepared'); report.prepared = true;
  } else {
    const original = await readSession(); report.sessionId = session.sessionId;
    assert.equal(original.projections.values.agentPreset, 'ptc');
    if (phase === 'start' || phase === 'retry-readonly') {
      assert.equal(original.row.running, false);
      if (sourceMode && scenario === 'read-only') {
        assert.equal(original.projections.values.permissions.currentValue, 'workspace-write');
        await main.getByRole('button', { name: 'Remote 选项', exact: true }).click();
        await page.getByRole('button', { name: '会话权限', exact: true }).click();
        const permissions = page.getByRole('dialog', { name: '会话权限', exact: true });
        await permissions.getByRole('button', { name: '仅可查看', exact: true }).click();
        await permissions.getByRole('button', { name: '仅可查看', exact: true }).and(permissions.locator('[aria-pressed="true"]')).waitFor();
        await permissions.getByRole('button', { name: '关闭窗口', exact: true }).click();
        assert.equal((await readSession()).projections.values.permissions.currentValue, 'read-only');
      } else if (phase === 'start' && scenario === 'workspace-write') {
        const previous = JSON.parse(await readFile(resolve(runtime, sourceMode ? 'latest-live-source-ptc-android-resume-observe.json' : 'latest-live-ptc-android-resume-observe.json'), 'utf8'));
        assert.equal(previous.passed, true); assert.equal(previous.sessionId, session.sessionId);
        assert.equal(original.projections.values.permissions.currentValue, 'workspace-write');
        const recovery = sourceMode ? 'latest-live-source-acl-recovery' : 'latest-live-acl-recovery';
        const reports = (await readdir(resolve(runtime, recovery))).filter(name => /^acl-report-[0-9a-f]{32}\.jsonl$/.test(name));
        assert.equal(reports.length, 1, 'Ambiguous ACL preparation; do not repeat a repair automatically');
        const records = (await readFile(resolve(runtime, recovery, reports[0]), 'utf8'))
          .trim().split('\n').map(line => JSON.parse(line));
        const grants = records.filter(item => item.kind === 'verification' && item.operation === 'grant');
        assert.equal(grants.length, 1); assert.equal(grants[0].status, 'verified');
        assert.equal(resolve(grants[0].path), resolve(state.workspacePath));
        assert.deepEqual(grants[0].details.after, { writeDac: true, writeOwner: true });
      } else if (phase === 'start') assert.equal(original.row.blank, true);
      else {
        const previous = JSON.parse(await readFile(seedPath, 'utf8'));
        assert.equal(previous.sessionId, session.sessionId); assert.equal(previous.stopAttempted, undefined);
        const priorCalls = original.records.filter(item => item.event.type === 'tool/call');
        const priorResults = original.records.filter(item => item.event.type === 'tool/result');
        assert.equal(priorCalls.length, 1); assert.equal(priorResults.length, 1);
        assert.equal(priorResults[0].event.data.error.code, 'CODE_RUN_FAILED');
        assert.match(priorResults[0].event.data.message.content[0].text, /SetNamedSecurityInfoW failed \(Win32 5\): grantWrite/);
        const archivedPath = resolve(runtime, 'latest-live-ptc-workspace-write-seed.json');
        try { assert.deepEqual(JSON.parse(await readFile(archivedPath, 'utf8')), previous); }
        catch (error) {
          if (error.code !== 'ENOENT') throw error;
          await writeFile(archivedPath, JSON.stringify(previous, null, 2), { flag: 'wx' });
        }
        const permissions = page.getByRole('dialog', { name: '会话权限', exact: true });
        if (!await permissions.isVisible()) {
          await main.getByRole('button', { name: 'Remote 选项', exact: true }).click();
          await page.getByRole('button', { name: '会话权限', exact: true }).click();
        }
        await permissions.getByRole('button', { name: '仅可查看', exact: true }).click();
        await permissions.getByRole('button', { name: '仅可查看', exact: true }).and(permissions.locator('[aria-pressed="true"]')).waitFor();
        await permissions.getByRole('button', { name: '关闭窗口', exact: true }).click();
        assert.equal((await readSession()).projections.values.permissions.currentValue, 'read-only');
      }
      const input = main.getByRole('textbox', { name: '消息', exact: true });
      assert.equal((await input.innerText()).trim(), '');
      seed = { at: new Date().toISOString(), home: state.home, sessionId: session.sessionId,
        marker: 'DSHM_PTC_READY_' + randomUUID().replaceAll('-', '').slice(0, 12),
        finish: 'DSHM_PTC_UNEXPECTED_FINISH', initialSeq: original.projections.asOfSeq,
        permission: phase === 'retry-readonly' || (sourceMode && scenario === 'read-only') ? 'read-only' : original.projections.values.permissions.currentValue };
      seed.code = `console.log("${seed.marker}"); await new Promise(resolve => setTimeout(resolve, 90000)); console.log("${seed.finish}");`;
      await writeFile(seedPath, JSON.stringify(seed, null, 2), { flag: phase === 'retry-readonly' ? 'w' : 'wx' });
      await input.fill(`这是 DSHM 新版 PTC 停止验收。只执行本条消息，不要补做之前的测试请求。只调用一次 run_code，code严格为：${seed.code}。timeoutMs=180000。不要执行其他工具、读写文件、执行Shell、联网或重试。等待我从手机停止。`);
      seed.attempted = true; await writeFile(seedPath, JSON.stringify(seed, null, 2));
      await main.getByRole('button', { name: '发送消息', exact: true }).click();
      seed.sent = true; await writeFile(seedPath, JSON.stringify(seed, null, 2)); report.sent = true;
    } else {
      seed = JSON.parse(await readFile(seedPath, 'utf8'));
      assert.equal(seed.home, state.home); assert.equal(seed.sessionId, session.sessionId); assert.equal(seed.sent, true);
      if (phase === 'stop') {
        assert.equal(seed.stopAttempted, undefined);
        if (sourceMode) {
          const end = Date.now() + 30000;
          let call;
          do {
            const held = await readSession(); assert.equal(held.row.running, true);
            const calls = held.records.filter(item => item.event.type === 'tool/call' && item.event.seq > seed.initialSeq);
            if (calls.length) {
              assert.equal(calls.length, 1); call = calls[0].event; assert.equal(call.data.name, 'run_code');
              const args = JSON.parse(call.data.arguments); assert.equal(args.code, seed.code); assert.equal(args.timeoutMs, 180000);
              break;
            }
            assert.ok(Date.now() < end, 'latest_source_ptc_call_missing');
            await new Promise(done => setTimeout(done, 100));
          } while (true);
          await new Promise(done => setTimeout(done, Math.max(0, call.time + 5000 - Date.now())));
        }
        await main.getByRole('button', { name: '工具详情', exact: true }).last().click();
        const details = page.getByRole('dialog', { name: '工具详情', exact: true });
        report.runningSnapshot = await details.ariaSnapshot();
        assert.ok((await details.innerText()).includes('run_code'));
        // 先记录原界面和原工具调用；随后只发原手机停止，不自行取消运行器。
        await capture(prefix + '-running');
        await details.getByRole('button', { name: '关闭工具详情', exact: true }).click();
        const held = await readSession();
        const calls = held.records.filter(item => item.event.type === 'tool/call' && item.event.seq > seed.initialSeq);
        assert.equal(calls.length, 1); assert.equal(calls[0].event.data.name, 'run_code');
        assert.equal(held.row.running, true);
        seed.callId = calls[0].event.data.callId; seed.stopAttempted = true;
        await writeFile(seedPath, JSON.stringify(seed, null, 2));
        await main.getByRole('button', { name: '停止生成', exact: true }).click();
        seed.stopped = true; await writeFile(seedPath, JSON.stringify(seed, null, 2)); report.stopSent = true;
      } else if (phase === 'observe' || phase === 'replay') {
        assert.equal(seed.stopped, true);
        if (phase === 'replay') {
          await main.locator('.remote-topbar').getByRole('button', { name: '返回', exact: true }).click();
          await main.locator('.remote-session-row').filter({ hasText: session.title }).click();
          await main.getByRole('textbox', { name: '消息', exact: true }).waitFor();
        }
        await main.getByRole('button', { name: '停止生成', exact: true }).waitFor({ state: 'hidden', timeout: 60000 });
        const after = await readSession(); assert.equal(after.row.running, false);
        const calls = after.records.filter(item => item.event.type === 'tool/call' && item.event.seq > seed.initialSeq);
        assert.equal(calls.length, 1); assert.equal(calls[0].event.data.callId, seed.callId);
        const results = after.records.filter(item => item.event.type === 'tool/result' && item.event.data.message.toolCallId === seed.callId);
        assert.equal(results.length, 1);
        report.originalResult = results[0].event.data;
        assert.equal(report.originalResult.error.code, 'ABORTED');
        assert.equal(report.originalResult.message.isError, true);
        const output = report.originalResult.message.content.map(part => part.text ?? '').join('\n');
        assert.match(output, /code run failed \(abort\)/);
        assert.ok(output.includes('Captured output:\n' + seed.marker));
        assert.ok(!output.includes(seed.finish));
        const details = page.getByRole('dialog', { name: '工具详情', exact: true });
        if (!await details.isVisible()) await main.getByRole('button', { name: '工具详情', exact: true }).last().click();
        const body = await details.innerText();
        assert.match(body, /run_code · 已停止/); assert.match(body, /工具调用已停止/);
        assert.ok(body.slice(body.indexOf('Captured output:')).includes(seed.marker));
        assert.ok(!body.slice(body.indexOf('Captured output:')).includes(seed.finish));
        report.noRetry = true; report.originalHostStopped = true;
        report.partialOutputRetained = true; report.phoneStopped = true;
        report.sandboxEnforcement = output.includes('enforcement: partial') ? 'partial' : 'unspecified';
        await capture(prefix + '-' + (phase === 'replay' ? 'replay' : 'stopped'));
        await details.getByRole('button', { name: '关闭工具详情', exact: true }).click();
        report.passed = true;
      } else if (phase === 'resume') {
        assert.equal(original.row.running, false); assert.equal(seed.resumeAttempted, undefined);
        seed.resumeMarker = 'DSHM_PTC_RESUMED_' + randomUUID().replaceAll('-', '').slice(0, 12);
        seed.resumeInitialSeq = original.projections.asOfSeq;
        await main.getByRole('textbox', { name: '消息', exact: true }).fill('停止验收已完成。现在不调用任何工具，只回复 ' + seed.resumeMarker);
        seed.resumeAttempted = true; await writeFile(seedPath, JSON.stringify(seed, null, 2));
        await main.getByRole('button', { name: '发送消息', exact: true }).click();
        seed.resumeSent = true; await writeFile(seedPath, JSON.stringify(seed, null, 2)); report.resumeSent = true;
      } else if (phase === 'resume-observe') {
        assert.equal(seed.resumeSent, true);
        await main.getByRole('article', { name: '模型回复', exact: true }).filter({ hasText: seed.resumeMarker }).waitFor({ timeout: 60000 });
        await main.getByRole('button', { name: '停止生成', exact: true }).waitFor({ state: 'hidden', timeout: 30000 });
        const after = await readSession(); assert.equal(after.row.running, false);
        assert.equal(after.records.filter(item => item.event.type === 'tool/call' && item.event.seq > seed.resumeInitialSeq).length, 0);
        assert.ok(JSON.stringify(after.records.filter(item => item.event.seq > seed.resumeInitialSeq)).includes(seed.resumeMarker));
        await capture(prefix + '-resumed'); report.resumedAfterStop = true; report.passed = true;
      } else {
        assert.equal(original.row.running, false);
        await main.getByRole('button', { name: 'Remote 选项', exact: true }).click();
        await page.getByRole('button', { name: '会话权限', exact: true }).click();
        const permissions = page.getByRole('dialog', { name: '会话权限', exact: true });
        await permissions.getByRole('button', { name: '工作区内修改', exact: true }).click();
        await permissions.getByRole('button', { name: '工作区内修改', exact: true }).and(permissions.locator('[aria-pressed="true"]')).waitFor();
        await permissions.getByRole('button', { name: '关闭窗口', exact: true }).click();
        assert.equal((await readSession()).projections.values.permissions.currentValue, 'workspace-write');
        report.permissionRestored = true;
        await main.locator('.remote-topbar').getByRole('button', { name: '返回', exact: true }).click();
        await main.locator('.remote-session-row').filter({ hasText: 'DSHM 新版手机真实模型验收' }).click();
        await main.getByRole('textbox', { name: '消息', exact: true }).waitFor();
        report.returnedToPrimary = true;
      }
    }
  }
} catch (error) {
  report.failure = { name: error.name, code: error.code ?? 'validation_failed',
    location: error.stack?.split('\n').find(line => line.includes('verify-latest-live-ptc-android.mjs:'))?.trim() };
  process.exitCode = 1;
} finally {
  await writeFile(resolve(runtime, prefix + '-android-' + phase + '.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report)); await device.close();
}
setTimeout(() => process.exit(process.exitCode ?? 0), 200);
