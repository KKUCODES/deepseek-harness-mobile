import assert from 'node:assert/strict';
import { startPausedOfficeReader } from './latest-office-paused-reader.mjs';

/** 终止真实设备 socket；不点击重连、不生成 ready、不替换缓存或 PDF。 */
export async function verifyOfficeNetworkRecovery(page, panel, name, observation, verify) {
  const initial = await verify('office-cancel-refresh');
  const before = await observation.counts(initial.fileName);
  assert.notEqual(initial.metadata.version, before.sourceVersions.at(-1));
  const cachedBefore = await observation.counts(name), original = await verify('office-connection-stat');
  const connectionCount = (await observation.connections()).length;
  const reader = await startPausedOfficeReader(page, initial);
  const close = async () => {
    await panel.getByRole('button', { name: '面板操作', exact: true }).click();
    await page.getByRole('menuitem', { name: '关闭当前面板', exact: true }).click();
    await panel.locator('[data-pdf-preview] canvas').first().waitFor({ state: 'detached' });
  };
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

    await reader.release();
    const drop = await verify('office-network-drop', { requestId: held.id });
    assert.equal(drop.originalRequestSocketDropped, true);
    assert.equal(drop.onlyMatchedDeviceSocket, true);
    assert.equal(drop.gracefulReasonSent, false);
    await page.waitForFunction(() => window.__latestOfficeCancellation.state.settled);
    const interrupted = await reader.snapshot();
    assert.equal(interrupted.failure, 'connection_closed_outcome_unknown');
    assert.equal(interrupted.resultUndefined, undefined);
    assert.equal(interrupted.pending, false);
    assert.equal(interrupted.chunks, initial.window);
    const released = await verify('office-cancel-released');
    assert.equal(released.phoneReaderReleased, true);
    assert.equal(released.sourcePreserved, true);

    await page.getByTestId('remote-workspace').waitFor({ timeout: 60000 });
    await page.waitForFunction(sessionId => {
      const element = document.querySelector('[data-testid="remote-workspace"]');
      if (!element) return false;
      const key = Object.keys(element).find(name => name.startsWith('__reactFiber$'));
      for (let fiber = element[key]; fiber; fiber = fiber.return) {
        const model = fiber.memoizedProps?.model;
        if (model?.client) {
          const state = model.getSnapshot();
          return state.connectionState === 'connected' && state.selected === sessionId;
        }
      }
      return false;
    }, initial.sessionId, { timeout: 60000 });
    const connections = (await observation.connections()).slice(connectionCount);
    assert.ok(connections.some(frame => frame.type === 'closed' && frame.reason === undefined));
    assert.ok(connections.some(frame => frame.type === 'ready'));
    assert.equal(connections.some(frame => frame.reason === 'user_disconnect'), false);
    // 原预览允许保留失败状态供用户重试；连接恢复必须自动发生。
    await page.waitForFunction(() => {
      const panel = document.querySelector('[role="region"][aria-label="插件面板"]');
      return panel && (panel.querySelector('[data-pdf-preview] canvas') || panel.querySelector('[data-textpreview-failed]'));
    }, undefined, { timeout: 60000 });
    let previewRecovery = 'automatic';
    if (await panel.locator('[data-textpreview-failed]').count()) {
      previewRecovery = 'original-retry-button';
      await panel.locator('[data-textpreview-failed]').getByRole('button', { name: '重试', exact: true }).click();
    }
    await panel.locator('[data-pdf-preview] canvas').first().waitFor({ timeout: 60000 });
    const recovered = await observation.counts(initial.fileName);
    assert.ok(recovered.conversions >= before.conversions + 2);
    assert.equal(recovered.sourceVersions.at(-1), held.metadata.version);
    assert.equal(recovered.sourceGenerations.at(-1), held.metadata.generation);
    await close();
    await page.locator('[data-files-entry="file"]').getByRole('button', { name, exact: true }).click();
    await panel.locator('[data-pdf-preview] canvas').first().waitFor({ timeout: 60000 });
    const cachedAfter = await observation.counts(name), current = await verify('office-connection-stat');
    assert.deepEqual(current, original);
    assert.equal(cachedAfter.conversions, cachedBefore.conversions + 1);
    assert.ok(cachedAfter.authorizations > cachedBefore.authorizations);
    assert.ok(cachedAfter.generations > cachedBefore.generations);
    assert.equal(cachedAfter.sourceVersions.at(-1), current.metadata.version);
    assert.equal(cachedAfter.sourceGenerations.at(-1), current.generation);
    await close();
    return { before, held, interrupted, recovered, cachedBefore, cachedAfter, original, connections, drop, previewRecovery,
      automaticNativeConnectionRecovery: true, oldOriginalRequestRejectedAndRemoved: true,
      hostReaderCapacityReleased: true, oldMobileCacheDiscarded: true,
      sourceAndServiceUnchanged: true, freshAuthorizedPdfCanvas: true,
      scope: 'one original device socket lost during converted PDF transmission; not conversion engine cancellation' };
  } finally {
    await reader.stop().catch(() => {});
    await verify('office-cancel-cleanup');
  }
}
