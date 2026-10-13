import assert from 'node:assert/strict';
import { startOfficeObservation } from './latest-office-observation.mjs';
import { startPausedOfficeReader } from './latest-office-paused-reader.mjs';

/** 通过原返回/列表切换会话；保留标签布局，不向控制器发送关闭或取消指令。 */
export async function verifyOfficeSessionInFlight(page, verify, ownership, capture, prepareSidebar) {
  const [first, , other] = ownership.sessions;
  const initial = await verify('office-cancel-refresh');
  assert.equal(initial.sessionId, first.sessionId);
  const observation = await startOfficeObservation(page);
  const reader = await startPausedOfficeReader(page, initial);
  const panel = page.getByRole('region', { name: '插件面板', exact: true });
  const tabLifetime = () => page.getByTestId('remote-workspace').evaluate((element, target) => {
    const key = Object.keys(element).find(name => name.startsWith('__reactFiber$'));
    for (let fiber = element[key]; fiber; fiber = fiber.return) if (fiber.memoizedProps?.model?.client) {
      const model = fiber.memoizedProps.model;
      const layout = model.panelMemory.layouts.get(target.sessionId)?.bySession[target.sessionId]?.layout;
      const tab = Object.values(layout?.tabs ?? {}).find(tab => decodeURIComponent(tab.contentId)
        .endsWith('/' + target.fileName));
      if (!tab) return null;
      const occurrence = model.pluginPanels.tabDomain.occurrence(target.sessionId, tab);
      return { tabId: tab.id, occurrenceId: occurrence.id, aborted: occurrence.signal.aborted };
    }
    throw Error('office_session_inflight_model_missing');
  }, initial);
  const openPanel = async () => {
    await page.getByRole('button', { name: 'Remote 选项', exact: true }).click();
    await page.getByRole('button', { name: '插件面板', exact: true }).click();
  };
  const showFiles = async () => {
    await panel.getByRole('button', { name: '打开面板', exact: true }).click();
    await page.locator('[data-sidebar-right-guide-entry]').filter({ hasText: '工作区文件' }).click();
  };
  const navigate = async session => {
    await page.locator('.remote-topbar').getByRole('button', { name: '返回', exact: true }).click();
    await page.locator('.remote-session-row').filter({ hasText: session.title }).click();
    await page.getByRole('textbox', { name: '消息', exact: true }).waitFor();
    assert.equal(await page.locator('[data-pdf-preview] canvas:visible').count(), 0);
  };
  const closeTab = async () => {
    await panel.getByRole('button', { name: '面板操作', exact: true }).click();
    await page.getByRole('menuitem', { name: '关闭当前面板', exact: true }).click();
    await panel.locator('[data-pdf-preview] canvas').first().waitFor({ state: 'detached' });
    await panel.getByRole('button', { name: '返回聊天', exact: true }).click();
  };
  let child, originalChildTab;
  const childLifetime = () => page.getByTestId('remote-workspace').evaluate((element, childId) => {
    const key = Object.keys(element).find(name => name.startsWith('__reactFiber$'));
    for (let fiber = element[key]; fiber; fiber = fiber.return) if (fiber.memoizedProps?.model?.client) {
      const model = fiber.memoizedProps.model, id = model.getSnapshot().selected;
      // 旁栏布局属于父会话；跨主会话切换时仍从原父会话读取保留记录。
      const parent = model.panelMemory.layouts.get(childId.parentId)?.bySession[childId.parentId]?.layout;
      const tab = Object.values(parent?.tabs ?? {}).find(tab => tab.kind === 'subagentchat'
        && decodeURIComponent(tab.contentId).includes(childId.id));
      if (!tab) return null;
      const occurrence = model.pluginPanels.tabDomain.occurrence(childId.parentId, tab);
      return { tabId: tab.id, contentId: tab.contentId, occurrenceId: occurrence.id,
        aborted: occurrence.signal.aborted, mainSession: id };
    }
    throw Error('office_sidebar_inflight_model_missing');
  }, { id: child.id, parentId: first.sessionId });
  try {
    if (prepareSidebar) {
      child = await prepareSidebar();
      const main = page.getByTestId('remote-workspace');
      await main.getByRole('button', { name: 'Remote 选项', exact: true }).click();
      await page.getByRole('button', { name: '子会话', exact: true }).click();
      const children = page.getByRole('dialog', { name: '子会话', exact: true });
      await children.getByRole('button', { name: '刷新子会话', exact: true }).click();
      await children.getByRole('group', { name: child.label, exact: true })
        .getByRole('button', { name: '在旁栏打开', exact: true }).click();
      await page.getByTestId('remote-sidebar-conversation').getByText('LATEST_SIDEBAR_CHILD_HISTORY', { exact: true }).waitFor();
      originalChildTab = await childLifetime();
      assert.ok(originalChildTab); assert.equal(originalChildTab.aborted, false);
      assert.equal(originalChildTab.mainSession, first.sessionId);
      await capture('sidebar-open');
      await panel.getByRole('button', { name: '返回聊天', exact: true }).click();
    }
    await openPanel(); await showFiles();
    await page.locator('[data-files-entry="file"]').getByRole('button', { name: initial.fileName, exact: true }).click();
    await page.waitForFunction(windowSize => {
      const state = window.__latestOfficeCancellation.state;
      return state.chunks === windowSize && state.heldAcknowledgements === windowSize;
    }, initial.window, { timeout: 120000 });
    const held = await reader.snapshot();
    const originalTab = await tabLifetime();
    assert.ok(originalTab); assert.equal(originalTab.aborted, false);
    assert.equal(held.metadata.absolutePath, initial.metadata.absolutePath);
    assert.equal(held.metadata.version, initial.metadata.version);
    assert.ok(held.metadata.bytes > held.receivedBytes);
    assert.equal(held.receivedBytes, initial.window * initial.chunkBytes);
    assert.equal(held.pending, true); assert.equal(held.settled, false);
    assert.equal(await panel.locator('[data-pdf-preview] canvas').count(), 0);
    const otherReader = await verify('office-cancel-hold-other');
    assert.equal(otherReader.metadata.version, held.metadata.version);
    assert.equal((await verify('office-cancel-busy')).bothReadersOccupied, true);
    if (child) {
      assert.deepEqual(await childLifetime(), originalChildTab);
      assert.equal(await page.getByTestId('remote-sidebar-conversation').count(), 1);
      await capture('sidebar-file-held');
    }

    // 这里只收起窗口；标签保留。主聊天切换卸载原预览 body，由原 load signal 取消读取。
    await panel.getByRole('button', { name: '返回聊天', exact: true }).click();
    await navigate(other);
    await page.waitForFunction(() => {
      const state = window.__latestOfficeCancellation.state;
      return state.settled && state.cancellationSent;
    });
    const switched = await reader.snapshot();
    assert.deepEqual(await tabLifetime(), originalTab, '原标签和其生命周期在切换后保持');
    if (child) {
      const preserved = await childLifetime();
      assert.deepEqual({ ...preserved, mainSession: first.sessionId }, originalChildTab);
      assert.equal(preserved.mainSession, other.sessionId);
      assert.equal(await page.getByTestId('remote-sidebar-conversation').count(), 0);
    }
    assert.equal(switched.cancellations, 1);
    assert.equal(switched.pending, false); assert.equal(switched.resultUndefined, true);
    assert.equal(switched.failure, undefined); assert.equal(switched.chunks, initial.window);
    const released = await verify('office-cancel-released');
    assert.equal(released.phoneReaderReleased, true); assert.equal(released.sourcePreserved, true);
    assert.equal(await page.locator('[data-pdf-preview] canvas:visible').count(), 0);
    await reader.release();

    await openPanel(); await showFiles();
    await page.locator('[data-files-entry="file"]').getByRole('button', { name: 'latest-session-office.docx', exact: true }).click();
    await panel.locator('[data-pdf-preview] canvas').first().waitFor({ timeout: 60000 });
    await page.waitForFunction(expected => [...document.querySelectorAll('[data-pdf-text]')].some(node =>
      node.offsetParent !== null && node.textContent.replace(/\s+/g, '') === expected.replace(/\s+/g, '')),
    other.text, { timeout: 60000 });
    const otherText = await panel.locator('[data-pdf-text]:visible').first().innerText();
    assert.equal(otherText.replace(/\s+/g, ''), other.text.replace(/\s+/g, ''));
    assert.ok(decodeURIComponent(await panel.locator('[data-textpreview-url]:visible').getAttribute('data-textpreview-url'))
      .includes(other.sessionId));
    await capture('other'); await closeTab(); await navigate(first);

    await openPanel();
    // 从保留的原标签恢复，不重新创建标签或直接调用资源 API。
    const retainedTab = panel.locator('nav').getByRole('button', { name: initial.fileName, exact: true });
    assert.equal(await retainedTab.count(), 1);
    await retainedTab.click();
    await panel.locator('[data-pdf-preview] canvas').first().waitFor({ timeout: 60000 });
    assert.deepEqual(await tabLifetime(), originalTab);
    await page.waitForFunction(() => [...document.querySelectorAll('[data-pdf-text]')].some(node =>
      node.offsetParent !== null && node.textContent.replace(/\s+/g, '').startsWith('DSHMtransmissionpage0:')),
    undefined, { timeout: 60000 });
    const returnedText = await panel.locator('[data-pdf-text]:visible').first().innerText();
    assert.equal(returnedText.includes(other.text), false);
    assert.ok((await panel.innerText()).includes(initial.fileName));
    const reads = (await observation.reads()).filter(call => call.method === 'remote.office' && call.path === initial.fileName);
    assert.equal(reads.length, 2);
    for (const read of reads) {
      assert.equal(read.sessionId, first.sessionId);
      assert.equal(read.metadata.absolutePath, held.metadata.absolutePath);
      assert.equal(read.metadata.version, held.metadata.version);
      assert.equal(read.metadata.generation, held.metadata.generation);
      assert.equal(read.settled, true); assert.equal(read.failure, undefined);
    }
    assert.ok(decodeURIComponent(await panel.locator('[data-textpreview-url]:visible').getAttribute('data-textpreview-url'))
      .includes(first.sessionId));
    await capture('returned'); await closeTab();
    assert.equal(await tabLifetime(), null, '只有关闭标签才移除原生命周期');
    if (child) {
      await openPanel();
      assert.deepEqual(await childLifetime(), originalChildTab);
      await panel.locator('nav').getByRole('button', { name: child.label, exact: true }).click();
      const aside = page.getByTestId('remote-sidebar-conversation').filter({ visible: true });
      await aside.getByText('LATEST_SIDEBAR_CHILD_HISTORY', { exact: true }).waitFor();
      const selectedChild = await aside.evaluate(element => {
        const key = Object.keys(element).find(name => name.startsWith('__reactFiber$'));
        for (let fiber = element[key]; fiber; fiber = fiber.return) if (fiber.memoizedProps?.model?.getSnapshot)
          return fiber.memoizedProps.model.getSnapshot().selected;
        throw Error('office_sidebar_restored_view_missing');
      });
      assert.equal(selectedChild, child.id);
      await capture('sidebar-returned');
      await panel.getByRole('button', { name: '面板操作', exact: true }).click();
      await page.getByRole('menuitem', { name: '关闭当前面板', exact: true }).click();
      await aside.waitFor({ state: 'detached' });
      assert.equal(await childLifetime(), null);
      await panel.getByRole('button', { name: '返回聊天', exact: true }).click();
    }
    assert.equal((await verify('office-session-finish')).sourceAndServiceUnchanged, true);
    return { held, switched, released, reads, originalTab, returnedTextPrefix: returnedText.slice(0, 80), otherText,
      fromSession: first.sessionId, toSession: other.sessionId,
      originalUiNavigationCancelledTransmission: true, retainedTabRestoredWithFreshRead: true,
      originalTabOccurrencePreservedUntilClosed: true, returnedActualPdfTextVerified: true,
      hostReaderCapacityReleased: true, oldPdfNotDisplayedInOtherSession: true,
      otherWorkspaceActualPdfTextVerified: true, sourceAndServiceUnchanged: true,
      ...(child ? { sidebar: { child, originalChildTab, originalChildOccurrenceRetained: true,
        unmountedInOtherMainSession: true, actualChildHistoryRestored: true, closedOnlyByOriginalMenu: true } } : {}),
      scope: child ? 'retained child sidebar alongside main-session converted PDF during original main navigation'
        : 'original main chat navigation during converted PDF transmission; tab layout retained' };
  } finally {
    await reader.stop().catch(() => {}); await observation.stop().catch(() => {});
    await verify('office-cancel-cleanup');
  }
}
