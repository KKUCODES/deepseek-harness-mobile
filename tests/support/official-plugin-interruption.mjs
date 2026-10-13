import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

/** 手机真实取消与官方进程退出；只有真实回执才能记为取消，未知结果不能重发安装。 */
export async function verifyOfficialPluginInterruption({ page, device, evidence, plugins, openManager, mark }) {
  const control = plugins.interruption, report = {};
  const main = page.getByTestId('remote-workspace');
  const manager = page.getByRole('region', { name: '管理电脑插件', exact: true });
  const start = async mode => {
    await manager.getByRole('button', { name: '添加插件', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: '添加插件', exact: true });
    await dialog.getByRole('textbox', { name: '包名或地址', exact: true }).fill(control.urls[mode]);
    await dialog.getByRole('button', { name: '安装', exact: true }).click();
    const running = page.getByRole('dialog').last();
    await running.locator('[data-install-phase="running"]').waitFor({ timeout: 30000 });
    return { dialog: running, started: await control.started(mode === 'host' ? 'host-exit' : mode) };
  };
  const operation = async (mode, state) => {
    const history = manager.locator('details.remote-plugin-operations');
    if (await history.getAttribute('open') === null) await history.locator('summary').click();
    const row = history.locator(`[data-operation-id][data-operation-state="${state}"]`)
      .filter({ hasText: control.urls[mode] }).last();
    await row.waitFor({ timeout: 30000 });
    return row;
  };
  try {
    const cancelled = await start('cancel');
    await cancelled.dialog.getByRole('button', { name: '取消安装', exact: true }).click();
    await page.getByRole('textbox', { name: '包名或地址', exact: true }).waitFor({ timeout: 60000 });
    await page.getByText('已取消安装，插件未启用，下载的文件可能保留', { exact: true }).waitFor();
    await page.keyboard.press('Escape');
    await cancelled.dialog.waitFor({ state: 'detached' });
    const row = await operation('cancel', 'complete');
    await row.getByText('已取消', { exact: true }).waitFor();
    report.cancel = { started: cancelled.started, settled: await control.settled('cancel'),
      operationId: await row.getAttribute('data-operation-id'), cancelledReceiptShown: true,
      inventory: await plugins.verify(false) };
    await writeFile(resolve(evidence, 'plugin-install-cancelled.png'), await device.screenshot());
    await mark('official-plugin-download-cancelled-and-receipt-verified');

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
    report.host = { started: interrupted.started, settled: await control.settled('host-exit'),
      operationId: await unknown.getAttribute('data-operation-id'), unknownResultShown: true,
      noAutomaticRetryControl: true, inventory: await plugins.verify(false) };
    report.restored = await control.unchanged();
    await writeFile(resolve(evidence, 'plugin-install-host-unknown.png'), await device.screenshot());
    await mark('official-plugin-download-host-exit-unknown-without-replay');
    report.passed = true;
    return report;
  } catch (error) { report.failure = error.message; throw error; }
  finally { await writeFile(resolve(evidence, 'plugin-interruption.json'), JSON.stringify(report, null, 2) + '\n'); }
}
