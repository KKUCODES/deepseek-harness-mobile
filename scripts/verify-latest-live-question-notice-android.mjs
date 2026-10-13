import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { access, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { openLatestLiveAndroid } from '../tests/support/latest-live-context.mjs';

const phase = process.argv[2];
assert.ok(['start', 'inspect', 'recover', 'audit'].includes(phase)); assert.equal(process.argv.length, 3);
const live = await openLatestLiveAndroid(undefined, { openRecorded: phase !== 'inspect' });
const { runtime, state, session, main, page, device, capture, readSession } = live;
assert.ok(['source', 'release'].includes(state.executionMode));
const prefix = 'latest-live-' + (state.executionMode === 'source' ? 'source-' : '') + 'question-notice';
const seedPath = resolve(runtime, prefix + '-seed.json');
const reportPath = resolve(runtime, prefix + '-android-' + phase + '.json');
const report = { at: new Date().toISOString(), phase, home: state.home, sessionId: session.sessionId,
  executionMode: state.executionMode, hostPid: state.hostPid, passed: false, errors: [] };
const pkg = 'dev.dshmobile.validation.latesttest';
const delay = ms => new Promise(done => setTimeout(done, ms));
const pid = async () => (await device.shell(`pidof ${pkg}`)).toString().trim();
const notices = async () => (await device.shell('cmd notification list')).toString().split('\n')
  .filter(line => line.includes(`|${pkg}|`) && line.includes('dshm.remote.notice.'));
async function nodes() {
  await device.shell('uiautomator dump /data/local/tmp/latest-question-notice.xml');
  const xml = (await device.shell('cat /data/local/tmp/latest-question-notice.xml')).toString();
  return [...xml.matchAll(/<node\s+([^>]+)>/g)].map(match => Object.fromEntries(
    [...match[1].matchAll(/([\w-]+)="([^"]*)"/g)].map(item => [item[1], item[2]])));
}
async function tap(node) {
  assert.ok(node); const [a, b, c, d] = node.bounds.match(/\d+/g).map(Number);
  await device.shell(`input tap ${Math.floor((a + c) / 2)} ${Math.floor((b + d) / 2)}`);
}
function originalCall(original, seed) {
  const calls = original.records.filter(item => item.event.type === 'tool/call' && item.event.seq > seed.initialSeq);
  assert.equal(calls.length, 1); assert.equal(calls[0].event.data.name, 'ask_user_question');
  const args = JSON.parse(calls[0].event.data.arguments);
  assert.equal(args.questions.length, 1); assert.equal(args.questions[0].id, 'notice_check');
  assert.equal(args.questions[0].question, seed.question);
  return calls[0].event;
}
page.on('pageerror', () => report.errors.push('page-error'));
let seed;
try {
  await assert.rejects(access(reportPath), { code: 'ENOENT' });
  if (state.executionMode === 'source') {
    assert.equal(state.command, 'pnpm dsh web');
    const { verifyInstalledSource } = await import('../../plugin/compatibility/latest-upstream/source-host.mjs');
    const installed = await verifyInstalledSource(); assert.equal(installed.sourceCommit, state.sourceCommit);
    report.sourceCommit = installed.sourceCommit; report.sourceFiles = installed.files;
  } else {
    assert.equal(state.command, 'node dsh/lib/bin.js web');
    const release = JSON.parse(await readFile(resolve(runtime, 'node_modules/@deepseek-ai/dsh/package.json'), 'utf8'));
    const candidate = JSON.parse(await readFile(resolve(runtime, 'candidate/package.json'), 'utf8'));
    assert.equal(release.name, '@deepseek-ai/dsh'); assert.equal(release.version, '0.2.1-alpha.1');
    assert.equal(candidate.name, '@dsh-mobile/plugin'); assert.equal(candidate.version, '0.1.76-latest.0');
    report.releasePackageVerified = true;
  }
  report.command = state.command;
  if (phase === 'start') {
    await assert.rejects(access(seedPath), { code: 'ENOENT' });
    const before = await readSession(); assert.equal(before.row.running, false);
    assert.equal((await main.getByRole('textbox', { name: '消息', exact: true }).innerText()).trim(), '');
    assert.equal((await notices()).length, 0);
    const options = page.getByRole('dialog', { name: 'Remote 选项', exact: true });
    if (await options.isVisible()) await options.getByRole('button', { name: '关闭窗口', exact: true }).click();
    await main.getByRole('button', { name: 'Remote 选项', exact: true }).click();
    await page.getByRole('button', { name: 'Remote 提醒', exact: true }).click();
    const settings = await nodes();
    assert.ok(settings.some(row => row.text === 'Remote 提醒 · 已连接'));
    assert.ok(settings.some(row => row.text === '需要回答' && row.checked === 'true'));
    await tap(settings.find(row => row.text === '完成'));
    await options.getByRole('button', { name: '关闭窗口', exact: true }).click();
    seed = { at: new Date().toISOString(), home: state.home, sessionId: session.sessionId, title: session.title,
      initialSeq: before.projections.asOfSeq, pid: await pid(), answer: '绿色',
      question: 'DSHM_QUESTION_NOTICE_' + randomUUID().replaceAll('-', '').slice(0, 12),
      settingsUnchanged: true };
    assert.match(seed.pid, /^\d+$/);
    await writeFile(seedPath, JSON.stringify(seed, null, 2), { flag: 'wx' });
    await main.getByRole('textbox', { name: '消息', exact: true }).fill(
      `这是 DSHM 新版后台提问通知验收。只执行本条请求，不补做以前的任务。只调用一次 ask_user_question，唯一问题id为 notice_check，正文为 ${seed.question}，两个单选项为“蓝色”和“绿色”，不标记推荐项。必须等待手机回答后，只回复 DSHM_NOTICE_ANSWER_加用户选中的中文颜色。不要调用其他工具、读写文件、修改设置或重试。`);
    seed.attempted = true; await writeFile(seedPath, JSON.stringify(seed, null, 2));
    await main.getByRole('button', { name: '发送消息', exact: true }).click();
    await device.shell('input keyevent KEYCODE_HOME');
    seed.sent = true; seed.backgroundAt = new Date().toISOString();
    await writeFile(seedPath, JSON.stringify(seed, null, 2));
    assert.equal(await pid(), seed.pid);
    const until = Date.now() + 45000;
    while (!(await notices()).length && Date.now() < until) await delay(300);
    report.notificationCount = (await notices()).length; assert.equal(report.notificationCount, 1);
    const original = await readSession(); const call = originalCall(original, seed);
    seed.callId = call.data.callId; report.originalCallId = call.data.callId;
    assert.equal(original.row.running, true);
    assert.equal(original.records.filter(item => item.event.type === 'tool/result' && item.event.data.message.toolCallId === seed.callId).length, 0);
    await device.shell('cmd statusbar expand-notifications');
    const shade = await nodes();
    assert.ok(shade.some(row => row.text === seed.title));
    const body = shade.find(row => row.text.includes('有问题等待你回答')); assert.ok(body);
    report.noticeTitle = seed.title; report.noticeBody = body.text;
    assert.equal(await pid(), seed.pid); await capture(prefix + '-shade');
    seed.readyToClick = true; await writeFile(seedPath, JSON.stringify(seed, null, 2));
    report.backgroundRetainedProcess = true; report.passed = true;
  } else if (phase === 'audit') {
    seed = JSON.parse(await readFile(seedPath, 'utf8'));
    assert.equal(seed.home, state.home); assert.equal(seed.sessionId, session.sessionId);
    assert.equal(seed.settled, true); assert.equal(seed.answered, true);
    const inspected = JSON.parse(await readFile(resolve(runtime, prefix + '-android-inspect.json'), 'utf8'));
    assert.equal(inspected.passed, true); assert.equal(inspected.nativeNotificationClicked, true);
    assert.equal(inspected.originalCallId, seed.callId);
    const before = await readSession(); assert.equal(before.row.running, false);
    await main.locator('.remote-topbar').getByRole('button', { name: '返回', exact: true }).click();
    await main.locator('.remote-session-row').filter({ hasText: seed.title }).click();
    await main.getByRole('article', { name: '模型回复', exact: true }).filter({ hasText: 'DSHM_NOTICE_ANSWER_' + seed.answer }).last().waitFor();
    const original = await readSession(); const call = originalCall(original, seed);
    assert.equal(call.data.callId, seed.callId); assert.equal(original.row.running, false);
    assert.equal(original.projections.asOfSeq, before.projections.asOfSeq);
    assert.ok(original.records.some(item => item.event.type === 'assistant/message'
      && item.event.data.turn === call.data.turn && item.event.data.message.content.some(part =>
        part.type === 'text' && part.text.includes('DSHM_NOTICE_ANSWER_' + seed.answer))));
    const result = original.records.filter(item => item.event.type === 'tool/result' && item.event.data.message.toolCallId === seed.callId);
    assert.equal(result.length, 1); assert.equal(result[0].event.data.message.isError, false);
    assert.deepEqual(JSON.parse(result[0].event.data.message.content.find(part => part.type === 'text').text), inspected.originalToolResult);
    assert.equal(original.projections.values.userQuestions.active.length, 0);
    assert.equal(await page.locator('[data-question-key]').count(), 0);
    assert.equal((await notices()).length, 0); assert.equal(await pid(), seed.pid);
    assert.equal((await main.getByRole('textbox', { name: '消息', exact: true }).innerText()).trim(), '');
    await capture(prefix + '-history');
    report.originalCallId = seed.callId; report.historyReopened = true;
    report.noRepeatedCall = true; report.sameProcess = true; report.passed = true;
  } else {
    seed = JSON.parse(await readFile(seedPath, 'utf8'));
    assert.equal(seed.home, state.home); assert.equal(seed.sessionId, session.sessionId);
    assert.equal(seed.sent, true); assert.equal(seed.answerAttempted, undefined);
    assert.equal(await pid(), seed.pid);
    if (phase === 'inspect') {
      assert.equal(seed.readyToClick, true); assert.equal((await notices()).length, 1);
      await device.shell('cmd statusbar expand-notifications');
      const title = (await nodes()).find(row => row.text === seed.title); assert.ok(title);
      seed.clickAttempted = true; await writeFile(seedPath, JSON.stringify(seed, null, 2));
      await tap(title); report.nativeNotificationClicked = true;
    }
    await main.locator('.remote-heading strong').getByText(seed.title, { exact: true }).waitFor();
    const card = page.locator('[data-question-key]'); await card.waitFor({ timeout: 15000 });
    assert.equal(await card.count(), 1); await card.getByText(seed.question, { exact: true }).waitFor();
    const pending = await readSession(); const call = originalCall(pending, seed);
    if (seed.callId) assert.equal(call.data.callId, seed.callId); else seed.callId = call.data.callId;
    report.originalCallId = call.data.callId;
    await capture(prefix + '-opened');
    assert.equal((await notices()).length, 0);
    await card.getByRole('radio', { name: seed.answer, exact: true }).click();
    assert.equal(await card.getByRole('radio', { name: seed.answer, exact: true }).getAttribute('aria-checked'), 'true');
    seed.answerAttempted = true; await writeFile(seedPath, JSON.stringify(seed, null, 2));
    await card.getByRole('button', { name: '提交', exact: true }).click();
    seed.answered = true; await writeFile(seedPath, JSON.stringify(seed, null, 2));
    await card.waitFor({ state: 'detached' });
    await main.getByRole('article', { name: '模型回复', exact: true }).filter({ hasText: 'DSHM_NOTICE_ANSWER_' + seed.answer }).last().waitFor({ timeout: 45000 });
    let original; const until = Date.now() + 15000;
    do {
      original = await readSession(); if (!original.row.running) break;
      assert.ok(Date.now() < until, 'question_notice_settlement_missing'); await delay(100);
    } while (true);
    originalCall(original, seed);
    const results = original.records.filter(item => item.event.type === 'tool/result' && item.event.data.message.toolCallId === seed.callId);
    assert.equal(results.length, 1); assert.equal(results[0].event.data.message.isError, false);
    const answer = JSON.parse(results[0].event.data.message.content.find(part => part.type === 'text').text);
    assert.deepEqual(answer, { answers: [{ id: 'notice_check', selected: [seed.answer] }] });
    assert.equal(original.projections.values.userQuestions.active.length, 0);
    assert.equal((await notices()).length, 0); assert.equal(await pid(), seed.pid);
    await main.getByRole('textbox', { name: '消息', exact: true }).waitFor();
    assert.equal((await main.getByRole('textbox', { name: '消息', exact: true }).innerText()).trim(), '');
    assert.equal(await page.locator('iframe').count(), 0);
    await capture(prefix + '-complete');
    report.originalToolResult = answer; report.notificationConsumed = true; report.sameProcess = true;
    report.passed = phase === 'inspect'; report.recovered = phase === 'recover';
    seed.settled = true; await writeFile(seedPath, JSON.stringify(seed, null, 2));
    if (phase === 'recover') process.exitCode = 1;
  }
  assert.deepEqual(report.errors, []);
} catch (error) {
  report.passed = false;
  report.failure = { name: error.name, code: error.code ?? 'validation_failed',
    message: error.message?.split('\n')[0], location: error.stack?.split('\n').find(line => line.includes('verify-latest-live-question-notice-android.mjs:'))?.trim() };
  process.exitCode = 1;
} finally {
  await writeFile(reportPath, JSON.stringify(report, null, 2), { flag: 'wx' });
  console.log(JSON.stringify(report)); await device.close();
}
setTimeout(() => process.exit(process.exitCode ?? 0), 200);
