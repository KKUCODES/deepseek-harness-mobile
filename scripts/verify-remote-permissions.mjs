import assert from 'node:assert/strict';

/** 正式 Android 页面验收。新会话仅在 DSH-TEST；自动写入只允许收紧为只读。 */
export async function verifyRemotePermissions(page) {
  const create = process.env.DSHM_PERMISSION_NEW_NAME, existing = process.env.DSHM_PERMISSION_CHAT;
  const expected = process.env.DSHM_PERMISSION_EXPECT, reduce = process.env.DSHM_PERMISSION_READ_ONLY === '1';
  if (create || reduce) assert.equal(process.env.DSHM_RUN_LIVE, '1');
  for (const title of [create, existing].filter(Boolean)) assert.match(title, /^DSHM 权限联调 /);
  assert.ok(!(create && existing));
  const originalTitle = (await page.getByTestId('remote-workspace').locator('.remote-heading').innerText()).split('\n')[0];
  const menu = async () => page.getByRole('button', { name: 'Remote 选项', exact: true }).click();
  if (existing) {
    await page.getByRole('button', { name: '返回', exact: true }).click();
    await page.getByRole('button', { name: new RegExp(`^${existing}`) }).click();
  }
  if (create) {
    await menu(); await page.getByRole('button', { name: '新建聊天', exact: true }).click();
    await page.getByRole('dialog', { name: '选择工作区', exact: true }).getByRole('button', { name: 'DSH-TEST', exact: true }).click();
    await page.getByRole('dialog', { name: '选择工作区', exact: true }).waitFor({ state: 'detached' });
    await menu(); await page.getByRole('button', { name: '重命名聊天', exact: true }).click();
    await page.getByRole('textbox', { name: '聊天名称', exact: true }).fill(create);
    await page.getByRole('button', { name: '保存名称', exact: true }).click();
    await page.getByRole('dialog', { name: '重命名聊天', exact: true }).waitFor({ state: 'detached' });
  }
  const input = page.getByRole('textbox', { name: '消息', exact: true }), draft = await input.inputValue();
  if (process.env.DSHM_PERMISSION_SEED === '1') {
    assert.equal(process.env.DSHM_RUN_LIVE, '1'); assert.ok(create || existing); assert.equal(draft, '');
    const history = page.getByRole('region', { name: '聊天内容', exact: true });
    assert.equal(await history.getByRole('article', { name: '模型回复' }).count(), 0);
    await input.fill('这是 DSHM 权限同步验证，只回复 DSHM_PERMISSION_READY，不调用任何工具。');
    await page.getByRole('button', { name: '发送消息', exact: true }).click();
    await history.getByRole('article', { name: '模型回复' }).filter({ hasText: 'DSHM_PERMISSION_READY' }).waitFor({ timeout: 60000 });
    await page.getByRole('button', { name: '停止生成', exact: true }).waitFor({ state: 'detached' });
  }
  await menu(); await page.getByRole('button', { name: '会话权限', exact: true }).click();
  const sheet = page.getByRole('dialog', { name: '会话权限', exact: true });
  const current = () => sheet.locator('button[aria-pressed="true"]').innerText();
  await sheet.locator('button[aria-pressed="true"]').waitFor();
  const before = await current();
  assert.equal(await sheet.getByRole('button', { name: '仅可查看', exact: true }).isEnabled(), true, 'requires current gateway/plugin');
  const choices = await sheet.locator('button[aria-pressed]').allTextContents();
  const labels = await sheet.locator('.remote-permission-option').evaluateAll(buttons => buttons.map(button => {
    const label = button.querySelector('strong'), parent = getComputedStyle(button), text = getComputedStyle(label);
    return { colorMatches: parent.color === text.color, fontMatches: parent.fontSize === text.fontSize };
  }));
  assert.ok(labels.every(label => label.colorMatches && label.fontMatches), '权限名称不能继承辅助说明的灰色小字样式');
  await sheet.getByRole('button', { name: '完全权限', exact: true }).click();
  assert.equal(await sheet.getByRole('button', { name: '启用完全权限', exact: true }).isEnabled(), false);
  await sheet.getByRole('checkbox').check();
  assert.equal(await sheet.getByRole('button', { name: '启用完全权限', exact: true }).isEnabled(), true);
  await page.screenshot({ path: 'artifacts/remote-permissions-confirm-android.png' });
  await sheet.getByRole('button', { name: '取消', exact: true }).click();
  assert.equal(await current(), before);
  if (reduce) {
    assert.ok(create || existing, 'Only disposable named test chats may change permissions');
    assert.match(before, /工作区内修改/);
    await sheet.getByRole('button', { name: '仅可查看', exact: true }).click();
    await sheet.getByRole('button', { name: '仅可查看', exact: true }).and(sheet.locator('[aria-pressed="true"]')).waitFor();
  }
  if (expected) await sheet.getByRole('button', { name: expected, exact: true }).and(sheet.locator('[aria-pressed="true"]')).waitFor();
  const after = await current();
  await page.screenshot({ path: 'artifacts/remote-permissions-android.png' });
  await sheet.getByRole('button', { name: '关闭窗口', exact: true }).click();
  assert.equal(await input.inputValue(), draft);
  if (create || existing) {
    await page.getByRole('button', { name: '返回', exact: true }).click();
    await page.getByRole('button', { name: new RegExp(`^${originalTitle}`) }).click();
  }
  return { chat: create || existing || originalTitle, before, after, choices, labels, confirmationCancelled: true, draftPreserved: true, reduced: reduce };
}
