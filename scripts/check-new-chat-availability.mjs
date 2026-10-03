import assert from 'node:assert/strict';

export async function checkNewChatAvailability(page) {
  await page.evaluate(async () => {
    await window.fixture.select('one');
    window.fixture.workspaceRows([{ workspaceId: 'A', title: 'A', path: '/fixture/A', sessionIds: ['one'], createdAt: '2026-09-24T00:00:00Z', updatedAt: '2026-09-24T00:00:00Z' }]);
  });
  const main = page.getByTestId('remote-workspace');
  const menu = () => main.getByRole('button', { name: 'Remote 选项', exact: true }).click();
  const close = () => page.getByRole('dialog').getByRole('button', { name: '关闭窗口', exact: true }).click();
  const set = state => page.evaluate(state => window.fixture.connectionState(state), state);
  const create = () => main.getByRole('button', { name: '新建聊天', exact: true });
  await main.getByRole('textbox', { name: '消息', exact: true }).fill('新建离线检查草稿');
  for (const state of ['disconnected', 'connecting']) {
    await set(state); await menu();
    assert.equal(await create().isDisabled(), true, `${state}: chat menu must block creation`);
    await close();
  }
  await set('connected'); await menu(); await create().click();
  const workspace = page.getByRole('dialog', { name: '选择工作区', exact: true }).getByRole('button', { name: 'A', exact: true });
  assert.equal(await workspace.isEnabled(), true);
  for (const state of ['disconnected', 'connecting']) {
    await set(state);
    assert.equal(await workspace.isDisabled(), true, `${state}: an already open picker must block creation`);
  }
  await set('connected'); assert.equal(await workspace.isEnabled(), true);
  await page.evaluate(() => window.fixture.holdCreate());
  await workspace.click();
  await page.waitForFunction(() => window.fixture.createCalls() === 1);
  assert.equal(await main.getByRole('button', { name: 'Remote 选项', exact: true }).isDisabled(), true);
  assert.equal(await workspace.isDisabled(), true);
  await page.evaluate(() => window.fixture.failCreate());
  await main.getByRole('alert').filter({ hasText: '测试创建失败' }).waitFor();
  assert.equal(await workspace.isEnabled(), true);
  assert.equal(await page.evaluate(() => window.fixture.sidebarState().selected), 'one');
  await close();
  assert.equal(await main.getByRole('textbox', { name: '消息', exact: true }).innerText(), '新建离线检查草稿');
  await main.getByRole('textbox', { name: '消息', exact: true }).fill('');
  await main.getByRole('button', { name: '返回', exact: true }).click();
  const home = main.getByRole('button', { name: '在已有工作区新建聊天', exact: true });
  for (const state of ['disconnected', 'connecting']) {
    await set(state); assert.equal(await home.isDisabled(), true, `${state}: home must block creation`);
    await menu(); assert.equal(await create().isDisabled(), true); await close();
  }
  await set('connected'); assert.equal(await home.isEnabled(), true);
  await page.evaluate(async () => { window.fixture.workspaceRows([]); await window.fixture.select('one'); });
  return { chatMenu: true, home: true, openPicker: true, disconnected: true, connecting: true, reconnect: true, pendingMenuBlocked: true, failedCreateRetainsChat: true, draftPreserved: true };
}
