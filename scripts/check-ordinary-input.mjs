import assert from 'node:assert/strict';

export async function checkOrdinaryInput(page) {
  const editor = page.getByRole('textbox', { name: '普通聊天消息', exact: true });
  const history = page.getByRole('combobox', { name: '普通聊天历史' });
  const initial = await history.inputValue();
  const waitBound = () => page.waitForFunction(() => window.dshmValidation.ordinaryInput.snapshot().bindings === 1);
  await page.getByTestId('ordinary-new').click();
  await page.waitForFunction(id => document.querySelector('select[aria-label="普通聊天历史"]').value !== id, initial);
  const first = await history.inputValue();
  await waitBound();
  const composer = page.getByTestId('ordinary-composer');
  await editor.fill('/总');
  await composer.getByRole('option', { name: '总结', exact: true }).click();
  assert.equal(await editor.inputValue(), '请总结下面的内容：');
  await editor.fill('/tra');
  await composer.getByRole('option', { name: /翻译/ }).waitFor();
  await editor.press('Enter');
  assert.equal(await editor.inputValue(), '请翻译以下内容：');
  await editor.fill('/总');
  await composer.getByRole('option', { name: '总结', exact: true }).waitFor();
  await page.evaluate(() => {
    const binding = [...window.dshmValidation.ordinaryInput.bindings.values()][0];
    window.ordinaryInputOldProbe = { binding, span: binding.controller.menu.getSnapshot().hit.span };
  });
  await editor.fill('后来编辑的真实草稿');
  assert.notEqual(await page.evaluate(() => {
    const { binding, span } = window.ordinaryInputOldProbe;
    return binding.ctx.bail(binding.ctx, 'slash/input-insert-text', { span, text: '不应写入' });
  }), true);
  assert.equal(await editor.inputValue(), '后来编辑的真实草稿');
  await page.getByTestId('ordinary-new').click();
  await page.waitForFunction(id => document.querySelector('select[aria-label="普通聊天历史"]').value !== id, first);
  const second = await history.inputValue();
  await waitBound();
  await editor.fill('另一聊天的草稿');
  assert.notEqual(await page.evaluate(() => {
    const { binding, span } = window.ordinaryInputOldProbe;
    return binding.ctx.bail(binding.ctx, 'slash/input-insert-text', { span, text: '不能跨聊天' });
  }), true);
  assert.equal(await editor.inputValue(), '另一聊天的草稿');
  await history.selectOption(first);
  await page.waitForFunction(() => document.querySelector('textarea[aria-label="普通聊天消息"]').value === '后来编辑的真实草稿');
  for (let i = 0; i < 5; i++) {
    await editor.fill('/总');
    await composer.getByRole('option', { name: '总结', exact: true }).waitFor();
    await page.getByTestId('ordinary-source-toggle').click();
    await page.waitForFunction(() => window.dshmValidation.ordinaryInput.snapshot().subscriptions === 0);
    assert.equal(await composer.locator('[data-trigger-menu]').count(), 0);
    await page.getByTestId('ordinary-source-toggle').click();
    await page.getByTestId('ordinary-input-toggle').click();
    await page.getByRole('button', { name: '加载输入插件', exact: true }).waitFor();
    const absent = await page.evaluate(() => window.dshmValidation.ordinaryInput.snapshot());
    assert.equal(absent.bindings, 0); assert.equal(absent.subscriptions, 0); assert.equal(absent.rootSessionsAbsent, true);
    assert.equal(await composer.locator('[data-trigger-menu]').count(), 0);
    assert.equal(await editor.inputValue(), '/总');
    await editor.fill('卸载时仍可编辑');
    await page.getByTestId('ordinary-input-toggle').click();
    await page.getByRole('button', { name: '卸载输入插件', exact: true }).waitFor();
    await waitBound();
    assert.equal(await editor.inputValue(), '卸载时仍可编辑');
    assert.equal((await page.evaluate(() => window.dshmValidation.ordinaryInput.snapshot())).subscriptions, 1);
  }
  await editor.fill('/总');
  await composer.getByRole('option', { name: '总结', exact: true }).click();
  await page.reload();
  await editor.waitFor();
  await page.waitForFunction(() => document.querySelector('textarea[aria-label="普通聊天消息"]').value === '请总结下面的内容：');
  for (const id of [first, second]) {
    await history.selectOption(id);
    await page.getByRole('button', { name: '删除当前聊天', exact: true }).click();
    await page.getByRole('button', { name: '确认删除', exact: true }).click();
    await page.waitForFunction(id => ![...document.querySelector('select[aria-label="普通聊天历史"]').options].some(item => item.value === id), id);
  }
  await history.selectOption(initial);
  return { originalEntryAndSlot: true, realDraftReload: true, staleRejected: true, crossChatRejected: true,
    sourceAndPluginCycles: 5, rootHostServiceAbsent: true };
}
