import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { androidAppWebView } from '../../scripts/android-app-webview.mjs';

/** 真实计划审批期间结束独立App；正常Launcher恢复原计划或另一连接已结算的决定。 */
export async function verifyOfficialPlanProcessRecovery({ page, device, evidence, inference,
  packageName, title, mark, replacePage }) {
  assert.equal(packageName, 'dev.dshmobile.validation.officialtest');
  const scope = inference.planReview, report = { cases: [], completed: false };
  assert.equal(scope.processOnly, true);
  const save = () => writeFile(resolve(evidence, 'plan-process.json'), JSON.stringify(report, null, 2) + '\n');
  const delay = ms => new Promise(done => setTimeout(done, ms));
  const pid = async () => (await device.shell(`pidof ${packageName}`)).toString().trim();
  const card = () => page.locator('[data-plan-review-key]');
  const editor = () => page.locator('[data-composer-input]');
  const choose = async active => {
    await page.getByTestId('remote-workspace').getByRole('button', { name: 'Remote 选项', exact: true }).click();
    await page.getByRole('button', { name: '计划模式', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: '计划模式', exact: true });
    await dialog.getByRole('button', { name: active ? '开启计划模式' : '关闭计划模式', exact: true }).click();
    await dialog.getByText('计划模式：' + (active ? '已开启' : '已关闭'), { exact: true }).waitFor();
    await scope.state(active);
    await dialog.getByRole('button', { name: '关闭窗口', exact: true }).click();
  };
  const viewPlan = async (seed, phase) => {
    await card().waitFor({ timeout: 180000 }); assert.equal(await card().count(), 1);
    await card().getByRole('heading', { name: seed.planTitle, exact: true }).waitFor();
    const panel = page.getByRole('region', { name: '插件面板', exact: true });
    await panel.waitFor({ timeout: 30000 });
    await panel.getByRole('heading', { name: seed.planTitle, exact: true }).waitFor();
    assert.ok((await panel.innerText()).includes(seed.planBody));
    await writeFile(resolve(evidence, 'plan-process-' + seed.kind + '-' + seed.outcome + '-' + phase + '-document.png'),
      await device.screenshot());
    await panel.getByRole('button', { name: '返回聊天', exact: true }).click();
    await panel.waitFor({ state: 'hidden' });
    seed[phase + 'ActualPlanPreviewVerified'] = true;
  };
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
    await scope.state(false);
    for (const kind of ['pending', 'settled']) for (const outcome of ['approve', 'modify']) {
      await choose(true);
      const seed = { kind, outcome, planTitle: 'DSHM 进程恢复计划 ' + kind + ' ' + outcome,
        planBody: '批准后只回复本次验收标记，不执行任何工具，不修改文件或设置。',
        initialSeq: await inference.beforeTool(), draft: 'OFFICIAL_PLAN_PROCESS_DRAFT_' + kind + '_' + outcome };
      seed.plan = '# ' + seed.planTitle + '\n\n' + seed.planBody;
      seed.token = 'DSHM_PLAN_PROCESS_' + kind.toUpperCase() + '_' + outcome.toUpperCase();
      seed.prompt = `只执行本条DSHM计划进程恢复验收。只调用一次exit_plan_mode并等待用户审阅。批准后只回复DSHM_PLAN_PROCESS_${kind.toUpperCase()}_APPROVE；用户要求修改或取消审阅后只回复DSHM_PLAN_PROCESS_${kind.toUpperCase()}_MODIFY，并立即结束，不重新提交计划。不要执行其他工具、读写文件或修改权限/设置。工具参数必须严格使用以下JSON对象，plan不要包含外围指令：\n${JSON.stringify({ plan: seed.plan })}`;
      report.cases.push(seed); await save();
      // 手机留下未发送草稿，电脑公开入口发起同一会话计划，避开审批输入接管。
      await editor().fill(seed.draft); await delay(1000);
      seed.submission = await scope.start(seed.prompt);
      await page.getByText(seed.prompt, { exact: true }).waitFor();
      await viewPlan(seed, 'initial');
      seed.pendingEvidence = await scope.verify({ ...seed, pending: true });
      seed.callId = seed.pendingEvidence.callId;
      assert.equal(await page.locator('[data-chat-call-id]').last().getAttribute('data-chat-call-id'), seed.callId);
      seed.checkpoint = await scope.checkpoint(seed);
      seed.observerBefore = await scope.observe(seed);
      seed.oldPid = await pid(); assert.match(seed.oldPid, /^[1-9]\d*$/);
      await writeFile(resolve(evidence, 'plan-process-' + kind + '-' + outcome + '-pending.png'), await device.screenshot());
      if (kind === 'pending') await scope.release(seed.callId);
      await device.shell(`am force-stop ${packageName}`); assert.equal(await pid(), '');
      await delay(1000); assert.equal(await pid(), '');
      seed.actualProcessEnded = true;
      seed.whileAppDead = await scope.verifyCheckpoint({ ...seed, pending: true });
      if (kind === 'settled') {
        seed.otherDecision = await scope.answer(seed);
        seed.replyWhileDead = await scope.settled(seed.token);
        assert.equal(await pid(), '');
        seed.officialWhileDead = await scope.verify(seed);
        seed.finalWhileDead = await scope.verifyCheckpoint({ ...seed, pending: false });
      }
      await reopen(seed); await delay(2000);
      if (kind === 'pending') {
        await viewPlan(seed, 'restored');
        assert.equal(await page.locator('[data-chat-call-id]').last().getAttribute('data-chat-call-id'), seed.callId);
        seed.observerAfter = await scope.observe(seed);
        assert.equal(seed.observerAfter.eventId, seed.observerBefore.eventId);
        assert.notEqual(seed.observerAfter.clientId, seed.observerBefore.clientId);
        seed.afterReopen = await scope.verifyCheckpoint({ ...seed, pending: true });
        await writeFile(resolve(evidence, 'plan-process-pending-' + outcome + '-restored.png'), await device.screenshot());
        await card().getByRole('button', { name: outcome === 'approve' ? '同意执行' : '要求修改', exact: true }).click();
      } else {
        assert.equal(await card().count(), 0); seed.noStalePlanAfterReopen = true;
      }
      await card().waitFor({ state: 'detached' });
      await page.getByRole('article', { name: '模型回复', exact: true })
        .getByText(seed.token, { exact: true }).waitFor({ timeout: 180000 });
      seed.reply = await scope.settled(seed.token);
      seed.official = await scope.verify(seed);
      seed.final = await scope.verifyCheckpoint({ ...seed, pending: false });
      seed.duplicate = await scope.duplicate(seed);
      assert.equal(await editor().innerText(), seed.draft);
      await writeFile(resolve(evidence, 'plan-process-' + kind + '-' + outcome + '-settled.png'), await device.screenshot());
      await scope.release(seed.callId); await editor().fill('');
      if (outcome === 'modify') await choose(false);
      await scope.state(false); seed.planModeRestored = true;
      seed.passed = true; await save(); await mark('official-plan-process-' + kind + '-' + outcome + '-single-settlement');
    }
    report.completed = true;
  } catch (error) { report.failure = error.message; throw error; }
  finally { await save(); }
  return report;
}
