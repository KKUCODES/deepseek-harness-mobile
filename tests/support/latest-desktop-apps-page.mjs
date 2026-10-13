import assert from 'node:assert/strict';
import { resolve } from 'node:path';

/** 观察真实原生传输，不替换响应；取消确认应产生零次启动调用。 */
export async function verifyLatestDesktopAppsPage(page, workspacePath, evidence, verifyOpen, prepareSidebar) {
  await page.evaluate(() => {
    const bridge = window.DSHMRemote, original = bridge.postMessage, operations = [];
    const observe = function(raw) {
      const message = JSON.parse(raw), operation = message.data?.frame?.operation;
      if (operation && ['remote.desktopApps', 'remote.desktopAppIcon', 'remote.prepareDesktopApp', 'remote.openDesktopApp'].includes(operation.method))
        operations.push({ method: operation.method, sessionId: operation.sessionId, appId: operation.appId });
      return original.call(this, raw);
    };
    bridge.postMessage = observe;
    window.__latestDesktopObserve = { operations, restore() { if (bridge.postMessage === observe) bridge.postMessage = original; } };
  });
  const mode = process.env.DSHM_LATEST_SOURCE_CHECK === '1' ? 'source' : 'npm';
  const dialog = page.getByRole('dialog', { name: '在电脑应用中打开', exact: true });
  try {
    await page.getByRole('button', { name: 'Remote 选项', exact: true }).click();
    await page.getByRole('button', { name: '在电脑应用中打开', exact: true }).click();
    const explorer = dialog.getByRole('button', { name: '文件资源管理器', exact: true });
    await explorer.waitFor({ timeout: 45000 });
    const image = explorer.locator('img');
    await image.waitFor();
    await image.evaluate(async node => { await node.decode(); });
    assert.ok(await image.evaluate(node => node.naturalWidth > 0 && node.naturalHeight > 0));
    await page.screenshot({ path: resolve(evidence, `latest-desktop-apps-${mode}-list.png`) });
    await explorer.click();
    await dialog.getByRole('button', { name: '确认在电脑打开', exact: true }).waitFor();
    assert.equal(await dialog.locator('.remote-file-path').innerText(), workspacePath);
    await page.screenshot({ path: resolve(evidence, `latest-desktop-apps-${mode}-confirm.png`) });
    await dialog.getByRole('button', { name: '取消', exact: true }).click();
    await explorer.waitFor();
    const operations = await page.evaluate(() => window.__latestDesktopObserve.operations);
    assert.equal(operations.filter(item => item.method === 'remote.openDesktopApp').length, 0);
    assert.ok(operations.some(item => item.method === 'remote.desktopApps'));
    assert.ok(operations.some(item => item.method === 'remote.desktopAppIcon' && item.appId === 'explorer'));
    assert.equal(operations.filter(item => item.method === 'remote.prepareDesktopApp' && item.appId === 'explorer').length, 1);
    let opened;
    if (verifyOpen) {
      await explorer.click();
      await dialog.getByRole('button', { name: '确认在电脑打开', exact: true }).click();
      await dialog.getByText('已向电脑发送打开请求。', { exact: true }).waitFor();
      opened = await verifyOpen('opened');
      await page.screenshot({ path: resolve(evidence, `latest-desktop-apps-${mode}-opened.png`) });
      await verifyOpen('closed');
      const after = await page.evaluate(() => window.__latestDesktopObserve.operations);
      assert.equal(after.filter(item => item.method === 'remote.openDesktopApp').length, 1);
    }
    await dialog.getByRole('button', { name: '关闭窗口', exact: true }).click();
    let sidebar;
    if (prepareSidebar) {
      const child = await prepareSidebar();
      const main = page.getByTestId('remote-workspace');
      const mainTitle = await main.locator('.remote-heading strong').innerText();
      await main.getByRole('button', { name: 'Remote 选项', exact: true }).click();
      await page.getByRole('button', { name: '子会话', exact: true }).click();
      const children = page.getByRole('dialog', { name: '子会话', exact: true });
      await children.getByRole('button', { name: '刷新子会话', exact: true }).click();
      await children.getByRole('group', { name: child.label, exact: true })
        .getByRole('button', { name: '在旁栏打开', exact: true }).click();
      const aside = page.getByTestId('remote-sidebar-conversation').filter({ visible: true });
      await aside.getByText('LATEST_SIDEBAR_CHILD_HISTORY', { exact: true }).waitFor();
      const action = aside.locator('[data-remote-desktop-app-action]');
      await action.getByRole('button', { name: '更多打开方式', exact: true }).click();
      const app = page.getByRole('menuitem', { name: /^文件资源管理器(?:（默认）)?$/ });
      await app.locator('img').evaluate(async node => { await node.decode(); });
      assert.ok(await app.locator('img').evaluate(node => node.naturalWidth > 0));
      await app.click();
      await dialog.getByRole('button', { name: '确认在电脑打开', exact: true }).waitFor();
      assert.equal(await dialog.locator('.remote-file-path').innerText(), child.workspacePath);
      let observed = await page.evaluate(() => window.__latestDesktopObserve.operations);
      assert.equal(observed.filter(item => item.method === 'remote.prepareDesktopApp').at(-1).sessionId, child.id);
      const beforeOpen = observed.filter(item => item.method === 'remote.openDesktopApp').length;
      await page.screenshot({ path: resolve(evidence, `latest-desktop-apps-${mode}-sidebar-confirm.png`) });
      await dialog.getByRole('button', { name: '取消', exact: true }).click();
      await dialog.getByRole('button', { name: '文件资源管理器', exact: true }).waitFor();
      observed = await page.evaluate(() => window.__latestDesktopObserve.operations);
      assert.equal(observed.filter(item => item.method === 'remote.openDesktopApp').length, beforeOpen);
      let childOpened;
      if (verifyOpen) {
        await dialog.getByRole('button', { name: '文件资源管理器', exact: true }).click();
        await dialog.getByRole('button', { name: '确认在电脑打开', exact: true }).click();
        await dialog.getByText('已向电脑发送打开请求。', { exact: true }).waitFor();
        childOpened = await verifyOpen('opened');
        await page.screenshot({ path: resolve(evidence, `latest-desktop-apps-${mode}-sidebar-opened.png`) });
        await verifyOpen('closed');
        observed = await page.evaluate(() => window.__latestDesktopObserve.operations);
        const opens = observed.filter(item => item.method === 'remote.openDesktopApp');
        assert.equal(opens.length, beforeOpen + 1); assert.equal(opens.at(-1).sessionId, child.id);
      }
      await dialog.getByRole('button', { name: '关闭窗口', exact: true }).click();
      const panel = page.getByRole('region', { name: '插件面板', exact: true });
      await panel.getByRole('button', { name: '面板操作', exact: true }).click();
      await page.getByRole('menuitem', { name: '关闭当前面板', exact: true }).click();
      await page.getByTestId('remote-sidebar-conversation').waitFor({ state: 'detached' });
      if (await panel.isVisible()) await panel.getByRole('button', { name: '返回聊天', exact: true }).click();
      assert.equal(await main.locator('.remote-heading strong').innerText(), mainTitle);
      sidebar = { passed: true, childId: child.id, source: child.source, workspaceConfirmed: true,
        originalMenuIconDecoded: true, cancelWithoutLaunch: true, confirmationUsesChildSession: true,
        actualAppLaunchVerified: !!verifyOpen, osObservation: childOpened, mainChatUnchanged: true, sidebarReleased: true };
    }
    return { passed: true, decodedExplorerIcon: true, workspaceConfirmed: true, cancelledWithoutOpen: true,
      actualAppLaunchVerified: !!verifyOpen, osObservation: opened, sidebar,
      operations: await page.evaluate(() => window.__latestDesktopObserve.operations) };
  } finally { await page.evaluate(() => { window.__latestDesktopObserve?.restore(); delete window.__latestDesktopObserve; }); }
}
