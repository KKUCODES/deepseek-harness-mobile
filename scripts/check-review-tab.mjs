import assert from 'node:assert/strict';

/** 原 ReviewTab 与手机读取/确认入口；服务响应为显式隔离夹具。 */
export async function checkReviewTab(page) {
  await page.evaluate(async () => { await window.fixture.select('two'); await window.fixture.documentPreview(); });
  await page.getByRole('button', { name: '查看整轮改动', exact: true }).click();
  const panel = page.getByRole('region', { name: '插件面板', exact: true });
  const active = panel.locator('.remote-document-tab:not([hidden])');
  const review = active.locator('[data-changes-review]');
  await review.locator('[data-review-view="unified"]').getByText('TURN BEFORE', { exact: true }).waitFor();
  assert.deepEqual(await page.evaluate(() => window.fixture.documentReads()), []);
  await review.locator('[data-review-tool="split"]').click();
  await review.locator('[data-diff-side="left"]').getByText('TURN BEFORE', { exact: true }).waitFor();
  await review.locator('[data-diff-side="right"]').getByText('TURN AFTER', { exact: true }).waitFor();
  await review.locator('[data-review-tool="wrap"]').click();
  await page.waitForFunction(() => document.querySelector('[data-review-tool="wrap"]')?.getAttribute('aria-pressed') === 'true');
  await review.locator('[data-review-view="split"][data-review-wrap]').waitFor();
  await review.locator('[data-review-file]').click();
  await page.getByRole('menuitem').filter({ hasText: 'b.dshmdoc' }).click();
  await review.getByRole('button', { name: /^(重试|Retry)$/ }).click();
  await review.getByText('TURN AFTER', { exact: true }).waitFor();
  assert.equal(await review.locator('[data-review-file]').getAttribute('data-review-file'), 'b.dshmdoc');
  assert.equal((await page.evaluate(() => window.fixture.reviewCalls())).filter(value => value.index === 1).length, 2);
  await review.locator('[data-review-tool="open-native"]').click();
  await active.getByRole('group', { name: '确认在电脑打开', exact: true }).getByText(/测试电脑/).waitFor();
  await active.getByRole('button', { name: '取消', exact: true }).click();
  assert.equal(await active.getByRole('group', { name: '确认在电脑打开', exact: true }).count(), 0);
  assert.deepEqual(await page.evaluate(() => window.fixture.deliveryOpens()), []);
  await review.locator('[data-review-tool="open-file"]').click();
  await active.getByTestId('diff-custom-renderer').getByText('CURRENT b.dshmdoc', { exact: true }).waitFor();
  await panel.getByRole('button', { name: /第 2 轮|Review · turn 2/ }).click();
  await review.locator('[data-review-view="split"][data-review-wrap]').waitFor();
  assert.equal(await review.locator('[data-review-file]').getAttribute('data-review-file'), 'b.dshmdoc');
  await panel.getByRole('button', { name: '返回聊天', exact: true }).click();
  return { originalReview: true, historicalWithoutContentRead: true, splitAndWrap: true, multiFileRetry: true,
    desktopConfirmationCancelled: true, pluginCurrentPreview: true, tabPreferencesRetained: true };
}
