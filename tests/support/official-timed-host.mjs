import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

/** 手机保持运行，官方隔离Host退出后补答原问题；结算后的重启不得重放。 */
export async function verifyOfficialTimedHost({ page, device, evidence, inference, packageName, mark }) {
  assert.equal(packageName, 'dev.dshmobile.validation.officialtest');
  const scope = inference.timedQuestion, host = scope.host;
  assert.ok(host);
  const report = { restarts: [], completed: false };
  const save = () => writeFile(resolve(evidence, 'timed-host.json'), JSON.stringify(report, null, 2) + '\n');
  const pid = async () => (await device.shell(`pidof ${packageName}`)).toString().trim();
  const card = () => page.locator('[data-question-key]');
  const editor = () => page.locator('[data-composer-input]');
  const screenshot = async name => writeFile(resolve(evidence, 'timed-host-' + name + '.png'), await device.screenshot());
  const offline = async item => {
    item.stop = await host.stop(); await save();
    await page.getByTestId('remote-offline-status').waitFor({ timeout: 30000 });
    // 会话仍在手机页中，离线不允许提交原问题。
    await page.waitForFunction(() => [...document.querySelectorAll('[data-question-key] button')]
      .every(button => button.disabled));
    assert.equal(await pid(), report.appPid);
    item.phoneOfflineAndNoActiveAnswer = true;
    await screenshot(item.phase + '-offline');
  };
  const online = async item => {
    item.start = await host.start(); await save();
    await page.getByTestId('remote-offline-status').waitFor({ state: 'detached', timeout: 60000 });
    await page.getByText(report.seed.prompt, { exact: true }).waitFor();
    assert.equal(await pid(), report.appPid);
    assert.equal(await page.locator('iframe').count(), 0);
    assert.equal(await editor().innerText(), report.draft);
    // 官方问题面板接管输入区期间不显示模型工具栏，答完后再核对模型。
    if (item.phase === 'settled') {
      await editor().click();
      await page.getByRole('button', { name: report.modelLabel, exact: true }).waitFor({ timeout: 30000 });
      item.modelPreserved = true;
    }
    item.sameAppAndOriginalChatAndDraft = true;
  };
  try {
    report.appPid = await pid(); assert.match(report.appPid, /^[1-9]\d*$/);
    const seed = report.seed = { kind: 'host', timeout: 120, initialSeq: await inference.beforeTool(),
      questionId: 'timed_host', question: '请选择电脑重启后补答验收颜色', selected: '绿色' };
    seed.done = 'DSHM_TIMED_HOST_绿色';
    seed.prompt = `这是DSHM官方电脑重启提问验收。只调用一次ask_user_question，timeout严格为120秒，问题id严格为${seed.questionId}，正文严格为“${seed.question}”，按顺序提供“蓝色”和“绿色”两个单选选项，multi_select严格为false。不标记推荐项，不调用其他工具，不读写文件，不修改设置，不重试提问。如果工具直接返回answers，只回复DSHM_TIMED_HOST_加选中的中文颜色。如果工具pending或工具因电脑重启而中断，不代表用户同意，不执行任何依赖答案的操作。之后收到answer_to_pending_question的用户补答时，只回复DSHM_TIMED_HOST_加选中的中文颜色，不再次调用工具。`;
    report.draft = 'OFFICIAL_TIMED_HOST_UNSENT_DRAFT';
    await editor().fill(report.draft);
    report.modelLabel = await page.getByRole('button', { name: /^选择模型，当前 / }).getAttribute('aria-label');
    await new Promise(done => setTimeout(done, 1000));
    seed.submission = await scope.start(seed.prompt);
    await page.getByText(seed.prompt, { exact: true }).waitFor();
    await card().waitFor({ timeout: 180000 }); assert.equal(await card().count(), 1);
    await card().getByText(seed.question, { exact: true }).waitFor();
    seed.callId = await page.locator('[data-chat-call-id]').last().getAttribute('data-chat-call-id');
    assert.ok(seed.callId);
    seed.checkpoint = await host.checkpoint(seed);
    seed.observer = await scope.observe(seed);
    await screenshot('waiting'); await save();

    const waiting = { phase: 'waiting' }; report.restarts.push(waiting);
    await offline(waiting); await online(waiting);
    waiting.official = await host.recovered(seed);
    await card().waitFor(); assert.equal(await card().count(), 1);
    await card().getByText(seed.question, { exact: true }).waitFor();
    await card().getByText('已继续工作，仍可回答', { exact: true }).waitFor();
    assert.equal(await page.locator('[data-chat-call-id]').last().getAttribute('data-chat-call-id'), seed.callId);
    const interrupted = page.locator('button[data-turn-process]').filter({ hasText: '已中断' });
    await interrupted.waitFor(); assert.equal(await interrupted.count(), 1);
    const oldTool = page.locator(`[data-chat-call-id="${seed.callId}"]`);
    const oldNode = page.locator('[data-chat-flow-kind="tool-call"]').filter({ has: oldTool });
    await oldNode.locator('[data-tool-details]').click();
    const detail = page.getByRole('dialog', { name: '工具详情', exact: true });
    await detail.getByText(/The tool call was interrupted after it was recorded/).waitFor();
    await screenshot('waiting-detail');
    await detail.getByRole('button', { name: '关闭工具详情', exact: true }).click();
    waiting.originalQuestionAndUnknownOutcomeVisible = true;
    await screenshot('waiting-restored'); await save();
    await card().getByRole('radio', { name: seed.selected, exact: true }).click();
    await card().getByRole('button', { name: '提交', exact: true }).click();
    await card().waitFor({ state: 'detached' });
    await page.getByRole('article', { name: '模型回复', exact: true })
      .getByText(seed.done, { exact: true }).waitFor({ timeout: 180000 });
    seed.reply = await scope.settled(seed.done);
    waiting.answer = await host.answered(seed);
    assert.equal(await editor().innerText(), report.draft);
    await editor().click();
    await page.getByRole('button', { name: report.modelLabel, exact: true }).waitFor({ timeout: 30000 });
    waiting.modelPreservedAfterAnswer = true;
    await screenshot('answered'); waiting.passed = true; await save();
    await mark('official-timed-host-interrupted-question-phone-late-answer-without-tool-replay');

    const settled = { phase: 'settled', checkpoint: await host.idleCheckpoint() };
    report.restarts.push(settled);
    // 已结算时没有问题卡片，仍核对原会话的离线及自行恢复。
    settled.stop = await host.stop(); await save();
    await page.getByTestId('remote-offline-status').waitFor({ timeout: 30000 });
    assert.equal(await pid(), report.appPid); assert.equal(await card().count(), 0);
    await screenshot('settled-offline'); await online(settled);
    await page.getByRole('article', { name: '模型回复', exact: true }).getByText(seed.done, { exact: true }).waitFor();
    assert.equal(await card().count(), 0);
    settled.history = await host.verifyIdle(seed);
    settled.passed = true; await screenshot('settled-restored'); await save();
    await editor().fill(''); report.completed = true;
    await mark('official-timed-host-settled-restart-retains-single-original-answer');
  } catch (error) { report.failure = error.message; throw error; }
  finally { await save(); }
  return report;
}
