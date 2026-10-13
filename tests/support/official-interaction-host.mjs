import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

/** 原默认提问/计划随Host结束失效；手机显式新请求才创建新交互。 */
export async function verifyOfficialInteractionHost({ page, device, evidence, inference, packageName, mark }) {
  assert.equal(packageName, 'dev.dshmobile.validation.officialtest');
  const scope = inference.interactionHost, mode = scope.mode;
  assert.ok(['legacy', 'plan'].includes(mode));
  const report = { mode, cases: [], completed: false };
  const save = () => writeFile(resolve(evidence, mode + '-host.json'), JSON.stringify(report, null, 2) + '\n');
  const screenshot = name => device.screenshot().then(bytes => writeFile(resolve(evidence, mode + '-host-' + name + '.png'), bytes));
  const pid = async () => (await device.shell(`pidof ${packageName}`)).toString().trim();
  const editor = () => page.locator('[data-composer-input]');
  const card = () => page.locator(mode === 'plan' ? '[data-plan-review-key]' : '[data-question-key]');
  const choosePlan = async active => {
    await page.getByTestId('remote-workspace').getByRole('button', { name: 'Remote 选项', exact: true }).click();
    await page.getByRole('button', { name: '计划模式', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: '计划模式', exact: true });
    await dialog.getByRole('button', { name: active ? '开启计划模式' : '关闭计划模式', exact: true }).click();
    await dialog.getByText('计划模式：' + (active ? '已开启' : '已关闭'), { exact: true }).waitFor();
    await scope.state(active);
    await dialog.getByRole('button', { name: '关闭窗口', exact: true }).click();
  };
  const seedFor = async (phase, outcome) => {
    const seed = { phase, outcome, initialSeq: await inference.beforeTool(), selected: '绿色',
      questionId: 'host_' + phase, question: '请选择默认提问电脑重启验收颜色（' + phase + '）',
      planTitle: 'DSHM 电脑重启计划 ' + phase + ' ' + outcome,
      planBody: '批准后只回复验收标记，不执行其他工具，不修改文件或设置。' };
    seed.plan = '# ' + seed.planTitle + '\n\n' + seed.planBody;
    seed.done = mode === 'legacy' ? 'DSHM_LEGACY_HOST_绿色' : 'DSHM_PLAN_HOST_' + outcome.toUpperCase();
    seed.prompt = mode === 'legacy'
      ? `只执行本条DSHM默认提问电脑重启验收。只调用一次ask_user_question，问题id严格为${seed.questionId}，正文严格为“${seed.question}”，依次提供“蓝色”和“绿色”两个单选选项，multi_select为false，不标记推荐项。不执行其他工具，不读写文件，不修改设置，不重试提问。收到正常answers后只回复DSHM_LEGACY_HOST_加选中的中文颜色。工具中断不是用户批准，不自动重新提问。`
      : `只执行本条DSHM计划电脑重启验收。只调用一次exit_plan_mode并等待用户审阅。批准后只回复DSHM_PLAN_HOST_APPROVE；用户要求修改后只回复DSHM_PLAN_HOST_MODIFY并结束，不再次提交计划。不执行其他工具、不读写文件或修改设置。电脑重启导致工具中断不是用户批准，不自动重新提交。工具参数严格使用以下JSON对象：\n${JSON.stringify({ plan: seed.plan })}`;
    return seed;
  };
  const showPending = async (seed, name) => {
    await page.getByText(seed.prompt, { exact: true }).waitFor();
    await card().waitFor({ timeout: 180000 }); assert.equal(await card().count(), 1);
    if (mode === 'legacy') await card().getByText(seed.question, { exact: true }).waitFor();
    else {
      await card().getByRole('heading', { name: seed.planTitle, exact: true }).waitFor();
      const panel = page.getByRole('region', { name: '插件面板', exact: true });
      await panel.waitFor({ timeout: 30000 });
      await panel.getByRole('heading', { name: seed.planTitle, exact: true }).waitFor();
      assert.ok((await panel.innerText()).includes(seed.planBody));
      await screenshot(name + '-document');
      await panel.getByRole('button', { name: '返回聊天', exact: true }).click();
      await panel.waitFor({ state: 'hidden' }); seed.actualPlanPreviewVerified = true;
    }
    seed.callId = await page.locator('[data-chat-call-id]').last().getAttribute('data-chat-call-id');
    assert.ok(seed.callId); await screenshot(name);
  };
  const restart = async (item, testCase) => {
    item.stop = await scope.stop(); await save();
    await page.getByTestId('remote-offline-status').waitFor({ timeout: 30000 });
    await page.waitForFunction(() => [...document.querySelectorAll('[data-question-key] button, [data-plan-review-key] button')]
      .every(button => button.disabled));
    assert.equal(await pid(), report.appPid); await screenshot(testCase.outcome + '-' + item.phase + '-offline');
    item.start = await scope.startHost(); await save();
    await page.getByTestId('remote-offline-status').waitFor({ state: 'detached', timeout: 60000 });
    await page.getByText(testCase.old.prompt, { exact: true }).waitFor();
    await card().waitFor({ state: 'detached', timeout: 30000 });
    assert.equal(await pid(), report.appPid); assert.equal(await page.locator('iframe').count(), 0);
    assert.equal(await editor().innerText(), testCase.draft);
    await editor().click();
    await page.getByRole('button', { name: report.modelLabel, exact: true }).waitFor({ timeout: 30000 });
    item.sameAppOriginalChatDraftAndModel = true; item.noStaleCard = true;
  };
  try {
    report.appPid = await pid(); assert.match(report.appPid, /^[1-9]\d*$/);
    report.modelLabel = await page.getByRole('button', { name: /^选择模型，当前 / }).getAttribute('aria-label');
    await scope.state(false);
    for (const outcome of mode === 'plan' ? ['approve', 'modify'] : ['answer']) {
      if (mode === 'plan') await choosePlan(true);
      const testCase = { outcome, draft: 'OFFICIAL_' + mode.toUpperCase() + '_HOST_DRAFT_' + outcome, restarts: [] };
      report.cases.push(testCase);
      const old = testCase.old = await seedFor('interrupted', outcome);
      await editor().fill(testCase.draft); await new Promise(done => setTimeout(done, 1000));
      old.submission = await scope.start(old.prompt);
      await showPending(old, outcome + '-waiting');
      old.checkpoint = await scope.checkpoint(old); await save();
      const waiting = { phase: 'waiting' }; testCase.restarts.push(waiting);
      await restart(waiting, testCase); waiting.official = await scope.recovered(old);
      const interrupted = page.locator('button[data-turn-process]').filter({ hasText: '已中断' });
      await interrupted.last().waitFor();
      const oldTool = page.locator(`[data-chat-call-id="${old.callId}"]`);
      await page.locator('[data-chat-flow-kind="tool-call"]').filter({ has: oldTool }).locator('[data-tool-details]').click();
      const detail = page.getByRole('dialog', { name: '工具详情', exact: true });
      await detail.getByText(/The tool call was interrupted after it was recorded/).waitFor();
      await screenshot(outcome + '-unknown-detail');
      await detail.getByRole('button', { name: '关闭工具详情', exact: true }).click();
      waiting.oldAnswer = await scope.oldAnswer(old);
      await new Promise(done => setTimeout(done, 3000));
      waiting.afterOldAnswer = await scope.recovered(old);
      assert.equal(await card().count(), 0);
      await scope.state(mode === 'plan');
      await screenshot(outcome + '-restored'); await save();
      await mark('official-' + mode + '-host-interrupted-old-card-removed-no-replay');

      const retry = testCase.retry = await seedFor('explicit_retry', outcome);
      retry.submission = await scope.start(retry.prompt);
      await showPending(retry, outcome + '-new-request'); assert.notEqual(retry.callId, old.callId);
      if (mode === 'legacy') {
        await card().getByRole('radio', { name: retry.selected, exact: true }).click();
        await card().getByRole('button', { name: '提交', exact: true }).click();
      } else await card().getByRole('button', { name: outcome === 'approve' ? '同意执行' : '要求修改', exact: true }).click();
      await card().waitFor({ state: 'detached' });
      await page.getByRole('article', { name: '模型回复', exact: true }).getByText(retry.done, { exact: true })
        .waitFor({ timeout: 180000 });
      retry.reply = await scope.settled(retry.done); retry.official = await scope.answered(retry, old);
      assert.equal(await editor().innerText(), testCase.draft); await screenshot(outcome + '-answered');
      const settled = { phase: 'settled', checkpoint: await scope.idleCheckpoint() }; testCase.restarts.push(settled);
      await restart(settled, testCase);
      await page.getByRole('article', { name: '模型回复', exact: true }).getByText(retry.done, { exact: true }).waitFor();
      settled.official = await scope.verifyIdle();
      await screenshot(outcome + '-settled-restored');
      if (mode === 'plan' && outcome === 'modify') await choosePlan(false);
      await scope.state(false); await editor().fill('');
      testCase.passed = true; await save();
      await mark('official-' + mode + '-host-explicit-' + outcome + '-single-result-and-settled-no-replay');
    }
    report.completed = true;
  } catch (error) { report.failure = error.message; throw error; }
  finally { await save(); }
  return report;
}
