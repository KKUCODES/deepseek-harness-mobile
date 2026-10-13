import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

/** 原计划卡片的批准和要求修改：真实模型、实际手机按钮、官方日志及模式投影交叉核对。 */
export async function verifyOfficialPlanReview({ page, device, evidence, inference, mark }) {
  const main = page.getByTestId('remote-workspace');
  const dialog = page.getByRole('dialog', { name: '计划模式', exact: true });
  const card = page.locator('[data-plan-review-key]');
  const report = { cases: [], completed: false };
  const save = () => writeFile(resolve(evidence, 'plan-review.json'), JSON.stringify(report, null, 2) + '\n');
  const choose = async active => {
    await main.getByRole('button', { name: 'Remote 选项', exact: true }).click();
    await page.getByRole('button', { name: '计划模式', exact: true }).click();
    await dialog.getByRole('button', { name: active ? '开启计划模式' : '关闭计划模式', exact: true }).click();
    await dialog.getByText('计划模式：' + (active ? '已开启' : '已关闭'), { exact: true }).waitFor();
    await inference.planReview.state(active);
    await dialog.getByRole('button', { name: '关闭窗口', exact: true }).click();
  };
  try {
    await inference.planReview.state(false);
    for (const outcome of ['approve', 'modify']) {
      await choose(true);
      const title = outcome === 'approve' ? 'DSHM 计划批准验收' : 'DSHM 计划修改验收';
      const plan = `# ${title}\n\n批准后只回复验收标记，不执行任何工具，不修改文件或设置。`;
      const token = outcome === 'approve' ? 'DSHM_PLAN_APPROVED' : 'DSHM_PLAN_MODIFY';
      const seed = { outcome, plan, initialSeq: await inference.beforeTool(), sent: false };
      report.cases.push(seed); await save();
      await main.locator('[data-composer-input]').fill(`只执行本条 DSHM 计划审核验收。仅调用一次 exit_plan_mode，然后等待用户审阅。批准后只回复 DSHM_PLAN_APPROVED；若用户要求修改或取消审阅，只回复 DSHM_PLAN_MODIFY 并立即停止，不重新提交计划。不要执行其他工具、读写文件、修改权限或设置。工具参数必须严格使用以下 JSON 对象，plan 内不要包含这些外围指令：\n${JSON.stringify({ plan })}`);
      await main.getByRole('button', { name: '发送消息', exact: true }).click();
      seed.sent = true; await save();
      await card.waitFor({ timeout: 180000 });
      assert.equal(await card.count(), 1);
      await card.getByRole('heading', { name: title, exact: true }).waitFor();
      seed.pendingEvidence = await inference.planReview.verify({ ...seed, pending: true });
      // 原计划插件自动打开正文面板；先实际查看正文并返回聊天，再操作审阅卡片。
      const panel = page.getByRole('region', { name: '插件面板', exact: true });
      await panel.waitFor();
      await panel.getByRole('heading', { name: title, exact: true }).waitFor();
      assert.ok((await panel.innerText()).includes('批准后只回复验收标记，不执行任何工具，不修改文件或设置。'));
      await writeFile(resolve(evidence, `plan-${outcome}-document.png`), await device.screenshot());
      await panel.getByRole('button', { name: '返回聊天', exact: true }).click();
      await panel.waitFor({ state: 'hidden' });
      seed.actualPlanPreviewVerified = true;
      await writeFile(resolve(evidence, `plan-${outcome}-pending.png`), await device.screenshot());
      await card.getByRole('button', { name: outcome === 'approve' ? '同意执行' : '要求修改', exact: true }).click();
      await card.waitFor({ state: 'detached' });
      await main.getByRole('article', { name: '模型回复', exact: true }).filter({ hasText: token }).waitFor({ timeout: 180000 });
      await main.getByRole('button', { name: '停止生成', exact: true }).waitFor({ state: 'hidden', timeout: 180000 });
      seed.official = await inference.planReview.verify(seed);
      seed.reply = await inference.verifyReply(token);
      if (outcome === 'modify') await choose(false);
      seed.passed = true; await save();
      await mark(`official-plan-${outcome}-from-phone`);
    }
    await inference.planReview.state(false);
    report.completed = true;
  } catch (error) { report.failure = error.message; throw error; }
  finally { await save(); }
  return report;
}
