import assert from 'node:assert/strict';

/** 原 Gateway 事件 → 原插件 apply → 手机真实输入链；不替代电脑/Android验收。 */
export async function checkOriginalInteractions(page) {
  await page.evaluate(async () => { window.fixture.locale('zh'); await window.fixture.select('one'); await window.fixture.enableInteractionDetails(); });
  const input = page.getByRole('textbox', { name: '消息', exact: true });
  await input.fill('审批期间保留的草稿');
  const editor = await input.elementHandle();
  const base = await page.evaluate(() => window.fixture.eventResults().length);
  const emit = frame => page.evaluate(value => window.fixture.event(value), frame);
  const result = async offset => {
    await page.waitForFunction(count => window.fixture.eventResults().length >= count, base + offset + 1);
    return page.evaluate(index => window.fixture.eventResults()[index].outcome, base + offset);
  };
  const approval = { type: 'waterfall', event: 'approval/request', eventId: 'original-approval', agentId: 'one',
    request: { toolName: 'fixture', callId: 'original-call', reason: '验证原审批插件' } };
  const questions = { type: 'waterfall', event: 'user-questions/request', eventId: 'original-question', agentId: 'one',
    request: { questions: [{ id: 'choices', question: '选择验证项目', multiSelect: true, options: [{ label: '草稿' }, { label: '同步' }] }] } };
  await emit(approval);
  const card = page.locator('[data-approval-key]');
  await card.getByTestId('approval-detail').waitFor();
  assert.equal(await card.getByTestId('approval-detail').innerText(), 'one:original-call');
  // 检查浏览器实际暴露给读屏的说明，不能只凭可见文字判定能听见审批理由。
  const accessibility = await page.context().newCDPSession(page);
  try {
    const { result: target } = await accessibility.send('Runtime.evaluate', {
      expression: 'document.querySelector("[data-approval-scroll]")',
    });
    const { nodes } = await accessibility.send('Accessibility.getPartialAXTree', {
      objectId: target.objectId, fetchRelatives: false,
    });
    assert.equal(nodes[0].name?.value, `审批详情: ${approval.request.reason}`, '审批理由必须进入读屏名称');
  } finally { await accessibility.detach(); }
  assert.equal(await input.count(), 0);
  assert.equal(await editor.evaluate(node => node.isConnected), true);
  await emit(questions);
  const question = page.locator('[data-question-key]');
  await question.waitFor();
  assert.equal(await card.count(), 0, '沿用原优先级：提问优先于审批');
  await page.evaluate(() => window.fixture.select('two'));
  await input.waitFor();
  assert.equal(await card.count(), 0);
  await page.evaluate(() => window.fixture.select('one'));
  await question.getByRole('checkbox', { name: '草稿', exact: true }).click();
  await question.getByRole('checkbox', { name: '同步', exact: true }).click();
  await question.getByPlaceholder('输入你的答案').fill('补充说明');
  await question.getByRole('button', { name: '收起问题卡片', exact: true }).click();
  await question.getByRole('button', { name: '展开问题卡片', exact: true }).click();
  assert.equal(await question.getByPlaceholder('输入你的答案').inputValue(), '补充说明');
  await page.evaluate(() => window.fixture.select('two'));
  await input.waitFor();
  await page.evaluate(() => window.fixture.select('one'));
  assert.equal(await question.getByRole('checkbox', { name: '同步', exact: true }).getAttribute('aria-checked'), 'true');
  assert.equal(await question.getByPlaceholder('输入你的答案').inputValue(), '补充说明');
  await question.getByRole('button', { name: '提交', exact: true }).click();
  assert.deepEqual(await result(0), { kind: 'result', value: { answers: [{ id: 'choices', selected: ['草稿', '同步'], custom: '补充说明' }] } });
  await card.getByRole('button', { name: '允许一次', exact: true }).click();
  assert.deepEqual(await result(1), { kind: 'result', value: 'allowed-once' });
  await emit({ ...approval, eventId: 'original-reject' });
  await card.getByRole('button', { name: '拒绝', exact: true }).click();
  assert.deepEqual(await result(2), { kind: 'result', value: 'rejected' });
  await emit({ ...questions, eventId: 'original-cancel-question' });
  await question.getByRole('button', { name: '放弃整组问题', exact: true }).click();
  assert.equal((await result(3)).error.code, 'ASK_CANCELLED');
  await emit({ ...approval, eventId: 'original-other-client' });
  await card.waitFor();
  await emit({ type: 'cancel', eventId: 'original-other-client' });
  await card.waitFor({ state: 'detached' });
  assert.equal(await page.evaluate(() => window.fixture.eventResults().length), base + 4);

  const plan = { type: 'waterfall', event: 'user-questions/request', eventId: 'original-plan', agentId: 'one', request: { questions: [{
    id: 'review', question: '确认此计划？', detail: '# 完整计划\n\n检查真实会话同步。\n\n- 保留聊天草稿\n- 不写入文件',
    options: [{ label: '继续讨论' }, { label: '原始批准选项' }], intent: { kind: 'plan-review', approve: '原始批准选项' },
  }] } };
  await emit(plan);
  await page.getByRole('region', { name: '插件面板', exact: true }).getByRole('heading', { name: '完整计划', exact: true }).waitFor();
  await page.getByText('不写入文件', { exact: true }).filter({ visible: true }).waitFor();
  await page.getByRole('button', { name: '返回聊天', exact: true }).click();
  const review = page.locator('[data-plan-review-key]');
  await review.getByRole('button', { name: '同意执行', exact: true }).click();
  assert.deepEqual(await result(4), { kind: 'result', value: { answers: [{ id: 'review', selected: ['原始批准选项'] }] } });
  await emit({ ...plan, eventId: 'original-plan-discuss' });
  await page.getByText('不写入文件', { exact: true }).filter({ visible: true }).waitFor();
  await page.getByRole('button', { name: '返回聊天', exact: true }).click();
  await review.getByRole('button', { name: '要求修改', exact: true }).click();
  assert.equal((await result(5)).error.code, 'ASK_CANCELLED');
  await review.waitFor({ state: 'detached' });
  await input.waitFor();
  assert.equal(await input.innerText(), '审批期间保留的草稿');
  await input.fill('');
  await page.evaluate(() => window.fixture.disableInteractionDetails());
  await editor.dispose();
  return { originalApply: true, approvalDetail: true, approvalReasonName: true, priority: true, sessionIsolation: true, questionDraftRestored: true,
    allowAndReject: true, cancel: true, otherClientCancel: true, planFullDocument: true, planApproveAndDiscuss: true, composerDraftRestored: true };
}
