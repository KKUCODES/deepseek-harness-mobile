import assert from 'node:assert/strict';

export async function checkRemoteNavigationApi(page) {
  await page.evaluate(async () => { await window.fixture.select('one'); await window.fixture.enableNavigationProbe(); });
  const button = page.getByTestId('navigation-probe'); await button.waitFor();
  assert.equal(await button.getAttribute('data-workspace-phase'), 'ready');
  await page.getByRole('textbox', { name: '消息', exact: true }).fill('导航接口原草稿');
  await button.click();
  await page.waitForFunction(() => window.fixture.sidebarState().selected === 'two');
  await page.getByRole('textbox', { name: '消息', exact: true }).waitFor();
  await page.evaluate(() => window.fixture.select('one'));
  const input = page.getByRole('textbox', { name: '消息', exact: true }); await input.waitFor();
  assert.equal(await input.innerText(), '导航接口原草稿');
  await input.fill(''); await page.evaluate(() => window.fixture.disableNavigationProbe());
  await button.waitFor({ state: 'detached' });
  return { serviceInjection: true, workspaceHook: true, ownPageNavigation: true, draftPreserved: true };
}
