import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { readFile, readdir, writeFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { openLatestLiveAndroid } from '../tests/support/latest-live-context.mjs';

const phase = process.argv[2];
const scenario = process.argv[3];
const ownedWorkspace = process.argv[4] === 'owned';
const repairedOriginal = process.argv[4] === 'repaired';
assert.ok(['start', 'observe', 'replay', 'return', 'return-failed'].includes(phase));
assert.ok(['read-only', 'workspace-write'].includes(scenario));
assert.ok(process.argv[4] === undefined || ownedWorkspace || repairedOriginal); assert.ok(process.argv.length <= 5);
const live = await openLatestLiveAndroid(ownedWorkspace ? 'latest-live-ptc-owned-session.json' : 'latest-live-ptc-session.json', { openRecorded: true });
const { runtime, state, session, main, page, device, capture, readSession } = live;
const prefix = 'latest-live-' + (state.executionMode === 'source' ? 'source-' : '') + 'ptc-'
  + (ownedWorkspace ? 'owned-' : repairedOriginal ? 'repaired-' : '') + 'file-' + scenario;
const workspacePath = ownedWorkspace ? session.workspacePath : state.workspacePath;
const seedPath = resolve(runtime, prefix + '-seed.json');
const report = { at: new Date().toISOString(), phase, scenario, passed: false, executionMode: state.executionMode,
  command: state.command, hostPid: state.hostPid, sessionId: session.sessionId };
const digest = value => createHash('sha256').update(value).digest('hex');
const persist = seed => writeFile(seedPath, JSON.stringify(seed, null, 2));
let seed;
try {
  if (state.executionMode === 'source') {
    assert.equal(state.command, 'pnpm dsh web');
    const { verifyInstalledSource } = await import('../../plugin/compatibility/latest-upstream/source-host.mjs');
    const installed = await verifyInstalledSource(); assert.equal(installed.sourceCommit, state.sourceCommit);
    report.sourceCommit = installed.sourceCommit; report.sourceFiles = installed.files;
  } else {
    assert.ok(ownedWorkspace || repairedOriginal); assert.equal(state.executionMode, 'release');
    assert.equal(state.command, 'node dsh/lib/bin.js web');
    const pkg = JSON.parse(await readFile(resolve(runtime, 'node_modules/@deepseek-ai/dsh/package.json'), 'utf8'));
    const candidate = JSON.parse(await readFile(resolve(runtime, 'candidate/package.json'), 'utf8'));
    assert.equal(pkg.name, '@deepseek-ai/dsh'); assert.equal(pkg.version, '0.2.1-alpha.1');
    assert.equal(candidate.name, '@dsh-mobile/plugin'); assert.equal(candidate.version, '0.1.76-latest.0');
    report.releasePackageVerified = true;
  }
  const original = await readSession(); assert.equal(original.projections.values.agentPreset, 'ptc');
  if (repairedOriginal) {
    const repaired = JSON.parse(await readFile(resolve(runtime, 'latest-live-original-files-repair.json'), 'utf8'));
    assert.equal(repaired.passed, true); assert.equal(repaired.explicitOriginalFilesRepaired, true);
    assert.equal(repaired.home, state.home); assert.equal(resolve(repaired.workspace), resolve(state.workspacePath));
  }
  if (phase === 'start') {
    assert.equal(original.row.running, false);
    assert.equal(original.projections.values.permissions.currentValue, 'workspace-write');
    if (scenario === 'workspace-write' && !ownedWorkspace && !repairedOriginal) {
      const recovery = resolve(runtime, 'latest-live-source-ptc-file-acl-recovery');
      const files = (await readdir(recovery)).filter(name => /^acl-report-.*\.jsonl$/.test(name));
      assert.equal(files.length, 1);
      const records = (await readFile(resolve(recovery, files[0]), 'utf8')).trim().split('\n').map(line => JSON.parse(line));
      const grants = records.filter(item => item.kind === 'verification' && item.operation === 'grant');
      assert.equal(grants.length, 1); assert.equal(grants[0].status, 'verified');
      assert.equal(resolve(grants[0].path), resolve(state.workspacePath));
      assert.deepEqual(grants[0].details.after, { writeDac: true, writeOwner: true });
    }
    seed = { at: new Date().toISOString(), home: state.home, sessionId: session.sessionId, scenario,
      marker: 'DSHM_PTC_FILE_' + randomUUID().replaceAll('-', '').slice(0, 12),
      initialPermission: 'workspace-write' };
    seed.file = resolve(workspacePath, 'dshm-ptc-file-' + randomUUID() + '.txt');
    if (repairedOriginal) {
      // 复用最初失败文件的原路径；新记录、随机标记和原调用序号隔离于失败证据。
      const failedSeed = JSON.parse(await readFile(resolve(runtime, 'latest-live-source-ptc-file-' + scenario + '-seed.json'), 'utf8'));
      assert.equal(failedSeed.home, state.home); assert.equal(failedSeed.sessionId, session.sessionId);
      seed.file = failedSeed.file; report.originalFileReused = true;
    }
    seed.before = 'DSHM_PTC_FILE_BEFORE\n';
    seed.after = seed.marker + ' 中文与emoji🙂\n';
    seed.code = `const fs = await import('node:fs/promises'); console.log(${JSON.stringify(seed.marker)}); await fs.writeFile(${JSON.stringify(seed.file)}, ${JSON.stringify(seed.after)}, 'utf8'); const body = await fs.readFile(${JSON.stringify(seed.file)}, 'utf8'); console.log(body); return { marker: ${JSON.stringify(seed.marker)}, body };`;
    // 排他持久记录先于文件准备和消息提交；结果未知时只能观察，不能重复发送。
    await writeFile(seedPath, JSON.stringify(seed, null, 2), { flag: 'wx' });
    assert.equal(dirname(seed.file), resolve(workspacePath));
    if (repairedOriginal) assert.equal(await readFile(seed.file, 'utf8'), seed.before);
    else { await writeFile(seed.file, seed.before, { flag: 'wx' }); seed.fixtureCreated = true; }
    await persist(seed);
    if (scenario === 'read-only') {
      await main.getByRole('button', { name: 'Remote 选项', exact: true }).click();
      await page.getByRole('button', { name: '会话权限', exact: true }).click();
      const permissions = page.getByRole('dialog', { name: '会话权限', exact: true });
      await permissions.getByRole('button', { name: '仅可查看', exact: true }).click();
      await permissions.getByRole('button', { name: '仅可查看', exact: true }).and(permissions.locator('[aria-pressed="true"]')).waitFor();
      await permissions.getByRole('button', { name: '关闭窗口', exact: true }).click();
    }
    const before = await readSession(); assert.equal(before.projections.values.permissions.currentValue, scenario);
    seed.initialSeq = before.projections.asOfSeq; await persist(seed);
    const input = main.getByRole('textbox', { name: '消息', exact: true }); assert.equal((await input.innerText()).trim(), '');
    await input.fill(`这是独立的 DSHM 程序文件写入验收，仅执行本条请求，不补做历史测试。只调用一次 run_code，description为“验证程序文件写入”，code必须逐字为：${seed.code}。timeoutMs=120000。只读模式的拒绝是预期结果，无论成功或失败都不要重试、不要申请提权、不要调用其他工具或Shell、不要操作其他文件或联网。根据实际结果简短回复。`);
    seed.attempted = true; await persist(seed);
    await main.getByRole('button', { name: '发送消息', exact: true }).click();
    seed.sent = true; await persist(seed); report.sent = true;
  } else {
    seed = JSON.parse(await readFile(seedPath, 'utf8'));
    assert.equal(seed.home, state.home); assert.equal(seed.sessionId, session.sessionId); assert.equal(seed.scenario, scenario);
    assert.equal(seed.sent, true); assert.equal(dirname(seed.file), resolve(workspacePath));
    if (phase === 'return' || phase === 'return-failed') {
      assert.equal(original.row.running, false);
      const observed = JSON.parse(await readFile(resolve(runtime, prefix + '-android-observe.json'), 'utf8'));
      if (phase === 'return-failed') {
        assert.equal(scenario, 'workspace-write'); assert.equal(observed.passed, false);
        assert.equal(observed.originalResult.message.isError, true);
        assert.equal(observed.originalResult.error.code, 'CODE_RUN_FAILED');
        assert.ok(observed.originalResult.message.content.some(part => part.text?.includes('EPERM')));
        report.failedScenarioCleaned = true;
      } else assert.equal(observed.passed, true);
      const expected = scenario === 'read-only' || phase === 'return-failed' ? seed.before : seed.after;
      assert.equal(await readFile(seed.file, 'utf8'), expected);
      await writeFile(seed.file, seed.before);
      assert.equal(await readFile(seed.file, 'utf8'), seed.before); report.fileRestored = true;
      if (scenario === 'read-only') {
        await main.getByRole('button', { name: 'Remote 选项', exact: true }).click();
        await page.getByRole('button', { name: '会话权限', exact: true }).click();
        const permissions = page.getByRole('dialog', { name: '会话权限', exact: true });
        await permissions.getByRole('button', { name: '工作区内修改', exact: true }).click();
        await permissions.getByRole('button', { name: '工作区内修改', exact: true }).and(permissions.locator('[aria-pressed="true"]')).waitFor();
        await permissions.getByRole('button', { name: '关闭窗口', exact: true }).click();
      }
      assert.equal((await readSession()).projections.values.permissions.currentValue, seed.initialPermission);
      report.permissionRestored = true;
      await main.locator('.remote-topbar').getByRole('button', { name: '返回', exact: true }).click();
      await main.locator('.remote-session-row').filter({ hasText: 'DSHM 新版手机真实模型验收' }).click();
      await main.getByRole('textbox', { name: '消息', exact: true }).waitFor(); report.returnedToPrimary = true;
      if (phase === 'return') report.passed = true;
    } else {
      if (phase === 'replay') {
        await main.locator('.remote-topbar').getByRole('button', { name: '返回', exact: true }).click();
        await main.locator('.remote-session-row').filter({ hasText: session.title }).click();
      }
      const end = Date.now() + 60000;
      let after;
      do {
        after = await readSession();
        if (!after.row.running && after.records.some(item => item.event.seq > seed.initialSeq && item.event.type === 'tool/result')) break;
        assert.ok(Date.now() < end, 'latest_ptc_file_result_missing');
        await new Promise(done => setTimeout(done, 200));
      } while (true);
      assert.equal(after.projections.values.permissions.currentValue, scenario);
      const events = after.records.map(item => item.event).filter(event => event.seq > seed.initialSeq);
      const calls = events.filter(event => event.type === 'tool/call'); assert.equal(calls.length, 1);
      assert.equal(calls[0].data.name, 'run_code'); const args = JSON.parse(calls[0].data.arguments);
      assert.equal(args.code, seed.code); assert.equal(args.timeoutMs, 120000); assert.equal(args.sandbox_permissions, undefined);
      assert.equal(events.filter(event => event.type.startsWith('tool/ptc-dispatch')).length, 0);
      const results = events.filter(event => event.type === 'tool/result'); assert.equal(results.length, 1);
      report.originalResult = results[0].data; assert.equal(report.originalResult.message.toolCallId, calls[0].data.callId);
      const output = report.originalResult.message.content.map(part => part.text ?? '').join('\n');
      assert.ok(output.includes(seed.marker)); report.callId = calls[0].data.callId;
      const disk = await readFile(seed.file, 'utf8'); report.diskSha256 = digest(disk);
      if (scenario === 'read-only') {
        assert.equal(report.originalResult.message.isError, true); assert.equal(report.originalResult.error.code, 'CODE_RUN_FAILED');
        assert.match(output, /EACCES|EPERM/); assert.ok(output.includes('File sandbox: read-only'));
        assert.equal(disk, seed.before); report.expectedWriteDenied = true;
      } else {
        assert.equal(report.originalResult.message.isError, false); assert.equal(report.originalResult.error, undefined);
        assert.equal(disk, seed.after); assert.ok(output.includes(seed.after.trim()));
        assert.ok(output.includes('File sandbox enforcement is partial on this host.'));
        report.directProgramWriteAndRead = true;
      }
      report.noRetry = true; report.partialEnforcementReported = output.includes('partial');
      const turn = main.getByRole('button', { name: /用时/ }).last();
      if (await turn.getAttribute('aria-expanded') === 'false') await turn.click();
      assert.match(report.callId, /^[A-Za-z0-9_:-]+$/);
      const row = main.locator(`[data-chat-call-id="${report.callId}"]`);
      await row.locator('[data-tool="run_code"]').waitFor();
      // 手机详情入口位于插件缩放框外；本轮仅有一个原调用，核对卡片后打开最新入口。
      await main.getByRole('button', { name: '工具详情', exact: true }).last().click();
      const detail = page.getByRole('dialog', { name: /工具详情/ }); await detail.waitFor();
      assert.ok((await detail.innerText()).includes(seed.marker)); report.originalResultRendered = true;
      await capture(prefix + '-' + phase);
      await detail.getByRole('button', { name: '关闭工具详情', exact: true }).click();
      report.passed = true;
    }
  }
} catch (error) {
  report.failure = { name: error.name, code: error.code ?? 'validation_failed', message: error.message,
    location: error.stack?.split('\n').find(line => line.includes('verify-latest-live-ptc-file-android.mjs:'))?.trim() };
  process.exitCode = 1;
} finally {
  await writeFile(resolve(runtime, prefix + '-android-' + phase + '.json'), JSON.stringify(report, null, 2),
    ownedWorkspace || repairedOriginal ? { flag: 'wx' } : undefined);
  console.log(JSON.stringify(report)); await device.close();
}
setTimeout(() => process.exit(process.exitCode ?? 0), 200);
