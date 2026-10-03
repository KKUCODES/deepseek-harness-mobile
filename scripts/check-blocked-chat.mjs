import assert from 'node:assert/strict';

export async function checkBlockedChat(page) {
  await page.evaluate(async () => { await window.fixture.enableSidebarResources(); await window.fixture.select('one'); });
  const main = page.getByTestId('remote-workspace');
  await main.getByRole('textbox', { name: '消息', exact: true }).fill('主聊天草稿');
  await page.evaluate(() => window.fixture.emitBlocked('one', 1, 0));
  const zh = '本轮任务受阻，未继续执行。', en = 'This turn was blocked and did not continue.';
  await main.getByRole('status').filter({ hasText: zh }).waitFor();
  await main.getByRole('button', { name: 'Remote 选项', exact: true }).click();
  await page.getByRole('button', { name: '子会话', exact: true }).click();
  await page.getByRole('dialog', { name: '子会话', exact: true }).getByRole('group', { name: '分析助手', exact: true })
    .getByRole('button', { name: '在旁栏打开', exact: true }).click();
  const aside = page.getByTestId('remote-sidebar-conversation').filter({ visible: true });
  await aside.getByRole('textbox', { name: '消息', exact: true }).fill('旁栏草稿');
  await page.evaluate(() => window.fixture.emitBlocked('child-chat', 1, 0));
  await aside.getByRole('status').filter({ hasText: zh }).waitFor();
  await page.evaluate(() => window.fixture.toolLocale('en'));
  await main.getByRole('status').filter({ hasText: en }).waitFor();
  await aside.getByRole('status').filter({ hasText: en }).waitFor();
  assert.equal(await aside.getByRole('textbox', { name: 'Message', exact: true }).innerText(), '旁栏草稿');
  assert.equal(await page.locator('[data-turn-blocked]').count(), 2);
  await page.getByRole('button', { name: 'Back to chat', exact: true }).click();
  assert.equal(await main.getByRole('textbox', { name: 'Message', exact: true }).innerText(), '主聊天草稿');
  return { main: true, sidebar: true, chineseAndEnglish: true, independentDraftsPreserved: true };
}
