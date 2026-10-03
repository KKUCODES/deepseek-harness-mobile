import assert from 'node:assert/strict';

// 使用完整 RemoteWorkspace 及真实编辑器，覆盖可切换模型与只读子会话两条入口。
export async function checkModelAccessibilityLabels(page) {
  await page.evaluate(async () => { await window.fixture.select('one'); window.fixture.toolLocale('en'); });
  let editor = page.getByRole('textbox', { name: 'Message', exact: true });
  await editor.fill('保留中文草稿');
  await page.evaluate(() => window.fixture.modelProjection('one', { provider: 'fixture', model: '根模型' }));
  await page.getByRole('button', { name: 'Choose model, current: 根模型', exact: true }).waitFor();
  await page.evaluate(() => window.fixture.toolLocale('zh'));
  editor = page.getByRole('textbox', { name: '消息', exact: true });
  await editor.focus();
  await page.getByRole('button', { name: '选择模型，当前 根模型', exact: true }).waitFor();
  assert.equal(await editor.innerText(), '保留中文草稿');
  await page.getByRole('button', { name: 'Remote 选项', exact: true }).click();
  await page.getByRole('button', { name: '子会话', exact: true }).click();
  await page.getByRole('dialog', { name: '子会话', exact: true }).getByRole('button', { name: /分析助手/ }).click();
  await page.evaluate(() => { window.fixture.modelProjection('child-chat', { provider: 'fixture', model: '子模型' }); window.fixture.toolLocale('en'); });
  await page.getByRole('textbox', { name: 'Message', exact: true }).focus();
  const view = page.getByRole('button', { name: 'View model, current: 子模型', exact: true });
  await view.waitFor();
  await page.evaluate(() => window.fixture.toolLocale('zh'));
  await page.getByRole('textbox', { name: '消息', exact: true }).focus();
  await page.getByRole('button', { name: '查看模型，当前 子模型', exact: true }).waitFor();
  await page.evaluate(() => window.fixture.toolLocale('en'));
  await page.getByRole('textbox', { name: 'Message', exact: true }).focus();
  await view.click();
  const sheet = page.getByRole('dialog', { name: 'Current model', exact: true });
  await sheet.waitFor();
  assert.equal(await sheet.locator('button.option:enabled').count(), 0);
  await sheet.getByRole('button', { name: 'Close', exact: true }).click();
  return { parentBilingual: true, childBilingual: true, namesPreserved: true, childReadOnly: true, parentDraftPreserved: true };
}
