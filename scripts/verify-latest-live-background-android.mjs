import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { openLatestLiveAndroid } from '../tests/support/latest-live-context.mjs';

const phase = process.argv[2]; assert.ok(['start', 'observe', 'replay', 'reconnect'].includes(phase));
const sourceMode = process.argv[3] === 'source';
assert.ok(process.argv[3] === undefined || sourceMode); assert.ok(process.argv.length <= 4);
const { runtime, state, session, main, page, device, capture, readSession } = await openLatestLiveAndroid('latest-live-encoding-session.json', { openRecorded: sourceMode });
const prefix = sourceMode ? 'latest-live-source-background' : 'latest-live-background', seedPath = resolve(runtime, prefix + '-seed.json');
const report = { at: new Date().toISOString(), phase, passed: false, executionMode: state.executionMode ?? 'release', hostPid: state.hostPid };
const output = page.getByRole('dialog', { name: '实时任务输出', exact: true });
const snapshot = () => main.evaluate(element => {
  const key = Object.keys(element).find(name => name.startsWith('__reactFiber$'));
  for (let fiber = element[key]; fiber; fiber = fiber.return) if (fiber.memoizedProps?.model?.client) {
    const model = fiber.memoizedProps.model, state = model.getSnapshot();
    return { selected: state.selected, jobs: state.jobs, legacyJobs: Object.hasOwn(state.list, 'jobsBySession'),
      connectionState: state.connectionState, jobsService: !!model.ctx.get('jobs'),
      reader: model.captureJobOutput?.().reader.snapshot };
  }
  throw Error('latest_background_model_missing');
});
const openJobs = async () => {
  const jobs = page.getByRole('dialog', { name: '后台任务', exact: true });
  if (!await jobs.isVisible()) {
    await main.getByRole('button', { name: 'Remote 选项', exact: true }).click();
    await page.getByRole('button', { name: '后台任务', exact: true }).click();
  }
  await jobs.waitFor(); return jobs;
};
const openOutput = async seed => {
  if (await output.isVisible()) return;
  const jobs = await openJobs();
  await jobs.locator('li[data-job-id]').filter({ hasText: seed.command }).getByRole('button', { name: '查看实时输出', exact: true }).click();
  await output.waitFor();
};
const text = () => output.getByLabel('独立任务输出', { exact: true });
try {
  if (sourceMode) {
    assert.equal(state.executionMode, 'source'); assert.equal(state.command, 'pnpm dsh web');
    const { verifyInstalledSource } = await import('../../plugin/compatibility/latest-upstream/source-host.mjs');
    const installed = await verifyInstalledSource(); assert.equal(installed.sourceCommit, state.sourceCommit);
    report.sourceCommit = installed.sourceCommit; report.sourceFiles = installed.files;
  }
  let seed;
  if (phase === 'start') {
    const original = await readSession();
    assert.equal(original.row.running, false);
    assert.equal(original.projections.values.permissions.currentValue, 'read-only');
    const current = await snapshot();
    assert.equal(current.jobsService, true); assert.equal(current.legacyJobs, false);
    assert.ok(current.jobs?.rows); assert.equal(current.selected, session.sessionId);
    const jobs = await openJobs(); await jobs.getByText('当前没有后台任务。', { exact: true }).waitFor();
    await jobs.getByRole('button', { name: '关闭窗口', exact: true }).click();
    seed = { home: state.home, sessionId: session.sessionId, initialSeq: original.projections.asOfSeq,
      marker: 'DSHM_BACKGROUND_' + randomUUID().replaceAll('-', '').slice(0, 12) };
    seed.command = `Write-Output '后台中文🍀${seed.marker}_START'; Write-Error '后台错误🦉${seed.marker}_ERR'; Start-Sleep -Seconds 60; Write-Output '后台结束中文🍀${seed.marker}_END'`;
    await writeFile(seedPath, JSON.stringify(seed, null, 2), { flag: 'wx' });
    const editor = main.getByRole('textbox', { name: '消息', exact: true });
    assert.equal((await editor.innerText()).trim(), '');
    await editor.fill(`这是后台任务独立输出验收。只执行本条消息，不要补做之前的测试请求。只调用一次 pwsh，command 严格为：${seed.command}。run_in_background=true，timeoutMs=90000。领取 jobId 后只调用一次 job_output，job_id 为这个任务，wait=false，读取已写出的文字，然后立即回复 DSHM_BACKGROUND_READY，不等待任务结束。不要读写文件、联网、提权、其他工具或重试。Write-Error 是预期测试输出。`);
    seed.attempted = true; await writeFile(seedPath, JSON.stringify(seed, null, 2));
    await main.getByRole('button', { name: '发送消息', exact: true }).click();
    seed.sent = true; await writeFile(seedPath, JSON.stringify(seed, null, 2));
    const end = Date.now() + 30000;
    let job;
    do {
      job = (await snapshot()).jobs.rows[session.sessionId]?.find(row => row.label === seed.command && row.kind === 'pwsh');
      if (job) break;
      assert.ok(Date.now() < end, 'latest_background_roster_missing');
      await new Promise(done => setTimeout(done, 100));
    } while (true);
    assert.equal(job.owner, session.sessionId); assert.equal(job.status, 'running');
    seed.jobId = job.id; seed.startedAt = job.startedAt;
    await writeFile(seedPath, JSON.stringify(seed, null, 2));
    await openOutput(seed);
    await text().filter({ hasText: `后台中文🍀${seed.marker}_START` }).waitFor();
    await output.getByRole('button', { name: '错误输出', exact: true }).click();
    await text().filter({ hasText: `后台错误🦉${seed.marker}_ERR` }).waitFor();
    const during = await snapshot();
    assert.equal(during.jobs.rows[session.sessionId].find(row => row.id === seed.jobId).status, 'running');
    const originalDuring = await readSession();
    const calls = originalDuring.records.filter(row => row.event.type === 'tool/call' && row.event.seq > seed.initialSeq && row.event.data.name === 'pwsh');
    assert.equal(calls.length, 1); const args = JSON.parse(calls[0].event.data.arguments);
    assert.equal(args.command, seed.command); assert.equal(args.run_in_background, true);
    seed.callId = calls[0].event.data.callId; seed.liveObserved = true;
    await writeFile(seedPath, JSON.stringify(seed, null, 2));
    await capture(prefix + '-running');
    report.liveBeforeJobSettlement = true; report.jobId = seed.jobId; report.passed = true;
  } else {
    seed = JSON.parse(await readFile(seedPath, 'utf8'));
    assert.equal(seed.home, state.home); assert.equal(seed.sessionId, session.sessionId);
    assert.equal(seed.sent, true); assert.equal(seed.liveObserved, true);
    if (phase === 'replay' || phase === 'reconnect') {
      if (await output.isVisible()) await output.getByRole('button', { name: '关闭任务输出', exact: true }).click();
      // 关闭输出后返回任务列表；先关闭这个原导航层，再离开聊天。
      const jobs = page.getByRole('dialog', { name: '后台任务', exact: true });
      if (await jobs.isVisible()) await jobs.getByRole('button', { name: '关闭窗口', exact: true }).click();
      if (phase === 'reconnect') {
        const fingerprint = await page.getByTestId('remote-fingerprint').textContent();
        await main.getByRole('button', { name: 'Remote 选项', exact: true }).click();
        await page.getByRole('button', { name: '电脑连接', exact: true }).click();
        await page.getByRole('button', { name: '断开连接', exact: true }).click();
        await page.getByTestId('remote-page').waitFor();
        assert.equal(await page.getByTestId('remote-fingerprint').textContent(), fingerprint);
        await page.getByRole('button', { name: '重新连接', exact: true }).click();
        await main.waitFor({ timeout: 60000 });
        assert.equal(await page.getByTestId('remote-fingerprint').textContent(), fingerprint);
        const reconnected = await snapshot();
        assert.equal(reconnected.jobsService, true); assert.equal(reconnected.connectionState, 'connected');
        assert.equal(reconnected.legacyJobs, false); report.explicitReconnectVerified = true;
      } else await main.locator('.remote-topbar').getByRole('button', { name: '返回', exact: true }).click();
      await main.locator('.remote-session-row').filter({ hasText: session.title }).click();
    }
    await openOutput(seed);
    const end = Date.now() + 75000;
    let job;
    do {
      job = (await snapshot()).jobs.rows[session.sessionId]?.find(row => row.id === seed.jobId && row.startedAt === seed.startedAt);
      if (job?.status === 'completed') break;
      assert.ok(Date.now() < end, 'latest_background_job_settlement_missing');
      await new Promise(done => setTimeout(done, 250));
    } while (true);
    await output.getByRole('button', { name: '标准输出', exact: true }).click();
    await text().filter({ hasText: `后台结束中文🍀${seed.marker}_END` }).waitFor();
    const stdout = await text().innerText();
    assert.ok(stdout.includes(`后台中文🍀${seed.marker}_START`)); assert.ok(!stdout.includes('\uFFFD'));
    await output.getByText(/^输出已读完/).waitFor();
    await output.getByRole('button', { name: '错误输出', exact: true }).click();
    await text().filter({ hasText: `后台错误🦉${seed.marker}_ERR` }).waitFor();
    const stderr = await text().innerText(); assert.ok(!stderr.includes('\uFFFD'));
    await output.getByText(/^输出已读完/).waitFor();
    const original = await readSession();
    assert.equal(original.projections.values.permissions.currentValue, 'read-only');
    const calls = original.records.filter(row => row.event.type === 'tool/call' && row.event.seq > seed.initialSeq);
    const pwsh = calls.filter(row => row.event.data.name === 'pwsh');
    assert.equal(pwsh.length, 1); assert.equal(pwsh[0].event.data.callId, seed.callId);
    const reads = calls.filter(row => row.event.data.name === 'job_output' && JSON.parse(row.event.data.arguments).job_id === seed.jobId);
    assert.ok(reads.length > 0);
    const readIds = new Set(reads.map(row => row.event.data.callId));
    const readResults = original.records.filter(row => row.event.type === 'tool/result'
      && readIds.has(row.event.data.message?.toolCallId));
    assert.equal(readResults.length, reads.length);
    assert.ok(readResults.every(row => row.event.data.message.isError === false));
    const consumed = readResults.some(row => row.event.data.message.content.some(part => part.type === 'text'
      && part.text.includes(`后台中文🍀${seed.marker}_START`)));
    const consumedText = readResults.flatMap(row => row.event.data.message.content)
      .filter(part => part.type === 'text').map(part => part.text).join('\n').replaceAll('\r\n', '\n');
    if (consumed) {
      assert.ok(consumedText.includes(stdout)); assert.ok(consumedText.includes(stderr));
    }
    assert.ok(calls.every(row => ['pwsh', 'job_output'].includes(row.event.data.name)));
    await capture(prefix + '-' + phase);
    report.jobId = job.id; report.status = job.status; report.stdout = stdout; report.stderr = stderr;
    report.sameOriginalCall = true; report.modelReadAttemptVerified = true; report.modelConsumedOutput = consumed;
    report.modelReadCallIds = [...readIds]; report.matchedConsumedStreams = consumed;
    report.readOnlyPreserved = true; report.passed = true;
  }
} catch (error) {
  report.failure = { name: error.name, message: error.message?.slice(0, 1000),
    location: error.stack?.split('\n').find(line => line.includes('verify-latest-live-background-android.mjs:'))?.trim() };
  process.exitCode = 1;
} finally {
  await writeFile(resolve(runtime, prefix + '-android-' + phase + '.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report)); await device.close();
}
process.exit(process.exitCode ?? 0);
