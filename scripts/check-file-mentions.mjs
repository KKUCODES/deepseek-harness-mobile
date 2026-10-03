import assert from 'node:assert/strict';

export async function checkFileMentions(page) {
  await page.evaluate(() => window.fixture.select('two'));
  await page.evaluate(() => window.fixture.fileMentionsTurn(false));
  const answer = page.getByRole('article', { name: '模型回复', exact: true }).filter({ hasText: 'unique.txt' });
  await answer.waitFor();
  assert.equal(await answer.locator('code button').count(), 0, '尚未关闭的回复不能产生文件引用');
  await page.evaluate(() => window.fixture.fileMentionsTurn(true));
  await answer.getByRole('button', { name: '打开文件：/one/unique.txt', exact: true }).waitFor();
  assert.equal(await answer.locator('code button').count(), 3);
  for (const name of ['report.txt', 'failed.txt', 'unknown.txt']) {
    const token = answer.locator('code').filter({ hasText: new RegExp(`^${name.replace('.', '\\.')}$`) });
    assert.equal(await token.count(), 1);
    assert.equal(await token.locator('button').count(), 0);
  }
  for (const path of ['/one/unique.txt', '/two/report.txt', '/one/delivery.txt']) {
    await answer.getByRole('button', { name: `打开文件：${path}`, exact: true }).click();
    const file = page.getByRole('dialog', { name: '文件预览', exact: true });
    await file.getByText(`File mention opened: ${path}`, { exact: true }).waitFor();
    await file.getByRole('button', { name: '关闭文件预览', exact: true }).click();
  }
  await page.evaluate(() => window.fixture.emitTurn('two', 2, 16));
  assert.equal(await answer.locator('code button').count(), 3, '较晚轮次不改变原引用');
  await page.evaluate(() => window.fixture.select('one'));
  await page.evaluate(() => window.fixture.emitTurn('one', 1, 0));
  assert.equal(await page.locator('article code button').count(), 0);
  return { liveClosingUpdate: true, successfulMutation: true, deliveredFile: true, exactPath: true, ambiguousAndFailedInert: true, ownFilePreview: true, laterTurnAndSessionIsolation: true };
}
