import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

/** 覆盖安装如实等待官方重启；加载的是正常bundle，不走旧动态运行器。 */
export async function verifyOfficialPluginUpgrade({ page, device, evidence, plugins, openManager, mark }) {
  const upgrade = plugins.upgrade, report = {};
  const main = page.getByTestId('remote-workspace');
  const manager = page.getByRole('region', { name: '管理电脑插件', exact: true });
  const dialog = page.getByRole('dialog', { name: '电脑插件', exact: true });
  const openPanel = async name => {
    await manager.getByRole('button', { name: '返回', exact: true }).click();
    await dialog.getByRole('button', { name: '关闭窗口', exact: true }).click();
    await main.getByRole('button', { name: 'Remote 选项', exact: true }).click();
    await page.getByRole('dialog', { name: 'Remote 选项', exact: true })
      .getByRole('button', { name: '插件面板', exact: true }).click();
    const surface = page.getByRole('region', { name: '插件面板', exact: true });
    // 已打开标签的标题来自保存布局；从新版公开指南入口新开，核对实际代码。
    await surface.locator('nav').getByRole('button', { name: '打开面板', exact: true }).click();
    const entry = surface.locator('[data-sidebar-right-guide-entry="dshm-verification-panel"]');
    await entry.getByText(name, { exact: true }).waitFor();
    await entry.click();
    return surface;
  };
  try {
    await manager.getByRole('button', { name: '添加插件', exact: true }).click();
    const input = page.getByRole('dialog', { name: '添加插件', exact: true });
    await input.getByRole('textbox', { name: '包名或地址', exact: true }).fill(upgrade.spec);
    await input.getByRole('button', { name: '安装', exact: true }).click();
    const started = Date.now();
    while (true) {
      assert.ok(Date.now() - started < 120000, 'Upgrade did not produce a visible completion receipt');
      const phase = page.locator('[data-install-phase]:visible').last();
      if (!await phase.count()) {
        // 安装引起的公开模块刷新可能卸载原弹窗；核对本设备持久回执，不重发安装。
        await manager.waitFor();
        const history = manager.locator('details.remote-plugin-operations');
        if (await history.getAttribute('open') === null) await history.locator('summary').click();
        const item = history.locator('[data-operation-id]').filter({ hasText: upgrade.spec }).last();
        await item.waitFor({ timeout: 120000 });
        const settled = history.locator('[data-operation-id][data-operation-state="complete"]')
          .filter({ hasText: upgrade.spec }).last();
        await settled.waitFor({ timeout: 120000 });
        await settled.getByText('重启电脑 DSH 后生效', { exact: true }).waitFor();
        report.operationId = await settled.getAttribute('data-operation-id');
        report.completionSource = 'recent-operation-history';
        break;
      }
      const state = await phase.getAttribute('data-install-phase');
      assert.notEqual(state, 'failed', await phase.innerText());
      if (state === 'done') {
        const current = page.getByRole('dialog').last();
        assert.ok((await current.innerText()).includes('下次启动后加载'));
        const enable = current.getByRole('button', { name: '立即启用', exact: true });
        report.immediateEnableOffered = await enable.count() > 0;
        report.completionSource = 'dialog';
        await writeFile(resolve(evidence, 'plugin-upgrade-restart-required.png'), await device.screenshot());
        if (report.immediateEnableOffered) await enable.click();
        else await current.getByRole('button', { name: '完成', exact: true }).click();
        await current.waitFor({ state: 'detached' });
        break;
      }
      await page.waitForTimeout(200);
    }
    report.installed = await plugins.verify(true, upgrade.version);
    report.restartRequiredShown = true;
    await writeFile(resolve(evidence, 'plugin-upgrade-restart-required.png'), await device.screenshot());
    // 官方明确要求重启；这时只核对安装回执与目录，不假定旧界面继续可用。
    report.runtimeBeforeRestart = 'not-asserted-restart-required';
    await mark('official-plugin-upgrade-requires-normal-host-restart');
    report.restart = await upgrade.restart();
    await main.waitFor({ timeout: 60000 });
    await page.getByTestId('remote-offline-status').waitFor({ state: 'detached', timeout: 60000 });
    if (!await manager.count()) await openManager();
    report.reloadedInventory = await plugins.verify(true, upgrade.version);
    const surface = await openPanel(upgrade.title), local = page.getByTestId('live-panel');
    await local.getByRole('heading', { name: upgrade.heading, exact: true }).waitFor();
    await local.getByRole('button', { name: '面板计数 0', exact: true }).click();
    await local.getByRole('button', { name: '面板计数 1', exact: true }).waitFor();
    assert.equal(await page.locator('iframe').count(), 0);
    await writeFile(resolve(evidence, 'plugin-upgrade-new-runtime.png'), await device.screenshot());
    report.newGuideEntryVerified = true; report.newVersionRendered = true;
    report.interactionExecuted = true; report.noEmbeddedDesktop = true;
    await surface.getByRole('button', { name: '返回聊天', exact: true }).click();
    await openManager();
    await mark('official-plugin-upgrade-new-code-after-normal-restart');
    return report;
  } catch (error) { report.failure = error.message; throw error; }
  finally { await writeFile(resolve(evidence, 'plugin-upgrade.json'), JSON.stringify(report, null, 2) + '\n'); }
}
