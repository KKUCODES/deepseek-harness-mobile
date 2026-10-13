import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { androidAppWebView } from '../../scripts/android-app-webview.mjs';

/** 原App结束前后不人为维持计时；通过真实手机回答仍等待的问题与超时后的原问题。 */
export async function verifyOfficialTimedQuestion({ page, device, evidence, inference,
  packageName, title, mark, replacePage }) {
  assert.equal(packageName, 'dev.dshmobile.validation.officialtest');
  const scope = inference.timedQuestion, report = { mode: 'official-opt-in-timed', cases: [], completed: false };
  const save = () => writeFile(resolve(evidence, 'timed-question.json'), JSON.stringify(report, null, 2) + '\n');
  const delay = ms => new Promise(done => setTimeout(done, ms));
  const pid = async () => (await device.shell(`pidof ${packageName}`)).toString().trim();
  const card = () => page.locator('[data-question-key]');
  const editor = () => page.locator('[data-composer-input]');
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
    await page.getByTestId('remote-workspace').waitFor({ timeout: 45000 });
    await page.locator('.remote-session-row').filter({ hasText: title }).click();
    await page.getByText(seed.prompt, { exact: true }).waitFor();
    assert.equal(await page.locator('iframe').count(), 0);
    seed.normalLauncherAndOwnRemotePage = true;
  };
  try {
    for (const kind of ['pending', 'expired']) {
      const seed = { kind, timeout: kind === 'pending' ? 120 : 12,
        questionId: 'timed_' + kind, question: '请选择超时提问验收颜色（' + kind + '）',
        initialSeq: await inference.beforeTool(), draft: 'OFFICIAL_TIMED_QUESTION_DRAFT_' + kind,
        selected: kind === 'pending' ? '绿色' : '蓝色' };
      seed.done = 'DSHM_TIMED_' + kind.toUpperCase() + '_' + seed.selected;
      seed.continued = 'DSHM_TIMED_' + kind.toUpperCase() + '_PENDING';
      seed.prompt = `这是DSHM官方带超时提问验收。只调用一次ask_user_question，timeout严格为${seed.timeout}秒，问题id严格为${seed.questionId}，正文严格为“${seed.question}”，按顺序提供“蓝色”和“绿色”两个单选选项。不标记推荐项，不调用其他工具，不读写文件，不修改设置，不重试提问。如果本次工具直接返回answers，只回复DSHM_TIMED_${kind.toUpperCase()}_加选中的中文颜色。如果工具返回pending，则仅回复${seed.continued}并结束当前轮次；pending不代表用户同意，不执行任何依赖答案的操作。之后收到answer_to_pending_question的用户补答时，只回复DSHM_TIMED_${kind.toUpperCase()}_加选中的中文颜色，不再次调用工具。`;
      report.cases.push(seed); await save();
      await editor().fill(seed.draft); await delay(1000);
      seed.submission = await scope.start(seed.prompt);
      await page.getByText(seed.prompt, { exact: true }).waitFor();
      await card().waitFor({ timeout: 180000 }); assert.equal(await card().count(), 1);
      await card().getByText(seed.question, { exact: true }).waitFor();
      seed.callId = await page.locator('[data-chat-call-id]').last().getAttribute('data-chat-call-id');
      assert.ok(seed.callId);
      seed.checkpoint = await scope.verify(seed, 'open');
      seed.observerBefore = await scope.observe(seed);
      seed.oldPid = await pid(); assert.match(seed.oldPid, /^[1-9]\d*$/);
      await writeFile(resolve(evidence, 'timed-question-' + kind + '-waiting.png'), await device.screenshot());
      await device.shell(`am force-stop ${packageName}`); assert.equal(await pid(), '');
      await delay(1000); assert.equal(await pid(), ''); seed.actualProcessEnded = true;
      if (kind === 'expired') {
        seed.continuedWhileAppDead = await scope.settled(seed.continued);
        assert.equal(await pid(), '');
        seed.officialWhileDead = await scope.verify(seed, 'continued');
      } else seed.officialWhileDead = await scope.verify(seed, 'open');
      await reopen(seed);
      await card().waitFor(); assert.equal(await card().count(), 1);
      await card().getByText(seed.question, { exact: true }).waitFor();
      assert.equal(await page.locator('[data-chat-call-id]').last().getAttribute('data-chat-call-id'), seed.callId);
      if (kind === 'expired') {
        await card().getByText('已继续工作，仍可回答', { exact: true }).waitFor();
        await page.getByRole('article', { name: '模型回复', exact: true })
          .getByText(seed.continued, { exact: true }).waitFor();
      } else {
        seed.observerAfter = await scope.observe(seed);
        assert.equal(seed.observerAfter.eventId, seed.observerBefore.eventId);
        assert.notEqual(seed.observerAfter.clientId, seed.observerBefore.clientId);
      }
      seed.afterReopen = await scope.verify(seed, kind === 'expired' ? 'continued' : 'open');
      await writeFile(resolve(evidence, 'timed-question-' + kind + '-restored.png'), await device.screenshot());
      await card().getByRole('radio', { name: seed.selected, exact: true }).click();
      assert.equal(await card().getByRole('radio', { name: seed.selected, exact: true }).getAttribute('aria-checked'), 'true');
      await card().getByRole('button', { name: '提交', exact: true }).click();
      await card().waitFor({ state: 'detached' });
      await page.getByRole('article', { name: '模型回复', exact: true })
        .getByText(seed.done, { exact: true }).waitFor({ timeout: 180000 });
      seed.reply = await scope.settled(seed.done);
      seed.final = await scope.verify(seed, 'answered');
      assert.equal(await editor().innerText(), seed.draft); seed.draftPreserved = true;
      assert.equal(await card().count(), 0); seed.noStaleQuestion = true;
      await writeFile(resolve(evidence, 'timed-question-' + kind + '-answered.png'), await device.screenshot());
      await editor().fill(''); seed.passed = true;
      await save(); await mark('official-timed-question-' + kind + '-actual-phone-answer');
    }
    report.completed = true;
  } catch (error) { report.failure = error.message; throw error; }
  finally { await save(); }
  return report;
}
