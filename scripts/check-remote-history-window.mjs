import assert from 'node:assert/strict';

export async function checkRemoteHistoryWindow(page) {
  page.setDefaultTimeout(20000);
  await page.waitForFunction(() => !!window.fixture);
  await page.evaluate(async () => { await window.fixture.select(null); window.fixture.locale('zh'); window.fixture.longHistory({ turns: 2000, paragraphs: 80 }); });
  await page.getByTestId('remote-workspace').locator('.remote-session-row').filter({ hasText: 'one' }).click();
  const chat = page.getByRole('region', { name: '聊天内容', exact: true });
  await chat.locator('[data-history-group]').first().waitFor();
  await page.evaluate(async () => { await window.fixture.historyPlugin(); await window.fixture.enableInteractionDetails(); });
  await page.getByTestId('history-plugin-state').click();
  const eventBase = await page.evaluate(() => window.fixture.eventResults().length);
  const report = { pages: [], errors: [] };
  page.on('pageerror', error => report.errors.push(error.message));
  const state = () => page.evaluate(() => window.fixture.longHistoryState());
  const top = async () => { await chat.evaluate(el => { el.scrollTop = 0; }); await page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)))); };
  for (let index = 0; index < 24; index++) {
    if (index === 2) {
      await page.evaluate(() => window.fixture.event({ type: 'waterfall', event: 'approval/request', eventId: 'history-approval', agentId: 'one',
        request: { toolName: 'fixture', callId: 'history-call', reason: '历史分页期间的决定' } }));
      await page.locator('[data-approval-key]').waitFor();
    }
    await top();
    // 浏览器聚焦按钮会滚动几像素；基线取真实点击聚焦后的阅读位置。
    await chat.getByRole('button', { name: '加载更早的消息', exact: true }).focus();
    await page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
    const before = await state();
    const anchor = await chat.locator('[data-history-group]').first().evaluate(el => ({ key: el.dataset.historyGroup, top: el.getBoundingClientRect().top }));
    await chat.getByRole('button', { name: '加载更早的消息', exact: true }).click();
    await page.waitForFunction(n => { const value = window.fixture.longHistoryState(); return value.calls > n && !document.querySelector('[data-history-loader]')?.disabled; }, before.calls);
    await page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
    const after = await state();
    assert.ok(after.first < before.first, '连续分页确实到达更早 cut');
    assert.ok(after.records <= 400 && after.bytes <= 4 * 1024 * 1024, '查阅数据预算');
    assert.ok(after.liveRecords <= 400, '原实时尾部不累计旧页');
    assert.ok(after.groups.length <= 12, '仅挂载可见回合和缓冲');
    const offset = await chat.locator(`[data-history-group="${anchor.key}"]`).evaluate(el => el.getBoundingClientRect().top).catch(() => null);
    if (offset !== null) assert.ok(Math.abs(offset - anchor.top) < 4, `历史锚点保持 ${offset - anchor.top}`);
    report.pages.push({ first: after.first, records: after.records, groups: after.groups.length, dom: await page.locator('*').count() });
  }
  await page.evaluate(() => window.fixture.longHistoryLive());
  await page.waitForFunction(() => window.fixture.longHistoryState().hasNewer);
  const beforeLive = await state(); assert.equal(beforeLive.last, report.pages.at(-1).first + beforeLive.records - 1);
  await page.getByRole('button', { name: '加载较新的消息', exact: true }).click();
  await page.waitForFunction(last => window.fixture.longHistoryState().last > last, beforeLive.last);
  await top(); const failedBefore = await state();
  await page.evaluate(() => window.fixture.longHistoryFail(true));
  await chat.getByRole('button', { name: '加载更早的消息', exact: true }).click();
  await page.getByRole('alert').filter({ hasText: '未能加载更早的记录，请重试。' }).waitFor();
  assert.equal((await state()).first, failedBefore.first);
  await page.evaluate(() => window.fixture.longHistoryFail(false));
  await chat.getByRole('button', { name: '加载更早的消息', exact: true }).click();
  await page.waitForFunction(first => window.fixture.longHistoryState().first < first, failedBefore.first);
  await page.evaluate(() => window.fixture.longHistoryReconnect());
  await page.waitForFunction(() => !document.querySelector('[data-history-loader]')?.disabled);
  await page.locator('[data-approval-key]').getByRole('button', { name: '允许一次', exact: true }).click();
  await page.waitForFunction(count => window.fixture.eventResults().length === count + 1, eventBase);
  const answer = await page.evaluate(index => window.fixture.eventResults()[index].outcome, eventBase);
  assert.deepEqual(answer, { kind: 'result', value: 'allowed-once' });
  await page.evaluate(() => window.fixture.event({ type: 'waterfall', event: 'approval/request', eventId: 'history-reject', agentId: 'one', request: { toolName: 'fixture', callId: 'history-call-reject', reason: '拒绝验证' } }));
  await page.locator('[data-approval-key]').getByRole('button', { name: '拒绝', exact: true }).click();
  await page.waitForFunction(count => window.fixture.eventResults().length === count + 2, eventBase);
  assert.deepEqual(await page.evaluate(index => window.fixture.eventResults()[index + 1].outcome, eventBase), { kind: 'result', value: 'rejected' });
  assert.equal(await page.getByTestId('history-plugin-state').innerText(), 'plugin-state:1');
  await page.getByRole('button', { name: '返回最新消息', exact: true }).click();
  await page.waitForFunction(() => window.fixture.longHistoryState().last === 10004);
  const editor = page.getByRole('textbox', { name: '消息', exact: true }); await editor.fill('history regression draft');
  assert.equal(await editor.innerText(), 'history regression draft');
  await page.evaluate(() => { window.__historyFault = true; window.fixture.longHistoryLive(); });
  await page.getByText('这段记录暂时无法显示，可以重试。', { exact: true }).first().waitFor();
  await page.evaluate(() => { window.__historyFault = false; });
  while (await page.getByRole('button', { name: '重新显示', exact: true }).count()) await page.getByRole('button', { name: '重新显示', exact: true }).first().click();
  await chat.locator('.reply').first().waitFor();
  assert.equal(await editor.innerText(), 'history regression draft');
  assert.equal(await page.getByTestId('history-plugin-state').innerText(), 'plugin-state:1');
  await page.evaluate(() => { window.fixture.longHistoryParagraphs(2200); window.fixture.longHistoryLive(); });
  await chat.locator('[aria-label="长内容分页"]').last().waitFor();
  const segment = chat.locator('[aria-label="长内容分页"]').last();
  await segment.getByRole('button', { name: '下一段', exact: true }).click();
  assert.match(await segment.getByRole('status').innerText(), /第 2 \/ /);
  assert.ok(await chat.locator('*').count() < 15000, '单条超长的原内置回复也不全量创建 DOM');
  assert.equal(await page.evaluate(() => window.dshmHandleBack()), true);
  await page.waitForFunction(() => window.fixture.sidebarState().selected === null);
  assert.equal(await page.getByTestId('remote-workspace').locator('.remote-session-row').count() > 0, true);
  await page.evaluate(async () => { await window.fixture.select('two'); window.fixture.historyOutputRows('two', [{ id: 'live', kind: 'pwsh', label: '历史输出测试', status: 'running', startedAt: 1000 }]); });
  await page.getByRole('button', { name: 'Remote 选项', exact: true }).click();
  await page.getByRole('button', { name: '后台任务', exact: true }).click();
  await page.getByRole('button', { name: '查看输出记录', exact: true }).click();
  const output = page.getByRole('dialog', { name: '后台任务输出', exact: true });
  await page.evaluate(() => { window.fixture.jobOutput('two', false); window.fixture.jobOutput('two', true, 'OUTPUT_LINE\n'.repeat(4000)); });
  await output.locator('[aria-label="长内容分页"]').waitFor();
  await output.getByRole('button', { name: '下一段', exact: true }).click();
  await output.getByText(/第 2 \/ /).waitFor();
  assert.ok(await output.locator('*').count() < 3000, '任务输出按段解析与挂载');
  await output.getByRole('button', { name: '关闭任务输出', exact: true }).click();
  assert.deepEqual(report.errors, []);
  return { ...report, live: true, newer: true, readFailureRetry: true, reconnect: true, draftAndBack: true, approvalPreservedAndSingleDecision: true, pluginState: true, renderRecovery: true, builtinLongContent: true, jobOutputPages: true };
}
