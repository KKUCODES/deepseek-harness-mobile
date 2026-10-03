import assert from 'node:assert/strict';

export async function checkRemoteEmptyFactory(page) {
  await page.evaluate(async () => { await window.fixture.enableSidebarResources(); await window.fixture.select('one'); await window.fixture.enableFactoryEmptyProbe(); });
  const main = page.getByTestId('remote-workspace'), panel = page.getByRole('region', { name: '插件面板', exact: true });
  await main.getByRole('button', { name: 'Remote 选项', exact: true }).click();
  await main.getByRole('button', { name: '子会话', exact: true }).click();
  await page.getByRole('dialog', { name: '子会话', exact: true }).getByRole('group', { name: '分析助手', exact: true })
    .getByRole('button', { name: '在旁栏打开', exact: true }).click();
  const empty = panel.getByTestId('remote-empty-conversation'); await empty.waitFor();
  assert.equal(await empty.getByTestId('empty-brand').getAttribute('data-size'), '34');
  assert.equal(await empty.getByRole('textbox', { name: '消息', exact: true }).isDisabled(), true);
  assert.equal(await empty.getByRole('button', { name: '发送消息', exact: true }).isDisabled(), true);
  assert.equal(await panel.getByTestId('remote-sidebar-conversation').count(), 0);
  await empty.getByRole('button', { name: '选择工作区', exact: true }).click();
  const picker = page.getByRole('dialog', { name: '选择工作区', exact: true }); await picker.waitFor();
  await picker.getByText('电脑还没有工作区，请先在电脑添加。', { exact: true }).waitFor();
  await page.evaluate(() => window.fixture.workspaceRows([window.fixture.factoryWorkspaceCandidate()]));
  await page.evaluate(() => window.fixture.failFactoryWorkspaceOnce());
  await picker.getByRole('button', { name: '联调工作区', exact: true }).click();
  await picker.waitFor({ state: 'detached' });
  await empty.getByRole('alert').getByText('测试工作区暂时不可用', { exact: true }).waitFor();
  await empty.getByRole('button', { name: '选择工作区', exact: true }).click();
  await picker.getByRole('button', { name: '联调工作区', exact: true }).click();
  await panel.waitFor({ state: 'hidden' });
  await main.locator('.remote-heading strong').getByText('agent-blank', { exact: true }).waitFor();
  await main.getByRole('textbox', { name: '消息', exact: true }).waitFor();
  await page.evaluate(async () => { await window.fixture.disableFactoryProbe(); await window.fixture.select('one'); window.fixture.workspaceRows([]); });
  if (!await panel.isVisible()) {
    await main.getByRole('button', { name: 'Remote 选项', exact: true }).click();
    await main.getByRole('button', { name: '插件面板', exact: true }).click();
  }
  await panel.getByRole('button', { name: '面板操作', exact: true }).click();
  await page.getByRole('menuitem', { name: '关闭当前面板', exact: true }).click();
  if (await panel.isVisible()) await panel.getByRole('button', { name: '返回聊天', exact: true }).click();
  return { noSession: true, noInputOrSend: true, brandSlot: true, emptyWorkspace: true, failureRetry: true, existingBlankSession: true };
}
