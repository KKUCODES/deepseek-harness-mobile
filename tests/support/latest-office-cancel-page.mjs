import assert from 'node:assert/strict';
import { startPausedOfficeReader } from './latest-office-paused-reader.mjs';

/** 仅延迟真实 PDF 分片的信用确认；原授权、转换、消息和 UI 取消路径全部保留。 */
export async function verifyOfficePreviewCancellation(page, panel, verify, observation) {
  const initial = await verify('office-cancel-prepare');
  const before = await observation.counts(initial.fileName);
  assert.equal(before.conversions, 0);
  const reader = await startPausedOfficeReader(page, initial), snapshot = reader.snapshot;
  try {
    await page.locator('[data-files-entry="file"]').getByRole('button', { name: initial.fileName, exact: true }).click();
    await page.waitForFunction(windowSize => {
      const state = window.__latestOfficeCancellation.state;
      return state.chunks === windowSize && state.heldAcknowledgements === windowSize;
    }, initial.window, { timeout: 120000 });
    const held = await snapshot();
    assert.equal(held.metadata.version, initial.metadata.version);
    assert.equal(held.metadata.absolutePath, initial.metadata.absolutePath);
    assert.ok(held.metadata.bytes > held.receivedBytes);
    assert.equal(held.receivedBytes, initial.window * initial.chunkBytes);
    assert.equal(held.settled, false); assert.equal(held.pending, true);
    assert.equal(await panel.locator('[data-pdf-preview] canvas').count(), 0);
    const other = await verify('office-cancel-hold-other');
    assert.deepEqual(other.metadata.version, held.metadata.version);
    assert.equal(other.metadata.generation, held.metadata.generation);
    const busy = await verify('office-cancel-busy');
    assert.equal(busy.bothReadersOccupied, true);
    assert.equal((await snapshot()).chunks, initial.window, '没有信用确认时手机不能收到第五个真实块');

    await panel.getByRole('button', { name: '面板操作', exact: true }).click();
    await page.getByRole('menuitem', { name: '关闭当前面板', exact: true }).click();
    await panel.locator('[data-textpreview-url]:visible').waitFor({ state: 'detached' });
    await page.waitForFunction(() => {
      const state = window.__latestOfficeCancellation.state;
      return state.settled && state.cancellationSent;
    });
    const cancelled = await snapshot();
    assert.equal(cancelled.cancellations, 1, '原取消帧只发送一次');
    assert.equal(cancelled.resultUndefined, true); assert.equal(cancelled.failure, undefined);
    assert.equal(cancelled.pending, false);
    assert.equal(cancelled.chunks, initial.window);
    const released = await verify('office-cancel-released');
    assert.equal(released.phoneReaderReleased, true);
    assert.equal(released.sourcePreserved, true);
    assert.equal(released.replacement.metadata.version, initial.metadata.version);
    assert.equal(await panel.locator('[data-pdf-preview] canvas').count(), 0);

    await reader.release();
    await page.locator('[data-files-entry="file"]').getByRole('button', { name: initial.fileName, exact: true }).click();
    await panel.locator('[data-pdf-preview] canvas').first().waitFor({ timeout: 60000 });
    assert.ok((await panel.innerText()).includes(initial.fileName));
    const reopened = await observation.counts(initial.fileName);
    assert.equal(reopened.conversions, 2, '取消后重新打开必须建立另一条真实转换流');
    assert.equal(reopened.sourceVersions.at(-1), held.metadata.version);
    assert.equal(reopened.sourceGenerations.at(-1), held.metadata.generation);
    await panel.getByRole('button', { name: '面板操作', exact: true }).click();
    await page.getByRole('menuitem', { name: '关闭当前面板', exact: true }).click();
    await panel.locator('[data-pdf-preview] canvas').first().waitFor({ state: 'detached' });
    return { source: initial.metadata, pdfBytes: held.metadata.bytes, windowBytes: held.receivedBytes,
      held, cancelled, reopened, replacement: released.replacement,
      actualUiCloseCancelledOriginalRequest: true, hostReaderCapacityReleased: true,
      reopenedActualPdfCanvas: true, sourcePreserved: true,
      scope: 'converted PDF transmission; not conversion engine in-flight cancellation' };
  } finally {
    await reader.stop().catch(() => {});
    await verify('office-cancel-cleanup');
  }
}
