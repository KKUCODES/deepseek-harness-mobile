import assert from 'node:assert/strict';
export async function checkToolCancellation(page) {
  await page.evaluate(async () => { window.fixture.locale('zh'); await window.fixture.select('one'); await window.fixture.enableOriginalTools(); window.fixture.interruptedTools(); });
  const before = page.locator('[data-chat-call-id="stopped-command"]');
  const during = page.locator('[data-chat-call-id="stopped-read"]');
  await before.getByText('已取消，工具尚未执行', { exact: true }).waitFor();
  await during.getByText('工具调用已停止', { exact: true }).waitFor();
  assert.equal(await before.locator('[data-state="stopped"]').count(), 1);
  assert.equal(await during.locator('[data-state="stopped"]').count(), 1);
  assert.equal(await before.getByText(/Error: tool call aborted/).count(), 0);
  await page.evaluate(() => { window.fixture.cancellationCases(); window.fixture.toolLocale('en'); });
  await before.getByText('Cancelled before the tool started', { exact: true }).waitFor();
  await during.getByText('Tool call stopped', { exact: true }).waitFor();
  await page.locator('[data-chat-call-id="child-cancelled"]').getByText('Cancelled before the tool started', { exact: true }).waitFor();
  assert.ok(await page.locator('[data-chat-call-id="ordinary-failure"] [data-state="error"]').count() > 0);
  assert.equal(await page.locator('[data-chat-call-id="ordinary-failure"] [data-state="stopped"]').count(), 0);
  await page.locator('[data-chat-call-id="review-denied"]').getByText('Rejected by Auto review', { exact: true }).waitFor();
  const partial = page.locator('[data-chat-call-id="cancel-partial"]');
  await partial.getByText('Tool call stopped', { exact: true }).click();
  await partial.getByText(/PARTIAL_OUTPUT_RETAINED/).waitFor();
  await page.evaluate(() => window.fixture.toolLocale('zh'));
  const failedNode = page.locator('[data-chat-flow-key]').filter({ has: page.locator('[data-chat-call-id="ordinary-failure"]') });
  const detailsButton = failedNode.getByRole('button', { name: '工具详情', exact: true });
  assert.equal(await detailsButton.evaluate(el => !!el.closest('[data-plugin-frame]')), false);
  await detailsButton.click();
  const details = page.getByRole('dialog', { name: '工具详情', exact: true });
  await details.getByText('Error: tool call aborted', { exact: true }).waitFor();
  assert.equal(await details.locator('details').first().getAttribute('open'), '');
  await details.getByRole('button', { name: '关闭工具详情', exact: true }).click();
  await page.evaluate(() => window.fixture.disableOriginalTools());
  await page.getByText('pwsh · 已停止 · 0.0 秒', { exact: true }).waitFor();
  // 备用工具记录展开也使用同一取消文案，原始英文错误不进入普通状态提示。
  await page.getByText('pwsh · 已停止 · 0.0 秒', { exact: true }).click();
  await page.locator('details').filter({ has: page.locator('summary').filter({ hasText: /^pwsh ·/ }) })
    .getByText('已取消，工具尚未执行', { exact: true }).waitFor();
  await page.evaluate(async () => { await window.fixture.enableOriginalTools(); await window.fixture.enableSidebarResources(); });
  await page.getByTestId('remote-workspace').getByRole('button', { name: 'Remote 选项', exact: true }).click();
  await page.getByRole('button', { name: '子会话', exact: true }).click();
  await page.getByRole('dialog', { name: '子会话', exact: true }).getByRole('group', { name: '分析助手', exact: true })
    .getByRole('button', { name: '在旁栏打开', exact: true }).click();
  const aside = page.getByTestId('remote-sidebar-conversation').filter({ visible: true });
  await aside.getByRole('textbox', { name: '消息', exact: true }).waitFor();
  await page.evaluate(() => window.fixture.interruptedTools('child-chat'));
  await aside.locator('[data-chat-call-id="stopped-command"]').getByText('已取消，工具尚未执行', { exact: true }).waitFor();
  await aside.locator('[data-chat-call-id="stopped-read"]').getByText('工具调用已停止', { exact: true }).waitFor();
  assert.equal(await aside.locator('[data-state="error"]').count(), 0);
  assert.equal((await page.evaluate(() => window.fixture.sidebarState())).selected, 'one');
  await aside.locator('[data-chat-flow-key]').filter({ has: page.locator('[data-chat-call-id="stopped-read"]') })
    .getByRole('button', { name: '工具详情', exact: true }).click();
  await page.getByRole('dialog', { name: '工具详情', exact: true }).getByText('工具调用已停止', { exact: true }).waitFor();
  await page.getByRole('button', { name: '关闭工具详情', exact: true }).click();
  await page.evaluate(() => window.fixture.disableOriginalTools());
  await aside.getByText('pwsh · 已停止 · 0.0 秒', { exact: true }).click();
  await aside.getByText('已取消，工具尚未执行', { exact: true }).waitFor();
  await page.reload(); await page.waitForFunction(() => !!window.fixture);
  return { originalPlugin: true, beforeDispatch: true, duringExecution: true, fallbackDetails: true, nested: true,
    sidebar: true, sidebarFallback: true, unscaledDetails: true, sidebarDetails: true, language: true, realDenialUnchanged: true, ordinaryErrorUnchanged: true, partialOutputPreserved: true };
}
