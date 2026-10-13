import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

/** 子任务由真实模型创建，手机只使用自己的聊天页面和官方 Session 地址。 */
export async function verifyOfficialSubagents({ page, device, evidence, inference, disconnect, reconnect, mark }) {
  const main = page.getByTestId('remote-workspace'), checks = inference.subagents;
  const editor = main.locator('[data-composer-input]');
  const report = { completed: false };
  const save = () => writeFile(resolve(evidence, 'subagents.json'), JSON.stringify(report, null, 2) + '\n');
  const state = () => main.evaluate(element => {
    const key = Object.keys(element).find(name => name.startsWith('__reactFiber$'));
    for (let fiber = element[key]; fiber; fiber = fiber.return) if (fiber.memoizedProps?.model?.client) {
      const view = fiber.memoizedProps.model.getSnapshot();
      return { selected: view.selected, subagent: view.session?.subagent,
        available: view.subagentServiceAvailable, error: view.session?.openError };
    }
    throw Error('official_subagent_model_missing');
  });
  const send = async prompt => {
    await editor.fill(prompt);
    await main.getByRole('button', { name: '发送消息', exact: true }).click();
  };
  const finished = async reply => {
    await main.getByRole('article', { name: '模型回复', exact: true }).filter({ hasText: reply })
      .last().waitFor({ timeout: 180000 });
    await main.getByRole('button', { name: '停止生成', exact: true }).waitFor({ state: 'hidden', timeout: 30000 });
  };
  const openChild = async () => {
    await main.getByRole('button', { name: 'Remote 选项', exact: true }).click();
    await page.getByRole('dialog', { name: 'Remote 选项', exact: true })
      .getByRole('button', { name: '子会话', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: '子会话', exact: true });
    const button = dialog.getByRole('button', { name: new RegExp(checks.label) });
    await button.waitFor();
    assert.equal(await button.count(), 1);
    assert.match(await button.innerText(), /可继续聊天/);
    await button.click();
    await main.getByRole('button', { name: '返回父会话', exact: true }).waitFor();
    assert.equal((await state()).selected, report.creation.address.childSessionId);
    assert.equal(await page.locator('iframe').count(), 0);
  };
  try {
    const initial = checks.marker + '_INITIAL', root = checks.marker + '_ROOT';
    const initialSeq = await checks.before();
    const args = { description: checks.label,
      prompt: `这是独立子会话测试。不要读写文件、执行命令、联网或创建其他子任务。只回复 ${initial}，可以用 send_message 回报父会话。` };
    await send(`现在只调用一次 subagent，参数为 ${JSON.stringify(args)}。不要调用其他工具或创建其他子任务，不读写文件、执行命令或联网。创建后只回复 ${root}，收到结果后也只回复 ${root}。`);
    report.creation = await checks.created(initialSeq, initial);
    await finished(root);
    const parent = await checks.parent();
    await editor.fill('DSHM_PARENT_CHILD_TEST_DRAFT');
    await openChild();
    await finished(initial);
    const childBefore = await checks.read();
    const childState = await state();
    assert.equal(childState.available, true);
    assert.equal(childState.subagent.parentAvailable, true);
    assert.equal(await editor.innerText(), '');
    await writeFile(resolve(evidence, 'child-initial.png'), await device.screenshot());
    await mark('official-model-created-child-opened-in-own-phone-page');
    const reply = checks.marker + '_CONTINUED';
    const prompt = `这是手机直接续聊验收，不调用任何工具、也不向其他会话发消息，只回复 ${reply}。`;
    await send(prompt);
    await finished(reply);
    report.continuation = await checks.verifyContinuation(childBefore.snapshot.asOfSeq, prompt, reply);
    const settled = await checks.read();
    assert.deepEqual(settled.records.slice(0, childBefore.records.length), childBefore.records);
    await editor.fill('DSHM_CHILD_ONLY_DRAFT');
    await main.getByRole('button', { name: '返回父会话', exact: true }).click();
    assert.equal((await state()).selected, checks.parentId);
    assert.equal(await editor.innerText(), 'DSHM_PARENT_CHILD_TEST_DRAFT');
    // 原子任务运行器会向父会话自动投递结算通知；保留旧前缀，核对新增通知而非禁止它。
    const parentAfter = await checks.parentSettled(reply);
    assert.deepEqual(parentAfter.records.slice(0, parent.records.length), parent.records);
    const notices = parentAfter.records.slice(parent.records.length).filter(row => row.event.type === 'user/message');
    assert.equal(notices.length, 1);
    assert.equal(notices[0].event.data.source.kind, 'subagent-settled');
    assert.equal(notices[0].event.data.source.senderSessionId, report.creation.address.childSessionId);
    assert.ok(JSON.stringify(notices[0].event.data.content).includes(reply));
    report.parentSettlement = { noticeSeq: notices[0].event.seq, count: notices.length, originalPrefixRetained: true };
    await openChild();
    assert.equal(await editor.innerText(), 'DSHM_CHILD_ONLY_DRAFT');
    await finished(reply);
    await disconnect();
    await page.getByTestId('remote-offline-status').waitFor();
    await reconnect();
    await page.getByTestId('remote-offline-status').waitFor({ state: 'detached', timeout: 45000 });
    await finished(reply);
    assert.equal((await state()).selected, report.creation.address.childSessionId);
    assert.equal(await editor.innerText(), 'DSHM_CHILD_ONLY_DRAFT');
    assert.deepEqual((await checks.read()).records, settled.records);
    report.readBoundary = await main.evaluate(async (element, request) => {
      const key = Object.keys(element).find(name => name.startsWith('__reactFiber$'));
      let model;
      for (let fiber = element[key]; fiber; fiber = fiber.return)
        if (fiber.memoizedProps?.model?.client) { model = fiber.memoizedProps.model; break; }
      if (!model) throw Error('official_subagent_model_missing');
      const controller = new AbortController(), timer = setTimeout(() => controller.abort(), 15000);
      try {
        const actual = await model.remote.session.page({ ...request, address: { ...request.address, mode: 'unknown' } }, controller.signal);
        const wrong = await model.remote.session.page({ ...request, address: { ...request.address, mode: 'one-shot' } }, controller.signal);
        // Playwright 跨进程传递 Error 时不会保留自定义属性；在手机内提取公开错误码。
        return { actual, wrong: { ok: wrong.ok, error: wrong.ok ? null : { code: wrong.error.code,
          message: wrong.error.message } } };
      } finally { clearTimeout(timer); }
    }, { address: report.creation.address, throughSeq: settled.snapshot.asOfSeq, maxMessages: 100 });
    assert.equal(report.readBoundary.actual.ok, true);
    assert.deepEqual(report.readBoundary.actual.value.records, settled.records);
    assert.equal(report.readBoundary.wrong.ok, false);
    assert.equal(report.readBoundary.wrong.error.code, 'subagent/unauthorized');
    assert.deepEqual((await checks.read()).records, settled.records);
    report.readBoundary = { unknownReadMatchesOriginal: true, mismatchedModeCode: 'subagent/unauthorized',
      verifiedRecords: settled.records.length, originalPrefixRetained: true };
    if (checks.stop) {
      report.stop = { completed: false, prepared: await checks.stop.prepare() };
      const command = `Write-Output '${checks.marker}_STOP_BEGIN'; Start-Sleep -Seconds 45; Write-Output '${checks.marker}_STOP_END'`;
      const stopReply = checks.marker + '_SHOULD_NOT_REPLY';
      await send(`这是子会话停止验收。只调用一次 pwsh，参数严格为 ${JSON.stringify({ command,
        description: 'DSHM 子会话只读等待停止', run_in_background: false, timeoutMs: 120000 })}。不要读写文件、联网、创建其他子任务或调用其他工具，不重试、不申请提权。自然完成后只回复 ${stopReply}；用户停止后不继续执行或补做。`);
      report.stop.running = await checks.stop.started(report.stop.prepared.initialSeq, command);
      const turn = main.locator('[data-turn-process]').last();
      if (await turn.getAttribute('aria-expanded') === 'false') await turn.click();
      await main.locator(`[data-chat-call-id="${report.stop.running.callId}"]`).waitFor();
      assert.equal(await editor.innerText(), '');
      await main.getByRole('button', { name: '停止生成', exact: true }).click();
      await main.getByRole('button', { name: '停止生成', exact: true }).waitFor({ state: 'hidden', timeout: 30000 });
      report.stop.settled = await checks.stop.settled(report.stop.prepared.initialSeq, command,
        checks.marker + '_STOP_END', stopReply);
      await main.locator('[data-turn-process]').last().getByText('已停止', { exact: true }).waitFor();
      assert.equal((await state()).selected, report.creation.address.childSessionId);
      report.stop.actualStoppedChildTurnShown = true;
      await writeFile(resolve(evidence, 'child-stopped.png'), await device.screenshot());
      await mark('official-phone-stops-real-readonly-child-tool-turn');
      const stopped = await checks.read(), after = checks.marker + '_AFTER_STOP';
      const prompt = `继续当前子会话。不调用任何工具或发送父会话消息，只回复 ${after}。`;
      await send(prompt); await finished(after);
      report.stop.continued = await checks.verifyContinuation(stopped.snapshot.asOfSeq, prompt, after);
      assert.deepEqual((await checks.read()).records.slice(0, stopped.records.length), stopped.records);
      await editor.fill('DSHM_CHILD_AFTER_STOP_DRAFT');
      await main.getByRole('button', { name: '返回父会话', exact: true }).click();
      assert.equal(await editor.innerText(), 'DSHM_PARENT_CHILD_TEST_DRAFT');
      await checks.parentSettled(after);
      report.stop.parentDraftPreserved = true;
      await openChild(); assert.equal(await editor.innerText(), 'DSHM_CHILD_AFTER_STOP_DRAFT');
      await finished(after);
      report.stop.childDraftPreserved = true; report.stop.completed = true;
      await writeFile(resolve(evidence, 'child-after-stop.png'), await device.screenshot());
      await mark('official-child-continues-after-phone-stop-parent-and-child-drafts-isolated');
    }
    await writeFile(resolve(evidence, 'child-reconnected.png'), await device.screenshot());
    await mark('official-child-phone-continuation-history-drafts-and-reconnect');
    await editor.fill('');
    await main.getByRole('button', { name: '返回父会话', exact: true }).click();
    assert.equal(await editor.innerText(), 'DSHM_PARENT_CHILD_TEST_DRAFT');
    await editor.fill('');
    report.parentHistoryPrefixUnchanged = true;
    report.completed = true;
  } catch (error) { report.failure = error.message; throw error; }
  finally { await save(); }
  return report;
}
