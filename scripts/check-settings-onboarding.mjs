import assert from 'node:assert/strict';

export async function checkSettingsOnboarding(page) {
  await page.evaluate(async () => {
    await window.fixture.select('one');
    window.fixture.settingsGrant(true);
    await window.fixture.enableSettingsSections();
    await window.fixture.enableSettingsOnboarding();
  });
  assert.deepEqual((await page.evaluate(() => window.fixture.settingsSections())).filter(row => row.id === 'models'), [{ id: 'models', order: 10 }]);
  // 历史聊天不能弹出首次引导。
  assert.equal(await page.getByTestId('onboarding-first').count(), 0);
  await page.evaluate(() => window.fixture.back());
  const first = page.getByTestId('onboarding-first'), last = page.getByTestId('onboarding-last');
  await first.waitFor(); assert.equal(await first.getAttribute('data-session'), 'none');
  assert.equal(await last.count(), 0);
  await first.getByRole('button', { name: '完成 first', exact: true }).click();
  await last.waitFor();
  await page.evaluate(() => window.fixture['onboarding-first'].openSection('fixture-section'));
  assert.equal(await page.getByRole('dialog', { name: '电脑设置', exact: true }).count(), 0);
  await last.getByRole('button', { name: '打开扩展设置 last', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: '电脑设置', exact: true });
  await page.getByTestId('settings-section').waitFor();
  assert.equal(await dialog.getByRole('combobox', { name: '设置页面', exact: true }).inputValue(), 'fixture-section');
  await dialog.getByRole('button', { name: '关闭窗口', exact: true }).click();
  await last.getByRole('button', { name: '打开模型设置 last', exact: true }).click();
  await dialog.getByRole('spinbutton', { name: '单次回复上限（Token）', exact: true }).waitFor();
  await dialog.getByRole('button', { name: '关闭窗口', exact: true }).click();
  await page.evaluate(() => window.fixture.settingsGrant(false));
  await last.waitFor({ state: 'detached' });
  await page.evaluate(() => window.fixture['onboarding-last'].openSection('models'));
  assert.equal(await dialog.count(), 0);
  await page.evaluate(() => window.fixture.settingsGrant(true));
  await last.waitFor();
  await last.getByRole('button', { name: '完成 last', exact: true }).click();
  await last.waitFor({ state: 'detached' });
  await page.evaluate(async () => { await window.fixture.select('one'); });
  await page.getByRole('textbox', { name: '消息', exact: true }).waitFor();
  await page.evaluate(() => window.fixture.back());
  await first.waitFor();
  await first.getByRole('button', { name: '完成 first', exact: true }).click();
  await last.waitFor();
  await page.evaluate(() => window.fixture.removeSettingsOnboarding());
  await last.waitFor({ state: 'detached' });
  await page.evaluate(() => window.fixture['onboarding-last'].openSection('models'));
  assert.equal(await dialog.count(), 0);
  await page.evaluate(() => { window.fixture.removeSettingsSections(); window.fixture.settingsGrant(false); });
  return { emptyMainOnly: true, silentStep: true, ordered: true, root: true, ownSections: true, models: true, staleCallbacksRejected: true, revoked: true, unloaded: true };
}
