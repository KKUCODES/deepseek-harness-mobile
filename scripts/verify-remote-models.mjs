import assert from 'node:assert/strict';

/** 仅通过正式手机界面验证；电脑反向切换由内置浏览器操作后再运行 expect。 */
export async function verifyRemoteModels(page) {
  const select = process.env.DSHM_MODEL_SELECT, effort = process.env.DSHM_MODEL_EFFORT;
  const expected = process.env.DSHM_MODEL_EXPECT;
  if (select || effort) assert.equal(process.env.DSHM_RUN_LIVE, '1', 'Model changes require DSHM_RUN_LIVE=1');
  const input = page.getByRole('textbox', { name: '消息', exact: true });
  const draft = await input.inputValue();
  const button = page.getByRole('button', { name: /^选择模型，当前 / });
  const sheet = page.getByRole('dialog', { name: '选择模型', exact: true });
  const open = async () => { await input.focus(); await button.click(); await sheet.waitFor(); };
  const values = async () => sheet.locator('button[aria-pressed="true"]').allTextContents();
  await open();
  if (expected) await sheet.getByRole('button', { name: expected, exact: true }).and(sheet.locator('[aria-pressed="true"]')).waitFor();
  const before = await values();
  const choices = await sheet.locator('button[aria-pressed]').allTextContents();
  if (select) {
    await sheet.getByRole('button', { name: select, exact: true }).click();
    await sheet.waitFor({ state: 'detached' });
    await open();
    await sheet.getByRole('button', { name: select, exact: true }).and(sheet.locator('[aria-pressed="true"]')).waitFor();
  }
  if (effort) {
    await sheet.getByRole('button', { name: effort, exact: true }).click();
    await sheet.waitFor({ state: 'detached' });
    await open();
    await sheet.getByRole('button', { name: effort, exact: true }).and(sheet.locator('[aria-pressed="true"]')).waitFor();
  }
  const after = await values(), label = await button.getAttribute('aria-label');
  await page.screenshot({ path: 'artifacts/remote-models-android.png' });
  await sheet.getByRole('button', { name: '关闭窗口', exact: true }).click();
  assert.equal(await input.inputValue(), draft);
  return { before, after, choices, label, expected, select, effort, draftPreserved: true };
}
