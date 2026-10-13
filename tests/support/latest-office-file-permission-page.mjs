import assert from 'node:assert/strict';
import { startOfficeObservation, assertCachedOfficeRead } from './latest-office-observation.mjs';
import { startPausedOfficeReader } from './latest-office-paused-reader.mjs';

/** 原文件 ReadData 权限真实收回；原 UI 的失败与重试决定是否能交给 PDF 渲染器。 */
export async function verifyOfficeFilePermission(page, verify, capture) {
  const initial = await verify('office-cancel-refresh');
  const prepared = await verify('office-cancel-file-prepare');
  assert.deepEqual(prepared.metadata, initial.metadata);
  const observation = await startOfficeObservation(page), reader = await startPausedOfficeReader(page, initial);
  const panel = page.getByRole('region', { name: '插件面板', exact: true });
  const close = async () => {
    await panel.getByRole('button', { name: '面板操作', exact: true }).click();
    await page.getByRole('menuitem', { name: '关闭当前面板', exact: true }).click();
    await panel.locator('[data-pdf-preview] canvas').first().waitFor({ state: 'detached' });
  };
  let restored;
  try {
    await page.getByRole('button', { name: 'Remote 选项', exact: true }).click();
    await page.getByRole('button', { name: '插件面板', exact: true }).click();
    await panel.getByRole('button', { name: '打开面板', exact: true }).click();
    await page.locator('[data-sidebar-right-guide-entry]').filter({ hasText: '工作区文件' }).click();
    const open = () => page.locator('[data-files-entry="file"]').getByRole('button', { name: initial.fileName, exact: true }).click();
    await open();
    await page.waitForFunction(windowSize => {
      const state = window.__latestOfficeCancellation.state;
      return state.chunks === windowSize && state.heldAcknowledgements === windowSize;
    }, initial.window, { timeout: 120000 });
    const held = await reader.snapshot();
    assert.equal(held.pending, true); assert.equal(held.settled, false);
    assert.equal(held.receivedBytes, initial.window * initial.chunkBytes);
    assert.equal(held.metadata.version, prepared.metadata.version);
    assert.equal(held.metadata.generation, prepared.generation);
    assert.equal(await panel.locator('[data-pdf-preview] canvas').count(), 0);
    const other = await verify('office-cancel-hold-other');
    assert.equal(other.metadata.version, held.metadata.version);
    assert.equal((await verify('office-cancel-busy')).bothReadersOccupied, true);
    const denied = await verify('office-cancel-file-deny');
    assert.equal(denied.realNodeReadDenied, true);
    assert.ok(['EACCES', 'EPERM'].includes(denied.code));
    await reader.resume();
    await page.waitForFunction(() => window.__latestOfficeCancellation.state.settled);
    const failed = await reader.snapshot();
    assert.equal(failed.receivedBytes, held.metadata.bytes);
    assert.equal(failed.resultUndefined, false);
    assert.deepEqual(failed.resultFailure, { code: 'gateway/internal', details: {} });
    assert.equal(failed.failure, undefined); assert.equal(failed.pending, false);
    assert.equal(failed.cancellations, 0);
    const failure = panel.locator('[data-textpreview-failed="gateway/internal"]');
    await failure.waitFor();
    assert.equal(await panel.locator('[data-pdf-preview] canvas').count(), 0);
    const failureText = await failure.innerText();
    assert.ok(failureText.includes('访问权限'));
    await capture('denied');

    restored = await verify('office-cancel-file-restore');
    assert.equal(restored.aclRestoredExactly, true); assert.equal(restored.originalBytesPreserved, true);
    assert.equal(restored.generation, prepared.generation);
    const released = await verify('office-cancel-released');
    assert.equal(released.phoneReaderReleased, true);
    await failure.getByRole('button', { name: '重试', exact: true }).click();
    await panel.locator('[data-pdf-preview] canvas').first().waitFor({ timeout: 60000 });
    await failure.waitFor({ state: 'detached' });
    await page.waitForFunction(() => [...document.querySelectorAll('[data-pdf-text]')].some(node =>
      node.offsetParent !== null && node.textContent.replace(/\s+/g, '').startsWith('DSHMtransmissionpage0:')),
    undefined, { timeout: 60000 });
    const text = await panel.locator('[data-pdf-text]:visible').first().innerText();
    const reloaded = await observation.counts(initial.fileName);
    assert.equal(reloaded.conversions, 2);
    assert.equal(reloaded.sourceVersions.at(-1), restored.metadata.version);
    assert.equal(reloaded.sourceGenerations.at(-1), prepared.generation);
    assert.ok(decodeURIComponent(await panel.locator('[data-textpreview-url]:visible').getAttribute('data-textpreview-url'))
      .includes(initial.sessionId));
    await capture('restored'); await close();
    await open(); await panel.locator('[data-pdf-preview] canvas').first().waitFor({ timeout: 60000 });
    await close();
    const cached = await observation.counts(initial.fileName);
    assertCachedOfficeRead(reloaded, cached);
    await panel.getByRole('button', { name: '返回聊天', exact: true }).click();
    return { held, denied, failed, failureText, restored, released, reloaded, cached,
      returnedTextPrefix: text.slice(0, 80), allPdfBytesRejectedByOriginalUi: true,
      oldPdfCanvasNotDisplayed: true, originalFailureContractPreserved: true,
      actualRetryReadsNewPdf: true, restoredPdfTextVerified: true,
      hostReaderCapacityReleased: true, restoredCacheReusedWithAuthorization: true,
      sourceBytesAndAclRestored: true, scope: 'actual Android workspace Office preview; Windows source ReadData ACL during converted PDF transmission' };
  } finally {
    await reader.stop().catch(() => {}); await observation.stop().catch(() => {});
    if (!restored) await verify('office-cancel-file-restore');
    await verify('office-cancel-cleanup');
  }
}
