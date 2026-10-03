import assert from 'node:assert/strict';

/** 只读取已有 DSH-TEST 会话，不新建、不归档、不发送模型请求。 */
export async function verifyRemoteSearch(page, history, disabled = false) {
  const title = 'DSHM Remote 联调提示';
  const draft = await page.getByRole('textbox', { name: '消息', exact: true }).inputValue();
  const marker = (await history.innerText()).match(/DSHM_[A-Z0-9_]{8,}/)?.[0];
  assert.ok(marker, 'Dedicated test history must contain an existing DSHM marker');
  const report = { marker };
  await page.getByRole('button', { name: '返回', exact: true }).click();
  const search = page.getByRole('textbox', { name: '搜索远程聊天', exact: true });
  if (disabled) {
    await search.fill(title);
    await page.getByText('电脑尚未开启聊天内容搜索，当前仅搜索标题。', { exact: true }).waitFor();
    await page.screenshot({ path: 'artifacts/remote-search-disabled-android.png' });
    await page.locator('.remote-session-row').filter({ hasText: title }).click();
    await history.getByRole('article', { name: '模型回复' }).first().waitFor();
    assert.equal(await page.getByRole('textbox', { name: '消息', exact: true }).inputValue(), draft);
    return { disabledHostExplained: true, titleSearchAndOpen: true, draftPreserved: true };
  }
  const settled = async () => {
    await page.waitForFunction(() => ![...document.querySelectorAll('[role="status"]')].some(item => item.textContent.includes('正在搜索聊天内容')));
    assert.equal(await page.getByRole('button', { name: '重新搜索', exact: true }).count(), 0);
  };
  await search.fill(marker);
  const match = page.locator('.remote-session-row').filter({ hasText: title });
  await match.locator('.remote-search-snippet').filter({ hasText: marker }).waitFor({ timeout: 30000 });
  await settled();
  report.messageContentMatch = true;
  await page.screenshot({ path: 'artifacts/remote-search-content-android.png' });
  await page.locator('.remote-project-row').filter({ hasText: 'DSH-TEST' }).click();
  await match.locator('.remote-search-snippet').filter({ hasText: marker }).waitFor();
  report.workspaceScope = true;
  await page.getByRole('button', { name: 'Remote 选项', exact: true }).click();
  await page.getByRole('button', { name: '查看已归档聊天', exact: true }).click();
  assert.equal(await match.count(), 0);
  report.activeExcludedFromArchived = true;
  await page.getByRole('button', { name: 'Remote 选项', exact: true }).click();
  await page.getByRole('button', { name: '查看最近聊天', exact: true }).click();
  await match.waitFor();
  await search.fill(`DSHM_NO_MATCH_${Date.now()}`);
  await page.getByText('没有找到匹配的聊天，试试其他关键词。', { exact: true }).waitFor({ timeout: 30000 });
  report.emptyAfterResponse = true;
  await search.fill(title);
  await match.waitFor(); await settled();
  report.titleMatch = true;
  await search.fill('');
  await match.click();
  await history.getByRole('article', { name: '模型回复' }).first().waitFor();
  assert.equal(await page.getByRole('textbox', { name: '消息', exact: true }).inputValue(), draft);
  report.openOriginalAndDraftPreserved = true;
  return report;
}
