import assert from 'node:assert/strict';
import { randomUUID, createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { openLatestLiveAndroid } from '../tests/support/latest-live-context.mjs';

const phase = process.argv[2], scenario = process.argv[3] ?? 'settled';
const sourceMode = process.argv[4] === 'source';
assert.ok(['start', 'start-history', 'observe', 'replay', 'history-live'].includes(phase));
assert.ok(['settled', 'live-history', 'live-history-retry'].includes(scenario));
assert.ok(process.argv[4] === undefined || sourceMode); assert.ok(process.argv.length >= 3 && process.argv.length <= 5);
if (['history-live', 'start-history'].includes(phase)) assert.ok(scenario.startsWith('live-history'));
const { runtime, state, session, main, page, device, capture, readSession } = await openLatestLiveAndroid('latest-live-encoding-session.json', { openRecorded: sourceMode });
const prefix = (sourceMode ? 'latest-live-source-large-output' : 'latest-live-large-output') + (scenario === 'settled' ? '' : '-' + scenario), seedPath = resolve(runtime, prefix + '-seed.json');
const report = { at: new Date().toISOString(), phase, scenario, passed: false,
  executionMode: state.executionMode ?? 'release', hostPid: state.hostPid };
const jobs = page.getByRole('dialog', { name: '后台任务', exact: true });
const output = page.getByRole('dialog', { name: '实时任务输出', exact: true });
const snapshot = () => main.evaluate(element => {
  const key = Object.keys(element).find(name => name.startsWith('__reactFiber$'));
  for (let fiber = element[key]; fiber; fiber = fiber.return) if (fiber.memoizedProps?.model?.client) {
    const model = fiber.memoizedProps.model, state = model.getSnapshot();
    const output = model.captureJobOutput?.();
    return { selected: state.selected, jobs: state.jobs, legacyJobs: Object.hasOwn(state.list, 'jobsBySession'),
      reader: output?.reader.snapshot, outputTarget: output?.target && { id: output.target.id, startedAt: output.target.startedAt } };
  }
  throw Error('latest_large_output_model_missing');
});
const normalize = value => value.replaceAll('\r\n', '\n');
const summary = value => {
  const points = Array.from(value);
  return { chars: value.length, bytes: Buffer.byteLength(value), sha256: createHash('sha256').update(value).digest('hex'),
    head: points.slice(0, 90).join(''), tail: points.slice(-90).join('') };
};
const expected = seed => `${seed.marker}_BEGIN\n` + Array.from({ length: 60 }, (_, i) => `LINE${String(i + 1).padStart(3, '0')} ${'中文🍀'.repeat(700)}\n`).join('') + `${seed.marker}_END\n`;
const wait = async (predicate, error, milliseconds = 45000) => {
  const end = Date.now() + milliseconds;
  while (true) {
    const current = await snapshot(); if (predicate(current)) return current;
    assert.ok(Date.now() < end, error); await new Promise(done => setTimeout(done, 150));
  }
};
const closeLayers = async () => {
  if (await output.isVisible()) await output.getByRole('button', { name: '关闭任务输出', exact: true }).click();
  if (await jobs.isVisible()) await jobs.getByRole('button', { name: '关闭窗口', exact: true }).click();
};
const openOutput = async seed => {
  if (await output.isVisible()) {
    const current = await snapshot();
    if (current.outputTarget?.id === seed.job.id && current.outputTarget.startedAt === seed.job.startedAt) return;
    await output.getByRole('button', { name: '关闭任务输出', exact: true }).click();
  }
  if (!await jobs.isVisible()) {
    await main.getByRole('button', { name: 'Remote 选项', exact: true }).click();
    await page.getByRole('button', { name: '后台任务', exact: true }).click();
  }
  await jobs.locator(`[data-job-id="${seed.job.id}"]`).getByRole('button', { name: '查看实时输出', exact: true }).click(); await output.waitFor();
};
const job = (current, seed) => current.jobs.rows[session.sessionId]?.find(row => row.id === seed.job?.id && row.startedAt === seed.job.startedAt);
async function verifyHistory(seed, generated, requireRunning) {
  await openOutput(seed); await output.getByRole('button', { name: '标准输出', exact: true }).click();
  await output.getByRole('button', { name: '从头查看', exact: true }).click();
  const parts = [], texts = []; let cursor = -1;
  for (let count = 0; count < 8; count++) {
    const current = await wait(current => current.reader && !['idle', 'reading', 'waiting'].includes(current.reader.phase), 'latest_large_history_missing');
    const reader = current.reader; assert.ok(['ready', 'ended'].includes(reader.phase)); assert.equal(reader.gap, true);
    if (requireRunning) assert.equal(job(current, seed).status, 'running');
    // 任务目录并非每次追加输出都刷新；读取器的真实缺口与返回文字才是本次输出证据。
    assert.ok(reader.offset > cursor); cursor = reader.offset;
    assert.ok(!reader.text.includes('\uFFFD')); const part = normalize(reader.text);
    assert.ok(!part.includes(seed.marker + '_BEGIN')); assert.ok(generated.includes(part)); texts.push(part);
    parts.push({ offset: reader.offset, total: reader.total, phase: reader.phase, ...summary(part) });
    await output.getByText('部分早期输出已不再保留，以下显示电脑仍保存的内容。', { exact: true }).waitFor();
    if (reader.phase === 'ended' || requireRunning && reader.offset === reader.total) break;
    await output.getByRole('button', { name: '读取下一段', exact: true }).click();
  }
  if (requireRunning) {
    assert.ok(parts.length >= 2); const joined = texts.join('');
    assert.ok(generated.slice(0, -(seed.marker.length + 5)).endsWith(joined));
    assert.equal(parts.at(-1).offset, parts.at(-1).total);
    seed.manualHistoryVerified = true; await writeFile(seedPath, JSON.stringify(seed, null, 2));
    report.manualPagesWhileRunning = parts.length; report.matchedConsecutiveHistory = true; report.historyText = summary(joined);
  } else {
    assert.equal(parts.at(-1).phase, 'ended'); assert.ok(parts.at(-1).tail.includes(seed.marker + '_END')); report.historyReachedEnd = true;
  }
  report.history = parts; report.explicitLossNotice = true; await capture(prefix + '-history');
}
async function auditOriginal(seed, generated) {
  let original = await readSession();
  if (sourceMode && !['start', 'start-history', 'history-live'].includes(phase)) {
    const deadline = Date.now() + 60000;
    while (true) {
      const reads = original.records.filter(row => row.event.type === 'tool/call' && row.event.seq > seed.initialSeq
        && row.event.data.name === 'job_output' && JSON.parse(row.event.data.arguments).job_id === seed.job.id);
      const results = reads.map(call => original.records.find(row => row.event.type === 'tool/result'
        && row.event.data.message?.toolCallId === call.event.data.callId));
      if (!original.row.running && results.length && results.every(Boolean)) {
        assert.ok(results.every(row => row.event.data.message.isError === false));
        assert.ok(results.some(row => row.event.data.message.content.some(part => part.type === 'text' && part.text.includes(seed.marker + '_END'))));
        report.originalOutputConsumed = true; report.originalOutputReadIds = reads.map(row => row.event.data.callId);
        break;
      }
      assert.ok(Date.now() < deadline, 'latest_source_large_original_output_not_consumed');
      await new Promise(done => setTimeout(done, 300)); original = await readSession();
    }
  }
  assert.equal(original.projections.values.permissions.currentValue, 'read-only');
  const calls = original.records.filter(row => row.event.type === 'tool/call' && row.event.seq > seed.initialSeq);
  const pwsh = calls.filter(row => row.event.data.name === 'pwsh'); assert.equal(pwsh.length, 1);
  const args = JSON.parse(pwsh[0].event.data.arguments); assert.equal(args.command, seed.command); assert.equal(args.run_in_background, true);
  const requestedTurn = pwsh[0].event.data.turn;
  assert.deepEqual(calls.filter(row => row.event.data.turn === requestedTurn).map(row => row.event.data.name), ['pwsh']);
  const metadataLookups = [];
  for (const call of calls.filter(row => row.event.data.turn !== requestedTurn)) {
    const starts = original.records.filter(row => row.event.type === 'turn/start' && row.event.data.turn === call.event.data.turn);
    assert.equal(starts.length, 1);
    const notice = original.records.find(row => row.event.type === 'user/message' && row.event.seq > starts[0].event.seq
      && row.event.seq < call.event.seq && row.event.data.source?.kind === 'tool-jobs' && row.event.data.source.form === 'notice'
      && row.event.data.content.some(part => part.type === 'text' && part.text.includes(`background job ${seed.job.id} `)));
    assert.ok(notice, 'latest_large_followup_without_original_notice');
    const followup = JSON.parse(call.event.data.arguments);
    if (sourceMode) assert.equal(call.event.data.name, 'job_output');
    if (call.event.data.name === 'job_output') assert.equal(followup.job_id, seed.job.id);
    else {
      // 原任务完成通知开启新轮次；只接受已在同会话原工具结果中出现的输出目录元数据查询。
      assert.equal(call.event.data.name, 'glob'); assert.deepEqual(Object.keys(followup).sort(), ['path', 'pattern']);
      assert.equal(followup.pattern, '*.txt');
      assert.ok(original.records.some(row => row.event.type === 'tool/result' && row.event.seq < call.event.seq
        && row.event.data.message?.content.some(part => part.type === 'text' && part.text.includes(followup.path))));
      const result = original.records.find(row => row.event.type === 'tool/result' && row.event.data.message?.toolCallId === call.event.data.callId);
      assert.ok(result); assert.equal(result.event.data.message.isError, false); assert.equal(result.event.data.meta?.shape, 'paths');
      assert.ok(result.event.data.meta.paths.length > 0);
      assert.ok(result.event.data.meta.paths.every(path => dirname(resolve(path)) === resolve(followup.path) && path.endsWith('-job_output.txt')));
      metadataLookups.push({ turn: call.event.data.turn, callId: call.event.data.callId, returnedPaths: result.event.data.meta.paths.length });
    }
  }
  const result = original.records.find(row => row.event.type === 'tool/result' && row.event.data.message?.toolCallId === pwsh[0].event.data.callId);
  assert.ok(result); assert.equal(result.event.data.message.isError, false);
  report.originalCallId = pwsh[0].event.data.callId; report.generated = summary(generated);
  report.requestedTurn = requestedTurn; report.originalTurnOnlyRequestedCommand = true;
  report.noticeMetadataLookups = metadataLookups; report.noModelRetry = true; report.readOnlyPreserved = true;
}
try {
  if (sourceMode) {
    assert.equal(state.executionMode, 'source'); assert.equal(state.command, 'pnpm dsh web');
    const { verifyInstalledSource } = await import('../../plugin/compatibility/latest-upstream/source-host.mjs');
    const installed = await verifyInstalledSource(); assert.equal(installed.sourceCommit, state.sourceCommit);
    report.sourceCommit = installed.sourceCommit; report.sourceFiles = installed.files;
  }
  let seed;
  if (phase === 'start' || phase === 'start-history') {
    await closeLayers(); const original = await readSession(), current = await snapshot();
    assert.equal(original.row.running, false); assert.equal(original.projections.values.permissions.currentValue, 'read-only');
    assert.equal(current.selected, session.sessionId); assert.equal(current.legacyJobs, false);
    assert.ok(current.jobs.rows[session.sessionId].every(row => !['running', 'stopping'].includes(row.status)));
    seed = { home: state.home, sessionId: session.sessionId, scenario, initialSeq: original.projections.asOfSeq,
      marker: 'DSHM_LARGE_' + randomUUID().replaceAll('-', '').slice(0, 12) };
    seed.command = `Write-Output '${seed.marker}_BEGIN'; Write-Error '大输出错误中文${seed.marker}'; Start-Sleep -Seconds 3; $line='中文🍀' * 700; 1..60 | ForEach-Object { Write-Output (("LINE{0:D3} " -f $_) + $line); Start-Sleep -Milliseconds 200 }; Start-Sleep -Seconds ${scenario.startsWith('live-history') ? 25 : 4}; Write-Output '${seed.marker}_END'`;
    await writeFile(seedPath, JSON.stringify(seed, null, 2), { flag: 'wx' });
    const editor = main.getByRole('textbox', { name: '消息', exact: true }); assert.equal((await editor.innerText()).trim(), '');
    const completion = sourceMode ? '之后如果收到该任务的完成通知，只使用 job_output(job_id=刚返回的任务ID, wait=false)读取该任务；不要查找临时文件，不使用glob、grep、read或再次pwsh。输出再大也只读任务服务已有的输出，不能补执行任何命令。' : '';
    await editor.fill(`这是 DSHM 大输出验收。只执行本条消息，不要补做之前的测试请求。只调用一次 pwsh，command 严格为：${seed.command}。run_in_background=true，timeoutMs=60000。启动后立即只回复 DSHM_LARGE_READY，不等待完成、不调用 job_output。${completion}不要访问文件、网络、提权、其他工具或重试。Write-Error 是预期输出。`);
    seed.attempted = true; await writeFile(seedPath, JSON.stringify(seed, null, 2));
    await main.getByRole('button', { name: '发送消息', exact: true }).click();
    seed.sent = true; await writeFile(seedPath, JSON.stringify(seed, null, 2));
    const currentJob = await wait(current => current.jobs.rows[session.sessionId]?.some(row => row.label === seed.command && row.kind === 'pwsh'), 'latest_large_job_missing');
    seed.job = currentJob.jobs.rows[session.sessionId].find(row => row.label === seed.command && row.kind === 'pwsh');
    assert.equal(seed.job.owner, session.sessionId); assert.equal(seed.job.status, 'running');
    await writeFile(seedPath, JSON.stringify(seed, null, 2));
    await openOutput(seed);
    await output.getByLabel('独立任务输出', { exact: true }).filter({ hasText: seed.marker + '_BEGIN' }).waitFor();
    const live = await wait(current => current.reader?.trimmed && current.reader.text.includes('LINE060 '), 'latest_large_live_tail_missing');
    assert.equal(job(live, seed).status, 'running'); assert.equal(live.reader.gap, false);
    assert.ok(live.reader.text.length <= 128 * 1024); assert.ok(!live.reader.text.includes('\uFFFD'));
    const normalized = normalize(live.reader.text), generated = expected(seed).slice(0, -(seed.marker.length + 5));
    assert.ok(generated.endsWith(normalized));
    await output.getByText('当前显示最近的输出。可选择“从头查看”分段读取早期内容。', { exact: true }).waitFor();
    seed.liveVerified = true; await writeFile(seedPath, JSON.stringify(seed, null, 2));
    report.liveBeforeSettlement = true; report.liveWindowTrimmed = true; report.liveWindow = summary(normalized);
    report.matchedGeneratedTail = true; report.noLiveGap = true; await capture(prefix + '-running');
    if (phase === 'start-history') { await verifyHistory(seed, expected(seed), true); await auditOriginal(seed, expected(seed)); }
    report.passed = true;
  } else {
    seed = JSON.parse(await readFile(seedPath, 'utf8'));
    assert.equal(seed.home, state.home); assert.equal(seed.sessionId, session.sessionId); assert.equal(seed.sent, true);
    assert.equal(seed.scenario ?? 'settled', scenario);
    assert.ok(seed.job); const generated = expected(seed);
    if (phase === 'observe') {
      await openOutput(seed); await output.getByRole('button', { name: '标准输出', exact: true }).click();
      await output.getByRole('button', { name: '实时读取', exact: true }).click();
      const settled = await wait(current => current.reader?.phase === 'ended' && job(current, seed)?.status === 'completed', 'latest_large_settlement_missing');
      const retained = normalize(settled.reader.text); assert.ok(retained.includes(seed.marker + '_END')); assert.ok(!retained.includes('\uFFFD'));
      // 缺口标记是显示层说明，不是命令生成的文字；仍需验证原缺口提示和其余完整后缀。
      const retainedData = retained.replace(/^\n…部分输出已丢失…\n/, '');
      assert.ok(generated.endsWith(retainedData)); assert.ok(settled.reader.text.length <= 128 * 1024);
      if (settled.reader.gap) await output.getByText('部分早期输出已不再保留，以下显示电脑仍保存的内容。', { exact: true }).waitFor();
      report.completedWindow = summary(retained); report.liveWindowTrimmed = settled.reader.trimmed; report.liveGap = settled.reader.gap;
      await output.getByRole('button', { name: '错误输出', exact: true }).click();
      await output.getByText(/^输出已读完/).waitFor();
      const stderr = (await snapshot()).reader;
      // 新开通道只能显示电脑此刻仍保留的片段；真实缺口必须在原页面说明。
      if (stderr.gap) await output.getByText('部分早期输出已不再保留，以下显示电脑仍保存的内容。', { exact: true }).waitFor();
      assert.ok(!stderr.text.includes('\uFFFD')); report.stderrRetained = summary(normalize(stderr.text)); report.stderrGap = stderr.gap;
      await capture(prefix + '-settled');
    } else {
      if (phase === 'replay') {
        await closeLayers(); await main.locator('.remote-topbar').getByRole('button', { name: '返回', exact: true }).click();
        await main.locator('.remote-session-row').filter({ hasText: session.title }).click();
      }
      await verifyHistory(seed, generated, phase === 'history-live');
    }
    await auditOriginal(seed, generated); report.passed = true;
  }
} catch (error) {
  report.failure = { name: error.name, message: error.message?.slice(0, 1000),
    location: error.stack?.split('\n').find(line => line.includes('verify-latest-live-large-output-android.mjs:'))?.trim() };
  process.exitCode = 1;
} finally {
  await writeFile(resolve(runtime, prefix + '-android-' + phase + '.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report)); await device.close();
}
// Windows CDP关闭后需让原生异步句柄完成回收，再退出验证器。
setTimeout(() => process.exit(process.exitCode ?? 0), 200);
