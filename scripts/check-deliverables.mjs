import assert from 'node:assert/strict';

/** 显式事件回放经过原轮投影和实际聊天入口，不替代真实电脑验收。 */
export async function checkDeliverables(page) {
  await page.evaluate(async () => { await window.fixture.select('two'); await window.fixture.documentPreview(); window.fixture.deliveryTurn(); });
  const tail = page.locator('[data-remote-deliverables]').filter({ has: page.locator('[data-presented-files-row]') });
  await tail.getByText('最新交付描述', { exact: true }).waitFor();
  assert.equal(await tail.locator('[data-presented-file]').count(), 4);
  await tail.getByRole('alert').waitFor();
  await tail.getByRole('button', { name: '重新读取', exact: true }).click();
  assert.equal(await page.getByRole('button', { name: /^查看交付文件：/ }).count(), 0);
  await tail.getByRole('button', { name: /展开全部 5 个交付文件|Show all 5 delivered files/ }).click();
  assert.equal(await tail.locator('[data-presented-file]').count(), 5);
  await tail.getByRole('button', { name: /^(在侧边栏打开 a.dshmdoc|Open a.dshmdoc in sidebar)$/ }).click();
  const panel = page.getByRole('region', { name: '插件面板', exact: true });
  await panel.getByTestId('diff-custom-renderer').getByText('CURRENT a.dshmdoc', { exact: true }).waitFor();
  assert.equal(await panel.getByRole('button', { name: '在电脑文件夹中显示', exact: true }).count(), 1);
  await panel.getByRole('button', { name: '返回聊天', exact: true }).click();
  for (const [menu, confirmation] of [[/用默认应用打开|Open in default app/, '确认在电脑打开'], [/在文件资源管理器中显示|Show in File Explorer/, '确认在电脑文件夹中显示']]) {
    await tail.getByRole('button', { name: /a.dshmdoc 的更多文件操作|More file actions for a.dshmdoc/ }).click();
    await page.getByRole('menuitem', { name: menu }).click();
    const group = tail.getByRole('group', { name: confirmation, exact: true });
    await group.waitFor(); assert.match(await group.innerText(), /a\.dshmdoc/);
    await group.getByRole('button', { name: '取消', exact: true }).click();
    assert.equal(await group.count(), 0);
  }
  assert.deepEqual(await page.evaluate(() => window.fixture.deliveryOpens()), []);
  await tail.getByRole('button', { name: /a.dshmdoc 的更多文件操作|More file actions for a.dshmdoc/ }).click();
  await page.getByRole('menuitem', { name: /在文件资源管理器中显示|Show in File Explorer/ }).click();
  await tail.getByRole('button', { name: '确认在电脑文件夹中显示', exact: true }).click();
  await tail.getByText('已请求电脑在文件夹中显示。', { exact: true }).waitFor();
  assert.deepEqual(await page.evaluate(() => window.fixture.deliveryOpens()),
    [{ method: 'remote.openFile', source: 'presented', sessionId: 'two', seq: 3, index: 0, confirmed: true, action: 'reveal' }]);
  await tail.getByRole('button', { name: /在侧边栏查看本轮改动|Review this turn’s changes in the sidebar/ }).click();
  await panel.locator('[data-changes-review]').getByText('TURN AFTER', { exact: true }).waitFor();
  await panel.getByRole('button', { name: '返回聊天', exact: true }).click();
  await page.screenshot({ path: 'artifacts/deliverables-web.png' });
  return { originalCards: true, deduplicatedLatestRecord: true, expandFive: true, originalDocumentPreview: true,
    previewPreservesDesktopSource: true, openAndRevealCancelled: true, revealUsesLatestAuthorizedRecord: true,
    summaryFailureRetry: true, lateChangeAnnouncement: true, originalReviewEntry: true };
}
