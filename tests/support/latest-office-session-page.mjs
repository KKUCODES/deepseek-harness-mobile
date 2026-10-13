import assert from 'node:assert/strict';
import { startOfficeObservation } from './latest-office-observation.mjs';

/** 原列表切换会话、原文件树预览；插件资源入口只用于真实的错误附件归属检查。 */
export async function verifyOfficeSessionOwnership(page, verify, captureOtherWorkspace) {
  const initial = await verify('office-session-prepare'), [first, same, other] = initial.sessions;
  const panel = page.getByRole('region', { name: '插件面板', exact: true });
  const observation = await startOfficeObservation(page);
  const displayed = [];
  const selected = () => page.getByTestId('remote-workspace').evaluate(element => {
    const key = Object.keys(element).find(name => name.startsWith('__reactFiber$'));
    for (let fiber = element[key]; fiber; fiber = fiber.return)
      if (fiber.memoizedProps?.model?.client) return fiber.memoizedProps.model.getSnapshot().selected;
    throw Error('office_session_model_missing');
  });
  const navigate = async session => {
    await page.locator('.remote-topbar').getByRole('button', { name: '返回', exact: true }).click();
    await page.locator('.remote-session-row').filter({ hasText: session.title }).click();
    assert.equal(await selected(), session.sessionId);
    await page.getByRole('textbox', { name: '消息', exact: true }).waitFor();
    assert.equal(await page.locator('[data-pdf-preview] canvas:visible').count(), 0);
  };
  const close = async () => {
    await panel.getByRole('button', { name: '面板操作', exact: true }).click();
    await page.getByRole('menuitem', { name: '关闭当前面板', exact: true }).click();
    await panel.locator('[data-pdf-preview] canvas').first().waitFor({ state: 'detached' });
    await panel.getByRole('button', { name: '返回聊天', exact: true }).click();
  };
  const openFile = async session => {
    assert.equal(await selected(), session.sessionId);
    await page.getByRole('button', { name: 'Remote 选项', exact: true }).click();
    await page.getByRole('button', { name: '插件面板', exact: true }).click();
    await panel.getByRole('button', { name: '打开面板', exact: true }).click();
    await page.locator('[data-sidebar-right-guide-entry]').filter({ hasText: '工作区文件' }).click();
    await page.locator('[data-files-entry="file"]').getByRole('button', { name: initial.fileName, exact: true }).click();
    await panel.locator('[data-pdf-preview] canvas').first().waitFor({ timeout: 60000 });
    await page.waitForFunction(expected => [...document.querySelectorAll('[data-pdf-text]')].some(node =>
      node.offsetParent !== null && node.textContent.replace(/\s+/g, '') === expected.replace(/\s+/g, '')),
    session.text, { timeout: 60000 });
    const text = await panel.locator('[data-pdf-text]:visible').first().innerText();
    assert.equal(text.replace(/\s+/g, ''), session.text.replace(/\s+/g, ''));
    displayed.push({ sessionId: session.sessionId, text });
    if (session.sessionId === other.sessionId) await captureOtherWorkspace();
    const address = await panel.locator('[data-textpreview-url]:visible').getAttribute('data-textpreview-url');
    assert.ok(decodeURIComponent(address).includes(session.sessionId));
    await close();
    return address;
  };
  const workspaceReads = async () => (await observation.reads()).filter(call =>
    call.method === 'remote.office' && call.path === initial.fileName);
  const authorizationCount = async id => (await observation.reads()).filter(call =>
    call.endpoint === 'workspaceFiles/readBytes' && call.path === initial.fileName && call.sessionId === id).length;
  const openAttachment = async () => {
    await page.getByRole('button', { name: '查看附件 ' + initial.attachment.name, exact: true }).click();
    await panel.locator('[data-pdf-preview] canvas').first().waitFor({ timeout: 60000 });
    const address = await panel.locator('[data-textpreview-url]:visible').getAttribute('data-textpreview-url');
    assert.ok(decodeURIComponent(address).includes(first.sessionId));
    assert.ok(decodeURIComponent(address).includes(initial.attachment.attachmentId));
    await close();
    return address;
  };
  try {
    assert.equal(await selected(), first.sessionId);
    const addresses = [await openFile(first)];
    assert.equal((await workspaceReads()).length, 1);
    const firstAuthorization = await authorizationCount(first.sessionId);
    assert.ok(firstAuthorization > 0);
    await openFile(first);
    assert.equal((await workspaceReads()).length, 1);
    assert.ok(await authorizationCount(first.sessionId) > firstAuthorization);
    await navigate(same); addresses.push(await openFile(same));
    assert.equal((await workspaceReads()).length, 2);
    assert.ok(await authorizationCount(same.sessionId) > 0);
    await navigate(other); addresses.push(await openFile(other));
    const reads = await workspaceReads();
    assert.equal(reads.length, 3);
    for (const [index, session] of initial.sessions.entries()) {
      assert.equal(reads[index].sessionId, session.sessionId);
      assert.equal(reads[index].settled, true); assert.equal(reads[index].failure, undefined);
      assert.equal(reads[index].metadata.absolutePath, session.metadata.absolutePath);
      assert.equal(reads[index].metadata.version, session.metadata.version);
      assert.equal(reads[index].metadata.generation, initial.generation);
    }
    assert.equal(new Set(addresses).size, 3);
    await navigate(first);
    const beforeReturn = await authorizationCount(first.sessionId);
    await openFile(first);
    assert.equal((await workspaceReads()).length, 3, '返回原会话可以复用它自己的缓存');
    assert.ok(await authorizationCount(first.sessionId) > beforeReturn, '复用也必须按原会话重新授权');

    const attachmentAddress = await openAttachment();
    await navigate(same);
    assert.equal(await page.getByRole('button', { name: '查看附件 ' + initial.attachment.name, exact: true }).count(), 0);
    const wrongAddress = 'dsh-resource://dshm-attachment/' + [same.sessionId, 'file', initial.attachment.attachmentId,
      initial.attachment.name].map(encodeURIComponent).join('/');
    await page.getByTestId('remote-workspace').evaluate((element, input) => {
      const key = Object.keys(element).find(name => name.startsWith('__reactFiber$'));
      for (let fiber = element[key]; fiber; fiber = fiber.return) if (fiber.memoizedProps?.model?.client) {
        const model = fiber.memoizedProps.model;
        if (model.getSnapshot().selected !== input.sessionId) throw Error('office_session_target_changed');
        model.pluginPanels.openResource(input.address); return;
      }
      throw Error('office_session_model_missing');
    }, { sessionId: same.sessionId, address: wrongAddress });
    await panel.getByText('无法预览此文档，请检查电脑连接、文件内容和访问权限后重试。', { exact: true }).waitFor();
    assert.equal(await panel.locator('[data-pdf-preview] canvas').count(), 0);
    const denied = (await observation.reads()).filter(call => call.method === 'remote.attachmentOffice'
      && call.sessionId === same.sessionId && call.attachmentId === initial.attachment.attachmentId);
    assert.equal(denied.length, 1);
    assert.equal(denied[0].failure, 'remote_attachment_not_referenced');
    assert.equal(denied[0].metadata, undefined);
    await close(); await navigate(first); await openAttachment();
    const attachments = (await observation.reads()).filter(call => call.method === 'remote.attachmentOffice'
      && call.sessionId === first.sessionId && call.attachmentId === initial.attachment.attachmentId);
    assert.equal(attachments.length, 2);
    for (const read of attachments) {
      assert.equal(read.settled, true); assert.equal(read.failure, undefined);
      assert.equal(read.metadata.attachmentId, initial.attachment.attachmentId);
      assert.equal(read.metadata.name, initial.attachment.name);
    }
    const final = await verify('office-session-finish');
    assert.equal(final.sourceAndServiceUnchanged, true);
    const authorizations = (await observation.reads()).filter(call =>
      call.endpoint === 'workspaceFiles/readBytes' && call.path === initial.fileName);
    return { sessions: initial.sessions, addresses, reads, authorizations, displayed, denied, attachments, attachmentAddress,
      sameSessionCacheReauthorized: true, differentSessionUsesOwnCache: true,
      sameNameOtherWorkspaceUsesOwnSource: true, actualPdfTextMatchesWorkspace: true, returnedSessionCacheReauthorized: true,
      wrongSessionAttachmentDeniedWithoutPdf: true, returnedAttachmentReauthorized: true,
      sourceAndServiceUnchanged: true };
  } finally { await observation.stop(); }
}
