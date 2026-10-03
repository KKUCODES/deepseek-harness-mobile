import assert from 'node:assert/strict';

export async function checkCordisCards(page) {
  await page.evaluate(() => window.fixture.select('two'));
  await page.evaluate(() => window.fixture.enableCordisCards());
  await page.evaluate(() => { window.fixture.cordisCardState('awaiting-approval'); window.fixture.cordisCardHistory('initial'); });
  const define = page.locator('[data-tool="cordis_define"]');
  const runs = page.locator('[data-tool="cordis_run"][data-cordis-plugin-id="card-plugin"]');
  await runs.locator('[data-cordis-business-view]').waitFor({ state: 'detached' });
  await page.waitForFunction(() => document.querySelector('[data-tool="cordis_run"]')?.dataset.cordisStatus === 'awaiting-approval');
  await define.getByText(/^(注册 Cordis 插件|Register Cordis Plugin)$/).click();
  await define.getByRole('tabpanel').getByText(/CLIENT_SOURCE/).waitFor();
  await define.getByRole('tab', { name: 'Host', exact: true }).click();
  await define.getByRole('tabpanel').getByText(/HOST_SOURCE/).waitFor();
  const sourceBounds = await define.boundingBox();
  assert.ok(sourceBounds && sourceBounds.x >= -1 && sourceBounds.x + sourceBounds.width <= page.viewportSize().width + 1,
    '原源码卡片不能撑开手机视口');
  await page.evaluate(() => window.fixture.cordisCardState('running'));
  const business = page.getByTestId('cordis-business');
  await business.waitFor(); assert.equal(await business.getAttribute('data-owner'), 'card-plugin/card-package/card-run');
  await business.click(); await business.getByText('业务点击 1', { exact: true }).waitFor();
  const businessBounds = await business.boundingBox();
  assert.ok(businessBounds && businessBounds.x >= -1 && businessBounds.x + businessBounds.width <= page.viewportSize().width + 1,
    '局部业务控件不能越出手机视口');
  await page.screenshot({ path: 'artifacts/cordis-cards-running-web.png' });
  await page.evaluate(() => window.fixture.cordisCardHistory('newer'));
  await page.waitForFunction(() => document.querySelector('[data-tool="cordis_run"]')?.dataset.cordisStatus === 'superseded');
  assert.equal(await business.count(), 1);
  await page.evaluate(() => window.fixture.cordisCardState('failed'));
  await business.waitFor({ state: 'detached' }); await runs.last().getByText('明确的卡片失败回放').waitFor();
  await page.evaluate(() => { window.fixture.cordisCardState('removed'); window.fixture.cordisCardHistory('actions'); });
  await page.waitForFunction(() => [...document.querySelectorAll('[data-tool="cordis_run"][data-cordis-plugin-id="card-plugin"]')].every(node => node.dataset.cordisStatus === 'removed'));
  await page.locator('[data-tool="cordis_stop"]').getByText('停止记录').waitFor();
  await page.locator('[data-tool="cordis_undefine"]').getByText('移除记录').waitFor();
  await page.locator('[data-tool="cordis_run"][data-state="error"]').waitFor();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  assert.ok(overflow <= 1, '历史工具卡片不能产生页面横向溢出');
  await page.screenshot({ path: 'artifacts/cordis-cards-web.png' });
  await page.evaluate(() => window.fixture.removeCordisCards());
  await define.waitFor({ state: 'detached' });
  return { originalCards: true, definitionSources: true, pending: true, latestBusinessOnly: true,
    failedAndRemoved: true, actionHistory: true, sourceBounds, businessBounds, overflow,
    unload: true, source: 'original components over isolated historical session event replay; retired tools are not executed' };
}
