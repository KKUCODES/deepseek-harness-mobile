import assert from 'node:assert/strict';

export async function checkFileTransfers(page) {
  await page.evaluate(async () => { await window.fixture.select('two'); await window.fixture.documentPreview(); window.fixture.startTransfers(); window.fixture.openCurrentDocument(); });
  const panel = page.getByRole('region', { name: '插件面板', exact: true });
  const calls = () => page.evaluate(() => window.fixture.transfers());
  const waitOperation = op => page.waitForFunction(op => window.fixture.transfers().some(call => call.op === op), op);
  await panel.getByTestId('diff-custom-renderer').waitFor();
  await page.evaluate(() => window.fixture.holdTransfer('file.chunk'));
  await panel.getByRole('button', { name: '下载完整文件', exact: true }).click();
  await waitOperation('file.chunk');
  await panel.getByRole('button', { name: '返回聊天', exact: true }).click();
  await waitOperation('file.abort');
  await page.evaluate(() => { window.fixture.releaseTransfer(); window.fixture.openCurrentDocument(); });
  await panel.getByRole('button', { name: '下载完整文件', exact: true }).waitFor();
  assert.equal((await calls()).some(item => item.op === 'file.save'), false);
  assert.equal(await panel.getByRole('status').filter({ hasText: '已保存' }).count(), 0);

  await page.evaluate(() => window.fixture.holdTransfer('file.share'));
  await panel.getByRole('button', { name: '分享完整文件', exact: true }).click();
  await waitOperation('file.share');
  await panel.getByRole('button', { name: '取消分享', exact: true }).click();
  assert.equal(await panel.getByRole('button', { name: '分享完整文件', exact: true }).isEnabled(), false, '取消完成前不能并发启动第二次传输');
  await page.evaluate(() => window.fixture.releaseTransfer());
  await panel.getByText('已打开系统分享面板。', { exact: true }).waitFor();
  const complete = (await calls()).filter(item => item.op === 'file.chunk');
  assert.ok(complete.every(item => Buffer.from(item.data.data, 'base64').toString() === 'LATEST COMPLETE FILE'));
  await page.evaluate(() => { window.fixture.holdTransfer(undefined); window.fixture.failTransfer('download_cleanup_failed'); });
  await panel.getByRole('button', { name: '下载完整文件', exact: true }).click();
  await panel.getByText('保存未完成，目标位置可能留有不完整文件，请检查后重新下载。', { exact: true }).waitFor();
  assert.equal(await panel.getByText('已保存到所选位置。', { exact: true }).count(), 0);
  await page.evaluate(() => window.fixture.failTransfer(undefined));

  await panel.getByRole('button', { name: '返回聊天', exact: true }).click();
  await page.evaluate(() => { window.fixture.holdTransfer('file.chunk'); window.fixture.transferAttachment('opaque:first'); });
  let attachment = page.getByRole('dialog', { name: '文件预览', exact: true });
  await attachment.locator('pre').getByText('ORIGINAL opaque:first', { exact: true }).waitFor();
  await attachment.getByRole('button', { name: '分享完整文件', exact: true }).click();
  await page.waitForFunction(() => window.fixture.transfers().some(item => item.op === 'file.chunk' && atob(item.data.data) === 'ORIGINAL opaque:first'));
  await attachment.getByText(/正在准备分享/).waitFor();
  const oldDownload = (await calls()).filter(item => item.op === 'file.begin').length;
  await page.evaluate(() => window.fixture.transferAttachment('opaque:second'));
  await attachment.locator('pre').getByText('ORIGINAL opaque:second', { exact: true }).waitFor();
  assert.ok((await calls()).some(item => item.op === 'file.abort' && item.data.downloadId === `download-${oldDownload}`));
  await page.evaluate(() => { window.fixture.releaseTransfer(); window.fixture.holdTransfer(undefined); });
  await attachment.getByRole('button', { name: '下载完整文件', exact: true }).click();
  await attachment.getByText('已保存到所选位置。', { exact: true }).waitFor();
  const all = await calls();
  assert.equal(all.some(item => ['file.save', 'file.share'].includes(item.op) && item.data.downloadId === `download-${oldDownload}`), false);
  assert.equal(all.some(item => item.method === 'workspace.read' && item.path === 'same.txt'), false);
  assert.ok(all.some(item => item.op === 'file.chunk' && Buffer.from(item.data.data, 'base64').toString() === 'ORIGINAL opaque:second'));
  await page.evaluate(() => window.fixture.failTransfer('download_cleanup_failed'));
  await attachment.getByRole('button', { name: '下载完整文件', exact: true }).click();
  await attachment.getByText('保存未完成，目标位置可能留有不完整文件，请检查后重新下载。', { exact: true }).waitFor();
  assert.equal(await attachment.getByText('已保存到所选位置。', { exact: true }).count(), 0);
  await attachment.getByRole('button', { name: '关闭文件预览', exact: true }).click();
  await page.evaluate(() => window.fixture.failTransfer(undefined));
  return { originalPanelCloseCancels: true, freshCompleteBytes: true, shareCancelCopy: true,
    cleanupBeforeNextTransfer: true, nativeSuccessSurvivesLateCancel: true, sameNameAttachmentIsolation: true,
    partialFileWarningInBothPreviews: true, noWorkspacePathFallback: true };
}
