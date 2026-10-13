import assert from 'node:assert/strict';
import { startOfficeObservation, assertCachedOfficeRead, assertFreshOfficeRead } from './latest-office-observation.mjs';
import { verifyOfficeServiceCache } from './latest-office-service-page.mjs';
import { verifyOfficePreviewCancellation } from './latest-office-cancel-page.mjs';
import { verifyOfficeReconnect } from './latest-office-reconnect-page.mjs';
import { verifyOfficeNetworkRecovery } from './latest-office-network-page.mjs';
import { verifyOfficeEngineCancellation, verifyOfficeSharedEngineCancellation, verifyOfficeEngineNetworkRecovery,
  verifyOfficeEngineServiceLifecycle } from './latest-office-engine-page.mjs';

/** 只读取原UI正在持有的资源快照；不建立测试订阅或替换原provider。 */
async function snapshot(page, address) {
  return page.getByTestId('remote-workspace').evaluate((element, address) => {
    const key = Object.keys(element).find(name => name.startsWith('__reactFiber$'));
    for (let fiber = element[key]; fiber; fiber = fiber.return) {
      const resources = fiber.memoizedProps?.model?.ctx?.resources;
      if (resources) {
        const state = resources.source(address).getSnapshot();
        // 原RemoteFailure的code是getter，浏览器跨进程序列化不会保留它。
        return { ...state, failure: state.failure && { code: state.failure.code, message: state.failure.message } };
      }
    }
    throw Error('original_resource_model_missing');
  }, address);
}

async function waitMetadata(page, address, metadata) {
  const until = Date.now() + 20000;
  let current;
  do {
    current = await snapshot(page, address);
    if (current.status === 'live' && Object.keys(current.value ?? {}).length === Object.keys(metadata).length
      && Object.entries(metadata).every(([key, value]) => current.value[key] === value)) return current;
    await new Promise(resolve => setTimeout(resolve, 100));
  } while (Date.now() < until);
  assert.equal(current.status, 'live');
  assert.deepEqual(current.value, metadata);
}

/** 实际打开原文件树和原TextPreview；Host修改/删除/恢复均经过其原生目标观察流。 */
export async function verifyFileRefresh(page, title, verify) {
  await page.locator('.remote-topbar').getByRole('button', { name: '返回', exact: true }).click();
  await page.getByRole('button').filter({ hasText: title }).click();
  const initial = await verify('prepare');
  await page.getByRole('button', { name: 'Remote 选项', exact: true }).click();
  await page.getByRole('button', { name: '插件面板', exact: true }).click();
  const panel = page.getByRole('region', { name: '插件面板', exact: true });
  await panel.getByRole('button', { name: '打开面板', exact: true }).click();
  await page.locator('[data-sidebar-right-guide-entry]').filter({ hasText: '工作区文件' }).click();
  await page.locator('[data-files-entry="file"]').getByRole('button', { name: initial.fileName, exact: true }).click();
  const preview = page.locator('[data-textpreview-url]:visible');
  await preview.waitFor();
  const address = await preview.getAttribute('data-textpreview-url');
  assert.match(address, /^dsh-resource:\/\/file\/session\//);
  await preview.locator('[data-textpreview-body]').getByText(initial.content.trim(), { exact: true }).waitFor();
  await waitMetadata(page, address, initial.metadata);
  const updated = await verify('update');
  assert.notEqual(updated.metadata.version, initial.metadata.version);
  assert.notEqual(updated.metadata.bytes, initial.metadata.bytes);
  await preview.locator('[data-textpreview-body]').getByText(updated.content.trim(), { exact: true }).waitFor();
  await waitMetadata(page, address, updated.metadata);
  await verify('delete');
  await preview.locator('[data-textpreview-meta-failed="workspace-file/not-found"]').waitFor();
  const failed = await snapshot(page, address);
  assert.equal(failed.status, 'failed');
  assert.equal(failed.failure.code, 'workspace-file/not-found');
  const restored = await verify('restore');
  assert.notEqual(restored.metadata.version, updated.metadata.version);
  await preview.locator('[data-textpreview-body]').getByText(restored.content.trim(), { exact: true }).waitFor();
  await waitMetadata(page, address, restored.metadata);
  await preview.locator('[data-textpreview-meta-failed]').waitFor({ state: 'detached' });
  await panel.getByRole('button', { name: '面板操作', exact: true }).click();
  await page.getByRole('menuitem', { name: '关闭当前面板', exact: true }).click();
  await preview.waitFor({ state: 'detached' });
  const until = Date.now() + 10000;
  let released;
  do {
    released = await snapshot(page, address);
    if (released.status === 'loading' && released.value === undefined) break;
    await new Promise(resolve => setTimeout(resolve, 100));
  } while (Date.now() < until);
  assert.equal(released.status, 'loading');
  assert.equal(released.value, undefined, '关闭原预览应释放最后一个资源holder');
  let office = false;
  const officeFormats = [];
  const observation = initial.officeFileNames?.length ? await startOfficeObservation(page) : undefined;
  let officeCache;
  try {
    for (const name of initial.officeFileNames ?? []) {
      const open = async () => {
        await page.locator('[data-files-entry="file"]').getByRole('button', { name, exact: true }).click();
        await panel.locator('[data-pdf-preview] canvas').first().waitFor({ timeout: 60000 });
        assert.ok((await panel.innerText()).includes(name));
      };
      const close = async () => {
        await panel.getByRole('button', { name: '面板操作', exact: true }).click();
        await page.getByRole('menuitem', { name: '关闭当前面板', exact: true }).click();
        await panel.locator('[data-pdf-preview] canvas').first().waitFor({ state: 'detached' });
      };
      await open(); await close();
      if (!office) {
        const before = await observation.counts(name);
        await open(); await close();
        const after = await observation.counts(name);
        assertCachedOfficeRead(before, after);
        officeCache = { before, after, reusedWithAuthorization: true };
        if (initial.officeMetadata) {
          await open();
          await panel.locator('.textLayer').getByText(initial.officeMetadata.sourceText, { exact: true }).waitFor();
          await close();
          assertCachedOfficeRead(after, await observation.counts(name));
        }
        let restoredSource = false;
        try {
          const changed = await verify('office-update');
          await open();
          const address = await panel.locator('[data-textpreview-url]:visible').getAttribute('data-textpreview-url');
          await waitMetadata(page, address, changed.metadata);
          if (initial.officeMetadata) {
            assert.equal(changed.sameSizeAndMtime.sameFileIdentity, true);
            assert.equal(changed.sourceText, initial.officeMetadata.differentText);
            await panel.locator('.textLayer').getByText(changed.sourceText, { exact: true }).waitFor();
            assert.equal(await panel.locator('.textLayer').getByText(initial.officeMetadata.sourceText, { exact: true }).count(), 0);
          }
          const afterChange = await observation.counts(name);
          assertFreshOfficeRead(after, afterChange, changed.metadata.version);
          // 保持原预览打开，让原目标监听和自动刷新处理恢复后的版本。
          const oldCanvas = await panel.locator('[data-pdf-preview] canvas').first().elementHandle();
          const restored = await verify('office-restore');
          restoredSource = true;
          await waitMetadata(page, address, restored.metadata);
          await page.waitForFunction(node => !node.isConnected, oldCanvas, { timeout: 60000 });
          await oldCanvas.dispose();
          await panel.locator('[data-pdf-preview] canvas').first().waitFor({ timeout: 60000 });
          if (initial.officeMetadata) {
            assert.equal(restored.sameSizeAndMtime.bytes, changed.sameSizeAndMtime.bytes);
            assert.equal(restored.sameSizeAndMtime.mtimeNs, changed.sameSizeAndMtime.mtimeNs);
            await panel.locator('.textLayer').getByText(restored.sourceText, { exact: true }).waitFor();
            assert.equal(await panel.locator('.textLayer').getByText(changed.sourceText, { exact: true }).count(), 0);
          }
          await panel.locator('[data-textpreview-changed]').waitFor({ state: 'detached' });
          await close();
          const afterRestore = await observation.counts(name);
          assertFreshOfficeRead(afterChange, afterRestore, restored.metadata.version);
          officeCache = { ...officeCache, changed: changed.metadata, restored: restored.metadata,
            afterChange, afterRestore, changedSourceReloadedAndRestored: true, openPreviewAutomaticallyRefreshed: true };
          if (initial.officeMetadata) {
            await open(); await close();
            const cached = await observation.counts(name);
            assertCachedOfficeRead(afterRestore, cached);
            officeCache.sameSizeAndMtime = { changed: changed.sameSizeAndMtime, restored: restored.sameSizeAndMtime,
              changedAndRestoredPdfTextVerified: true, unchangedVersionReusedWithoutConversion: true, cached };
          }
          if (initial.officeServiceLifetime) officeCache.serviceLifetime =
            await verifyOfficeServiceCache(page, panel, name, observation, close, verify);
        } finally {
          if (!restoredSource) await verify('office-restore');
        }
      }
      officeFormats.push(name.slice(name.lastIndexOf('.') + 1));
      office = true;
    }
    if (initial.officeEngine && !initial.officeEngineLifecycle) {
      if (initial.officeEngineNetworkDrop) officeCache.engineNetworkRecovery = await verifyOfficeEngineNetworkRecovery(page, panel, verify, observation);
      else if (initial.officeEngineShared) officeCache.sharedEngineCancellation = await verifyOfficeSharedEngineCancellation(page, panel, verify,
        { cancelJoinedReader: initial.officeEngineJoinedCancel });
      else officeCache.engineCancellation = await verifyOfficeEngineCancellation(page, panel, verify);
    }
    if (initial.officeCancellation) {
      officeCache.previewCancellation = await verifyOfficePreviewCancellation(page, panel, verify, observation);
      if (initial.officeRecovery) officeCache.networkRecovery =
        await verifyOfficeNetworkRecovery(page, panel, initial.officeFileNames[0], observation, verify);
      officeCache.reconnect = await verifyOfficeReconnect(page, panel, title, initial.officeFileNames[0], observation, verify);
    }
  } finally {
    await observation?.stop();
  }
  await panel.getByRole('button', { name: '返回聊天', exact: true }).click();
  const officeAttachmentFormats = [];
  for (const file of initial.officeAttachments ?? []) {
    await page.getByRole('button', { name: '查看附件 ' + file.name, exact: true }).click();
    await panel.locator('[data-pdf-preview] canvas').first().waitFor({ timeout: 60000 });
    const address = await panel.locator('[data-textpreview-url]:visible').getAttribute('data-textpreview-url');
    assert.ok(address.startsWith('dsh-resource://dshm-attachment/'));
    assert.ok(decodeURIComponent(address).includes(file.attachmentId));
    assert.ok((await panel.innerText()).includes(file.name));
    await panel.getByRole('button', { name: '面板操作', exact: true }).click();
    await page.getByRole('menuitem', { name: '关闭当前面板', exact: true }).click();
    await panel.locator('[data-pdf-preview] canvas').first().waitFor({ state: 'detached' });
    await panel.getByRole('button', { name: '返回聊天', exact: true }).click();
    officeAttachmentFormats.push(file.name.slice(file.name.lastIndexOf('.') + 1));
  }
  if (initial.officeEngineLifecycle) {
    // 服务停用清空原缓存；先完成附件回归，避免把后续附件转换误计为专项读者。
    await page.getByRole('button', { name: 'Remote 选项', exact: true }).click();
    await page.getByRole('button', { name: '插件面板', exact: true }).click();
    await panel.getByRole('button', { name: '打开面板', exact: true }).click();
    await page.locator('[data-sidebar-right-guide-entry]').filter({ hasText: '工作区文件' }).click();
    officeCache.engineServiceLifecycle = await verifyOfficeEngineServiceLifecycle(page, panel, verify, { shared: initial.officeEngineShared });
    await panel.getByRole('button', { name: '返回聊天', exact: true }).click();
  }
  return { initial: initial.metadata, updated: updated.metadata, restored: restored.metadata, released: true,
    office, officeFormats, officeAttachmentFormats, officeCache };
}
