import assert from 'node:assert/strict';

/** 正式 Android 入口：仅在 DSH-TEST 的专用新会话选择极简模式。 */
export async function verifyRemoteAgentPresets(page) {
  const create = process.env.DSHM_AGENT_NEW_NAME, existing = process.env.DSHM_AGENT_CHAT;
  const expected = process.env.DSHM_AGENT_EXPECT;
  for (const title of [create, existing].filter(Boolean)) assert.match(title, /^DSHM 模式联调 /);
  assert.ok(!(create && existing));
  const original = (await page.getByTestId('remote-workspace').locator('.remote-heading').innerText()).split('\n')[0];
  const menu = () => page.getByRole('button', { name: 'Remote 选项', exact: true }).click();
  if (create) {
    assert.equal(process.env.DSHM_RUN_LIVE, '1');
    await menu(); await page.getByRole('button', { name: '新建聊天', exact: true }).click();
    await page.getByRole('dialog', { name: '选择工作区', exact: true }).getByRole('button', { name: 'DSH-TEST', exact: true }).click();
    await page.getByRole('dialog', { name: '选择工作区', exact: true }).waitFor({ state: 'detached' });
    await menu(); await page.getByRole('button', { name: '重命名聊天', exact: true }).click();
    await page.getByRole('textbox', { name: '聊天名称', exact: true }).fill(create);
    await page.getByRole('button', { name: '保存名称', exact: true }).click();
    await page.getByRole('dialog', { name: '重命名聊天', exact: true }).waitFor({ state: 'detached' });
  } else if (existing) {
    await page.getByRole('button', { name: '返回', exact: true }).click();
    await page.getByRole('button', { name: new RegExp(`^${existing}`) }).click();
  }
  await menu(); await page.getByRole('button', { name: 'Agent 模式', exact: true }).click();
  const sheet = page.getByRole('dialog', { name: 'Agent 模式', exact: true });
  await sheet.locator('button[aria-pressed="true"]').waitFor();
  const before = await sheet.locator('button[aria-pressed="true"]').getAttribute('aria-label');
  const choices = await sheet.locator('button[aria-pressed]').evaluateAll(buttons => buttons.map(button => button.getAttribute('aria-label')));
  if (create) {
    await sheet.getByRole('button', { name: '极简模式', exact: true }).click();
    await sheet.getByRole('button', { name: '极简模式', exact: true }).and(sheet.locator('[aria-pressed="true"]')).waitFor();
  }
  if (expected) await sheet.getByRole('button', { name: expected, exact: true }).and(sheet.locator('[aria-pressed="true"]')).waitFor();
  const after = await sheet.locator('button[aria-pressed="true"]').getAttribute('aria-label');
  await page.screenshot({ path: 'artifacts/remote-agent-presets-android.png' });
  await sheet.getByRole('button', { name: '关闭窗口', exact: true }).click();
  if (create) {
    const input = page.getByRole('textbox', { name: '消息', exact: true }); assert.equal(await input.inputValue(), '');
    await input.fill('这是 DSHM Agent 模式联调，只回复 DSHM_AGENT_MODE_READY，不调用任何工具。');
    await page.getByRole('button', { name: '发送消息', exact: true }).click();
    await page.getByRole('article', { name: '模型回复' }).filter({ hasText: 'DSHM_AGENT_MODE_READY' }).waitFor({ timeout: 60000 });
    await page.getByRole('button', { name: '停止生成', exact: true }).waitFor({ state: 'detached' });
  }
  await menu(); await page.getByRole('button', { name: 'Agent 模式', exact: true }).click();
  await sheet.getByText('本次聊天已开始，模式不能更换。', { exact: true }).waitFor();
  assert.equal(await sheet.getByRole('button', { name: '标准模式', exact: true }).isEnabled(), false);
  await sheet.getByRole('button', { name: '关闭窗口', exact: true }).click();
  if (create || existing) {
    await page.getByRole('button', { name: '返回', exact: true }).click();
    await page.getByRole('button', { name: new RegExp(`^${original}`) }).click();
  }
  return { chat: create || existing || original, before, after, choices, lockedAfterStart: true, sent: !!create };
}
