import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

/** 手机调用官方 ACP 提供方，核对父会话的真实结算以及外部条目无本地打开入口。 */
export async function verifyOfficialExternalChild({ page, device, evidence, inference, mark }) {
  const checks = inference.externalChild, main = page.getByTestId('remote-workspace');
  const editor = main.locator('[data-composer-input]'), report = { completed: false };
  const save = () => writeFile(resolve(evidence, 'external-child.json'), JSON.stringify(report, null, 2) + '\n');
  try {
    const initialSeq = await checks.before(), rootReply = checks.marker + '_ROOT';
    const args = { description: checks.label, prompt: `这是外部 ACP 通信测试。不要调用工具、读写文件、执行命令、联网或创建子任务。只回复 ${checks.reply}。` };
    await editor.fill(`只调用一次 dshm_external，参数严格为 ${JSON.stringify(args)}。不调用其他工具、不重试、不读写文件或联网。启动后只回复 ${rootReply}；收到子任务结果后也只回复 ${rootReply}。`);
    await main.getByRole('button', { name: '发送消息', exact: true }).click();
    report.settlement = await checks.settled(initialSeq);
    await main.getByRole('article', { name: '模型回复', exact: true }).filter({ hasText: rootReply }).last().waitFor({ timeout: 180000 });
    await main.getByRole('button', { name: '停止生成', exact: true }).waitFor({ state: 'hidden', timeout: 30000 });
    // 只核对官方生成的结算消息；提示词/工具参数中同名标记不能算作执行结果。
    report.phoneSettlement = await main.evaluate((element, expected) => {
      const key = Object.keys(element).find(name => name.startsWith('__reactFiber$'));
      for (let fiber = element[key]; fiber; fiber = fiber.return) if (fiber.memoizedProps?.model?.client) {
        const model = fiber.memoizedProps.model, state = model.getSnapshot();
        const entries = model.reference.binding.eventSource.getSnapshot().entries;
        const notices = entries.filter(row => row.event.type === 'user/message'
          && row.event.data.source?.kind === 'subagent-settled'
          && row.event.data.source.senderSessionId === expected.taskId);
        if (notices.length !== 1 || !JSON.stringify(notices[0].event.data.content).includes(expected.reply))
          throw Error('official_acp_phone_settlement_missing');
        return { selected: state.selected, noticeSeq: notices[0].event.seq, actualSettlementReceived: true };
      }
      throw Error('official_external_model_missing');
    }, { ...report.settlement, reply: checks.reply });
    assert.equal(report.phoneSettlement.selected, checks.parentId);
    assert.equal(report.phoneSettlement.noticeSeq, report.settlement.noticeSeq);
    await editor.fill('DSHM_EXTERNAL_PARENT_DRAFT');
    await main.getByRole('button', { name: 'Remote 选项', exact: true }).click();
    await page.getByRole('dialog', { name: 'Remote 选项', exact: true }).getByRole('button', { name: '子会话', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: '子会话', exact: true });
    const group = dialog.getByRole('group', { name: checks.label, exact: true });
    await group.waitFor();
    assert.equal(await group.getByRole('button', { name: new RegExp(checks.label) }).isDisabled(), true);
    assert.equal(await group.getByRole('button', { name: '在旁栏打开', exact: true }).count(), 0);
    assert.match(await group.innerText(), /外部任务/);
    assert.doesNotMatch(await group.innerText(), /可继续聊天|当前未运行|进行中/);
    await group.getByText('此任务的执行结果显示在父会话。', { exact: true }).waitFor();
    const result = group.locator(`[data-external-subagent-result="${report.settlement.taskId}"]`);
    await result.locator('summary').click();
    assert.equal(await result.locator('.remote-external-result').isVisible(), true);
    const text = await result.locator('.remote-external-result').innerText();
    assert.ok(text.includes(checks.reply));
    assert.equal(Number(await result.getAttribute('data-result-notice-seq')), report.settlement.noticeSeq);
    report.visibleResult = { noticeSeq: report.settlement.noticeSeq, text, fromNoticeInsteadOfPromptOrArguments: true };
    await writeFile(resolve(evidence, 'external-parent-result.png'), await device.screenshot());
    await writeFile(resolve(evidence, 'external-child.png'), await device.screenshot());
    await mark('phone-external-task-label-and-no-invalid-main-or-aside-entry');
    report.rejectedEntrances = await main.evaluate(async (element, id) => {
      for (let fiber = element[Object.keys(element).find(name => name.startsWith('__reactFiber$'))]; fiber; fiber = fiber.return)
        if (fiber.memoizedProps?.model?.client) {
          const model = fiber.memoizedProps.model, before = model.getSnapshot().selected, results = [];
          for (const action of ['openChild', 'openChildAside']) {
            try { await model[action](id); throw Error('invalid_external_entry_accepted'); }
            catch (error) { if (error.message !== '此任务的执行结果显示在父会话。') throw error; results.push(action); }
          }
          if (model.getSnapshot().selected !== before) throw Error('external_rejection_changed_selection');
          return results;
        }
      throw Error('official_external_model_missing');
    }, report.settlement.taskId);
    await dialog.getByRole('button', { name: '关闭窗口', exact: true }).click();
    assert.equal(await editor.innerText(), 'DSHM_EXTERNAL_PARENT_DRAFT');
    assert.equal(await page.locator('iframe').count(), 0);
    report.completed = true; await mark('real-official-acp-result-returned-to-parent-and-draft-preserved');
    return report;
  } finally { await save(); }
}
