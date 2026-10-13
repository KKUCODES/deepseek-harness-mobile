import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { androidAppWebView } from '../../scripts/android-app-webview.mjs';

/** 官方默认阻塞式提问：结束独立App，再从正常Launcher恢复原问题或已经结算的答案。 */
export async function verifyOfficialQuestionProcessRecovery({ page, device, evidence, inference,
  packageName, title, mark, replacePage }) {
  assert.equal(packageName, 'dev.dshmobile.validation.officialtest');
  const scope = inference.questionProcess, report = { mode: 'official-default-legacy', cases: [], completed: false };
  const save = () => writeFile(resolve(evidence, 'question-process.json'), JSON.stringify(report, null, 2) + '\n');
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
    assert.equal(await editor().innerText(), seed.draft);
    seed.normalLauncherAndOwnRemotePage = true; seed.draftPreserved = true;
  };
  try {
    for (const kind of ['pending', 'settled']) {
      const seed = { kind, questionId: 'process_' + kind, question: '请选择进程恢复验收颜色（' + kind + '）',
        initialSeq: await inference.beforeTool(), draft: 'OFFICIAL_QUESTION_PROCESS_DRAFT_' + kind,
        selected: kind === 'pending' ? '绿色' : '蓝色' };
      seed.done = 'DSHM_QUESTION_PROCESS_' + kind.toUpperCase() + '_' + seed.selected;
      seed.prompt = `这是DSHM官方默认提问的App进程恢复验收。只执行本条请求，只调用一次ask_user_question，问题id严格为${seed.questionId}，正文严格为“${seed.question}”，提供“蓝色”和“绿色”两个单选选项，不标记推荐项。等待用户回答后，只回复DSHM_QUESTION_PROCESS_${kind.toUpperCase()}_加选中的中文颜色。不执行其他工具，不读写文件，不修改设置，不重试提问。`;
      report.cases.push(seed); await save();
      // 保留手机未发送草稿，由电脑公开入口发起同一会话任务，避开提问对输入区域的接管。
      await editor().fill(seed.draft); await delay(1000);
      seed.submission = await scope.start(seed.prompt);
      await page.getByText(seed.prompt, { exact: true }).waitFor();
      await card().waitFor({ timeout: 180000 }); assert.equal(await card().count(), 1);
      await card().getByText(seed.question, { exact: true }).waitFor();
      seed.callId = await page.locator('[data-chat-call-id]').last().getAttribute('data-chat-call-id');
      assert.ok(seed.callId);
      seed.checkpoint = await scope.verify({ ...seed, pending: true });
      seed.observerBefore = await scope.observe(seed);
      seed.oldPid = await pid(); assert.match(seed.oldPid, /^[1-9]\d*$/);
      await writeFile(resolve(evidence, 'question-process-' + kind + '-pending.png'), await device.screenshot());
      if (kind === 'pending') await scope.release(seed.callId);
      await device.shell(`am force-stop ${packageName}`); assert.equal(await pid(), '');
      await delay(1000); assert.equal(await pid(), '');
      seed.actualProcessEnded = true;
      seed.whileAppDead = await scope.verify({ ...seed, pending: true });
      if (kind === 'settled') {
        seed.otherDecision = await scope.answer(seed, seed.selected);
        seed.replyWhileDead = await scope.settled(seed.done);
        assert.equal(await pid(), '');
        seed.officialWhileDead = await scope.verify({ ...seed, pending: false });
      }
      await reopen(seed); await delay(2000);
      if (kind === 'pending') {
        await card().waitFor(); assert.equal(await card().count(), 1);
        await card().getByText(seed.question, { exact: true }).waitFor();
        assert.equal(await page.locator('[data-chat-call-id]').last().getAttribute('data-chat-call-id'), seed.callId);
        seed.observerAfter = await scope.observe(seed);
        assert.equal(seed.observerAfter.eventId, seed.observerBefore.eventId);
        assert.notEqual(seed.observerAfter.clientId, seed.observerBefore.clientId);
        seed.afterReopen = await scope.verify({ ...seed, pending: true });
        await writeFile(resolve(evidence, 'question-process-pending-restored.png'), await device.screenshot());
        await card().getByRole('radio', { name: seed.selected, exact: true }).click();
        assert.equal(await card().getByRole('radio', { name: seed.selected, exact: true }).getAttribute('aria-checked'), 'true');
        await card().getByRole('button', { name: '提交', exact: true }).click();
      } else {
        assert.equal(await card().count(), 0); seed.noStaleQuestionAfterReopen = true;
      }
      await card().waitFor({ state: 'detached' });
      await page.getByRole('article', { name: '模型回复', exact: true })
        .getByText(seed.done, { exact: true }).waitFor({ timeout: 180000 });
      seed.reply = await scope.settled(seed.done);
      seed.final = await scope.verify({ ...seed, pending: false });
      seed.duplicate = await scope.duplicate(seed);
      assert.equal(await editor().innerText(), seed.draft);
      await writeFile(resolve(evidence, 'question-process-' + kind + '-settled.png'), await device.screenshot());
      await scope.release(seed.callId); await editor().fill('');
      seed.passed = true; await save(); await mark('official-question-process-' + kind + '-single-settlement');
    }
    report.completed = true;
  } catch (error) { report.failure = error.message; throw error; }
  finally { await save(); }
  return report;
}
