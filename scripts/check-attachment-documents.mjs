import assert from 'node:assert/strict';

export async function checkAttachmentDocuments(page) {
  await page.evaluate(async () => { await window.fixture.select('two'); await window.fixture.documentPreview(); window.fixture.startTransfers(); window.fixture.attachmentPreview('first'); });
  const panel = page.getByRole('region', { name: '插件面板', exact: true });
  const current = panel.locator('.remote-document-tab:not([hidden])');
  await current.locator('[data-textpreview-plain]').getByText('ORIGINAL first', { exact: true }).waitFor();
  assert.match(await current.locator('[data-textpreview-url]').getAttribute('data-textpreview-url'), /^dsh-resource:\/\/dshm-attachment\/two\/file\/first\/same.txt$/);
  await page.evaluate(() => window.fixture.attachmentRenderers());
  const output = current.getByTestId('attachment-renderer');
  await output.filter({ hasText: '"kind":"text"' }).waitFor();
  for (const [label, kind] of [['bytes-complete', 'bytes'], ['renderer', 'renderer']]) {
    await current.locator('[data-document-viewer-menu]').click();
    await page.getByRole('menuitem', { name: label, exact: true }).click();
    await output.filter({ hasText: '"text":"ORIGINAL first"' }).waitFor();
    const value = JSON.parse(await output.innerText());
    assert.equal(value.kind, kind); assert.equal(value.address, value.tab); assert.equal(value.source, 'attachment');
  }
  await page.evaluate(() => window.fixture.attachmentPreview('second'));
  await current.getByTestId('attachment-renderer').filter({ hasText: 'ORIGINAL second' }).waitFor();
  assert.equal(await panel.locator('nav').getByRole('button', { name: 'same.txt', exact: true }).count(), 2);
  await page.evaluate(() => window.fixture.removeAttachmentRenderers());
  await current.locator('[data-textpreview-plain]').getByText('ORIGINAL second', { exact: true }).waitFor();
  await page.evaluate(() => window.fixture.attachmentFailure(true));
  await current.locator('[data-textpreview-tool="reload"]').click();
  await current.locator('[data-textpreview-failed]').waitFor();
  assert.equal(await current.locator('[data-textpreview-plain]').count(), 0);
  await page.evaluate(() => window.fixture.attachmentFailure(false));
  await current.locator('[data-textpreview-tool="reload"]').click();
  await current.locator('[data-textpreview-plain]').getByText('ORIGINAL second', { exact: true }).waitFor();
  assert.ok((await page.evaluate(() => window.fixture.transfers())).filter(value => value.method === 'remote.attachment').length >= 5);
  assert.equal((await page.evaluate(() => window.fixture.documentReads())).length, 0);
  await page.evaluate(() => window.fixture.htmlReadFailure());
  await current.getByRole('alert').getByText('文件已在电脑上发生变化，请重新读取。', { exact: true }).waitFor();
  assert.equal(await current.locator('iframe').count(), 0);
  assert.equal(await page.evaluate(() => window.fixture.htmlReadCount()), 1);
  await current.getByRole('button', { name: '重试', exact: true }).click();
  await page.waitForFunction(() => window.fixture.htmlReadCount() === 2);
  await current.getByRole('alert').getByText('文件已在电脑上发生变化，请重新读取。', { exact: true }).waitFor();
  assert.deepEqual(await page.evaluate(() => window.fixture.htmlReadSignals()), [true, false]);
  await page.evaluate(() => window.fixture.htmlHoldNextRead());
  await current.getByRole('button', { name: '重试', exact: true }).click();
  await current.getByRole('status').getByText('正在读取文件…', { exact: true }).waitFor();
  await current.locator('[data-textpreview-tool="reload"]').click();
  await current.getByRole('alert').getByText('文件已在电脑上发生变化，请重新读取。', { exact: true }).waitFor();
  await page.evaluate(async () => { window.fixture.htmlRejectHeldRead(); await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))); });
  assert.deepEqual(await page.evaluate(() => window.fixture.htmlReadSignals()), [true, true, true, false]);
  assert.equal(await current.getByRole('alert').innerText(), '文件已在电脑上发生变化，请重新读取。\n\n重试');
  await panel.getByRole('button', { name: '返回聊天', exact: true }).click();
  await page.evaluate(() => window.fixture.htmlLegacyFailure());
  const fallback = page.getByRole('dialog', { name: '文件预览', exact: true });
  await fallback.getByRole('alert').getByText('文件已被删除或移动。', { exact: true }).waitFor();
  assert.equal(await page.evaluate(() => window.fixture.htmlLegacyReads()), 1);
  await fallback.getByRole('button', { name: '重试', exact: true }).click();
  await page.waitForFunction(() => window.fixture.htmlLegacyReads() === 2);
  await fallback.getByRole('alert').getByText('文件已被删除或移动。', { exact: true }).waitFor();
  await fallback.getByRole('button', { name: '关闭文件预览', exact: true }).click();
  return { sameNameSeparateTabs: true, originalPlainBody: true, textBytesAndRendererPlugins: true, originalResourceHook: true,
    unloadFallback: true, lateFailureClearsContent: true, retry: true, noWorkspaceReads: true,
    htmlRejectedReadVisible: true, htmlExplicitRetry: true, htmlLateFailureIgnored: true, htmlLegacyRetry: true };
}
