import assert from 'node:assert/strict';

/** 原工具详情入口与真实标签/插件组件的隔离回放；电脑读取响应为显式夹具。 */
export async function checkDocumentDiff(page) {
  await page.evaluate(async () => { await window.fixture.select('two'); await window.fixture.documentPreview(); });
  await page.locator('details.remote-tool-card summary').click();
  await page.getByRole('button', { name: '查看本次修改', exact: true }).click();
  const panel = page.getByRole('region', { name: '插件面板', exact: true });
  const active = panel.locator('.remote-document-tab:not([hidden])');
  const history = active.locator('[data-dshm-document-view="changes"]');
  await history.getByText('BEFORE a', { exact: false }).waitFor();
  await history.getByText('AFTER a', { exact: false }).waitFor();
  assert.deepEqual(await page.evaluate(() => window.fixture.documentReads()), []);
  await panel.getByRole('button', { name: '下载最新完整文件', exact: true }).waitFor();
  await active.getByRole('button', { name: '最新完整文件', exact: true }).click();
  await active.getByTestId('diff-custom-renderer').getByText('CURRENT a.dshmdoc', { exact: true }).waitFor();
  await active.getByRole('button', { name: '本次修改', exact: true }).click();
  await history.getByText('BEFORE a', { exact: false }).waitFor();
  assert.doesNotMatch(await history.innerText(), /CURRENT/);
  await active.getByRole('combobox', { name: '选择修改文件', exact: true }).selectOption('b.dshmdoc');
  await history.getByText('BEFORE b', { exact: false }).waitFor();
  await active.getByRole('button', { name: '最新完整文件', exact: true }).click();
  await active.getByTestId('diff-custom-renderer').getByText('CURRENT b.dshmdoc', { exact: true }).waitFor();
  await page.evaluate(() => window.fixture.openCurrentDocument());
  await active.getByTestId('diff-custom-renderer').getByText('CURRENT a.dshmdoc', { exact: true }).waitFor();
  assert.equal(await history.count(), 0, '普通文件导航不得恢复旧差异视图');
  await page.evaluate(() => window.fixture.removeDocumentRenderer());
  await active.locator('[data-textpreview-plain]').getByText('CURRENT a.dshmdoc', { exact: true }).waitFor();
  await panel.getByRole('button', { name: '返回聊天', exact: true }).click();
  return { originalToolEntry: true, historicalWithoutContentRead: true, pluginCurrentPreview: true,
    historicalSnapshotPreserved: true, multiFileSelection: true, ordinaryNavigationCurrent: true, uninstallFallback: true };
}
