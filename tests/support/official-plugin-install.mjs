import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { verifyOfficialPluginUpgrade } from './official-plugin-upgrade.mjs';
import { verifyOfficialPluginInterruption } from './official-plugin-interruption.mjs';
import { verifyOfficialPluginScripts } from './official-plugin-scripts.mjs';
import { verifyOfficialPluginApplying } from './official-plugin-applying.mjs';
import { verifyOfficialPluginLayout, cleanOfficialPluginLayout, verifyOfficialPluginLayoutDisposed } from './official-plugin-layout.mjs';

/** 按官方实际返回的启用/重启结果验收；不预设当前 Host 的 HMR 状态。 */
export async function verifyOfficialPluginInstall({ page, device, evidence, plugins, fingerprint, title, mark }) {
  const report = {}, main = page.getByTestId('remote-workspace');
  if (plugins.upgrade) report.upgradePreparation = await plugins.upgrade.prepare();
  if (plugins.interruption) report.interruptionPreparation = await plugins.interruption.prepare();
  if (plugins.scripts) report.scriptsPreparation = await plugins.scripts.prepare();
  if (plugins.applying) report.applyingPreparation = await plugins.applying.prepare();
  if (plugins.layout) report.layoutPreparation = await plugins.layout.prepare();
  const editor = main.locator('[data-composer-input]');
  await editor.fill('OFFICIAL_PLUGIN_DRAFT');
  const dialog = page.getByRole('dialog', { name: '电脑插件', exact: true });
  const manager = page.getByRole('region', { name: '管理电脑插件', exact: true });
  const openManager = async () => {
    await main.waitFor({ timeout: 60000 });
    const row = main.locator('.remote-session-row').filter({ hasText: title });
    if (await row.count()) await row.click();
    await main.getByRole('button', { name: 'Remote 选项', exact: true }).click();
    await page.getByRole('dialog', { name: 'Remote 选项', exact: true }).getByRole('button', { name: '电脑插件', exact: true }).click();
    await dialog.getByRole('button', { name: '管理电脑插件', exact: true }).click();
  };
  const reconnectPermissions = async () => {
    // 网关变更设备权限会结束旧连接；沿真实用户入口重新鉴权，而非等待原页面自动提权。
    await page.getByText('电脑已调整这台手机的权限，请重新连接。', { exact: true }).waitFor();
    await page.getByRole('button', { name: '重新连接', exact: true }).click();
    await openManager();
  };
  await openManager();
  await manager.getByText('请在电脑 DSH Mobile 插件中，为此设备授予管理权限。', { exact: true }).waitFor();
  assert.equal(await manager.getByRole('button', { name: '添加插件', exact: true }).count(), 0);
  report.managementRequired = true;
  await mark('official-plugin-management-denied-before-grant');
  let granted = false;
  try {
    await plugins.management(fingerprint, true); granted = true;
    await reconnectPermissions();
    await manager.getByRole('button', { name: '添加插件', exact: true }).waitFor({ timeout: 60000 });
    if (plugins.interruption) report.interruption = await verifyOfficialPluginInterruption({ page, device, evidence, plugins, openManager, mark });
    if (plugins.scripts) report.scripts = await verifyOfficialPluginScripts({ page, device, evidence, plugins, mark });
    if (plugins.applying) report.applying = await verifyOfficialPluginApplying({ page, device, evidence, plugins, openManager, mark });
    await manager.getByRole('button', { name: '添加插件', exact: true }).click();
    let current = page.getByRole('dialog', { name: '添加插件', exact: true });
    await current.getByRole('textbox', { name: '包名或地址', exact: true }).fill(plugins.spec);
    await current.getByRole('button', { name: '安装', exact: true }).click();
    current = page.getByRole('dialog').last();
    const result = current.locator('[data-install-phase="done"], [data-install-phase="failed"]');
    await result.waitFor({ timeout: 120000 });
    assert.equal(await result.getAttribute('data-install-phase'), 'done', await current.innerText());
    const notice = await current.innerText();
    const enable = current.getByRole('button', { name: '立即启用', exact: true });
    const enableOffered = await enable.count() > 0;
    report.install = { ...(await plugins.verify(true)), restartNoticeShown: notice.includes('下次启动后加载'),
      immediateEnableOffered: enableOffered, notice };
    await writeFile(resolve(evidence, 'plugin-install.png'), await device.screenshot());
    if (enableOffered) await enable.click();
    else await current.getByRole('button', { name: '完成', exact: true }).click();
    await current.waitFor({ state: 'detached' });
    await mark('official-phone-plugin-install-and-activation-result');
    if (enableOffered && !report.install.restartNoticeShown) {
      await manager.getByRole('button', { name: '返回', exact: true }).click();
      await dialog.getByRole('button', { name: '关闭窗口', exact: true }).click();
      await main.getByRole('button', { name: 'Remote 选项', exact: true }).click();
      await page.getByRole('dialog', { name: 'Remote 选项', exact: true })
        .getByRole('button', { name: '插件面板', exact: true }).click();
      const surface = page.getByRole('region', { name: '插件面板', exact: true });
      await surface.getByRole('button', { name: 'DSHM 面板验收', exact: true }).click();
      const local = page.getByTestId('live-panel');
      await local.waitFor();
      if (plugins.layout) report.layout = await verifyOfficialPluginLayout({ page, device, evidence, plugins, surface, title, mark });
      const geometry = await local.evaluate(node => ({ original: node.offsetWidth,
        displayed: node.getBoundingClientRect().width, viewport: innerWidth }));
      assert.equal(geometry.original, 720);
      assert.ok(geometry.displayed < 720 && geometry.displayed <= geometry.viewport);
      assert.equal(await page.locator('iframe').count(), 0);
      await local.getByRole('button', { name: '面板计数 0', exact: true }).click();
      await local.getByRole('button', { name: '选择其他面板', exact: true }).click();
      await surface.locator('nav').getByRole('button', { name: 'DSHM 面板验收', exact: true }).click();
      await local.getByRole('button', { name: '面板计数 1', exact: true }).waitFor();
      await local.getByRole('button', { name: '打开插件弹窗', exact: true }).click();
      const modal = page.getByRole('dialog', { name: '原插件弹窗', exact: true });
      await modal.getByRole('textbox', { name: '插件弹窗输入', exact: true }).fill('OFFICIAL_LOCAL_PLUGIN');
      await modal.getByRole('button', { name: '弹窗菜单', exact: true }).click();
      await page.getByRole('menuitem', { name: '填入菜单值', exact: true }).click();
      assert.equal(await modal.getByRole('textbox', { name: '插件弹窗输入', exact: true }).inputValue(), 'menu-value');
      await writeFile(resolve(evidence, 'plugin-local-ui.png'), await device.screenshot());
      await modal.getByRole('button', { name: '关闭插件弹窗', exact: true }).click();
      await surface.getByRole('button', { name: '返回聊天', exact: true }).click();
      await main.getByRole('button', { name: 'Remote 选项', exact: true }).click();
      await page.getByRole('dialog', { name: 'Remote 选项', exact: true }).getByRole('button', { name: '插件面板', exact: true }).click();
      await surface.locator('nav').getByRole('button', { name: 'DSHM 面板验收', exact: true }).click();
      await local.getByRole('button', { name: '面板计数 1', exact: true }).waitFor();
      report.localUi = { ownMobilePage: true, iframeAbsent: true, geometry,
        interactive: true, modalAndMenu: true, stateRetained: true };
      await surface.getByRole('button', { name: '返回聊天', exact: true }).click();
      await openManager();
      await mark('official-static-plugin-local-ui-and-state');
    }
    if (plugins.upgrade) report.upgrade = await verifyOfficialPluginUpgrade({ page, device, evidence, plugins, openManager, mark });
    if (plugins.layout) {
      assert.equal(report.layout?.passed, true, 'Layout requires an actually loaded local plugin');
      await manager.getByRole('button', { name: '返回', exact: true }).click();
      await cleanOfficialPluginLayout({ page, plugins, dialog, report: report.layout });
      await dialog.getByRole('button', { name: '管理电脑插件', exact: true }).click();
    }
    const card = manager.locator(`[data-plugin-package="${plugins.packageName}"]`);
    await card.waitFor();
    await card.getByRole('button', { name: '查看 ' + plugins.packageName, exact: true }).click();
    await manager.getByRole('button', { name: '卸载 ' + plugins.packageName, exact: true }).click();
    const confirm = page.getByRole('dialog', { name: '卸载「' + plugins.packageName + '」？', exact: true });
    plugins.removing();
    await confirm.getByRole('button', { name: '卸载', exact: true }).click();
    await confirm.waitFor({ state: 'detached', timeout: 120000 });
    await card.waitFor({ state: 'detached' });
    report.remove = await plugins.verify(false);
    if (plugins.upgrade) report.upgradeCleanup = await plugins.upgrade.unchanged();
    if (plugins.interruption) report.interruptionCleanup = await plugins.interruption.unchanged();
    if (plugins.scripts) report.scriptsCleanup = await plugins.scripts.unchanged();
    if (plugins.applying) report.applyingCleanup = await plugins.applying.unchanged();
    if (plugins.layout) {
      await verifyOfficialPluginLayoutDisposed({ page, plugins, report: report.layout, evidence });
      report.layoutCleanup = await plugins.layout.unchanged();
    }
    await mark('official-phone-plugin-uninstall-inventory');
    await plugins.management(fingerprint, false); granted = false;
    await reconnectPermissions();
    await manager.getByText('请在电脑 DSH Mobile 插件中，为此设备授予管理权限。', { exact: true }).waitFor({ timeout: 60000 });
    assert.equal(await manager.getByRole('button', { name: '添加插件', exact: true }).count(), 0);
    report.managementReturned = true;
    await manager.getByRole('button', { name: '返回', exact: true }).click();
    await dialog.getByRole('button', { name: '关闭窗口', exact: true }).click();
    assert.equal(await editor.innerText(), 'OFFICIAL_PLUGIN_DRAFT');
    await editor.fill('');
    report.draftPreserved = true;
    await mark('official-plugin-management-revoked-chat-retained');
    return report;
  } catch (error) { report.failure = error.message; report.failureText = await page.locator('body').innerText(); throw error; }
  finally {
    if (granted) await plugins.management(fingerprint, false);
    await writeFile(resolve(evidence, 'plugin-install.json'), JSON.stringify(report, null, 2) + '\n');
  }
}
