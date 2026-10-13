import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { _android } from 'playwright';
import { androidAppWebView } from './android-app-webview.mjs';
import { openLatestLiveAndroid } from '../tests/support/latest-live-context.mjs';

const phase = process.argv[2];
assert.ok(['open', 'start', 'observe', 'replay'].includes(phase));
const sourceMode = process.argv[3] === 'source';
assert.ok(process.argv[3] === undefined || sourceMode); assert.ok(process.argv.length <= 4);
assert.equal(process.env.DSHM_ANDROID_SERIAL, 'emulator-5554');
const prefix = sourceMode ? 'latest-live-source-job-stop' : 'latest-live-job-stop';
const runtime = resolve(import.meta.dirname, '../../plugin/artifacts/latest-runtime-check');
const seedPath = resolve(runtime, prefix + '-seed.json');
const report = { at: new Date().toISOString(), phase, passed: false };
const alive = pid => {
  assert.ok(Number.isSafeInteger(pid) && pid > 0);
  try { process.kill(pid, 0); return true; }
  catch (error) { if (error.code === 'ESRCH') return false; throw error; }
};
const delay = () => new Promise(done => setTimeout(done, 200));
async function verifySource(state) {
  report.executionMode = state.executionMode ?? 'release'; report.hostPid = state.hostPid;
  if (!sourceMode) return;
  assert.equal(state.executionMode, 'source'); assert.equal(state.command, 'pnpm dsh web');
  const { verifyInstalledSource } = await import('../../plugin/compatibility/latest-upstream/source-host.mjs');
  const installed = await verifyInstalledSource(); assert.equal(installed.sourceCommit, state.sourceCommit);
  report.sourceCommit = installed.sourceCommit; report.sourceFiles = installed.files;
}

// 只经已安装 App 的原抽屉和会话列表返回记录的测试聊天，不新建、不配对。
async function openRecorded() {
  if (sourceMode) {
    const live = await openLatestLiveAndroid('latest-live-encoding-session.json', { openRecorded: true });
    try {
      await verifySource(live.state); await live.capture(prefix + '-open');
      report.openedRecordedChat = true; report.passed = true;
    } finally { await live.device.close(); }
    return;
  }
  const state = JSON.parse(await readFile(resolve(runtime, 'latest-live-state.json'), 'utf8'));
  const session = JSON.parse(await readFile(resolve(runtime, 'latest-live-encoding-session.json'), 'utf8'));
  assert.equal(state.target, '0.2.1-alpha.1'); assert.equal(session.home, state.home);
  const device = (await _android.devices({ omitDriverInstall: true })).find(item => item.serial() === process.env.DSHM_ANDROID_SERIAL);
  assert.ok(device);
  try {
    const first = await (await androidAppWebView(device, 'dev.dshmobile.validation.latesttest')).page();
    const context = first.context(); let page = context.pages().find(item => item.url().startsWith('https://remote.dshm.invalid/'));
    if (!page) {
      const ordinary = context.pages().find(item => item.url().startsWith('https://appassets.androidplatform.net/')); assert.ok(ordinary);
      const drawer = ordinary.getByRole('dialog', { name: '侧边导航', exact: true });
      if (!await drawer.isVisible()) await ordinary.getByRole('button', { name: '打开侧边抽屉', exact: true }).click();
      const opened = context.waitForEvent('page', { predicate: item => item.url().startsWith('https://remote.dshm.invalid/'), timeout: 30000 });
      await ordinary.getByRole('button', { name: 'Remote', exact: true }).click(); page = await opened;
    }
    const main = page.getByTestId('remote-workspace'); await main.waitFor({ timeout: 60000 });
    const output = page.getByRole('dialog', { name: '实时任务输出', exact: true });
    if (await output.isVisible()) await output.getByRole('button', { name: '关闭任务输出', exact: true }).click();
    const jobs = page.getByRole('dialog', { name: '后台任务', exact: true });
    if (await jobs.isVisible()) await jobs.getByRole('button', { name: '关闭窗口', exact: true }).click();
    const heading = main.locator('.remote-heading strong');
    if (await heading.innerText() !== session.title) {
      if (await heading.innerText() !== 'Remote') await main.locator('.remote-topbar').getByRole('button', { name: '返回', exact: true }).click();
      await main.locator('.remote-session-row').filter({ hasText: session.title }).click();
    }
    assert.equal(await heading.innerText(), session.title);
    assert.equal(await page.locator('iframe').count(), 0);
    await writeFile(resolve(runtime, prefix + '-open.png'), await device.screenshot());
    report.openedRecordedChat = true; report.passed = true;
  } finally { await device.close(); }
}

async function verify() {
  const { state, session, main, page, device, capture, readSession } = await openLatestLiveAndroid('latest-live-encoding-session.json', { openRecorded: sourceMode });
  const jobs = page.getByRole('dialog', { name: '后台任务', exact: true });
  const output = page.getByRole('dialog', { name: '实时任务输出', exact: true });
  const text = () => output.getByLabel('独立任务输出', { exact: true });
  const snapshot = () => main.evaluate(element => {
    const key = Object.keys(element).find(name => name.startsWith('__reactFiber$'));
    for (let fiber = element[key]; fiber; fiber = fiber.return) if (fiber.memoizedProps?.model?.client) {
      const model = fiber.memoizedProps.model, state = model.getSnapshot();
      return { selected: state.selected, jobs: state.jobs, connectionState: state.connectionState,
        legacyJobs: Object.hasOwn(state.list, 'jobsBySession'), jobsService: !!model.ctx.get('jobs') };
    }
    throw Error('latest_job_stop_model_missing');
  });
  const closeOutput = async () => { if (await output.isVisible()) await output.getByRole('button', { name: '关闭任务输出', exact: true }).click(); };
  const openJobs = async () => {
    await closeOutput();
    if (!await jobs.isVisible()) {
      await main.getByRole('button', { name: 'Remote 选项', exact: true }).click();
      await page.getByRole('button', { name: '后台任务', exact: true }).click();
    }
    await jobs.waitFor();
  };
  const openOutput = async id => {
    await openJobs(); await jobs.locator(`[data-job-id="${id}"]`).getByRole('button', { name: '查看实时输出', exact: true }).click();
    await output.waitFor(); await output.getByRole('button', { name: '标准输出', exact: true }).click();
  };
  const row = (current, job) => current.jobs.rows[session.sessionId]?.find(item => item.id === job.id && item.startedAt === job.startedAt);
  try {
    await verifySource(state);
    let seed;
    if (phase === 'start') {
      const original = await readSession(), current = await snapshot();
      assert.equal(original.row.running, false); assert.equal(original.projections.values.permissions.currentValue, 'read-only');
      assert.equal(current.selected, session.sessionId); assert.equal(current.jobsService, true); assert.equal(current.legacyJobs, false);
      assert.equal(current.connectionState, 'connected');
      assert.ok(current.jobs.rows[session.sessionId].every(item => !['running', 'stopping'].includes(item.status)));
      seed = { home: state.home, sessionId: session.sessionId, initialSeq: original.projections.asOfSeq,
        marker: 'DSHM_JOB_STOP_' + randomUUID().replaceAll('-', '').slice(0, 12) };
      seed.stopCommand = `Write-Output '停止中文🍀${seed.marker}'; Write-Output "DSHM_STOP_PID=$PID"; Write-Error '停止错误中文${seed.marker}'; 1..60 | ForEach-Object { Write-Output "DSHM_STOP_TICK=$_"; Start-Sleep -Seconds 2 }; Write-Output '${seed.marker}_UNEXPECTED_END'`;
      seed.keepCommand = `Write-Output '继续中文🍀${seed.marker}'; Write-Output "DSHM_KEEP_PID=$PID"; 1..40 | ForEach-Object { Write-Output "DSHM_KEEP_TICK=$_"; Start-Sleep -Seconds 2 }; Write-Output '${seed.marker}_KEEP_DONE'`;
      await writeFile(seedPath, JSON.stringify(seed, null, 2), { flag: 'wx' });
      const editor = main.getByRole('textbox', { name: '消息', exact: true }); assert.equal((await editor.innerText()).trim(), '');
      await editor.fill(`这是 DSHM 停止后台任务验收。只执行本条消息，不要补做之前的测试请求。按顺序只调用两次 pwsh，两次 run_in_background=true，timeoutMs=150000。第一次 command 严格为：${seed.stopCommand}。第二次 command 严格为：${seed.keepCommand}。两次启动后立即只回复 DSHM_STOP_PAIR_READY，不等待结束、不调用 job_output。用户会在手机停止第一个任务，请勿重试或重启。不要访问文件、网络、提权或调用其他工具。Write-Error 是预期输出。`);
      seed.attempted = true; await writeFile(seedPath, JSON.stringify(seed, null, 2));
      await main.getByRole('button', { name: '发送消息', exact: true }).click();
      seed.sent = true; await writeFile(seedPath, JSON.stringify(seed, null, 2));
    } else {
      seed = JSON.parse(await readFile(seedPath, 'utf8'));
      assert.equal(seed.home, state.home); assert.equal(seed.sessionId, session.sessionId); assert.equal(seed.sent, true);
    }
    if (phase === 'start' || phase === 'observe' && !seed.stopped) {
      const end = Date.now() + 45000;
      while (!seed.stop || !seed.keep) {
        const current = await snapshot();
        seed.stop ??= current.jobs.rows[session.sessionId]?.find(item => item.label === seed.stopCommand && item.kind === 'pwsh');
        seed.keep ??= current.jobs.rows[session.sessionId]?.find(item => item.label === seed.keepCommand && item.kind === 'pwsh');
        assert.ok(Date.now() < end, 'latest_job_stop_pair_missing');
        if (!seed.stop || !seed.keep) await delay();
      }
      assert.equal(seed.stop.owner, session.sessionId); assert.equal(seed.keep.owner, session.sessionId);
      assert.notEqual(seed.stop.id, seed.keep.id); await writeFile(seedPath, JSON.stringify(seed, null, 2));
      await openOutput(seed.stop.id);
      await text().filter({ hasText: 'DSHM_STOP_TICK=' }).waitFor(); seed.before = await text().innerText();
      seed.stopPid = Number(seed.before.match(/DSHM_STOP_PID=(\d+)/)?.[1]); assert.equal(alive(seed.stopPid), true);
      await output.getByRole('button', { name: '错误输出', exact: true }).click();
      await text().filter({ hasText: `停止错误中文${seed.marker}` }).waitFor();
      await openOutput(seed.keep.id); await text().filter({ hasText: 'DSHM_KEEP_TICK=' }).waitFor();
      const early = await text().innerText(); seed.keepPid = Number(early.match(/DSHM_KEEP_PID=(\d+)/)?.[1]); assert.equal(alive(seed.keepPid), true);
      await openJobs(); const stop = jobs.locator(`[data-job-id="${seed.stop.id}"]`);
      if (!seed.stopRequestedAt) {
        await stop.getByRole('button', { name: '停止任务', exact: true }).click();
        await stop.getByRole('button', { name: '继续运行', exact: true }).click();
        assert.equal(row(await snapshot(), seed.stop).status, 'running'); assert.equal(alive(seed.stopPid), true);
        seed.cancelKeptRunning = true;
        await stop.getByRole('button', { name: '停止任务', exact: true }).click();
        // 先记录一次停止尝试；回执超时后只观察电脑终态，不自动再次发送停止。
        seed.stopRequestedAt = new Date().toISOString(); await writeFile(seedPath, JSON.stringify(seed, null, 2));
        await stop.getByRole('button', { name: '确认停止任务', exact: true }).click();
      }
      await stop.getByText('已取消', { exact: true }).waitFor();
      assert.equal(row(await snapshot(), seed.stop).status, 'killed'); assert.equal(alive(seed.stopPid), false);
      assert.equal(row(await snapshot(), seed.keep).status, 'running'); assert.equal(alive(seed.keepPid), true);
      seed.stopped = true; await writeFile(seedPath, JSON.stringify(seed, null, 2));
      await capture(prefix + '-stopped');
      report.cancelKeptRunning = seed.cancelKeptRunning; report.processStopped = true; report.unrelatedStillRunning = true;
      if (phase === 'start') { report.passed = true; return; }
    }
    assert.equal(seed.stopped, true); assert.equal(alive(seed.stopPid), false);
    if (phase === 'replay') {
      await closeOutput(); if (await jobs.isVisible()) await jobs.getByRole('button', { name: '关闭窗口', exact: true }).click();
      await main.locator('.remote-topbar').getByRole('button', { name: '返回', exact: true }).click();
      await main.locator('.remote-session-row').filter({ hasText: session.title }).click();
    }
    await openOutput(seed.stop.id); await output.getByText(/^输出已读完/).waitFor();
    report.stoppedOutput = await text().innerText();
    assert.ok(report.stoppedOutput.startsWith(seed.before)); assert.ok(report.stoppedOutput.includes(seed.marker));
    assert.ok(!report.stoppedOutput.includes(seed.marker + '_UNEXPECTED_END')); assert.ok(!report.stoppedOutput.includes('\uFFFD'));
    await output.getByRole('button', { name: '从头查看', exact: true }).click(); await output.getByText(/^输出已读完/).waitFor();
    assert.equal(await text().innerText(), report.stoppedOutput);
    await output.getByRole('button', { name: '错误输出', exact: true }).click();
    await text().filter({ hasText: `停止错误中文${seed.marker}` }).waitFor(); report.stderr = await text().innerText();
    await openOutput(seed.keep.id);
    await text().filter({ hasText: seed.marker + '_KEEP_DONE' }).waitFor({ timeout: 95000 });
    await output.getByText(/^输出已读完/).waitFor(); report.keepOutput = await text().innerText();
    assert.equal(alive(seed.keepPid), false);
    const current = await snapshot(); assert.equal(row(current, seed.stop).status, 'killed'); assert.equal(row(current, seed.keep).status, 'completed');
    const original = await readSession(); assert.equal(original.projections.values.permissions.currentValue, 'read-only');
    const calls = original.records.filter(item => item.event.type === 'tool/call' && item.event.seq > seed.initialSeq);
    const commands = calls.filter(item => item.event.data.name === 'pwsh'); assert.equal(commands.length, 2);
    const args = commands.map(item => JSON.parse(item.event.data.arguments));
    assert.deepEqual(args.map(item => item.command), [seed.stopCommand, seed.keepCommand]); assert.ok(args.every(item => item.run_in_background === true));
    assert.ok(calls.every(item => ['pwsh', 'job_output'].includes(item.event.data.name)));
    const ids = new Set(commands.map(item => item.event.data.callId));
    const results = original.records.filter(item => item.event.type === 'tool/result' && ids.has(item.event.data.message?.toolCallId));
    assert.equal(results.length, 2); assert.ok(results.every(item => item.event.data.message.isError === false));
    report.originalCallIds = [...ids]; report.stopId = seed.stop.id; report.keepId = seed.keep.id;
    report.sameOriginalCommands = true; report.noModelRetry = true; report.readOnlyPreserved = true;
    report.stoppedOutputPreserved = true; report.unrelatedCompleted = true; report.passed = true;
    await capture(prefix + '-' + phase);
    seed.verified = true; await writeFile(seedPath, JSON.stringify(seed, null, 2));
  } finally { await device.close(); }
}
try { if (phase === 'open') await openRecorded(); else await verify(); }
catch (error) {
  report.failure = { name: error.name, message: error.message?.slice(0, 1000),
    location: error.stack?.split('\n').find(line => line.includes('verify-latest-live-job-stop-android.mjs:'))?.trim() };
  process.exitCode = 1;
} finally {
  await writeFile(resolve(runtime, prefix + '-android-' + phase + '.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report));
}
process.exit(process.exitCode ?? 0);
