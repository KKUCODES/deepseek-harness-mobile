import assert from 'node:assert/strict';

export async function checkModelOnboarding(page) {
  await page.evaluate(async () => {
    window.fixture.settingsGrant(true); await window.fixture.select('one');
    await window.fixture.enableModelOnboarding(); await window.fixture.back();
  });
  const dialog = page.getByRole('dialog', { name: '添加一个 API Key 开始使用', exact: true });
  await dialog.waitFor();
  assert.equal(await dialog.locator('input[type="password"]').count(), 0);
  const native = dialog.getByRole('button', { name: '管理电脑 Key', exact: true });
  await native.click();
  assert.equal((await page.evaluate(() => window.fixture.keyNativeCalls())).length, 1);
  await dialog.getByRole('button', { name: '稍后配置', exact: true }).click();
  await dialog.waitFor({ state: 'detached' });
  await page.evaluate(() => window.fixture.select('one'));
  await page.getByRole('textbox', { name: '消息', exact: true }).waitFor();
  await page.evaluate(() => window.fixture.back());
  await dialog.waitFor();
  await page.evaluate(() => window.fixture.modelReadiness('provider-ready'));
  await dialog.waitFor({ state: 'detached' });
  await page.evaluate(() => window.fixture.select('one'));
  await page.getByRole('textbox', { name: '消息', exact: true }).waitFor();
  await page.evaluate(() => window.fixture.back());
  await page.waitForTimeout(100);
  assert.equal(await dialog.count(), 0);
  await page.evaluate(() => { window.fixture.removeModelOnboarding(); window.fixture.settingsGrant(false); });
  return { nativeKeyOnly: true, cancelledKeyKeepsPrompt: true, later: true, readyEventCompletes: true, readyDoesNotPrompt: true };
}
