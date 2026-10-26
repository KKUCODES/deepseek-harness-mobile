import assert from 'node:assert/strict';

export async function checkRemoteBackNavigation(page) {
  await page.waitForFunction(() => !!window.fixture && !!window.dshmHandleBack);
  // 仅初始化列表；每次进入会话必须点击真实按钮，不能用 model.select 绕过 act/busy。
  await page.evaluate(() => window.fixture.select(null));
  const main = page.getByTestId('remote-workspace');
  const back = main.getByRole('button', { name: '返回', exact: true });
  const selected = () => page.evaluate(() => window.fixture.sidebarState().selected);
  const systemBack = async () => assert.equal(await page.evaluate(() => window.dshmHandleBack()), true);
  const waitSelected = id => page.waitForFunction(value => window.fixture.sidebarState().selected === value, id);
  const enter = async () => {
    await main.locator('.remote-session-row, [data-remote-home-session]').filter({ hasText: 'one' }).click();
    await waitSelected('one');
    await page.waitForFunction(() => !document.querySelector('.remote-topbar button').disabled);
  };

  await page.evaluate(() => window.fixture.holdSelection());
  try {
    await main.locator('.remote-session-row, [data-remote-home-session]').filter({ hasText: 'one' }).click();
    await waitSelected('one');
    assert.equal(await back.isDisabled(), true);
    await systemBack();
    assert.equal(await selected(), 'one', '读取未结束时仍保留忙碌保护');
  } finally {
    await page.evaluate(() => window.fixture.releaseSelection());
  }
  await page.waitForFunction(() => !document.querySelector('.remote-topbar button').disabled);
  await systemBack();
  await waitSelected(null);

  for (let attempt = 0; attempt < 3; attempt++) {
    await enter();
    await systemBack();
    await waitSelected(null);
    await enter();
    await back.click();
    await waitSelected(null);
  }

  await page.evaluate(() => window.fixture.backNavigationProject());
  await main.getByRole('button', { name: '返回验证项目', exact: true }).click();
  await enter();
  await main.getByRole('textbox', { name: '消息', exact: true }).fill('返回验证草稿');

  await main.getByRole('button', { name: 'Remote 选项', exact: true }).click();
  await page.getByRole('dialog', { name: 'Remote 选项', exact: true }).waitFor();
  await systemBack();
  await page.getByRole('dialog', { name: 'Remote 选项', exact: true }).waitFor({ state: 'hidden' });
  assert.equal(await selected(), 'one', '返回先关闭自有弹窗');

  await page.evaluate(() => window.fixture.enablePanels());
  await main.getByRole('button', { name: 'Remote 选项', exact: true }).click();
  await page.getByRole('button', { name: '插件面板', exact: true }).click();
  const panel = page.getByRole('region', { name: '插件面板', exact: true });
  await panel.getByRole('button', { name: '测试面板', exact: true }).click();
  await page.getByTestId('fixture-panel').getByRole('button', { name: '打开插件弹窗', exact: true }).click();
  const modal = page.getByRole('dialog', { name: '原插件弹窗', exact: true });
  await modal.getByRole('button', { name: '弹窗菜单', exact: true }).click();
  await systemBack();
  await page.getByRole('menuitem', { name: '填入菜单值', exact: true }).waitFor({ state: 'hidden' });
  assert.equal(await modal.isVisible(), true, '返回先关闭插件菜单，保留弹窗');
  await systemBack();
  await modal.waitFor({ state: 'hidden' });
  assert.equal(await panel.isVisible(), true, '返回先关闭插件弹窗，保留面板');
  assert.equal(await selected(), 'one');

  await page.evaluate(async () => {
    await window.fixture.enableGlobalPanels();
    window.fixture.selectGlobalPanel('fixture-global');
  });
  const global = page.locator('.remote-global-panel');
  await page.getByTestId('global-panel-content').waitFor();
  await systemBack();
  await global.waitFor({ state: 'hidden' });
  assert.equal(await panel.isVisible(), true, '全局插件页面先于下层面板关闭');
  assert.equal(await selected(), 'one');
  await systemBack();
  await panel.waitFor({ state: 'hidden' });
  assert.equal(await selected(), 'one', '返回先关闭面板，保留聊天');
  assert.equal(await main.getByRole('textbox', { name: '消息', exact: true }).innerText(), '返回验证草稿');

  await page.evaluate(async () => { window.fixture.settingsGrant(true); await window.fixture.enableSettingsTabs(); });
  await main.getByRole('button', { name: 'Remote 选项', exact: true }).click();
  await page.getByRole('button', { name: '电脑插件', exact: true }).click();
  await page.getByRole('button', { name: '插件设置', exact: true }).click();
  await page.getByRole('tab', { name: '扩展一', exact: true }).click();
  await page.getByTestId('settings-tab-one').waitFor();
  await systemBack();
  await page.getByTestId('settings-tab-one').waitFor({ state: 'hidden' });
  assert.equal(await selected(), 'one', '插件设置先于聊天关闭');

  await systemBack();
  await waitSelected(null);
  assert.equal(await main.locator('.remote-heading, .dhp-bar h1').innerText(), '返回验证项目', '聊天返回原项目列表');
  await enter();
  assert.equal(await main.getByRole('textbox', { name: '消息', exact: true }).innerText(), '返回验证草稿');
  await systemBack();
  await waitSelected(null);
  await systemBack();
  await main.getByRole('button', { name: '返回验证项目', exact: true }).waitFor();
  assert.equal(await page.evaluate(() => window.dshmHandleBack()), false, '根列表交还原生返回');
  return { listEntry: true, busyThenReady: true, repeatedSystemAndHeader: 3, projectReturn: true,
    ownDialog: true, pluginMenuThenModal: true, globalThenSidePanel: true, pluginSettings: true, draftPreserved: true, rootReturnsFalse: true };
}
