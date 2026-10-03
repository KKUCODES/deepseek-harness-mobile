import assert from 'node:assert/strict';

/** 经原 ModuleLoader 卸载真实主题，核对其 DOM 生命周期及旁边业务视图的状态。 */
export async function checkTheme(page) {
  const read = () => page.evaluate(() => ({
    ...window.dshmValidation.snapshot(),
    dark: document.body.hasAttribute('data-ds-dark-theme'),
    fontSize: document.body.style.getPropertyValue('--dsh-content-font-size'),
    source: document.documentElement.getAttribute('data-ds-theme-source'),
    colorScheme: document.documentElement.style.colorScheme,
    themeMetas: document.querySelectorAll('meta[name="theme-color"]').length,
  }));
  const initial = await read();
  assert.ok(initial.themeStyles > 0);
  assert.equal(initial.themeMetas, 1);
  const draft = await page.getByRole('textbox', { name: '输入增强验证草稿', exact: true }).inputValue();
  const streamStatus = await page.getByTestId('stream-status').innerText();
  const streamContent = await page.getByTestId('stream-content').innerText();

  for (let index = 0; index < 20; index++) {
    await page.getByTestId('theme-toggle').click();
    await page.getByRole('button', { name: '重新加载主题插件', exact: true }).waitFor();
    await page.waitForFunction(() => !window.dshmValidation.snapshot().themeLifecycle.active);
    const unloaded = await read();
    assert.equal(unloaded.themeStyles, 0);
    assert.equal(unloaded.themeMetas, 0);
    assert.equal(unloaded.dark, false);
    assert.equal(unloaded.source, null);
    assert.equal(unloaded.colorScheme, '');
    assert.equal(unloaded.fontSize, '');
    assert.equal(unloaded.themeLifecycle.disposals, initial.themeLifecycle.disposals + index + 1);
    assert.equal(await page.getByRole('button', { name: '深色', exact: true }).count(), 0);
    assert.equal(await page.getByRole('button', { name: '增大字号', exact: true }).count(), 0);
    await page.getByRole('button', { name: '中文', exact: true }).waitFor();
    assert.deepEqual(unloaded.settings.value, initial.settings.value);
    assert.deepEqual(unloaded.failures, []);

    await page.getByTestId('theme-toggle').click();
    await page.getByRole('button', { name: '卸载主题插件', exact: true }).waitFor();
    await page.waitForFunction(() => document.body.hasAttribute('data-ds-dark-theme'));
    const restored = await read();
    assert.equal(restored.themeStyles, initial.themeStyles);
    assert.equal(restored.themeMetas, 1);
    assert.equal(restored.fontSize, '15px');
    assert.equal(restored.themeLifecycle.mounts, initial.themeLifecycle.mounts + index + 1);
    assert.equal(await page.getByRole('button', { name: '深色', exact: true }).count(), 1);
    assert.equal(await page.getByRole('button', { name: '增大字号', exact: true }).count(), 1);

    // 同一设置变化只应投影一次，重载不能留下额外的 presenter 监听。
    await page.getByRole('button', { name: '浅色', exact: true }).click();
    await page.waitForFunction(() => !document.body.hasAttribute('data-ds-dark-theme'));
    assert.equal((await read()).themeLifecycle.applies, restored.themeLifecycle.applies + 1);
    await page.getByRole('button', { name: '深色', exact: true }).click();
    await page.waitForFunction(() => document.body.hasAttribute('data-ds-dark-theme'));
    assert.equal((await read()).themeLifecycle.applies, restored.themeLifecycle.applies + 2);
    assert.equal(await page.getByRole('textbox', { name: '输入增强验证草稿', exact: true }).inputValue(), draft);
    assert.equal(await page.getByTestId('stream-status').innerText(), streamStatus);
    assert.equal(await page.getByTestId('stream-content').innerText(), streamContent);
  }
  return { cycles: 20, originalStyles: initial.themeStyles, final: await read(),
    verified: ['original theme styles and settings slots unload/reload', 'presenter DOM and metadata cleaned', 'saved theme restored', 'one DOM update per setting change', 'draft and stream state preserved'] };
}
