import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

/** 两条真实协议连接并发决定，手机展示同一问题/计划的唯一实际结算。 */
export async function verifyOfficialInteractionRace({ page, device, evidence, inference, packageName, mark }) {
  assert.equal(packageName, 'dev.dshmobile.validation.officialtest');
  const scope = inference.interactionRace, mode = scope.mode;
  assert.ok(['legacy', 'plan'].includes(mode));
  const report = { mode, cases: [], completed: false };
  const save = () => writeFile(resolve(evidence, mode + '-race.json'), JSON.stringify(report, null, 2) + '\n');
  const screenshot = name => device.screenshot().then(bytes => writeFile(resolve(evidence, mode + '-race-' + name + '.png'), bytes));
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
  try {
    report.appPid = await pid(); assert.match(report.appPid, /^[1-9]\d*$/);
    report.modelLabel = await page.getByRole('button', { name: /^选择模型，当前 / }).getAttribute('aria-label');
    await scope.state(false);
    for (const round of [0, 1]) {
      if (mode === 'plan') await choosePlan(true);
      const seed = { round, initialSeq: await inference.beforeTool(), draft: 'OFFICIAL_' + mode.toUpperCase() + '_RACE_DRAFT_' + round,
        questionId: 'race_' + round, question: '请选择并发回答验收颜色（' + round + '）',
        planTitle: 'DSHM 并发计划验收 ' + round, planBody: '只回复验收标记，不执行任何工具，不修改文件或设置。' };
      seed.plan = '# ' + seed.planTitle + '\n\n' + seed.planBody;
      seed.prefix = 'DSHM_' + mode.toUpperCase() + '_RACE_' + round + '_';
      seed.prompt = mode === 'legacy'
        ? `只执行本条DSHM默认提问并发验收。只调用一次ask_user_question，问题id严格为${seed.questionId}，正文严格为“${seed.question}”，依次提供“蓝色”和“绿色”单选选项，multi_select为false，不标记推荐项。等待最终answers后，只回复${seed.prefix}加选中的中文颜色。不执行其他工具，不读写文件，不修改设置，不重试提问，不把未胜出的答案当作新的请求。`
        : `只执行本条DSHM计划并发验收。只调用一次exit_plan_mode并等待最终用户决定。批准后只回复${seed.prefix}APPROVE，要求修改或取消审阅后只回复${seed.prefix}MODIFY并结束，不再次提交计划。不执行其他工具、不读写文件或修改设置。工具参数严格使用以下JSON对象：\n${JSON.stringify({ plan: seed.plan })}`;
      report.cases.push(seed); await save();
      await editor().fill(seed.draft); await new Promise(done => setTimeout(done, 1000));
      seed.submission = await scope.start(seed.prompt);
      await page.getByText(seed.prompt, { exact: true }).waitFor();
      await card().waitFor({ timeout: 180000 }); assert.equal(await card().count(), 1);
      if (mode === 'legacy') await card().getByText(seed.question, { exact: true }).waitFor();
      else {
        await card().getByRole('heading', { name: seed.planTitle, exact: true }).waitFor();
        const panel = page.getByRole('region', { name: '插件面板', exact: true });
        await panel.waitFor(); await panel.getByRole('heading', { name: seed.planTitle, exact: true }).waitFor();
        assert.ok((await panel.innerText()).includes(seed.planBody));
        await screenshot(round + '-document');
        await panel.getByRole('button', { name: '返回聊天', exact: true }).click();
        await panel.waitFor({ state: 'hidden' }); seed.actualPlanPreviewVerified = true;
      }
      seed.callId = await page.locator('[data-chat-call-id]').last().getAttribute('data-chat-call-id');
      assert.ok(seed.callId); seed.checkpoint = await scope.checkpoint(seed);
      await screenshot(round + '-pending'); await save();
      // 竞争由两个独立clientId的实际中转连接发起，手机只观察同一事件，不伪装手机提交。
      seed.competition = await scope.compete(seed); await save();
      await card().waitFor({ state: 'detached', timeout: 30000 });
      seed.official = await scope.settled(seed);
      const reply = page.getByRole('article', { name: '模型回复', exact: true }).getByText(seed.official.token, { exact: true });
      await reply.waitFor({ timeout: 180000 }); await reply.scrollIntoViewIfNeeded();
      assert.equal(await card().count(), 0); assert.equal(await editor().innerText(), seed.draft);
      assert.equal(await pid(), report.appPid); assert.equal(await page.locator('iframe').count(), 0);
      await editor().click();
      await page.getByRole('button', { name: report.modelLabel, exact: true }).waitFor();
      seed.oldAnswers = await scope.duplicate(seed, seed.official.winner);
      assert.equal(await card().count(), 0);
      await screenshot(round + '-settled');
      if (mode === 'plan' && seed.official.winner === 'modify') await choosePlan(false);
      await scope.state(false); await editor().fill('');
      seed.passed = true; await save();
      await mark('official-' + mode + '-race-' + round + '-one-winner-result-and-phone-card-removed');
    }
    report.winners = report.cases.map(seed => seed.official.winner);
    report.completed = true;
  } catch (error) { report.failure = error.message; throw error; }
  finally { await save(); }
  return report;
}
