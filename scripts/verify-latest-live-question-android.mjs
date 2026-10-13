import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { openLatestLiveAndroid } from '../tests/support/latest-live-context.mjs';

const phase = process.argv[2]; assert.ok(['start', 'answer', 'observe'].includes(phase));
const sourceMode = process.argv[3] === 'source';
assert.ok(process.argv[3] === undefined || sourceMode); assert.ok(process.argv.length <= 4);
const prefix = sourceMode ? 'latest-live-source-question' : 'latest-live-question';
const live = await openLatestLiveAndroid(undefined, { openRecorded: sourceMode });
const { runtime, state, session, main, page, device, capture, readSession } = live;
const seedPath = resolve(runtime, prefix + '-seed.json');
const report = { at: new Date().toISOString(), phase, sessionId: session.sessionId, passed: false,
  executionMode: state.executionMode ?? 'release', hostPid: state.hostPid };
let seed;
try {
  if (sourceMode) {
    assert.equal(state.executionMode, 'source'); assert.equal(state.command, 'pnpm dsh web');
    const { verifyInstalledSource } = await import('../../plugin/compatibility/latest-upstream/source-host.mjs');
    const installed = await verifyInstalledSource(); assert.equal(installed.sourceCommit, state.sourceCommit);
    report.sourceCommit = installed.sourceCommit; report.sourceFiles = installed.files;
  }
  if (phase === 'start') {
    const original = await readSession(); assert.equal(original.row.running, false);
    const input = main.getByRole('textbox', { name: '消息', exact: true });
    assert.equal((await input.innerText()).trim(), '');
    seed = { at: new Date().toISOString(), home: state.home, sessionId: session.sessionId, initialSeq: original.projections.asOfSeq,
      question: 'DSHM_QUESTION_' + randomUUID().replaceAll('-', '').slice(0, 12), answer: '绿色' };
    await writeFile(seedPath, JSON.stringify(seed, null, 2), { flag: 'wx' });
    await input.fill(`这是 DSHM 新版真实提问验收。只执行本条消息，不要补做之前的测试请求。只调用一次 ask_user_question 工具，问题id为 color_check，问题正文为 ${seed.question}，提供两个单选选项“蓝色”和“绿色”，不要标记推荐项。必须等待用户选择后，最后只回复 DSHM_QUESTION_ANSWER_加用户选中的中文颜色。不要执行其他工具、读写文件或修改设置。`);
    seed.attempted = true; await writeFile(seedPath, JSON.stringify(seed, null, 2));
    await main.getByRole('button', { name: '发送消息', exact: true }).click();
    seed.sent = true; await writeFile(seedPath, JSON.stringify(seed, null, 2));
    report.sent = true;
  } else {
    seed = JSON.parse(await readFile(seedPath, 'utf8'));
    assert.equal(seed.home, state.home); assert.equal(seed.sessionId, session.sessionId); assert.equal(seed.sent, true);
    if (phase === 'answer') {
      assert.equal(seed.answerAttempted, undefined);
      const card = page.locator('[data-question-key]');
      await card.waitFor({ timeout: 180000 }); assert.equal(await card.count(), 1);
      await card.getByText(seed.question, { exact: true }).waitFor();
      await capture(prefix + '-pending');
      report.questionSnapshot = await card.ariaSnapshot();
      await card.getByRole('radio', { name: seed.answer, exact: true }).click();
      assert.equal(await card.getByRole('radio', { name: seed.answer, exact: true }).getAttribute('aria-checked'), 'true');
      assert.equal(await card.getByRole('radio', { name: '蓝色', exact: true }).getAttribute('aria-checked'), 'false');
      await capture(prefix + '-selected');
      seed.answerAttempted = true; await writeFile(seedPath, JSON.stringify(seed, null, 2));
      await card.getByRole('button', { name: '提交', exact: true }).click();
      seed.answered = true; await writeFile(seedPath, JSON.stringify(seed, null, 2));
      await card.waitFor({ state: 'detached' });
      report.originalChoiceSubmitted = true;
    } else {
      await main.getByRole('article', { name: '模型回复', exact: true }).filter({ hasText: 'DSHM_QUESTION_ANSWER_' + seed.answer })
        .last().waitFor({ timeout: 180000 });
      let original;
      const end = Date.now() + 30000;
      do {
        original = await readSession(); if (!original.row.running) break;
        assert.ok(Date.now() < end, 'latest_question_settlement_missing');
        await new Promise(done => setTimeout(done, 100));
      } while (true);
      assert.equal(original.row.running, false);
      assert.equal(original.projections.values.userQuestions.active.length, 0);
      const calls = original.records.filter(item => item.event.type === 'tool/call'
        && item.event.data.name === 'ask_user_question'
        && JSON.parse(item.event.data.arguments).questions.some(question => question.question === seed.question));
      assert.equal(calls.length, 1);
      if (sourceMode) assert.deepEqual(original.records.filter(item => item.event.type === 'tool/call'
        && item.event.seq > seed.initialSeq).map(item => item.event.data.callId), [calls[0].event.data.callId]);
      const call = calls[0].event;
      assert.ok(original.records.some(item => item.event.type === 'assistant/message'
        && item.event.data.turn === call.data.turn && item.event.data.message.content.some(part =>
          part.type === 'text' && part.text.includes('DSHM_QUESTION_ANSWER_' + seed.answer))));
      const results = original.records.filter(item => item.event.type === 'tool/result'
        && item.event.data.message.toolCallId === call.data.callId);
      assert.equal(results.length, 1); assert.equal(results[0].event.data.message.isError, false);
      const answer = JSON.parse(results[0].event.data.message.content.find(part => part.type === 'text').text);
      assert.deepEqual(answer, { answers: [{ id: 'color_check', selected: [seed.answer] }] });
      assert.equal(await page.locator('[data-question-key]').count(), 0);
      await main.getByRole('textbox', { name: '消息', exact: true }).waitFor();
      report.originalQuestionProjection = original.projections.values.userQuestions;
      report.originalCallId = call.data.callId; report.originalToolResult = answer;
      report.legacyQuestionNotInTimedProjection = original.projections.values.userQuestions.settled.length === 0;
      report.passed = true; await capture(prefix + '-complete');
    }
  }
} catch (error) {
  report.failure = { name: error.name, code: error.code ?? 'validation_failed', message: error.message?.split('\n')[0],
    location: error.stack?.split('\n').find(line => line.includes('verify-latest-live-question-android.mjs:'))?.trim() };
  process.exitCode = 1;
} finally {
  await writeFile(resolve(runtime, prefix + '-android-' + phase + '.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report)); await device.close();
}
process.exit(process.exitCode ?? 0);
