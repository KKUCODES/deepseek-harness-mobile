import assert from 'node:assert/strict';

export async function checkManagementStatus(page) {
  await page.evaluate(async () => {
    await window.fixture.select('two');
    window.fixture.settingsGrant(true); window.fixture.workspaceGrant(true);
    window.fixture.workspaceRows([{ workspaceId: 'A', title: 'A', path: '/fixture/A', sessionIds: ['two'], createdAt: '2026-09-24T00:00:00Z', updatedAt: '2026-09-24T00:00:00Z' }]);
    window.fixture.managementConnection('connected');
  });
  const open = async name => {
    await page.getByRole('button', { name: 'Remote 选项', exact: true }).click();
    await page.getByRole('button', { name, exact: true }).click();
  };
  const set = (state, allowed = true) => page.evaluate(([state, allowed]) => window.fixture.managementConnection(state, allowed), [state, allowed]);
  const offline = async panel => {
    for (const state of ['disconnected', 'connecting']) {
      await set(state);
      await panel.getByText(state === 'connecting' ? '正在连接电脑…' : '电脑连接已断开，重新连接后可继续操作。', { exact: true }).waitFor();
      assert.equal(await panel.getByText(/请.*授予.*管理权限|请更新电脑/).count(), 0);
    }
  };
  await open('电脑设置');
  const settings = page.getByRole('dialog', { name: '电脑设置', exact: true });
  const limit = settings.getByRole('spinbutton', { name: '单次回复上限（Token）' });
  await limit.fill('2468');
  const endpoint = settings.getByRole('region', { name: '电脑模型服务地址', exact: true });
  const address = endpoint.getByRole('textbox', { name: '新的完整服务地址' });
  await address.fill('https://unsaved.example/api');
  await endpoint.getByRole('button', { name: '核对新地址', exact: true }).click();
  await offline(settings);
  assert.equal(await limit.inputValue(), '2468'); assert.equal(await limit.isDisabled(), true);
  assert.equal(await endpoint.getByRole('group', { name: '确认服务地址' }).count(), 1);
  assert.equal(await endpoint.getByRole('button', { name: '确认更改服务地址', exact: true }).isDisabled(), true);
  await set('connected');
  assert.equal(await limit.inputValue(), '2468');
  await endpoint.getByRole('button', { name: '取消更改地址', exact: true }).click();
  assert.equal(await address.inputValue(), 'https://unsaved.example/api');
  assert.equal((await page.evaluate(() => window.fixture.endpointWrites())).length, 0);
  assert.equal((await page.evaluate(() => window.fixture.settingsRequests())).filter(request => request.method === 'remote.settingsWrite').length, 0);
  await set('connected', false);
  await settings.getByText('请先在电脑端授予此设备管理权限，再查看或修改电脑设置。', { exact: true }).waitFor();
  assert.equal(await limit.count(), 0);
  await settings.getByRole('button', { name: '关闭窗口', exact: true }).click();

  await set('connected'); await open('管理工作区');
  const workspaces = page.getByRole('dialog', { name: '管理工作区', exact: true });
  await workspaces.getByRole('button', { name: 'A', exact: true }).click();
  await workspaces.getByRole('button', { name: '重命名工作区', exact: true }).click();
  await workspaces.getByRole('textbox', { name: '工作区名称', exact: true }).fill('未提交的名称');
  await offline(workspaces);
  assert.equal(await workspaces.getByRole('button', { name: '保存工作区名称', exact: true }).count(), 0);
  await set('connected');
  await workspaces.getByRole('textbox', { name: '工作区名称', exact: true }).waitFor();
  assert.equal(await workspaces.getByRole('textbox', { name: '工作区名称', exact: true }).inputValue(), '未提交的名称');
  assert.equal((await page.evaluate(() => window.fixture.workspaceWrites())).length, 0);
  await set('connected', false);
  await workspaces.getByText('请在电脑 DSH Mobile 插件中，为此设备授予管理权限。', { exact: true }).waitFor();
  await workspaces.getByRole('button', { name: '关闭窗口', exact: true }).click();

  await open('电脑插件');
  await page.getByRole('button', { name: '管理电脑插件', exact: true }).click();
  const plugins = page.getByRole('region', { name: '管理电脑插件', exact: true });
  await plugins.getByText('请在电脑 DSH Mobile 插件中，为此设备授予管理权限。', { exact: true }).waitFor();
  await offline(plugins);
  await set('connected', false);
  await plugins.getByText('请在电脑 DSH Mobile 插件中，为此设备授予管理权限。', { exact: true }).waitFor();
  await plugins.getByRole('button', { name: '返回', exact: true }).click();
  await page.getByRole('button', { name: '关闭窗口', exact: true }).click();
  return { threeEntries: true, reconnectPriority: true, settingDraft: true, endpointReviewDraft: true, workspaceDraft: true, noWrites: true, revokedAfterReconnect: true };
}
