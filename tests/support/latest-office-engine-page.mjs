import assert from 'node:assert/strict';

/** 仅旁观原请求；确认和分片均原样转发，不延迟引擎或传输。 */
async function observeReader(page, initial) {
  await page.getByTestId('remote-workspace').evaluate((element, initial) => {
    const key = Object.keys(element).find(name => name.startsWith('__reactFiber$'));
    let client;
    for (let fiber = element[key]; fiber; fiber = fiber.return) {
      if (fiber.memoizedProps?.model?.client) { client = fiber.memoizedProps.model.client; break; }
    }
    if (!client || window.__latestOfficeEngine) throw Error('engine_reader_observation_unavailable');
    const originalRequest = client.request, originalCall = client.call, reads = [];
    function request(operation, ...args) {
      if (operation.method !== 'remote.office' || operation.sessionId !== initial.sessionId || operation.path !== initial.fileName)
        return originalRequest.call(this, operation, ...args);
      if (typeof args[0] !== 'function') throw Error('engine_reader_requires_original_callback');
      const state = { chunks: 0, bytes: 0, cancellations: 0, settled: false }, emit = args[0];
      args[0] = function(value, ...rest) {
        if (value.type === 'metadata') state.metadata = { bytes: value.bytes, version: value.version, generation: value.generation };
        if (value.type === 'chunk') { state.chunks++; state.bytes += atob(value.data).length; }
        return emit.call(this, value, ...rest);
      };
      const pending = originalRequest.call(this, operation, ...args);
      state.id = pending.id; reads.push(state);
      pending.promise.then(value => { state.settled = true; state.resultUndefined = value === undefined;
        if (value?.ok === false) state.failure = value.error;
      }, error => { state.settled = true; state.failure = error.message; });
      return pending;
    }
    function call(operation, data, ...args) {
      if (operation === 'socket.send' && data?.frame?.type === 'cancel') {
        const state = reads.find(read => read.id === data.frame.id);
        if (state) state.cancellations++;
      }
      return originalCall.call(this, operation, data, ...args);
    }
    client.request = request; client.call = call;
    window.__latestOfficeEngine = { reads, snapshot() {
      return reads.map(read => ({ ...read, pending: client.requests.has(read.id) }));
    }, stop() {
      if (client.request !== request || client.call !== call) throw Error('engine_observation_wrappers_changed');
      client.request = originalRequest; client.call = originalCall; delete window.__latestOfficeEngine;
    } };
  }, initial);
  return { snapshot: () => page.evaluate(() => window.__latestOfficeEngine.snapshot()),
    stop: () => page.evaluate(() => window.__latestOfficeEngine?.stop()) };
}

async function closeOfficePanel(page, panel) {
  await panel.getByRole('button', { name: '面板操作', exact: true }).click();
  await page.getByRole('menuitem', { name: '关闭当前面板', exact: true }).click();
  await panel.locator('[data-textpreview-url]:visible').waitFor({ state: 'detached' });
}

export async function verifyOfficeEngineCancellation(page, panel, verify) {
  const initial = await verify('office-engine-prepare');
  const reader = await observeReader(page, initial);
  try {
    const file = page.locator('[data-files-entry="file"]').getByRole('button', { name: initial.fileName, exact: true });
    await file.click();
    const running = await verify('office-engine-running');
    const [inFlight] = await reader.snapshot();
    assert.ok(inFlight.pending); assert.equal(inFlight.settled, false);
    assert.equal(inFlight.chunks, 0); assert.equal(inFlight.metadata, undefined);
    assert.equal(await panel.locator('[data-pdf-preview] canvas').count(), 0);
    await closeOfficePanel(page, panel);
    await page.waitForFunction(() => {
      const read = window.__latestOfficeEngine.reads[0];
      return read?.settled && read.cancellations === 1;
    });
    const [cancelled] = await reader.snapshot();
    assert.equal(cancelled.pending, false); assert.equal(cancelled.resultUndefined, true);
    assert.equal(cancelled.failure, undefined); assert.equal(cancelled.metadata, undefined); assert.equal(cancelled.chunks, 0);
    const stopped = await verify('office-engine-stopped');
    await file.click();
    await panel.locator('[data-pdf-preview] canvas').first().waitFor({ timeout: 120000 });
    const text = panel.locator('.textLayer').first();
    await text.waitFor();
    assert.match(await text.innerText(), /DSHM transmission page 0/);
    const reads = await reader.snapshot();
    assert.equal(reads.length, 2); assert.equal(reads[1].failure, undefined);
    assert.equal(reads[1].metadata.version, initial.metadata.version);
    assert.ok(reads[1].chunks > 0);
    await closeOfficePanel(page, panel);
    const reopened = await verify('office-engine-reopened');
    const finalReads = await reader.snapshot();
    assert.equal(finalReads[0].chunks, 0); assert.equal(finalReads[0].metadata, undefined, '取消后不能接纳迟到结果');
    assert.equal(finalReads[1].settled, true); assert.equal(finalReads[1].pending, false);
    return { initial, running, cancelled, stopped, reopened, reads: finalReads,
      actualUiCloseCancelledOriginalNativeHelper: true, reopenedActualPdfCanvasAndText: true,
      scope: 'original native helper in flight with matching source bytes; not converted PDF transmission' };
  } finally { await reader.stop(); }
}

/** 断开实际设备 socket 时引擎仍存活；通过原连接恢复和预览重试检查新转换。 */
export async function verifyOfficeEngineNetworkRecovery(page, panel, verify, observation) {
  const initial = await verify('office-engine-prepare');
  const reader = await observeReader(page, initial);
  const connectionCount = (await observation.connections()).length;
  try {
    const file = page.locator('[data-files-entry="file"]').getByRole('button', { name: initial.fileName, exact: true });
    await file.click();
    const running = await verify('office-engine-running');
    const [inFlight] = await reader.snapshot();
    assert.equal(inFlight.pending, true); assert.equal(inFlight.settled, false);
    assert.equal(inFlight.chunks, 0); assert.equal(inFlight.metadata, undefined);
    assert.equal(await panel.locator('[data-pdf-preview] canvas').count(), 0);
    const drop = await verify('office-engine-network-drop', { requestId: inFlight.id });
    assert.equal(drop.originalRequestSocketDropped, true);
    assert.equal(drop.onlyMatchedDeviceSocket, true); assert.equal(drop.gracefulReasonSent, false);
    assert.equal(drop.runningAtDrop.helpers[0].pid, running.helpers[0].pid);
    await page.waitForFunction(() => window.__latestOfficeEngine.reads[0]?.settled);
    const [interrupted] = await reader.snapshot();
    assert.equal(interrupted.pending, false);
    assert.equal(interrupted.failure, 'connection_closed_outcome_unknown');
    assert.equal(interrupted.metadata, undefined); assert.equal(interrupted.chunks, 0);
    const stopped = await verify('office-engine-stopped');
    assert.equal(stopped.helpers[0].pid, running.helpers[0].pid);
    assert.notEqual(stopped.helpers[0].code, 0);
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
    await panel.locator('[data-textpreview-failed]').waitFor();
    const readsBeforeRetry = await reader.snapshot();
    assert.equal(readsBeforeRetry.length, 1, '原失败请求不能自动重发');
    await panel.locator('[data-textpreview-failed]').getByRole('button', { name: '重试', exact: true }).click();
    await panel.locator('[data-pdf-preview] canvas').first().waitFor({ timeout: 120000 });
    const text = panel.locator('.textLayer').first(); await text.waitFor();
    assert.match(await text.innerText(), /DSHM transmission page 0/);
    const reads = await reader.snapshot();
    assert.equal(reads.length, 2); assert.equal(reads[1].failure, undefined);
    assert.equal(reads[1].metadata.version, initial.metadata.version);
    assert.equal(reads[1].metadata.generation, stopped.generation);
    assert.equal(reads[1].bytes, reads[1].metadata.bytes); assert.ok(reads[1].chunks > 0);
    await closeOfficePanel(page, panel);
    const reopened = await verify('office-engine-reopened');
    return { initial, running, inFlight, drop, interrupted, stopped, connections, reads, reopened,
      originalEngineRunningAtUnexpectedSocketLoss: true, oldHelperExitedAndQueueReleased: true,
      automaticNativeConnectionRecovery: true, originalFailedPreviewRetainedWithoutResend: true,
      originalRetryOpenedFreshConversionCanvasAndText: true, sourcePreserved: true,
      scope: 'unexpected device socket loss during original native conversion, followed by explicit original preview retry' };
  } finally { await reader.stop(); }
}

/** 原插件管理器在 native helper 运行时停用服务，再沿原按钮启用/重试。 */
export async function verifyOfficeEngineServiceLifecycle(page, panel, verify, { shared = false } = {}) {
  const initial = await verify('office-engine-prepare');
  const reader = await observeReader(page, initial);
  let disabled = false;
  try {
    const file = page.locator('[data-files-entry="file"]').getByRole('button', { name: initial.fileName, exact: true });
    await file.click();
    const running = await verify('office-engine-running');
    const [inFlight] = await reader.snapshot();
    assert.equal(inFlight.pending, true); assert.equal(inFlight.settled, false);
    assert.equal(inFlight.metadata, undefined); assert.equal(inFlight.chunks, 0);
    assert.equal(await panel.locator('[data-pdf-preview] canvas').count(), 0);
    const joined = shared ? await verify('office-engine-shared-join') : undefined;
    const unload = await verify('office-engine-service-disable'); disabled = true;
    assert.equal(unload.runningAtDisable.helpers[0].pid, running.helpers[0].pid);
    await page.waitForFunction(() => window.__latestOfficeEngine.reads[0]?.settled);
    const [interrupted] = await reader.snapshot();
    assert.equal(interrupted.pending, false);
    assert.equal(interrupted.failure?.code ?? interrupted.failure, 'gateway/cancelled');
    assert.equal(interrupted.metadata, undefined); assert.equal(interrupted.chunks, 0);
    const otherReader = shared ? await verify('office-engine-shared-service-failed') : undefined;
    const stopped = await verify('office-engine-service-stopped');
    assert.equal(stopped.unloadedHelperExited, true); assert.equal(stopped.oldCacheCleared, true);
    const failure = panel.locator('[data-textpreview-failed]'); await failure.waitFor();
    assert.equal(await panel.locator('[data-pdf-preview] canvas').count(), 0);
    const enabled = await verify('office-engine-service-enable'); disabled = false;
    assert.notEqual(enabled.generation, unload.generation);
    assert.equal((await reader.snapshot()).length, 1, '启用服务不能自动重发旧读取');
    await failure.getByRole('button', { name: '重试', exact: true }).click();
    await panel.locator('[data-pdf-preview] canvas').first().waitFor({ timeout: 120000 });
    const text = panel.locator('.textLayer').first(); await text.waitFor();
    assert.match(await text.innerText(), /DSHM transmission page 0/);
    const reads = await reader.snapshot(); assert.equal(reads.length, 2);
    assert.equal(reads[1].failure, undefined); assert.equal(reads[1].metadata.version, initial.metadata.version);
    assert.equal(reads[1].metadata.generation, enabled.generation);
    assert.equal(reads[1].bytes, reads[1].metadata.bytes); assert.ok(reads[1].chunks > 0);
    await closeOfficePanel(page, panel);
    const reopened = await verify('office-engine-service-reopened');
    return { initial, running, inFlight, joined, otherReader, unload, interrupted, stopped, enabled, reads, reopened,
      originalNativeHelperRunningAtUnload: true, unloadedHelperAndOldCacheReleased: true,
      oldRequestNotResentAfterServiceEnable: true, retryUsedNewServiceActualPdfCanvasAndText: true,
      sourcePreserved: true };
  } finally {
    if (disabled) await verify('office-engine-service-enable');
    await reader.stop();
  }
}

/** 原设备撤销发生在第三次真实转换中；不先收管理权限，不重新配对。 */
export async function verifyOfficeEngineRevocation(page, verify, revoke, { shared = false } = {}) {
  const initial = await verify('office-engine-revoke-prepare');
  await page.getByRole('button', { name: 'Remote 选项', exact: true }).click();
  await page.getByRole('button', { name: '插件面板', exact: true }).click();
  const panel = page.getByRole('region', { name: '插件面板', exact: true });
  await panel.getByRole('button', { name: '打开面板', exact: true }).click();
  await page.locator('[data-sidebar-right-guide-entry]').filter({ hasText: '工作区文件' }).click();
  const reader = await observeReader(page, initial);
  const trace = { startedAt: Date.now() };
  try {
    await page.locator('[data-files-entry="file"]').getByRole('button', { name: initial.fileName, exact: true }).click();
    const running = shared ? undefined : await verify('office-engine-revoke-running');
    const joined = shared ? await verify('office-engine-shared-revoke-join') : undefined;
    const [inFlight] = await reader.snapshot(); assert.equal(inFlight.pending, true); assert.equal(inFlight.settled, false);
    assert.equal(inFlight.metadata, undefined); assert.equal(inFlight.chunks, 0);
    assert.equal(await panel.locator('[data-pdf-preview] canvas').count(), 0);
    const beforeRevocation = inFlight;
    Object.assign(trace, { beforeAt: Date.now(), beforeRevocation });
    const receipt = await revoke(shared ? joined.observation : undefined);
    const remaining = shared ? await verify('office-engine-shared-revoke-remaining') : undefined;
    Object.assign(trace, { receiptAt: Date.now(), afterReceipt: await reader.snapshot(), receipt });
    assert.equal(receipt.runningAtRevoke.helpers[2].pid, (running ?? joined.observation).helpers[2].pid);
    // 原 Store 撤销只改变 status；保留的管理标记不代表仍能访问，随后核验实际重连拒绝。
    assert.equal(receipt.status, 'revoked'); assert.equal(receipt.management, true);
    await page.waitForFunction(() => window.__latestOfficeEngine.reads[0]?.settled);
    const [interrupted] = await reader.snapshot(); assert.equal(interrupted.pending, false);
    // 撤销移除页面可先触发原 cancel()；它返回 undefined，reset() 才拒绝 promise。
    if (shared && interrupted.failure === undefined) {
      assert.equal(interrupted.resultUndefined, true);
      assert.equal(interrupted.cancellations, 1, JSON.stringify(interrupted));
    } else assert.equal(interrupted.failure, 'connection_closed_outcome_unknown', JSON.stringify(interrupted));
    assert.equal(interrupted.metadata, undefined); assert.equal(interrupted.chunks, 0);
    await page.getByTestId('remote-workspace').waitFor({ state: 'detached' });
    assert.equal(await page.locator('[data-pdf-preview] canvas').count(), 0);
    const stopped = await verify(shared ? 'office-engine-shared-revoke-finished' : 'office-engine-revoke-stopped');
    await page.getByRole('heading', { name: '连接授权已失效', exact: true }).waitFor();
    await page.getByRole('button', { name: '重新连接', exact: true }).click();
    await page.getByRole('alert').filter({ hasText: '连接授权已失效' }).waitFor();
    assert.equal(await page.getByTestId('remote-workspace').count(), 0);
    assert.equal((await reader.snapshot()).length, 1);
    const [finalRead] = await reader.snapshot();
    assert.equal(finalRead.chunks, 0); assert.equal(finalRead.metadata, undefined);
    return { initial, running, joined, remaining, inFlight, beforeRevocation, trace, receipt, interrupted, stopped,
      originalNativeHelperRunningAtRevocation: true,
      ...(shared ? { revokedPhoneReaderReleasedOnlyOwnRequest: true, otherApprovedReaderCompletedOriginalPdf: true }
        : { revokedHelperAndQueueReleased: true }),
      oldPreviewRemovedWithoutResultOrResend: true, revokedReconnectDenied: true, sourcePreserved: true };
  } catch (error) { error.officeEngineRevocationTrace = trace; throw error; }
  finally { await reader.stop(); }
}

/** 手机取消自己的原请求；另一已批准连接继续消费同一个真实转换。 */
export async function verifyOfficeSharedEngineCancellation(page, panel, verify, { cancelJoinedReader = false } = {}) {
  const initial = await verify('office-engine-prepare');
  const reader = await observeReader(page, initial);
  try {
    const file = page.locator('[data-files-entry="file"]').getByRole('button', { name: initial.fileName, exact: true });
    await file.click();
    const running = await verify('office-engine-running');
    const joined = await verify('office-engine-shared-join');
    const [inFlight] = await reader.snapshot();
    assert.ok(inFlight.pending); assert.equal(inFlight.settled, false);
    assert.equal(inFlight.chunks, 0); assert.equal(inFlight.metadata, undefined);
    assert.equal(await panel.locator('[data-pdf-preview] canvas').count(), 0);
    if (cancelJoinedReader) {
      const remaining = await verify('office-engine-shared-cancel-joined');
      const [stillReading] = await reader.snapshot();
      assert.equal(stillReading.pending, true); assert.equal(stillReading.settled, false);
      assert.equal(stillReading.cancellations, 0); assert.equal(stillReading.chunks, 0);
      assert.equal(stillReading.metadata, undefined);
      await panel.locator('[data-pdf-preview] canvas').first().waitFor({ timeout: 120000 });
      const text = panel.locator('.textLayer').first(); await text.waitFor();
      assert.match(await text.innerText(), /DSHM transmission page 0/);
      const [finished] = await reader.snapshot();
      assert.equal(finished.pending, false); assert.equal(finished.settled, true);
      assert.equal(finished.cancellations, 0); assert.equal(finished.failure, undefined);
      assert.equal(finished.metadata.version, initial.metadata.version);
      assert.equal(finished.bytes, finished.metadata.bytes); assert.ok(finished.chunks > 0);
      const completed = await verify('office-engine-shared-phone-finished');
      assert.equal(finished.bytes, completed.pdfBytes);
      await closeOfficePanel(page, panel);
      await file.click();
      await panel.locator('[data-pdf-preview] canvas').first().waitFor({ timeout: 120000 });
      await text.waitFor(); assert.match(await text.innerText(), /DSHM transmission page 0/);
      const reads = await reader.snapshot();
      // 原手机已完成读取，重开沿原 OfficePreviewCache 命中，不应重复发起转换请求。
      assert.equal(reads.length, 1); assert.equal(reads[0].failure, undefined);
      assert.deepEqual(reads[0].metadata, finished.metadata); assert.equal(reads[0].bytes, finished.bytes);
      await closeOfficePanel(page, panel);
      const cached = await verify('office-engine-shared-phone-cached');
      assert.equal(cached.pdfBytes, completed.pdfBytes);
      const finalReads = await reader.snapshot();
      for (const read of finalReads) {
        assert.equal(read.settled, true); assert.equal(read.pending, false); assert.equal(read.cancellations, 0);
      }
      return { initial, running, joined, remaining, completed, cached, reads: finalReads,
        joinedRelayCancelledOnlyOwnReader: true, originalPhoneReaderCompletedActualPdfCanvasAndText: true,
        reopenedActualPdfCanvasAndText: true, reopenedFromCompletedPhoneCache: true,
        singleNativeHelperAcrossBothReadersAndReopen: true,
        scope: 'joined approved relay reader cancels; original Android reader finishes the same native conversion' };
    }
    await closeOfficePanel(page, panel);
    await page.waitForFunction(() => {
      const read = window.__latestOfficeEngine.reads[0];
      return read?.settled && read.cancellations === 1;
    });
    const remaining = await verify('office-engine-shared-remaining');
    const [cancelled] = await reader.snapshot();
    assert.equal(cancelled.pending, false); assert.equal(cancelled.resultUndefined, true);
    assert.equal(cancelled.failure, undefined); assert.equal(cancelled.metadata, undefined); assert.equal(cancelled.chunks, 0);
    const completed = await verify('office-engine-shared-finished');
    await file.click();
    await panel.locator('[data-pdf-preview] canvas').first().waitFor({ timeout: 120000 });
    const text = panel.locator('.textLayer').first(); await text.waitFor();
    assert.match(await text.innerText(), /DSHM transmission page 0/);
    const reads = await reader.snapshot();
    assert.equal(reads.length, 2); assert.equal(reads[1].failure, undefined);
    assert.equal(reads[1].metadata.version, initial.metadata.version);
    assert.equal(reads[1].metadata.generation, completed.reader.metadata.generation);
    assert.equal(reads[1].metadata.bytes, completed.reader.bytes);
    assert.ok(reads[1].chunks > 0);
    await closeOfficePanel(page, panel);
    const cached = await verify('office-engine-shared-cached');
    const finalReads = await reader.snapshot();
    assert.equal(finalReads[0].chunks, 0); assert.equal(finalReads[0].metadata, undefined);
    assert.equal(finalReads[1].settled, true); assert.equal(finalReads[1].pending, false);
    return { initial, running, joined, cancelled, remaining, completed, cached, reads: finalReads,
      actualPhoneUiCancelledOnlyOwnReader: true, otherAuthorizedRelayCompletedOriginalConversion: true,
      reopenedActualPdfCanvasAndText: true, singleNativeHelperAcrossBothReadersAndReopen: true,
      scope: 'actual Android reader and separate approved relay connection sharing one original native helper' };
  } finally { await reader.stop(); }
}
