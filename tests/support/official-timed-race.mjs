import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

/** 超时补答竞争通过真实协议连接发起；手机核对原问题、唯一续聊与旧卡片撤下。 */
export async function verifyOfficialTimedRace({ page, device, evidence, inference, packageName, mark }) {
  assert.equal(packageName, 'dev.dshmobile.validation.officialtest');
  const scope = inference.timedRace, report = { mode: 'continued', cases: [], completed: false };
  const save = () => writeFile(resolve(evidence, 'continued-race.json'), JSON.stringify(report, null, 2) + '\n');
  const screenshot = name => device.screenshot().then(bytes => writeFile(resolve(evidence, 'continued-race-' + name + '.png'), bytes));
  const pid = async () => (await device.shell(`pidof ${packageName}`)).toString().trim();
  const editor = () => page.locator('[data-composer-input]');
  const card = () => page.locator('[data-question-key]');
  try {
    report.appPid = await pid(); assert.match(report.appPid, /^[1-9]\d*$/);
    report.modelLabel = await page.getByRole('button', { name: /^选择模型，当前 / }).getAttribute('aria-label');
    for (const round of [0, 1]) {
      const seed = { round, kind: 'expired', timeout: 12, initialSeq: await inference.beforeTool(),
        draft: 'OFFICIAL_CONTINUED_RACE_DRAFT_' + round,
        questionId: 'continued_race_' + round, question: '请选择超时补答竞争验收颜色（' + round + '）' };
      seed.prefix = 'DSHM_TIMED_RACE_' + round + '_'; seed.continued = seed.prefix + 'PENDING';
      seed.prompt = `这是DSHM官方超时补答竞争验收。只调用一次ask_user_question，timeout严格为${seed.timeout}秒，问题id严格为${seed.questionId}，正文严格为“${seed.question}”，按顺序提供“蓝色”和“绿色”两个单选选项。不标记推荐项，不调用其他工具，不读写文件，不修改设置，不重试提问。如果工具返回pending，则仅回复${seed.continued}并结束当前轮次；pending不代表用户同意，不执行任何依赖答案的操作。之后收到answer_to_pending_question的用户补答时，只回复${seed.prefix}加选中的中文颜色，不再次调用工具。`;
      report.cases.push(seed); await save();
      await editor().fill(seed.draft); await new Promise(done => setTimeout(done, 1000));
      seed.submission = await scope.start(seed.prompt);
      await page.getByText(seed.prompt, { exact: true }).waitFor();
      await card().waitFor({ timeout: 180000 }); assert.equal(await card().count(), 1);
      await card().getByText(seed.question, { exact: true }).waitFor();
      seed.callId = await page.locator('[data-chat-call-id]').last().getAttribute('data-chat-call-id');
      assert.ok(seed.callId); seed.open = await scope.verify(seed, 'open'); await save();
      seed.continuedReply = await scope.settled(seed.continued);
      await card().getByText('已继续工作，仍可回答', { exact: true }).waitFor();
      seed.checkpoint = await scope.prepare(seed);
      await screenshot(round + '-continued'); await save();
      seed.competition = await scope.compete(seed); await save();
      seed.official = await scope.settledWinner(seed, seed.competition.acceptedColor);
      await card().waitFor({ state: 'detached', timeout: 30000 });
      const reply = page.getByRole('article', { name: '模型回复', exact: true }).getByText(seed.official.token, { exact: true });
      await reply.waitFor({ timeout: 180000 }); await reply.scrollIntoViewIfNeeded();
      assert.equal(await card().count(), 0); assert.equal(await editor().innerText(), seed.draft);
      assert.equal(await pid(), report.appPid); assert.equal(await page.locator('iframe').count(), 0);
      await editor().click(); await page.getByRole('button', { name: report.modelLabel, exact: true }).waitFor();
      seed.oldAnswers = await scope.duplicate(seed, seed.official.winner);
      assert.equal(await card().count(), 0); await screenshot(round + '-settled');
      await editor().fill(''); seed.passed = true; await save();
      await mark('official-continued-race-' + round + '-one-new-user-reply-and-phone-card-removed');
    }
    report.winners = report.cases.map(seed => seed.official.winner); report.completed = true;
  } catch (error) { report.failure = error.message; throw error; }
  finally { await save(); }
  return report;
}
