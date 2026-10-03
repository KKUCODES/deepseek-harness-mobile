import assert from 'node:assert/strict';

export async function checkWorkspaceDrafts(page) {
  await page.evaluate(() => window.fixture.beginWorkspaceDraftTest());
  const main = page.getByTestId('remote-workspace'), input = main.getByRole('textbox', { name: '消息', exact: true });
  await input.fill('跨工作区草稿');
  await page.evaluate(() => window.fixture.insertWorkspaceReference());
  await page.evaluate(() => window.fixture.uploadWorkspaceDraft());
  await page.waitForFunction(() => !window.fixture.workspaceDraftState().saving['draft-from']);
  await main.getByRole('button', { name: '切换工作区', exact: true }).click();
  await page.getByRole('dialog', { name: '选择工作区', exact: true }).getByRole('button', { name: '草稿工作区 to', exact: true }).click();
  await main.locator('.remote-heading strong').getByText('draft-to', { exact: true }).waitFor();
  await input.locator('[data-composer-chip]').waitFor();
  const result = await page.evaluate(() => window.fixture.workspaceDraftState());
  assert.equal(result.drafts['draft-from'], ''); assert.deepEqual(result.attachments['draft-from'], []);
  assert.ok(result.drafts['draft-to'].includes('@/fixture/draft-from/same.txt'));
  assert.equal(await input.locator('[data-composer-chip]').count(), 1);
  assert.deepEqual(result.uploads.map(item => [item.sessionId, item.text]), [['draft-from', 'workspace draft original'], ['draft-to', 'workspace draft original']]);
  assert.notEqual(result.uploads[0].receiptId, result.uploads[1].receiptId);
  assert.equal(result.attachments['draft-to'][0].receiptId, result.uploads[1].receiptId); assert.deepEqual(result.locks, []);
  await page.evaluate(() => window.fixture.endWorkspaceDraftTest());
  return { ownPagePicker: true, draftMoved: true, sourceCleared: true, referenceSourceRetained: true, targetReuploaded: true, newReceipt: true, locksReleased: true };
}
