import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { verifyOfficialPluginAutoApplying } from './official-plugin-auto-applying.mjs';

/** 手机通过正式「立即启用」与操作记录处理加载中断；安装回执与启用回执分别核对。 */
export async function verifyOfficialPluginApplying({ page, device, evidence, plugins, openManager, mark }) {
  if (plugins.applying.automaticInstall) return verifyOfficialPluginAutoApplying({ page, device, evidence, plugins, openManager, mark });
  const control = plugins.applying, report = {};
  const main = page.getByTestId('remote-workspace');
  const manager = page.getByRole('region', { name: '管理电脑插件', exact: true });
  const start = async mode => {
    await manager.getByRole('button', { name: '添加插件', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: '添加插件', exact: true });
    await dialog.getByRole('textbox', { name: '包名或地址', exact: true }).fill(control.specs[mode]);
    await dialog.getByRole('button', { name: '安装', exact: true }).click();
    const current = page.getByRole('dialog').last();
    await current.locator('[data-install-phase="done"]').waitFor({ timeout: 60000 });
    const installed = await control.verify(mode, true);
    assert.equal(installed.enabled, false);
    const enable = current.getByRole('button', { name: '立即启用', exact: true });
    await enable.click();
    const started = await control.started(mode);
    // 官方模块图更新可能已刷新原弹窗；在操作记录中继续核对原请求，不依赖旧节点。
    const activationUi = await page.locator('button').evaluateAll(nodes => {
      const node = nodes.find(item => item.textContent.trim() === '立即启用');
      return node ? { enableButtonHidden: false, disabled: node.disabled, busy: node.getAttribute('aria-busy') === 'true' }
        : { enableButtonHidden: true };
    });
    if (!activationUi.enableButtonHidden) { assert.equal(activationUi.disabled, true); assert.equal(activationUi.busy, true); }
    return { dialog: current, installed, started, activationUi };
  };
  const operation = async (mode, state) => {
    const history = manager.locator('details.remote-plugin-operations');
    if (await history.getAttribute('open') === null) await history.locator('summary').click();
    const row = history.locator(`[data-operation-id][data-operation-state="${state}"]`)
      .filter({ hasText: control.names[mode] }).filter({ hasText: '切换插件包' }).last();
    await row.waitFor({ timeout: 60000 });
    return row;
  };
  const remove = async mode => {
    const name = control.names[mode];
    const card = manager.locator(`[data-plugin-package="${name}"]`);
    await card.waitFor();
    await card.getByRole('button', { name: '查看 ' + name, exact: true }).click();
    await manager.getByRole('button', { name: '卸载 ' + name, exact: true }).click();
    const confirm = page.getByRole('dialog', { name: '卸载「' + name + '」？', exact: true });
    await confirm.getByRole('button', { name: '卸载', exact: true }).click();
    await confirm.waitFor({ state: 'detached', timeout: 120000 });
    await card.waitFor({ state: 'detached' });
    const inventory = await control.verify(mode, false);
    return inventory;
  };
  try {
    const finishing = await start('finish');
    await writeFile(resolve(evidence, 'plugin-applying.png'), await device.screenshot());
    if (await page.locator('[data-install-phase]').count()) {
      await finishing.dialog.getByRole('button', { name: '关闭', exact: true }).click();
      await finishing.dialog.waitFor({ state: 'detached' });
    }
    if (!await manager.count()) await openManager();
    const pending = await operation('finish', 'pending');
    const operationId = await pending.getAttribute('data-operation-id');
    assert.equal(await pending.getByRole('button').count(), 0);
    assert.equal(await pending.getAttribute('data-operation-state'), 'pending');
    await writeFile(resolve(evidence, 'plugin-activation-pending.png'), await device.screenshot());
    control.finish();
    const completed = await operation('finish', 'complete');
    assert.equal(await completed.getAttribute('data-operation-id'), operationId);
    await completed.getByText('已完成', { exact: true }).waitFor();
    assert.equal(await completed.getByText('已取消', { exact: true }).count(), 0);
    report.finish = { installed: finishing.installed, started: finishing.started, activationUi: finishing.activationUi,
      operationId, activationCannotBeCancelled: true, actualCompletionShown: true,
      settled: await control.settled('finish'), inventory: await control.verify('finish', true),
      removed: await remove('finish') };
    await mark('official-plugin-activation-loading-and-actual-success');

    const interrupted = await start('host');
    report.restart = await control.restart();
    await main.waitFor({ timeout: 60000 });
    await page.getByTestId('remote-offline-status').waitFor({ state: 'detached', timeout: 60000 });
    if (await page.locator('[data-install-phase]:visible').count()) await page.keyboard.press('Escape');
    if (!await manager.count()) await openManager();
    await manager.waitFor();
    const unknown = await operation('host', 'unknown');
    await unknown.getByText('无法确认结果，请核对电脑插件列表。', { exact: true }).waitFor();
    assert.equal(await unknown.getByRole('button').count(), 0);
    report.host = { installed: interrupted.installed, started: interrupted.started, activationUi: interrupted.activationUi,
      operationId: await unknown.getAttribute('data-operation-id'), unknownResultShown: true,
      noAutomaticRetryControl: true, settled: await control.settled('host'),
      inventory: await control.verify('host', true) };
    await writeFile(resolve(evidence, 'plugin-applying-host-unknown.png'), await device.screenshot());
    report.host.removed = await remove('host');
    report.policy = await control.policyUnchanged();
    report.restored = await control.unchanged();
    await mark('official-plugin-activation-host-exit-unknown-existing-bundle-without-reinstall');
    report.passed = true;
    return report;
  } catch (error) { report.failure = error.message; throw error; }
  finally { await writeFile(resolve(evidence, 'plugin-applying.json'), JSON.stringify(report, null, 2) + '\n'); }
}
