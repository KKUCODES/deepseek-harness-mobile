import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { access, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { openLatestLiveAndroid } from '../tests/support/latest-live-context.mjs';

const phase = process.argv[2]; assert.ok(['prepare', 'start', 'live-start', 'observe', 'replay'].includes(phase));
const scenario = process.argv[3] ?? (phase === 'live-start' ? 'live' : 'first');
assert.ok(['first', 'live', 'source', 'source-diagnostic', 'source-diagnostic-retry', 'source-context', 'source-registration', 'sdk-attempt-8', 'sdk-attempt-9', 'electron-attempt-1', 'electron-attempt-2'].includes(scenario)); assert.ok(process.argv.length <= 4);
const sourceMode = scenario.startsWith('source');
const sdkMode = ['sdk-attempt-8', 'sdk-attempt-9'].includes(scenario);
const electronMode = ['electron-attempt-1', 'electron-attempt-2'].includes(scenario);
const sdkAttempt = sdkMode ? Number(scenario.slice('sdk-attempt-'.length)) : undefined;
if (sourceMode || sdkMode || electronMode) assert.ok(['live-start', 'observe', 'replay'].includes(phase));
const prefix = sourceMode || sdkMode || electronMode ? 'latest-live-' + scenario + '-encoding' : scenario === 'live' ? 'latest-live-encoding-live' : 'latest-live-encoding';
const reportPath = resolve(import.meta.dirname, '../../plugin/artifacts/latest-runtime-check', prefix + '-android-' + phase + '.json');
await assert.rejects(access(reportPath), { code: 'ENOENT' });
const sessionFile = 'latest-live-encoding-session.json';
const live = await openLatestLiveAndroid(phase === 'prepare' ? undefined : sessionFile,
  { preparingEncoding: phase === 'prepare', openRecorded: sourceMode || sdkMode || electronMode, reconnectRecorded: sdkMode || electronMode });
const { runtime, state, session, main, page, device, capture, readSession } = live;
const title = 'DSHM 新版命令编码验收';
const seedPath = resolve(runtime, prefix + '-seed.json');
const report = { at: new Date().toISOString(), phase, scenario, passed: false,
  executionMode: state.executionMode ?? 'release', hostPid: state.hostPid, home: state.home, sessionId: session.sessionId };
const details = page.getByRole('dialog', { name: '命令详情', exact: true });
const openDetails = async () => {
  if (await details.isVisible()) return;
  const turn = main.getByRole('button', { name: /用时/ }).last();
  await turn.waitFor();
  if (await turn.getAttribute('aria-expanded') === 'false') await turn.click();
  await main.getByRole('button', { name: '工具详情', exact: true }).last().click();
  await details.waitFor();
};
try {
  if (electronMode) {
    assert.equal(state.executionMode, 'electron'); assert.equal(state.command, 'official Electron desktop main');
    if (scenario === 'electron-attempt-2') { assert.equal(state.electronCarrier.attempt, 2); assert.equal(state.electronCarrier.encodingUpgrade, true); }
    const model = JSON.parse(await readFile(resolve(runtime, `latest-electron-android-attempt-${scenario.endsWith('-2') ? 2 : 1}.json`)));
    assert.equal(model.passed, true); assert.equal(model.inferenceVerified, true); assert.equal(model.hostPid, state.hostPid);
    const desktop = JSON.parse(await readFile(resolve(state.electronCarrier.directory, 'main-window-after-activation.json')));
    assert.equal(desktop.actualWorkspaceVisible, true); assert.equal(desktop.facts.pid, state.hostPid);
    const ui = JSON.parse(await readFile(resolve(state.electronCarrier.directory, 'actual-desktop-ui-observation.json')));
    assert.equal(ui.actualReply, model.marker); assert.equal(ui.actualDesktopOwnPage, true);
    process.kill(state.electronCarrier.electronHostPid, 0);
    report.electronHostPid = state.electronCarrier.electronHostPid;
  }
  if (sdkMode) {
    // 原SDK续聊先通过，才复用原专用编码会话进行单次真实工具/实时输出验收。
    assert.equal(state.executionMode, 'sdk-sea'); assert.equal(state.command, 'SDK executable web');
    const sdk = JSON.parse(await readFile(resolve(runtime, `latest-sdk-sea-android-attempt-${sdkAttempt}.json`)));
    assert.equal(sdk.passed, true); assert.equal(sdk.inferenceVerified, true); assert.equal(sdk.hostPid, state.hostPid);
    const { readLatestSdkCarrier } = await import('../../backend/scripts/latest-sdk-carrier.mjs');
    const carrier = await readLatestSdkCarrier(runtime);
    assert.equal(carrier.buildReport, resolve(runtime, `latest-sdk-sea-build-attempt-${sdkAttempt}.json`));
    assert.equal(carrier.productSha256, state.sdkProduct.sha256);
    report.productSha256 = carrier.productSha256;
  }
  if (sourceMode) {
    assert.equal(state.executionMode, 'source'); assert.equal(state.command, 'pnpm dsh web');
    const { verifyInstalledSource } = await import('../../plugin/compatibility/latest-upstream/source-host.mjs');
    const installed = await verifyInstalledSource();
    assert.equal(installed.sourceCommit, state.sourceCommit);
    report.sourceCommit = installed.sourceCommit; report.sourceFiles = installed.files;
  }
  if (phase === 'prepare') {
    const resumed = JSON.parse(await readFile(resolve(runtime, 'latest-live-resume-after.json'), 'utf8'));
    assert.equal(resumed.passed, true); assert.equal(resumed.hostPid, state.hostPid);
    assert.equal((await readSession()).row.running, false);
    // 先记尝试，避免工具超时后自动重复创建会话。
    await writeFile(resolve(runtime, 'latest-live-encoding-create-attempt.json'), JSON.stringify({ at: new Date().toISOString(), home: state.home }), { flag: 'wx' });
    await main.getByRole('button', { name: '在已有工作区新建聊天', exact: true }).click();
    await page.getByLabel('选择工作区', { exact: true }).getByRole('button', { name: 'test-project', exact: true }).click();
    await main.getByRole('textbox', { name: '消息', exact: true }).waitFor();
    await main.getByRole('button', { name: 'Remote 选项', exact: true }).click();
    await page.getByRole('button', { name: '重命名聊天', exact: true }).click();
    await page.getByRole('textbox', { name: '聊天名称', exact: true }).fill(title);
    await page.getByRole('button', { name: '保存名称', exact: true }).click();
    await main.locator('.remote-heading strong').getByText(title, { exact: true }).waitFor();
    const selected = await main.evaluate(element => {
      const key = Object.keys(element).find(name => name.startsWith('__reactFiber$'));
      for (let fiber = element[key]; fiber; fiber = fiber.return) if (fiber.memoizedProps?.model?.client) {
        const model = fiber.memoizedProps.model, id = model.getSnapshot().selected;
        return { id, row: model.getSnapshot().list.byId[id] };
      }
      throw Error('latest_encoding_session_missing');
    });
    assert.match(selected.id, /^session-[0-9a-f-]{36}$/); assert.equal(selected.row.blank, true);
    assert.equal(resolve(selected.row.cwd), state.workspacePath);
    await writeFile(resolve(runtime, sessionFile), JSON.stringify({ home: state.home, sessionId: selected.id, title,
      originalPhoneCreateVerified: true }, null, 2), { flag: 'wx' });
    report.createdSessionId = selected.id; report.passed = true;
  } else if (phase === 'start' || phase === 'live-start') {
    const original = await readSession(); assert.equal(original.row.running, false);
    if (phase === 'start') assert.equal(original.row.blank, true);
    else {
      const first = JSON.parse(await readFile(resolve(runtime, 'latest-live-encoding-android-observe.json'), 'utf8'));
      assert.equal(first.passed, true); assert.equal(first.originalResultAndPhoneMatch, true);
      assert.equal(original.projections.values.permissions.currentValue, 'read-only');
      if (await details.isVisible()) await details.getByRole('button', { name: '关闭命令详情', exact: true }).click();
    }
    const permissions = page.getByRole('dialog', { name: '会话权限', exact: true });
    await main.getByRole('button', { name: 'Remote 选项', exact: true }).click();
    await page.getByRole('button', { name: '会话权限', exact: true }).click();
    await permissions.getByRole('button', { name: '仅可查看', exact: true }).click();
    await permissions.getByText('当前权限：仅可查看', { exact: true }).waitFor();
    await permissions.getByRole('button', { name: '关闭窗口', exact: true }).click();
    assert.equal((await readSession()).projections.values.permissions.currentValue, 'read-only');
    const seed = { home: state.home, sessionId: session.sessionId, initialSeq: original.projections.asOfSeq,
      marker: 'DSHM_ENCODING_' + randomUUID().replaceAll('-', '').slice(0, 12) };
    seed.command = `Write-Output '中文🍀${seed.marker}'; Write-Error '错误🦉${seed.marker}'; Start-Sleep -Seconds 20; Write-Output '结束中文🍀${seed.marker}'`;
    await writeFile(seedPath, JSON.stringify(seed, null, 2), { flag: 'wx' });
    const editor = main.getByRole('textbox', { name: '消息', exact: true });
    assert.equal((await editor.innerText()).trim(), '');
    await editor.fill(`这是 DSHM 新版命令编码和手机实时输出验收。只执行本条消息的命令，不要补做之前的测试请求。只调用一次 pwsh 工具，command 严格为：${seed.command}。timeoutMs=60000，run_in_background=false。不要读写文件、联网、提权、其他工具或重试；Write-Error是预期测试输出。结束后只回复 DSHM_ENCODING_DONE。`);
    seed.attempted = true; await writeFile(seedPath, JSON.stringify(seed, null, 2));
    await main.getByRole('button', { name: '发送消息', exact: true }).click();
    seed.sent = true; await writeFile(seedPath, JSON.stringify(seed, null, 2));
    let calls;
    const end = Date.now() + 30000;
    do {
      const current = await readSession();
      calls = current.records.filter(item => item.event.type === 'tool/call' && item.event.seq > seed.initialSeq);
      if (calls.length) break;
      assert.ok(current.row.running && Date.now() < end, 'latest_encoding_original_call_missing');
      await new Promise(done => setTimeout(done, 100));
    } while (true);
    assert.equal(calls.length, 1); assert.equal(calls[0].event.data.name, 'pwsh');
    await openDetails();
    await details.getByRole('group', { name: '命令输出视图', exact: true }).waitFor();
    await details.getByLabel('独立命令输出', { exact: true }).filter({ hasText: `中文🍀${seed.marker}` }).waitFor();
    const during = await readSession(); assert.equal(during.row.running, true);
    seed.callId = calls[0].event.data.callId; seed.liveObserved = true;
    assert.equal(JSON.parse(calls[0].event.data.arguments).command, seed.command);
    await capture(prefix + '-running'); await writeFile(seedPath, JSON.stringify(seed, null, 2));
    report.liveBeforeSettlement = true; report.callId = seed.callId; report.passed = true;
  } else {
    const seed = JSON.parse(await readFile(seedPath, 'utf8'));
    assert.equal(seed.home, state.home); assert.equal(seed.sessionId, session.sessionId);
    assert.equal(seed.sent, true);
    if (scenario === 'live' || sourceMode || sdkMode || electronMode) assert.equal(seed.liveObserved, true);
    if (phase === 'replay') {
      if (await details.isVisible()) await details.getByRole('button', { name: '关闭命令详情', exact: true }).click();
      await main.locator('.remote-topbar').getByRole('button', { name: '返回', exact: true }).click();
      await main.locator('.remote-session-row').filter({ hasText: title }).click();
    }
    await openDetails();
    let original;
    const end = Date.now() + 45000;
    do {
      original = await readSession();
      if (!original.row.running) break;
      assert.ok(Date.now() < end, 'latest_encoding_settlement_missing');
      await new Promise(done => setTimeout(done, 100));
    } while (true);
    const records = original.records.filter(item => item.event.seq > seed.initialSeq);
    const calls = records.filter(item => item.event.type === 'tool/call');
    const results = records.filter(item => item.event.type === 'tool/result');
    assert.equal(calls.length, 1); assert.equal(results.length, 1);
    if (seed.callId) assert.equal(calls[0].event.data.callId, seed.callId);
    assert.equal(results[0].event.data.message.toolCallId, calls[0].event.data.callId);
    assert.equal(results[0].event.data.message.isError, false);
    assert.equal(JSON.parse(calls[0].event.data.arguments).command, seed.command);
    const body = JSON.stringify(results[0].event.data);
    assert.ok(body.includes(`中文🍀${seed.marker}`)); assert.ok(body.includes(`结束中文🍀${seed.marker}`));
    assert.ok(body.includes(`错误🦉${seed.marker}`)); assert.ok(!body.includes('�'));
    assert.ok(!body.includes('CannotCreateTypeConstrainedLanguage'));
    await details.getByRole('button', { name: '标准输出', exact: true }).click();
    await details.getByLabel('独立命令输出', { exact: true }).filter({ hasText: `结束中文🍀${seed.marker}` }).waitFor();
    await details.getByRole('button', { name: '错误输出', exact: true }).click();
    await details.getByLabel('独立命令输出', { exact: true }).filter({ hasText: `错误🦉${seed.marker}` }).waitFor();
    await details.getByRole('button', { name: '执行结果', exact: true }).click();
    await details.locator('.remote-file-preview-body').filter({ hasText: `结束中文🍀${seed.marker}` }).waitFor();
    assert.ok(!(await details.innerText()).includes('�'));
    assert.equal(original.projections.values.permissions.currentValue, 'read-only');
    assert.ok(records.some(item => item.event.type === 'assistant/message' && JSON.stringify(item.event.data).includes('DSHM_ENCODING_DONE')));
    await capture(prefix + '-' + phase); report.callId = calls[0].event.data.callId;
    report.liveBeforeSettlement = seed.liveObserved === true;
    report.originalResultAndPhoneMatch = true; report.readOnlyPreserved = true;
    report.inferenceVerified = true; report.passed = true;
    if (sdkMode || electronMode) await details.getByRole('button', { name: '关闭命令详情', exact: true }).click();
  }
} catch (error) {
  report.failure = { name: error.name, code: error.code ?? 'validation_failed',
    location: error.stack?.split('\n').find(line => line.includes('verify-latest-live-encoding-android.mjs:'))?.trim() };
  process.exitCode = 1;
} finally {
  await writeFile(reportPath, JSON.stringify(report, null, 2), { flag: 'wx' });
  console.log(JSON.stringify(report)); await device.close();
}
// 源码载荷核验的tsx/esbuild句柄不能掩盖实际验证终态；设备已在finally关闭。
process.exit(process.exitCode ?? 0);
