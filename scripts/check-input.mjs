import assert from 'node:assert/strict';

/** 同一组操作用于 Edge 和 APK 内的 Android WebView；IME 使用 CDP 组合输入协议。 */
export async function checkInput(page) {
  const editor = page.getByRole('textbox', { name: '输入增强验证草稿', exact: true });
  await editor.fill('/总');
  await page.getByRole('option', { name: '总结', exact: true }).click();
  assert.equal(await editor.inputValue(), '请总结下面的内容：');
  await editor.fill('/tra');
  await page.getByRole('option', { name: /翻译/ }).waitFor();
  await editor.press('Enter');
  assert.equal(await editor.inputValue(), '请翻译以下内容：');

  await editor.fill('/总');
  await page.getByRole('option', { name: '总结', exact: true }).waitFor();
  const staleSpan = await page.evaluate(() => window.dshmInputValidation.controller.menu.getSnapshot().hit.span);
  await editor.fill('这是后来编辑的新草稿');
  // 重放原控制器刚刚产生的旧请求，验证实际 Cordis 写入口的 CAS，而非只测按钮。
  const accepted = await page.evaluate(span => {
    const runtime = window.dshmInputValidation;
    return runtime.context.bail(runtime.context, 'slash/input-insert-text', { span, text: '不应覆盖' });
  }, staleSpan);
  assert.notEqual(accepted, true);
  assert.equal(await editor.inputValue(), '这是后来编辑的新草稿');

  await editor.fill('/总');
  await page.getByRole('option', { name: '总结', exact: true }).waitFor();
  for (let index = 0; index < 20; index++) {
    await page.getByTestId('input-source-toggle').click();
    await page.getByRole('button', { name: '启用提示词源', exact: true }).waitFor();
    assert.equal(await page.locator('[data-trigger-menu]').count(), 0);
    assert.equal(await page.evaluate(() => window.dshmInputValidation.snapshot().subscriptions), 0);
    await page.getByTestId('input-source-toggle').click();
    await page.getByRole('button', { name: '停用提示词源', exact: true }).waitFor();
    assert.equal(await page.evaluate(() => window.dshmInputValidation.snapshot().subscriptions), 1);
  }

  await editor.fill('');
  await editor.focus();
  const cdp = await page.context().newCDPSession(page);
  try {
    await cdp.send('Input.imeSetComposition', { text: '/总', selectionStart: 2, selectionEnd: 2 });
    await page.waitForFunction(() => window.dshmInputValidation.snapshot().composing);
    assert.equal(await page.locator('[data-trigger-menu]').count(), 0);
    assert.equal(await editor.inputValue(), '/总');
    await cdp.send('Input.insertText', { text: '/总' });
    await page.waitForFunction(() => !window.dshmInputValidation.snapshot().composing);
    await page.getByRole('option', { name: '总结', exact: true }).waitFor();
    await page.getByRole('option', { name: '总结', exact: true }).click();
    assert.equal(await editor.inputValue(), '请总结下面的内容：');
  } finally { await cdp.detach(); }
  const result = await page.evaluate(() => window.dshmInputValidation.snapshot());
  assert.equal(result.applied, 3);
  assert.equal(result.rejected, 1);
  return { ...result, sourceCycles: 20, imeMethod: 'CDP composition protocol; NOT a physical Chinese keyboard test' };
}
