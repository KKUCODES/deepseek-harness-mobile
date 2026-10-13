import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { androidAppWebView } from '../../scripts/android-app-webview.mjs';

/** 所有写入和停止均点击真实手机入口；只读快照用于与另一个真实中转读者逐字节核对。 */
export async function verifyOfficialBackgroundControl({ page, device, evidence, inference, disconnect, reconnect, mark,
  packageName, title, replacePage }) {
  const control = inference.jobs.control;
  let main = page.getByTestId('remote-workspace');
  const report = { passed: false }, marker = control.marker;
  if (control.processLifecycle) {
    assert.equal(packageName, 'dev.dshmobile.validation.officialtest'); assert.equal(typeof replacePage, 'function');
    report.process = { cases: [], passed: false };
  }
  const save = () => writeFile(resolve(evidence, 'background-control.json'), JSON.stringify(report, null, 2) + '\n');
  const snapshot = () => main.evaluate(element => {
    const key = Object.keys(element).find(name => name.startsWith('__reactFiber$'));
    for (let fiber = element[key]; fiber; fiber = fiber.return) if (fiber.memoizedProps?.model?.client) {
      const model = fiber.memoizedProps.model, state = model.getSnapshot(), capture = model.captureJobOutput?.();
      return { selected: state.selected, jobs: state.jobs, drafts: state.drafts,
        reader: capture?.reader.snapshot, outputMode: capture?.mode, outputStream: capture?.stream };
    }
    throw Error('official_background_control_model_missing');
  });
  const wait = async (read, predicate, reason) => {
    const deadline = Date.now() + 40000;
    for (;;) {
      const value = await read(); if (predicate(value)) return value;
      assert.ok(Date.now() < deadline, reason); await new Promise(done => setTimeout(done, 200));
    }
  };
  let jobs = page.getByRole('dialog', { name: '后台任务', exact: true });
  let output = page.getByRole('dialog', { name: '实时任务输出', exact: true });
  const text = () => output.getByLabel('独立任务输出', { exact: true });
  const row = target => jobs.locator(`li[data-job-id="${target.jobId}"]`);
  const openJobs = async () => {
    await main.getByRole('button', { name: 'Remote 选项', exact: true }).click();
    await page.getByRole('button', { name: '后台任务', exact: true }).click(); await jobs.waitFor();
  };
  const pid = async () => (await device.shell(`pidof ${packageName}`)).toString().trim();
  const notices = async () => (await device.shell('cmd notification list')).toString().split('\n')
    .filter(line => line.includes(`|${packageName}|`) && line.includes('dshm.remote.notice.'));
  const endOwn = async seed => {
    seed.oldPid = await pid(); assert.match(seed.oldPid, /^[1-9]\d*$/);
    await device.shell(`am force-stop ${packageName}`); assert.equal(await pid(), '');
    await new Promise(done => setTimeout(done, 500)); assert.equal(await pid(), '');
    seed.actualProcessEnded = true;
  };
  const reopen = async seed => {
    const launch = (await device.shell(`am start -W -a android.intent.action.MAIN -c android.intent.category.LAUNCHER -n ${packageName}/dev.dshmobile.validation.ValidationActivity`)).toString();
    assert.match(launch, /Status: ok/); seed.newPid = await pid();
    assert.match(seed.newPid, /^[1-9]\d*$/); assert.notEqual(seed.newPid, seed.oldPid);
    const ordinary = await (await androidAppWebView(device, packageName)).page();
    await ordinary.getByRole('button', { name: '打开侧边抽屉', exact: true }).waitFor();
    assert.equal(ordinary.context().pages().length, 1);
    await ordinary.getByRole('button', { name: '打开侧边抽屉', exact: true }).click();
    const opening = ordinary.context().waitForEvent('page', {
      predicate: target => target.url().startsWith('https://remote.dshm.invalid/'), timeout: 30000,
    });
    await ordinary.getByRole('button', { name: 'Remote', exact: true }).click();
    page = await opening; replacePage(page);
    main = page.getByTestId('remote-workspace'); jobs = page.getByRole('dialog', { name: '后台任务', exact: true });
    output = page.getByRole('dialog', { name: '实时任务输出', exact: true });
    await main.waitFor({ timeout: 45000 });
    await page.locator('.remote-session-row').filter({ hasText: title }).click();
    await main.locator('[data-composer-input]').waitFor();
    assert.equal((await snapshot()).selected, report.targets.sessionId);
    assert.equal(await main.locator('[data-composer-input]').innerText(), 'DSHM_BACKGROUND_CONTROL_DRAFT');
    assert.equal(await page.locator('iframe').count(), 0); assert.equal(await output.count(), 0);
    seed.normalLauncherAndOwnRemotePage = true; seed.originalSessionAndDraftPreserved = true;
    seed.noAutomaticOutputWindow = true;
  };
  try {
    report.prepared = await control.prepare();
    await main.getByRole('button', { name: 'Remote 选项', exact: true }).click();
    await page.getByRole('button', { name: '会话权限', exact: true }).click();
    const permissions = page.getByRole('dialog', { name: '会话权限', exact: true });
    await permissions.getByRole('button', { name: '仅可查看', exact: true }).click();
    await permissions.getByText('当前权限：仅可查看', { exact: true }).waitFor();
    await permissions.getByRole('button', { name: '关闭窗口', exact: true }).click();
    const initialSeq = await inference.beforeTool(), ready = `${marker}_READY`;
    await main.locator('[data-composer-input]').fill(`这是 DSHM 官方纯插件后台任务专项，只执行本条。依次仅调用两次 pwsh，均 run_in_background=true、timeoutMs=180000。第一个 command 严格为：${control.commands.stop}。第二个 command 严格为：${control.commands.large}。这两条仅向本机自有测试服务请求，不访问外网、文件或凭据，不提权。Write-Error 是预期双流输出。领取两个 jobId 后立即只回复 ${ready}。不等待完成、不调用 job_output、不重试、不调用其他工具；收到完成通知也不要调用工具。`);
    await main.getByRole('button', { name: '发送消息', exact: true }).click();
    await main.getByRole('article', { name: '模型回复', exact: true }).filter({ hasText: ready }).waitFor({ timeout: 180000 });
    await main.getByRole('button', { name: '停止生成', exact: true }).waitFor({ state: 'hidden', timeout: 180000 });
    const state = await snapshot(), target = mode => {
      const rows = state.jobs.rows[state.selected].filter(job => job.kind === 'pwsh' && job.label === control.commands[mode]);
      assert.equal(rows.length, 1); const job = rows[0];
      assert.equal(job.owner, state.selected); assert.equal(job.status, 'running');
      return { jobId: job.id, startedAt: job.startedAt };
    };
    const stop = target('stop'), large = target('large');
    assert.notEqual(stop.jobId, large.jobId); report.targets = { stop, large, sessionId: state.selected };
    report.started = await control.started({ stop, large, initialSeq });
    await main.locator('[data-composer-input]').fill('DSHM_BACKGROUND_CONTROL_DRAFT');
    await openJobs();
    await row(stop).getByRole('button', { name: '停止任务', exact: true }).click();
    await row(stop).getByRole('button', { name: '继续运行', exact: true }).click();
    assert.equal((await control.read(stop, 'stdout')).status, 'running');
    await row(stop).getByRole('button', { name: '停止任务', exact: true }).click();
    await row(stop).getByRole('button', { name: '确认停止任务', exact: true }).click();
    await row(stop).getByText('已取消', { exact: true }).waitFor({ timeout: 30000 });
    await jobs.getByText('任务已取消。', { exact: true }).waitFor();
    report.stopped = await control.stopped({ stop, large });
    await writeFile(resolve(evidence, 'background-control-stopped.png'), await device.screenshot());
    await mark('official-background-stop-confirms-real-killed-producer-and-sibling-running');
    await row(large).getByRole('button', { name: '查看实时输出', exact: true }).click();
    await text().filter({ hasText: `${marker}_LARGE_BEGIN` }).waitFor();
    const before = (await wait(snapshot, value => value.reader?.phase === 'ready'
      && value.reader.offset === value.reader.total, 'background_initial_reader_not_ready')).reader;
    report.beforeDisconnect = before;
    let runningProcess;
    if (control.processLifecycle) {
      runningProcess = { kind: 'running' }; report.process.cases.push(runningProcess);
      await endOwn(runningProcess);
      assert.equal((await control.read(large, 'stdout')).status, 'running');
      runningProcess.originalJobStillRunningWhileDead = true;
    } else { await disconnect(); await output.getByTestId('remote-offline-status').waitFor(); }
    report.released = control.release('large-start');
    report.largeWritten = await control.startedGate('large-finish');
    if (!control.processLifecycle) {
      await reconnect(); await output.getByTestId('remote-offline-status').waitFor({ state: 'detached', timeout: 45000 });
      await output.getByRole('button', { name: '重新读取', exact: true }).waitFor();
    } else { assert.equal(await pid(), ''); runningProcess.outputProducedWhileDead = true; }
    // Host 断线时独立读者也须等中转恢复；App 结束分支仍可读取，须核对原泵已接收末行。
    const retainedWhileOffline = await wait(() => control.retained(large, 'stdout'),
      value => value.text.includes(`${marker}_LINE_0999:`), 'background_last_original_output_not_received');
    report.offlineOutput = retainedWhileOffline;
    assert.equal(retainedWhileOffline.status, 'running'); assert.ok(retainedWhileOffline.total > 400000);
    assert.ok(retainedWhileOffline.earliest > before.offset);
    if (control.processLifecycle) {
      await reopen(runningProcess); await openJobs();
      await row(large).getByText('运行中', { exact: true }).waitFor();
      await row(large).getByRole('button', { name: '查看实时输出', exact: true }).click();
      runningProcess.explicitOutputReopened = true;
    } else {
      const paused = (await snapshot()).reader;
      assert.equal(paused.offset, before.offset); assert.equal(paused.text, before.text);
      report.reconnected = { previousOffsetPreserved: true, previousTextPreserved: true, explicitRetryRequired: true };
      await output.getByRole('button', { name: '重新读取', exact: true }).click();
    }
    const resumed = (await wait(snapshot, value => value.reader?.phase === 'ready'
      && value.reader.offset === retainedWhileOffline.total, 'background_resume_not_drained')).reader;
    await output.getByText('部分早期输出已不再保留，以下显示电脑仍保存的内容。', { exact: true }).waitFor();
    assert.equal(resumed.gap, true); assert.ok(resumed.text.endsWith(retainedWhileOffline.text));
    assert.equal(resumed.text.split('…部分输出已丢失…').length, 2);
    assert.ok(resumed.text.includes('中文🙂')); assert.ok(!resumed.text.includes('\uFFFD'));
    assert.ok(!resumed.text.includes(`${marker}_STDERR_END`));
    report.resumed = { gapShown: true, noReplacementCharacter: true, retainedBytesMatched: true,
      offset: resumed.offset, retainedBytes: retainedWhileOffline.bytes, sha256: retainedWhileOffline.sha256 };
    await writeFile(resolve(evidence, 'background-control-gap-resumed.png'), await device.screenshot());
    if (control.processLifecycle) {
      runningProcess.retainedBytesMatched = true; runningProcess.passed = true;
      await mark('official-background-process-running-job-and-utf8-output-restored-with-original-draft');
    } else await mark('official-background-disconnect-preserves-offset-and-explicitly-resumes-with-real-ring-gap');
    // 完成通知会触发官方模型消费并收缩缓存；先在实际运行中的稳定缓存核对双流及分段。
    const runningStderr = await control.retained(large, 'stderr');
    await output.getByRole('button', { name: '错误输出', exact: true }).click();
    await wait(snapshot, value => value.outputStream === 'stderr' && value.outputMode === 'live'
      && value.reader?.phase === 'ready' && value.reader.offset === runningStderr.total, 'background_stderr_not_drained');
    const stderr = (await snapshot()).reader, stderrGap = runningStderr.frames[0].lossy
      || runningStderr.frames[0].producerGap;
    assert.equal(stderr.gap, Boolean(stderrGap));
    assert.equal(stderr.text, (stderrGap ? '\n…部分输出已丢失…\n' : '') + runningStderr.text);
    report.stderr = { gapShown: Boolean(stderrGap), retainedBytesMatched: true, raw: runningStderr };
    await text().filter({ hasText: `${marker}_STDERR_END` }).waitFor();
    await output.getByRole('button', { name: '标准输出', exact: true }).click();
    await wait(snapshot, value => value.outputStream === 'stdout' && value.outputMode === 'live'
      && value.reader?.phase === 'ready' && value.reader.offset === retainedWhileOffline.total, 'background_stdout_not_drained');
    await output.getByRole('button', { name: '从头查看', exact: true }).click();
    const history = [], decoder = new TextDecoder('utf-8', { fatal: true });
    let offset = 0;
    for (;;) {
      const phone = (await wait(snapshot, value => value.outputMode === 'history' && value.outputStream === 'stdout'
        && value.reader?.offset > offset && ['ready', 'ended'].includes(value.reader.phase),
      'background_history_segment_not_ready')).reader;
      const raw = await control.read(large, 'stdout', offset), bytes = Buffer.from(raw.data, 'base64');
      const expected = decoder.decode(bytes, { stream: raw.nextOffset !== raw.totalBytes });
      assert.equal(phone.offset, raw.nextOffset); assert.equal(phone.text, expected);
      history.push({ from: offset, start: raw.startOffset, next: raw.nextOffset, bytes: bytes.length,
        sha256: createHash('sha256').update(bytes).digest('hex'), lossy: raw.lossy });
      offset = raw.nextOffset;
      if (offset === raw.totalBytes) { assert.equal(phone.phase, 'ready'); break; }
      assert.ok(history.length < 20);
      await output.getByRole('button', { name: '读取下一段', exact: true }).click();
    }
    assert.ok(history.length >= 4); assert.equal(history[0].lossy, true);
    assert.equal(history.slice(1).every(frame => frame.lossy === false), true);
    report.history = { segments: history, allActualRetainedBytesMatched: true, sharedRingCoordinateVerified: true };
    await writeFile(resolve(evidence, 'background-control-history-end.png'), await device.screenshot());
    assert.ok((await snapshot()).reader.text.includes(`${marker}_LINE_0999:`));
    await output.getByRole('button', { name: '实时读取', exact: true }).click();
    await wait(snapshot, value => value.outputMode === 'live' && value.outputStream === 'stdout'
      && value.reader?.phase === 'ready' && value.reader.offset === retainedWhileOffline.total, 'background_live_not_restored');
    let settledProcess;
    if (control.processLifecycle) {
      settledProcess = { kind: 'settled-while-dead' }; report.process.cases.push(settledProcess);
      await endOwn(settledProcess); assert.equal((await control.read(large, 'stdout')).status, 'running');
    }
    control.release('large-finish');
    if (control.processLifecycle) {
      report.final = await control.final({ stop, large }); assert.equal(await pid(), '');
      settledProcess.originalTerminalWhileDead = report.final.actualTerminalStatus;
      const until = Date.now() + 3000;
      do { assert.equal(await pid(), ''); assert.equal((await notices()).length, 0);
        await new Promise(done => setTimeout(done, 250)); } while (Date.now() < until);
      settledProcess.noPushWhileDead = true;
      await reopen(settledProcess); await openJobs();
      await row(large).getByText('已完成', { exact: true }).waitFor();
      await row(stop).getByText('已取消', { exact: true }).waitFor();
      await row(large).getByRole('button', { name: '查看实时输出', exact: true }).click();
      settledProcess.explicitOutputReopened = true;
    }
    await output.getByText(/^输出已读完/).waitFor({ timeout: 30000 });
    await text().filter({ hasText: `${marker}_LARGE_END` }).waitFor();
    report.final = await control.final({ stop, large });
    assert.ok((await snapshot()).reader.text.endsWith(report.final.stdout.text));
    if (control.processLifecycle) {
      settledProcess.originalTerminalRestored = 'completed'; settledProcess.retainedBytesMatched = true;
      settledProcess.passed = true; report.process.passed = true;
      await writeFile(resolve(evidence, 'background-process-settled-restored.png'), await device.screenshot());
      await mark('official-background-process-settled-while-dead-without-push-and-original-output-restored');
    }
    await output.getByRole('button', { name: '关闭任务输出', exact: true }).click();
    await row(large).getByText('已完成', { exact: true }).waitFor();
    await row(stop).getByText('已取消', { exact: true }).waitFor();
    await jobs.getByRole('button', { name: '关闭窗口', exact: true }).click();
    assert.equal(await main.locator('[data-composer-input]').innerText(), 'DSHM_BACKGROUND_CONTROL_DRAFT');
    report.draftPreserved = true; report.passed = true;
    await mark('official-background-large-stdout-stderr-history-segments-and-terminal-states');
    return { control: report };
  } finally { await save(); }
}
