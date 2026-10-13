import assert from 'node:assert/strict';

/** 原连接菜单断开和重新连接；不能通过合成 ready、清缓存或替换 generation 证明恢复。 */
export async function verifyOfficeReconnect(page, panel, title, name, observation, verify) {
  const before = await observation.counts(name), original = await verify('office-connection-stat');
  const connectionCount = (await observation.connections()).length;
  await panel.getByRole('button', { name: '返回聊天', exact: true }).click();
  await page.getByRole('button', { name: 'Remote 选项', exact: true }).click();
  await page.getByRole('button', { name: '电脑连接', exact: true }).click();
  await page.getByRole('button', { name: '断开连接', exact: true }).click();
  await page.getByTestId('remote-state').filter({ hasText: '连接已断开' }).waitFor();
  assert.equal(await page.getByTestId('remote-workspace').count(), 0);
  await page.getByRole('button', { name: '重新连接', exact: true }).click();
  await page.getByTestId('remote-workspace').waitFor({ timeout: 60000 });
  await page.getByRole('button').filter({ hasText: title }).click();
  await page.getByRole('button', { name: 'Remote 选项', exact: true }).click();
  await page.getByRole('button', { name: '插件面板', exact: true }).click();
  await panel.getByRole('button', { name: '打开面板', exact: true }).click();
  await page.locator('[data-sidebar-right-guide-entry]').filter({ hasText: '工作区文件' }).click();
  await page.locator('[data-files-entry="file"]').getByRole('button', { name, exact: true }).click();
  await panel.locator('[data-pdf-preview] canvas').first().waitFor({ timeout: 60000 });
  const after = await observation.counts(name), current = await verify('office-connection-stat');
  assert.deepEqual(current, original, '断开和重连不能修改原文件或转换服务代次');
  assert.equal(after.conversions, before.conversions + 1, '重新连接必须重新读取 PDF，不沿用手机旧缓存');
  assert.ok(after.authorizations > before.authorizations);
  assert.ok(after.generations > before.generations);
  assert.equal(after.sourceVersions.at(-1), current.metadata.version);
  assert.equal(after.sourceGenerations.at(-1), current.generation);
  const connections = (await observation.connections()).slice(connectionCount);
  assert.ok(connections.some(frame => frame.type === 'closed' && frame.reason === 'user_disconnect'));
  assert.ok(connections.some(frame => frame.type === 'ready'));
  await panel.getByRole('button', { name: '面板操作', exact: true }).click();
  await page.getByRole('menuitem', { name: '关闭当前面板', exact: true }).click();
  await panel.locator('[data-pdf-preview] canvas').first().waitFor({ state: 'detached' });
  return { before, after, original, connections, actualNativeDisconnectAndReconnect: true,
    oldMobileCacheDiscarded: true, sourceAndServiceUnchanged: true, freshAuthorizedPdfCanvas: true };
}
