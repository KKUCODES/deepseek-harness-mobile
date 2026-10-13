import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

/** 真正手机提交在转发前或回执送达前断线；恢复后不自动重发原决定。 */
export async function verifyOfficialInteractionSending({ page, device, evidence, inference, packageName, mark }) {
  assert.equal(packageName, 'dev.dshmobile.validation.officialtest');
  const scope = inference.interactionSending, mode = scope.mode, transport = scope.transport;
  assert.ok(['legacy', 'plan'].includes(mode));
  const report = { mode, cases: [], completed: false };
  const save = () => writeFile(resolve(evidence, mode + '-sending.json'), JSON.stringify(report, null, 2) + '\n');
  const screenshot = name => device.screenshot().then(bytes => writeFile(resolve(evidence, mode + '-sending-' + name + '.png'), bytes));
  const pid = async () => (await device.shell(`pidof ${packageName}`)).toString().trim();
  const editor = () => page.locator('[data-composer-input]');
  const selector = mode === 'plan' ? '[data-plan-review-key]' : '[data-question-key]';
  const card = () => page.locator(selector);
  const choosePlan = async active => {
    await page.getByTestId('remote-workspace').getByRole('button', { name: 'Remote 选项', exact: true }).click();
    await page.getByRole('button', { name: '计划模式', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: '计划模式', exact: true });
    await dialog.getByRole('button', { name: active ? '开启计划模式' : '关闭计划模式', exact: true }).click();
    await dialog.getByText('计划模式：' + (active ? '已开启' : '已关闭'), { exact: true }).waitFor();
    await scope.state(active); await dialog.getByRole('button', { name: '关闭窗口', exact: true }).click();
  };
  const answer = async selected => {
    if (mode === 'plan') await card().getByRole('button', { name: selected === 'approve' ? '同意执行' : '要求修改', exact: true }).click();
    else {
      await card().getByRole('radio', { name: selected, exact: true }).click();
      assert.equal(await card().getByRole('radio', { name: selected, exact: true }).getAttribute('aria-checked'), 'true');
      await card().getByRole('button', { name: '提交', exact: true }).click();
    }
  };
  try {
    report.appPid = await pid(); assert.match(report.appPid, /^[1-9]\d*$/);
    report.modelLabel = await page.getByRole('button', { name: /^选择模型，当前 / }).getAttribute('aria-label');
    await scope.state(false);
    for (const cutMode of ['before-forward', 'after-receipt']) {
      if (mode === 'plan') await choosePlan(true);
      const seed = { cutMode, initialSeq: await inference.beforeTool(), draft: 'OFFICIAL_' + mode.toUpperCase() + '_SENDING_' + cutMode,
        questionId: 'sending_' + cutMode, question: '请选择答复断线验收颜色（' + cutMode + '）',
        planTitle: 'DSHM 答复断线计划 ' + cutMode, planBody: '只回复验收标记，不调用其他工具，不修改文件或设置。' };
      seed.plan = '# ' + seed.planTitle + '\n\n' + seed.planBody;
      seed.prefix = 'DSHM_' + mode.toUpperCase() + '_SENDING_' + cutMode.replaceAll('-', '_') + '_';
      seed.prompt = mode === 'legacy'
        ? `只执行本条DSHM默认提问答复断线验收。只调用一次ask_user_question，问题id严格为${seed.questionId}，正文严格为“${seed.question}”，依次提供“蓝色”和“绿色”单选选项，multi_select为false，不标记推荐项。等待最终answers后，只回复${seed.prefix}加选中的中文颜色。不执行其他工具，不读写文件，不修改设置，不重试提问。`
        : `只执行本条DSHM计划答复断线验收。只调用一次exit_plan_mode并等待最终用户决定。批准后只回复${seed.prefix}APPROVE，要求修改或取消审阅后只回复${seed.prefix}MODIFY并结束，不再次提交计划。不执行其他工具，不读写文件或修改设置。工具参数严格使用以下JSON对象：\n${JSON.stringify({ plan: seed.plan })}`;
      report.cases.push(seed); await save();
      await editor().fill(seed.draft); await new Promise(done => setTimeout(done, 1000));
      seed.submission = await scope.start(seed.prompt);
      await page.getByText(seed.prompt, { exact: true }).waitFor();
      await card().waitFor({ timeout: 180000 }); assert.equal(await card().count(), 1);
      if (mode === 'legacy') await card().getByText(seed.question, { exact: true }).waitFor();
      else {
        const panel = page.getByRole('region', { name: '插件面板', exact: true });
        await panel.waitFor(); await panel.getByRole('heading', { name: seed.planTitle, exact: true }).waitFor();
        assert.ok((await panel.innerText()).includes(seed.planBody)); await screenshot(cutMode + '-document');
        await panel.getByRole('button', { name: '返回聊天', exact: true }).click(); await panel.waitFor({ state: 'hidden' });
        seed.actualPlanPreviewVerified = true;
      }
      seed.callId = await page.locator('[data-chat-call-id]').last().getAttribute('data-chat-call-id');
      assert.ok(seed.callId); seed.checkpoint = await scope.checkpoint(seed);
      seed.observer = seed.checkpoint.observers[0];
      const first = mode === 'plan' ? 'approve' : '绿色';
      const outcome = { kind: 'result', value: { answers: [{ id: mode === 'plan' ? 'plan-review' : seed.questionId,
        selected: [mode === 'plan' ? 'Approve' : first] }] } };
      await transport.arm({ ...seed.observer, mode: cutMode, event: 'user-questions/request', outcome,
        ...(mode === 'plan' ? { plan: seed.plan } : { question: { id: seed.questionId, question: seed.question } }) });
      await save(); await answer(first);
      seed.cut = await transport.cut(); await save();
      assert.equal(seed.cut.callId, seed.callId); assert.equal(seed.cut.eventId, seed.observer.eventId);
      assert.equal(seed.cut.socketClosed, true); assert.equal(seed.cut.requestForwarded, cutMode === 'after-receipt');
      assert.deepEqual(seed.cut.outcome, outcome);
      assert.ok(seed.checkpoint.observers.every(observer => observer.clientId !== seed.cut.clientId));
      if (cutMode === 'before-forward') assert.equal(seed.cut.receipt, undefined);
      else { assert.equal(seed.cut.receipt.type, 'result'); assert.equal(seed.cut.receipt.value.ok, true); }
      await page.getByTestId('remote-offline-status').waitFor({ timeout: 30000 });
      await page.waitForFunction(({ selector }) => [...document.querySelectorAll(selector + ' button')]
        .filter(button => ['提交', '同意执行', '要求修改'].includes(button.textContent.trim()))
        .every(button => button.disabled), { selector }, { timeout: 30000 });
      assert.equal(await pid(), report.appPid); seed.phoneOfflineAndNoEnabledOldDecision = true;
      await screenshot(cutMode + '-offline');
      if (cutMode === 'before-forward') seed.offline = await scope.pending(seed);
      else seed.offline = await scope.settled(seed);
      assert.equal((await transport.answers(seed.observer.eventId)).length, 1);
      await save(); await transport.resume();
      await page.getByTestId('remote-offline-status').waitFor({ state: 'detached', timeout: 60000 });
      await page.getByText(seed.prompt, { exact: true }).waitFor();
      if (cutMode === 'before-forward') {
        await card().waitFor({ timeout: 30000 }); assert.equal(await card().count(), 1);
        seed.restoredPending = await scope.pending(seed);
        assert.equal((await transport.answers(seed.observer.eventId)).length, 1);
        // 原答案未送达；恢复后由手机显式提交相反决定，不允许把旧答案重放。
        await answer(mode === 'plan' ? 'modify' : '蓝色');
      }
      seed.official = await scope.settled(seed);
      assert.equal(seed.official.winner, cutMode === 'before-forward' ? mode === 'plan' ? 'modify' : '蓝色' : first);
      await card().waitFor({ state: 'detached', timeout: 30000 });
      const reply = page.getByRole('article', { name: '模型回复', exact: true }).getByText(seed.official.token, { exact: true });
      await reply.waitFor({ timeout: 30000 }); await reply.scrollIntoViewIfNeeded();
      assert.equal(await editor().innerText(), seed.draft); assert.equal(await pid(), report.appPid);
      await editor().click(); await page.getByRole('button', { name: report.modelLabel, exact: true }).waitFor();
      assert.equal(await page.locator('iframe').count(), 0); assert.equal(await card().count(), 0);
      seed.answers = await transport.answers(seed.observer.eventId);
      assert.equal(seed.answers.length, cutMode === 'before-forward' ? 2 : 1);
      assert.deepEqual(seed.answers.map(item => item.forwarded), cutMode === 'before-forward' ? [false, true] : [true]);
      if (cutMode === 'before-forward') assert.notEqual(seed.answers[0].clientId, seed.answers[1].clientId);
      seed.noAutomaticAnswerReplay = true; seed.oldAnswers = await scope.duplicate(seed, seed.official.winner);
      await screenshot(cutMode + '-settled');
      if (mode === 'plan' && seed.official.winner === 'modify') await choosePlan(false);
      await scope.state(false); await editor().fill(''); seed.passed = true;
      await save(); await mark('official-' + mode + '-sending-' + cutMode + '-phone-recovered-without-replay');
    }
    report.completed = true;
  } catch (error) { report.failure = error.message; throw error; }
  finally { await save(); }
  return report;
}
