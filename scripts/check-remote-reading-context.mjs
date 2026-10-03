import assert from 'node:assert/strict';

// 真实页面、原旁栏/Modal，原生桥只记录阅读位置，不伪造电脑通知事件。
export async function checkRemoteReadingContext(page) {
  await page.evaluate(async () => { await window.fixture.enableSidebarResources(); await window.fixture.select('one'); });
  const reading = value => page.waitForFunction(value => window.fixture.readingContexts().at(-1) === value, value);
  const main = page.getByTestId('remote-workspace');
  const aside = page.getByTestId('remote-sidebar-conversation').filter({ visible: true });
  const panel = page.getByRole('region', { name: '插件面板', exact: true });
  await reading('one');
  await main.getByRole('button', { name: 'Remote 选项', exact: true }).click();
  await reading(null);
  await page.getByRole('button', { name: '子会话', exact: true }).click();
  await page.getByRole('group', { name: '分析助手', exact: true }).getByRole('button', { name: '在旁栏打开', exact: true }).click();
  await aside.getByRole('textbox', { name: '消息', exact: true }).waitFor();
  await reading('child-chat');
  await aside.getByRole('button', { name: /^Agent 模式，当前/ }).click();
  const mode = aside.getByRole('dialog', { name: 'Agent 模式', exact: true });
  await mode.waitFor(); await reading(null);
  await page.evaluate(() => window.dshmHandleBack());
  await mode.waitFor({ state: 'detached' });
  assert.equal(await aside.isVisible(), true, '关闭旁栏内弹窗不能同时关闭旁栏');
  await reading('child-chat');
  await page.evaluate(() => window.fixture.enableReadingModal());
  await aside.getByRole('button', { name: '打开阅读验证弹窗', exact: true }).click();
  const modal = page.getByRole('dialog', { name: '阅读验证弹窗', exact: true });
  await modal.getByRole('textbox', { name: '阅读验证输入', exact: true }).fill('插件弹窗可输入');
  await reading(null);
  await page.evaluate(() => window.dshmHandleBack());
  await modal.waitFor({ state: 'detached' });
  await reading('child-chat');
  assert.equal(await aside.isVisible(), true);
  await panel.getByRole('button', { name: '面板操作', exact: true }).click();
  await page.getByRole('menuitem', { name: '关闭当前面板', exact: true }).click();
  await aside.waitFor({ state: 'detached' });
  await reading('one');
  await main.getByRole('button', { name: 'Remote 选项', exact: true }).click();
  await page.getByRole('button', { name: '插件面板', exact: true }).click();
  await reading(null);
  await panel.getByRole('button', { name: '返回聊天', exact: true }).click();
  await reading('one');
  await page.evaluate(() => window.fixture.removeReadingModal());
  return { mainAndSidebarIdentity: true, nativeSheetSuspendsReading: true,
    originalPluginModalSuspendsReading: true, modalBackKeepsSidebar: true, guideSuspendsReading: true, closingRestoresReading: true };
}
