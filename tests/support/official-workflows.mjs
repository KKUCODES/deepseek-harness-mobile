import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

/** 真实 workflow 工具启动两名成员，沿官方局部renderer进入手机自有子聊天。 */
export async function verifyOfficialWorkflows({ page, device, evidence, inference, disconnect, reconnect, mark }) {
  const main = page.getByTestId('remote-workspace'), checks = inference.workflows;
  const editor = main.locator('[data-composer-input]');
  const report = { completed: false };
  const save = () => writeFile(resolve(evidence, 'workflows.json'), JSON.stringify(report, null, 2) + '\n');
  const view = () => main.evaluate(element => {
    const key = Object.keys(element).find(name => name.startsWith('__reactFiber$'));
    for (let fiber = element[key]; fiber; fiber = fiber.return) if (fiber.memoizedProps?.model?.client) {
      const state = fiber.memoizedProps.model.getSnapshot();
      return { selected: state.selected, target: state.selectedTarget,
        nodes: state.conversation?.order.map(id => state.conversation.nodes.get(id))
          .filter(node => node.kind === 'workflow-run').map(node => node.data) };
    }
    throw Error('official_workflow_model_missing');
  });
  const card = main.locator('[data-workflow-run]');
  try {
    await checks.initial();
    const before = await checks.history();
    const member = checks.marker + '_MEMBER', other = checks.marker + '_OTHER';
    const slow = `不要调用工具、不读写文件或发送其他会话消息。请用中文写约800字说明如何确认手机与电脑聊天同步，最后单独写 ${member}。`;
    const quick = `不要调用任何工具、不读写文件或发送其他会话消息。只回复 ${other}。`;
    const script = `phase("并行核对"); const results = await parallel([() => agent(${JSON.stringify(slow)}, {label:"手机核对成员",phase:"并行核对"}), () => agent(${JSON.stringify(quick)}, {label:"电脑核对成员",phase:"并行核对"})]); return results;`;
    report.script = script;
    const args = { script, meta: { name: checks.marker, description: '只读手机工作流验证' }, run_in_background: false };
    const prompt = `只调用一次 workflow 工具，严格使用以下参数，不修改脚本、不重试、不调用其他工具。${JSON.stringify(args)}。工作流结束后只回复 ${checks.marker}。`;
    await editor.fill(prompt);
    await main.getByRole('button', { name: '发送消息', exact: true }).click();
    // 提交确认期间 Lexical 会短暂锁定；等真实可编辑状态后再留草稿。
    await main.locator('[data-composer-input][contenteditable="true"]').fill('DSHM_WORKFLOW_PARENT_DRAFT');
    await card.waitFor({ timeout: 60000 });
    assert.equal(await card.count(), 1);
    const open = card.getByRole('button', { name: '打开 手机核对成员', exact: true });
    await open.waitFor({ timeout: 60000 });
    assert.equal(await card.getAttribute('data-run-status'), 'running');
    report.running = await checks.verify({ phase: 'running', nodes: (await view()).nodes, beforeSeq: before.snapshot.asOfSeq, script });
    await writeFile(resolve(evidence, 'workflow-running.png'), await device.screenshot());
    await open.click();
    await main.getByRole('button', { name: '返回父会话', exact: true }).waitFor();
    const child = await view();
    assert.equal(child.target.mode, 'continuable');
    assert.equal(child.target.parentSessionId, checks.sessionId);
    assert.equal(await main.locator('[data-composer-input]').count(), 1);
    assert.equal(await main.locator('[data-composer-input]').innerText(), '');
    report.child = await checks.child(child.target);
    await main.getByRole('article', { name: '模型回复', exact: true }).filter({ hasText: member })
      .last().waitFor({ timeout: 180000 });
    report.childCompleted = await checks.child(child.target, member);
    await main.getByRole('button', { name: '停止生成', exact: true }).waitFor({ state: 'hidden' });
    await writeFile(resolve(evidence, 'workflow-child.png'), await device.screenshot());
    await main.getByRole('button', { name: '返回父会话', exact: true }).click();
    assert.equal((await view()).selected, checks.sessionId);
    assert.equal(await editor.innerText(), 'DSHM_WORKFLOW_PARENT_DRAFT');
    await main.getByRole('article', { name: '模型回复', exact: true }).filter({ hasText: checks.marker })
      .last().waitFor({ timeout: 180000 });
    await main.getByRole('button', { name: '停止生成', exact: true }).waitFor({ state: 'hidden' });
    await page.waitForFunction(() => document.querySelector('[data-workflow-run]')?.dataset.runStatus === 'completed');
    report.completedRun = await checks.verify({ phase: 'completed', nodes: (await view()).nodes,
      beforeSeq: before.snapshot.asOfSeq, script, member, other });
    const settled = await checks.history();
    assert.deepEqual(settled.records.slice(0, before.records.length), before.records);
    // 官方完成轮次默认收起；沿用户入口展开，再核对真实成员结果。
    const turn = main.getByRole('button', { name: /^已完成/ }).last();
    if (await turn.getAttribute('aria-expanded') === 'false') await turn.click();
    const header = card.locator('[data-disclosure-row]').first();
    if (await header.getAttribute('aria-expanded') === 'false') await header.click();
    const phase = card.locator('[data-disclosure-row]').filter({ hasText: '并行核对' }).last();
    if (await phase.getAttribute('aria-expanded') === 'false') await phase.click();
    assert.equal(await card.locator('[data-member-status="completed"]').count(), 2);
    assert.equal(await card.getByRole('button', { name: /^打开 / }).count(), 0);
    await writeFile(resolve(evidence, 'workflow-completed.png'), await device.screenshot());
    await mark('official-workflow-running-two-members-child-identity-and-real-completion');
    await disconnect(); await page.getByTestId('remote-offline-status').waitFor();
    await reconnect();
    await page.getByTestId('remote-offline-status').waitFor({ state: 'detached', timeout: 45000 });
    await card.waitFor();
    assert.equal(await card.getAttribute('data-run-status'), 'completed');
    assert.equal(await editor.innerText(), 'DSHM_WORKFLOW_PARENT_DRAFT');
    assert.deepEqual((await checks.history()).records, settled.records);
    assert.deepEqual((await view()).nodes, report.completedRun.nodes);
    assert.equal(await page.locator('iframe').count(), 0);
    await writeFile(resolve(evidence, 'workflow-reconnected.png'), await device.screenshot());
    await editor.fill('');
    await mark('official-workflow-original-events-draft-and-reconnect-no-replay');
    report.completed = true;
  } catch (error) { report.failure = error.message; throw error; }
  finally { await save(); }
  return report;
}
