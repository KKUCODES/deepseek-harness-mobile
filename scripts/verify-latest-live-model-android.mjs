// 真实模型专项复用已批准的测试 UID；只发专用消息，不清除 App 或读取 Key。
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile, writeFile, realpath } from 'node:fs/promises';
import { resolve, relative, isAbsolute } from 'node:path';
import { _android } from 'playwright';
import { androidAppWebView } from './android-app-webview.mjs';

assert.ok(process.argv.length === 2 || process.argv.length === 3 && process.argv[2] === '--send-unsubmitted');
const sendUnsubmitted = process.argv[2] === '--send-unsubmitted';
const runtime = resolve(import.meta.dirname, '../../plugin/artifacts/latest-runtime-check');
const state = JSON.parse(await readFile(resolve(runtime, 'latest-live-state.json'), 'utf8'));
const recorded = JSON.parse(await readFile(resolve(runtime, 'latest-live-android-session.json'), 'utf8'));
const child = relative(resolve(runtime, 'live-homes'), state.home);
assert.match(child, /^[0-9a-f-]{36}$/);
assert.ok(!isAbsolute(child));
assert.equal(await realpath(state.home), resolve(await realpath(resolve(runtime, 'live-homes')), child));
assert.equal(state.target, '0.2.1-alpha.1'); assert.equal(state.ready, true);
assert.equal(recorded.home, state.home);
assert.equal(recorded.title, 'DSHM 新版手机真实模型验收');
assert.equal(recorded.originalSessionListVerified, true);
assert.match(recorded.sessionId, /^session-[0-9a-f-]{36}$/);
assert.equal(process.env.DSHM_ANDROID_SERIAL, 'emulator-5554');
const packageName = 'dev.dshmobile.validation.latesttest';
const device = (await _android.devices({ omitDriverInstall: true })).find(item => item.serial() === process.env.DSHM_ANDROID_SERIAL);
assert.ok(device);
const reportPath = resolve(runtime, 'latest-live-model-android.json');
const attemptPath = resolve(runtime, 'latest-live-model-attempt.json');
let report = { at: new Date().toISOString(), target: state.target, home: state.home,
  sessionId: recorded.sessionId, packageName, inferenceVerified: false, passed: false };
try {
  const first = await (await androidAppWebView(device, packageName)).page();
  const page = first.context().pages().find(item => item.url().startsWith('https://remote.dshm.invalid/'));
  assert.ok(page); page.setDefaultTimeout(30000);
  const main = page.getByTestId('remote-workspace');
  await main.waitFor();
  assert.equal(await main.locator('.remote-heading strong').innerText(), recorded.title);
  assert.equal(await page.locator('iframe').count(), 0);
  const selected = await main.evaluate(element => {
    const key = Object.keys(element).find(name => name.startsWith('__reactFiber$'));
    for (let fiber = element[key]; fiber; fiber = fiber.return)
      if (fiber.memoizedProps?.model?.client) return fiber.memoizedProps.model.getSnapshot().selected;
    throw Error('latest_live_selected_missing');
  });
  assert.equal(selected, recorded.sessionId);
  // 只使用本测试 Host 原登录入口；私有 URL/cookie 不落入公开报告。
  const { loginURL } = JSON.parse(await readFile(resolve(state.home, 'private-entry.json'), 'utf8'));
  const url = new URL(loginURL);
  assert.equal(url.hostname, '127.0.0.1'); assert.equal(url.protocol, 'http:');
  const login = await fetch(url, { redirect: 'manual', signal: AbortSignal.timeout(10000) });
  assert.equal(login.status, 303, 'latest_live_login_failed');
  const cookie = login.headers.get('set-cookie')?.split(';')[0]; assert.ok(cookie);
  const read = async (method, args) => {
    assert.ok(['session/list', 'session/projections', 'session/page'].includes(method));
    const rpcId = randomUUID();
    const response = await fetch(new URL('/api/' + method, url), { method: 'POST',
      headers: { cookie, 'content-type': 'application/json' }, signal: AbortSignal.timeout(15000),
      body: JSON.stringify({ type: 'client-request', rpcId, method, payload: { args } }) });
    assert.equal(response.status, 200, 'latest_live_read_' + response.status);
    const frame = await response.json();
    assert.equal(frame.rpcId, rpcId); assert.equal(frame.result.ok, true, 'latest_live_read_refused');
    return frame.result.value;
  };
  const original = async () => {
    report.phase = 'read-projections';
    const projections = await read('session/projections', { request: { sessionId: recorded.sessionId } });
    assert.ok(Number.isInteger(projections?.asOfSeq));
    report.phase = 'read-history';
    const history = await read('session/page', { request: { address: { kind: 'session', sessionId: recorded.sessionId },
      throughSeq: projections.asOfSeq, maxMessages: 30 } });
    assert.ok(Array.isArray(history.records));
    return { projections, records: history.records };
  };
  let attempt;
  try { attempt = JSON.parse(await readFile(attemptPath, 'utf8')); }
  catch (error) { if (error.code !== 'ENOENT') throw error; }
  if (attempt) {
    assert.equal(attempt.home, state.home); assert.equal(attempt.sessionId, recorded.sessionId);
    assert.match(attempt.marker, /^DSHM_LATEST_MODEL_[0-9a-f]{16}$/);
    report.reusedAttempt = true;
  }
  if (!attempt || sendUnsubmitted) {
    const rows = await read('session/list', { _request: {} });
    const row = rows.items.find(item => item.sessionId === recorded.sessionId);
    assert.ok(row?.blank && !row.running, 'latest_live_not_blank');
    assert.equal(resolve(row.cwd), resolve(state.workspacePath));
    const before = await original();
    assert.equal(before.records.filter(item => item.event?.type === 'user/message').length, 0);
    attempt ??= { at: new Date().toISOString(), home: state.home, sessionId: recorded.sessionId,
      marker: 'DSHM_LATEST_MODEL_' + randomUUID().replaceAll('-', '').slice(0, 16) };
    // 发送前以排他创建记录一次；失败重跑只观察，不自动补发或造成重复收费。
    if (!sendUnsubmitted) await writeFile(attemptPath, JSON.stringify(attempt, null, 2), { flag: 'wx' });
    const input = page.getByRole('textbox', { name: '消息', exact: true });
    assert.equal((await input.innerText()).trim(), '');
    await input.fill(`这是 DSHM 新版真实模型联调。请只回复 ${attempt.marker}，不要调用工具。`);
    await page.getByRole('button', { name: '发送消息', exact: true }).click();
    report.sentThroughOriginalAndroidComposer = true;
  }
  report.marker = attempt.marker;
  await writeFile(reportPath, JSON.stringify(report, null, 2));
  await page.getByRole('article', { name: '模型回复', exact: true }).filter({ hasText: attempt.marker })
    .waitFor({ timeout: 240000 });
  await page.getByRole('button', { name: '停止生成', exact: true }).waitFor({ state: 'hidden', timeout: 240000 });
  const after = await original();
  const texts = record => (record.event?.data?.message?.content ?? record.event?.data?.content ?? [])
    .filter(part => part.type === 'text').map(part => part.text).join('\n');
  const users = after.records.filter(item => item.event?.type === 'user/message' && texts(item).includes(attempt.marker));
  const assistants = after.records.filter(item => item.event?.type === 'assistant/message' && texts(item).trim() === attempt.marker);
  assert.equal(users.length, 1); assert.equal(assistants.length, 1);
  const rows = await read('session/list', { _request: {} });
  const row = rows.items.find(item => item.sessionId === recorded.sessionId);
  assert.equal(row.blank, false); assert.equal(row.running, false);
  assert.equal(resolve(row.cwd), resolve(state.workspacePath));
  report = { ...report, finishedAt: new Date().toISOString(), inferenceVerified: true, passed: true,
    originalHostHistoryVerified: true, ownPage: true, userSeq: users[0].event.seq,
    assistantSeq: assistants[0].event.seq, assistantSource: Object.fromEntries(['kind', 'provider', 'model']
      .map(key => [key, assistants[0].event.data.message.source[key]])),
    tokenUsage: after.projections.values.tokenUsage, sessionStats: after.projections.values.sessionStats,
    modelSelection: after.projections.values.modelSelection, historyEventTypes: after.records.map(item => item.event.type) };
  await writeFile(resolve(runtime, 'latest-live-model-android.png'), await device.screenshot());
} catch (error) {
  // 避免登录链接或运行时原日志进入公开错误文本。
  report.failure = { name: error.name, code: error.code ?? 'validation_failed',
    ...(typeof error.message === 'string' && /^latest_live_[a-z_0-9]+$/.test(error.message) ? { detail: error.message } : {}),
    location: error.stack?.split('\n').find(line => line.includes('verify-latest-live-model-android.mjs:'))?.trim() };
  await writeFile(resolve(runtime, 'latest-live-model-android-failed.png'), await device.screenshot()).catch(() => {});
  process.exitCode = 1;
} finally {
  await writeFile(reportPath, JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ passed: report.passed, inferenceVerified: report.inferenceVerified,
    sessionId: recorded.sessionId, failure: report.failure }));
  await device.close();
}
