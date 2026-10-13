import assert from 'node:assert/strict';
import { startOfficeObservation } from './latest-office-observation.mjs';
import { startPausedOfficeReader } from './latest-office-paused-reader.mjs';

/** 使用原设备授权操作与原 UI，分别验证收回管理权限和撤销设备；不替代鉴权。 */
export async function verifyOfficeAuthorizationLoss(page, title, verify, change, mode) {
  assert.ok(['management', 'revoke'].includes(mode));
  const expectedReason = mode === 'management' ? 'permissions_changed' : 'device_revoked';
  const initial = await verify('office-cancel-refresh');
  await page.getByRole('button', { name: 'Remote 选项', exact: true }).click();
  await page.getByRole('button', { name: '插件面板', exact: true }).click();
  const panel = page.getByRole('region', { name: '插件面板', exact: true });
  await panel.getByRole('button', { name: '打开面板', exact: true }).click();
  await page.locator('[data-sidebar-right-guide-entry]').filter({ hasText: '工作区文件' }).click();
  const observation = await startOfficeObservation(page);
  const reader = await startPausedOfficeReader(page, initial);
  try {
    await page.locator('[data-files-entry="file"]').getByRole('button', { name: initial.fileName, exact: true }).click();
    await page.waitForFunction(windowSize => {
      const state = window.__latestOfficeCancellation.state;
      return state.chunks === windowSize && state.heldAcknowledgements === windowSize;
    }, initial.window, { timeout: 120000 });
    const held = await reader.snapshot();
    assert.equal(held.metadata.version, initial.metadata.version);
    assert.equal(held.metadata.absolutePath, initial.metadata.absolutePath);
    assert.ok(held.metadata.bytes > held.receivedBytes);
    assert.equal(held.receivedBytes, initial.window * initial.chunkBytes);
    assert.equal(held.settled, false); assert.equal(held.pending, true);
    assert.equal(await panel.locator('[data-pdf-preview] canvas').count(), 0);
    const other = await verify('office-cancel-hold-other');
    assert.equal(other.metadata.version, held.metadata.version);
    assert.equal(other.metadata.generation, held.metadata.generation);
    assert.equal((await verify('office-cancel-busy')).bothReadersOccupied, true);
    const receipt = await change();
    assert.equal(receipt.status, mode === 'management' ? 'active' : 'revoked');
    assert.equal(receipt.management, false);
    await page.waitForFunction(() => window.__latestOfficeCancellation.state.settled);
    const interrupted = await reader.snapshot();
    assert.equal(interrupted.failure, 'connection_closed_outcome_unknown');
    assert.equal(interrupted.resultUndefined, undefined);
    assert.equal(interrupted.pending, false);
    assert.equal(interrupted.chunks, initial.window);
    await page.getByTestId('remote-workspace').waitFor({ state: 'detached' });
    assert.equal(await page.locator('[data-pdf-preview] canvas').count(), 0);
    const released = await verify('office-cancel-released');
    assert.equal(released.phoneReaderReleased, true); assert.equal(released.sourcePreserved, true);
    assert.equal(released.replacement.metadata.version, held.metadata.version);
    assert.equal(released.replacement.metadata.generation, held.metadata.generation);
    const connectionsBeforeRetry = await observation.connections();
    assert.ok(connectionsBeforeRetry.some(frame => frame.type === 'closed' && frame.reason === expectedReason));
    assert.equal(connectionsBeforeRetry.some(frame => frame.type === 'ready'), false);
    const beforeRetry = await observation.counts(initial.fileName);
    assert.equal(beforeRetry.conversions, 1);

    await reader.release();
    if (mode === 'revoke') {
      await page.getByRole('heading', { name: '连接授权已失效', exact: true }).waitFor();
      await page.getByRole('button', { name: '重新连接', exact: true }).click();
      await page.getByRole('alert').filter({ hasText: '连接授权已失效' }).waitFor();
      assert.equal(await page.getByTestId('remote-workspace').count(), 0);
      assert.equal(await page.locator('[data-pdf-preview] canvas').count(), 0);
      assert.equal((await observation.counts(initial.fileName)).conversions, 1);
      assert.equal((await observation.connections()).some(frame => frame.type === 'ready'), false);
      return { mode, receipt, held, interrupted, connections: await observation.connections(),
        originalAuthorizationLost: true, oldRequestRejectedAndRemoved: true, hostReaderCapacityReleased: true,
        oldPdfNotDisplayed: true, sourcePreserved: true, revokedReconnectDenied: true };
    }
    await page.getByTestId('remote-state').filter({ hasText: '连接已断开' }).waitFor();
    await page.getByRole('button', { name: '重新连接', exact: true }).click();
    await page.getByTestId('remote-workspace').waitFor({ timeout: 60000 });
    await page.getByRole('button').filter({ hasText: title }).click();
    await page.getByRole('button', { name: 'Remote 选项', exact: true }).click();
    await page.getByRole('button', { name: '插件面板', exact: true }).click();
    await panel.getByRole('button', { name: '打开面板', exact: true }).click();
    await page.locator('[data-sidebar-right-guide-entry]').filter({ hasText: '工作区文件' }).click();
    await page.locator('[data-files-entry="file"]').getByRole('button', { name: initial.fileName, exact: true }).click();
    await panel.locator('[data-pdf-preview] canvas').first().waitFor({ timeout: 60000 });
    const afterRetry = await observation.counts(initial.fileName), connections = await observation.connections();
    assert.ok(connections.some(frame => frame.type === 'ready' && frame.management === false));
    assert.equal(afterRetry.conversions, 2);
    assert.ok(afterRetry.authorizations > beforeRetry.authorizations);
    assert.ok(afterRetry.generations > beforeRetry.generations);
    assert.equal(afterRetry.sourceVersions.at(-1), held.metadata.version);
    assert.equal(afterRetry.sourceGenerations.at(-1), held.metadata.generation);
    await panel.getByRole('button', { name: '面板操作', exact: true }).click();
    await page.getByRole('menuitem', { name: '关闭当前面板', exact: true }).click();
    await panel.locator('[data-pdf-preview] canvas').first().waitFor({ state: 'detached' });
    await panel.getByRole('button', { name: '返回聊天', exact: true }).click();
    return { mode, receipt, held, interrupted, beforeRetry, afterRetry, connections,
      originalAuthorizationLost: true, oldRequestRejectedAndRemoved: true, hostReaderCapacityReleased: true,
      oldPdfNotDisplayed: true, sourcePreserved: true, freshReadonlyConnectionAndPdf: true };
  } finally {
    await reader.stop().catch(() => {});
    await observation.stop().catch(() => {});
    await verify('office-cancel-cleanup');
  }
}
