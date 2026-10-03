import assert from 'node:assert/strict';

export async function checkSettingsAccess(page) {
  await page.evaluate(() => window.fixture.settingsGrant(false));
  // 手机偏好不依赖电脑管理授权；聊天、离线及首页应调用同一原生入口。
  const before = await page.evaluate(() => window.fixture.appearanceNavigationCalls().length);
  for (const [selected, connection] of [['two', 'connected'], ['two', 'disconnected'], [null, 'connected']]) {
    await page.evaluate(async ({ selected, connection }) => {
      window.fixture.managementConnection('connected', false);
      await window.fixture.select(selected);
      window.fixture.managementConnection(connection, false);
    }, { selected, connection });
    await page.getByRole('button', { name: 'Remote 选项', exact: true }).click();
    await page.getByRole('button', { name: '外观与语言', exact: true }).click();
    await page.getByRole('dialog').waitFor({ state: 'detached' });
  }
  assert.deepEqual(await page.evaluate(start => window.fixture.appearanceNavigationCalls().slice(start), before),
    Array.from({ length: 3 }, () => ({ op: 'appearance.settings', data: undefined })));
  await page.evaluate(async () => {
    await window.fixture.select('two'); window.fixture.settingsGrant(false);
    window.fixture.managementConnection('connected', false);
  });
  await page.getByRole('button', { name: 'Remote 选项', exact: true }).click();
  await page.getByRole('button', { name: '电脑设置', exact: true }).click();
  const panel = page.getByRole('dialog', { name: '电脑设置', exact: true });
  await panel.getByText('请先在电脑端授予此设备管理权限，再查看或修改电脑设置。', { exact: true }).waitFor();
  assert.equal(await panel.getByRole('combobox', { name: '设置页面', exact: true }).count(), 0);
  for (const [state, notice] of [['connecting', '正在连接电脑…'], ['disconnected', '电脑连接已断开，重新连接后可继续操作。']]) {
    await page.evaluate(state => window.fixture.managementConnection(state), state);
    await panel.getByText(notice, { exact: true }).waitFor();
    assert.equal(await panel.getByText(/授予.*管理权限/).count(), 0);
  }
  await page.evaluate(() => window.fixture.managementConnection('connected', true));
  await panel.getByRole('spinbutton', { name: '单次回复上限（Token）', exact: true }).waitFor();
  await page.evaluate(() => window.fixture.enableSettingsSections());
  const picker = panel.getByRole('combobox', { name: '设置页面', exact: true });
  await picker.selectOption('fixture-section');
  const pluginInput = panel.getByRole('textbox', { name: '插件设置草稿', exact: true });
  await pluginInput.fill('临时断线保留插件草稿');
  await page.evaluate(() => window.fixture.managementConnection('disconnected'));
  await panel.getByText('电脑连接已断开，重新连接后可继续操作。', { exact: true }).waitFor();
  assert.equal(await pluginInput.inputValue(), '临时断线保留插件草稿');
  const inert = await pluginInput.evaluate(node => {
    for (let current = node; current; current = current.parentElement ?? current.getRootNode()?.host) {
      if (current.inert) return true;
    }
    return false;
  });
  assert.equal(inert, true, 'ShadowRoot 内的插件也必须继承宿主 inert');
  await pluginInput.evaluate(node => node.focus());
  assert.equal(await pluginInput.evaluate(node => node.getRootNode().activeElement === node), false);
  assert.equal(await picker.isDisabled(), true);
  await page.evaluate(() => window.fixture.closeSettingsSection());
  assert.equal(await panel.count(), 1, '离线插件的旧关闭回调不能改变导航');
  await page.evaluate(() => window.fixture.managementConnection('connected', true));
  await panel.getByText('电脑连接已断开，重新连接后可继续操作。', { exact: true }).waitFor({ state: 'detached' });
  assert.equal(await pluginInput.inputValue(), '临时断线保留插件草稿');
  assert.equal(await pluginInput.isDisabled(), false);
  await page.evaluate(() => window.fixture.managementConnection('connected', false));
  await panel.getByText('请先在电脑端授予此设备管理权限，再查看或修改电脑设置。', { exact: true }).waitFor();
  assert.equal(await panel.getByRole('spinbutton').count(), 0);
  assert.equal(await pluginInput.count(), 0);
  await panel.getByRole('button', { name: '关闭窗口', exact: true }).click();
  await page.evaluate(() => window.fixture.removeSettingsSections());
  return { phoneAppearanceWithoutManagement: true, initialDenied: true, connectionNotice: true, grantedThenRevoked: true, contentRemoved: true, pluginDraftPreserved: true, offlineInert: true };
}
