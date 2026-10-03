import assert from 'node:assert/strict';
import { resolve } from 'node:path';

export async function checkDesktopApps(page) {
  await page.evaluate(async () => { await window.fixture.select('two'); window.fixture.setupDesktopApps(); });
  await page.getByRole('button', { name: 'Remote 选项', exact: true }).click();
  await page.getByRole('button', { name: '在电脑应用中打开', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: '在电脑应用中打开', exact: true });
  const app = dialog.getByRole('button', { name: 'VS Code', exact: true });
  await app.click();
  await dialog.getByText('即将在「test-pc」上使用「VS Code」打开：', { exact: true }).waitFor();
  await page.screenshot({ path: resolve('artifacts/desktop-apps-confirm-web.png') });
  await dialog.getByRole('button', { name: '取消', exact: true }).click();
  assert.equal((await page.evaluate(() => window.fixture.desktopApps.snapshot())).calls.filter(call => call.method === 'remote.openDesktopApp').length, 0);
  await app.click(); await dialog.getByRole('button', { name: '确认在电脑打开', exact: true }).click();
  await dialog.getByText('已向电脑发送打开请求。', { exact: true }).waitFor();
  assert.equal((await page.evaluate(() => window.fixture.desktopApps.snapshot())).calls.filter(call => call.method === 'remote.openDesktopApp').length, 1);
  await page.evaluate(() => window.fixture.desktopApps.failOpen());
  await app.click(); await dialog.getByRole('button', { name: '确认在电脑打开', exact: true }).click();
  await dialog.getByText('打开结果尚未确认，请先在电脑上核对。', { exact: true }).waitFor();
  assert.equal(await dialog.getByRole('button', { name: '确认在电脑打开', exact: true }).count(), 0);
  await page.evaluate(() => window.fixture.desktopApps.hold(true));
  await app.click();
  await page.waitForFunction(() => window.fixture.desktopApps.snapshot().pending === 1);
  await page.evaluate(() => window.fixture.desktopApps.connection('disconnected'));
  await dialog.getByText('电脑连接已断开，重新连接后可继续操作。', { exact: true }).waitFor();
  await page.evaluate(() => { window.fixture.desktopApps.hold(false); window.fixture.desktopApps.connection('connected'); window.fixture.desktopApps.release(); });
  await app.waitFor();
  assert.equal(await dialog.getByRole('button', { name: '确认在电脑打开', exact: true }).count(), 0);
  await page.evaluate(() => window.fixture.desktopApps.connection('connected', false));
  await dialog.getByText('请更新电脑远程插件及兼容补丁，并确认电脑桌面可用。', { exact: true }).waitFor();
  assert.equal(await app.count(), 0);
  const result = await page.evaluate(() => window.fixture.desktopApps.snapshot());
  assert.equal(result.calls.filter(call => call.method === 'remote.openDesktopApp').length, 2);
  assert.ok(result.cancelled.includes('remote.prepareDesktopApp'));
  await dialog.getByRole('button', { name: '关闭窗口', exact: true }).click();
  await page.evaluate(() => { window.fixture.desktopApps.connection('connected'); window.fixture.desktopApps.header(true); });
  await page.evaluate(() => window.fixture.desktopApps.icons());
  const action = page.locator('[data-remote-desktop-app-action]');
  await page.waitForFunction(() => [...document.querySelectorAll('[data-remote-desktop-app-action] img')]
    .some(img => img.src.startsWith('data:image/svg+xml;base64,') && img.complete && img.naturalWidth === 32));
  await action.getByRole('button', { name: '选择打开方式', exact: true }).click();
  await page.getByRole('menuitem', { name: 'VS Code', exact: true }).click();
  await dialog.getByText('即将在「test-pc」上使用「VS Code」打开：', { exact: true }).waitFor();
  await dialog.getByRole('button', { name: '取消', exact: true }).click();
  await page.waitForFunction(() => [...document.querySelectorAll('[data-desktop-app-icon]')]
    .some(img => img.src.startsWith('data:image/svg+xml;base64,') && img.complete && img.naturalWidth === 32));
  await dialog.getByRole('button', { name: '关闭窗口', exact: true }).click();
  assert.equal((await page.evaluate(() => window.fixture.desktopApps.snapshot())).calls.filter(call => call.method === 'remote.openDesktopApp').length, 2);
  await page.evaluate(async () => { await window.fixture.enableSidebarResources(); await window.fixture.select('one'); });
  const main = page.getByTestId('remote-workspace');
  await main.getByRole('button', { name: 'Remote 选项', exact: true }).click();
  await page.getByRole('button', { name: '子会话', exact: true }).click();
  await page.getByRole('dialog', { name: '子会话', exact: true }).getByRole('group', { name: '分析助手', exact: true })
    .getByRole('button', { name: '在旁栏打开', exact: true }).click();
  const aside = page.getByTestId('remote-sidebar-conversation').filter({ visible: true });
  await aside.locator('[data-remote-desktop-app-action]').getByRole('button', { name: '选择打开方式', exact: true }).click();
  await page.getByRole('menuitem', { name: 'VS Code', exact: true }).click();
  await dialog.getByText('即将在「test-pc」上使用「VS Code」打开：', { exact: true }).waitFor();
  const calls = (await page.evaluate(() => window.fixture.desktopApps.snapshot())).calls;
  assert.equal(calls.filter(call => call.method === 'remote.prepareDesktopApp').at(-1).sessionId, 'child-chat');
  assert.equal((await page.evaluate(() => window.fixture.sidebarState())).selected, 'one');
  await dialog.getByRole('button', { name: '取消', exact: true }).click();
  await dialog.getByRole('button', { name: '关闭窗口', exact: true }).click();
  await page.getByRole('region', { name: '插件面板', exact: true }).getByRole('button', { name: '返回聊天', exact: true }).click();
  await page.evaluate(() => window.fixture.desktopApps.header(false));
  assert.equal(await action.count(), 0);
  return { menu: true, cancelWithoutLaunch: true, confirmOnce: true, unknownNotRetried: true, disconnectLateReplyDiscarded: true, reconnected: true, unsupported: true, originalMenuToSharedConfirmation: true, sidebarSessionIsolated: true, removedPluginHidden: true, iconImagesDecoded: true };
}
