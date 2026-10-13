import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

/** 自有局部插件发起 enabled:true；取消/完成/未知继续走 DSHM 正式操作记录。 */
export async function verifyOfficialPluginAutoApplying({ page, device, evidence, plugins, openManager, mark }) {
  const control = plugins.applying, report = { automaticInstall: true };
  const main = page.getByTestId('remote-workspace');
  const manager = page.getByRole('region', { name: '管理电脑插件', exact: true });
  const surface = page.getByRole('region', { name: '插件面板', exact: true });
  const computerDialog = page.getByRole('dialog', { name: '电脑插件', exact: true });
  const openPanel = async () => {
    if (await manager.count()) await manager.getByRole('button', { name: '返回', exact: true }).click();
    if (await computerDialog.count()) await computerDialog.getByRole('button', { name: '关闭窗口', exact: true }).click();
    await main.getByRole('button', { name: 'Remote 选项', exact: true }).click();
    await page.getByRole('dialog', { name: 'Remote 选项', exact: true }).getByRole('button', { name: '插件面板', exact: true }).click();
    await surface.getByRole('button', { name: control.title, exact: true }).click();
    await page.getByTestId('auto-install-panel').waitFor();
    assert.equal(await page.locator('iframe').count(), 0);
  };
  const returnManager = async () => {
    if (await surface.count()) await surface.getByRole('button', { name: '返回聊天', exact: true }).click();
    if (!await manager.count()) await openManager();
    await manager.waitFor();
  };
  const operation = async (mode, state) => {
    const history = manager.locator('details.remote-plugin-operations');
    if (await history.getAttribute('open') === null) await history.locator('summary').click();
    const row = history.locator(`[data-operation-id][data-operation-state="${state}"]`)
      .filter({ hasText: control.specs[mode] }).filter({ hasText: '安装插件' }).last();
    await row.waitFor({ timeout: 60000 });
    return row;
  };
  const remove = async mode => {
    const name = control.names[mode], card = manager.locator(`[data-plugin-package="${name}"]`);
    await card.waitFor();
    await card.getByRole('button', { name: '查看 ' + name, exact: true }).click();
    await manager.getByRole('button', { name: '卸载 ' + name, exact: true }).click();
    const confirm = page.getByRole('dialog', { name: '卸载「' + name + '」？', exact: true });
    await confirm.getByRole('button', { name: '卸载', exact: true }).click();
    await confirm.waitFor({ state: 'detached', timeout: 120000 });
    await card.waitFor({ state: 'detached' });
    return control.verify(mode, false);
  };
  const start = async mode => {
    await openPanel();
    const row = page.getByTestId('auto-install-panel').locator(`[data-auto-install="${mode}"]`);
    await row.getByRole('button', { name: '安装并启用 ' + mode, exact: true }).click();
    const started = await control.started(mode);
    const output = row.locator('output');
    await output.filter({ hasText: '"phase":"applying"' }).waitFor({ timeout: 60000 });
    const progress = JSON.parse(await output.innerText());
    assert.equal(progress.phase, 'applying');
    assert.equal(await output.getAttribute('data-install-request'), control.requestIds[mode]);
    return { started, progress, requestId: control.requestIds[mode], row, output };
  };
  try {
    await manager.getByRole('button', { name: '添加插件', exact: true }).click();
    const add = page.getByRole('dialog', { name: '添加插件', exact: true });
    await add.getByRole('textbox', { name: '包名或地址', exact: true }).fill(control.specs.controller);
    await add.getByRole('button', { name: '安装', exact: true }).click();
    const current = page.getByRole('dialog').last();
    await current.locator('[data-install-phase="done"]').waitFor({ timeout: 60000 });
    report.controller = { installed: await control.verify('controller', true) };
    assert.equal(report.controller.installed.enabled, false);
    await current.getByRole('button', { name: '立即启用', exact: true }).click();
    await current.waitFor({ state: 'detached', timeout: 60000 });
    report.controller.enabled = await control.verify('controller', true);
    assert.equal(report.controller.enabled.enabled, true);
    await mark('official-own-plugin-auto-install-controls-in-mobile-local-surface');

    const finishing = await start('finish');
    await finishing.row.getByRole('button', { name: '请求取消 finish', exact: true }).click();
    await finishing.output.filter({ hasText: '"status":"too-late"' }).waitFor();
    const cancellation = JSON.parse(await finishing.output.innerText()).cancellation;
    assert.equal(cancellation.ok, true); assert.equal(cancellation.value.status, 'too-late');
    await writeFile(resolve(evidence, 'plugin-auto-applying-raw-too-late.png'), await device.screenshot());
    await returnManager();
    const pending = await operation('finish', 'pending');
    const operationId = await pending.getAttribute('data-operation-id');
    await pending.getByRole('button', { name: '取消此次安装', exact: true }).click();
    await manager.getByText('插件正在应用，已无法取消，请等待结果。', { exact: true }).waitFor();
    assert.equal(await pending.getAttribute('data-operation-state'), 'pending');
    assert.equal(await pending.getByText('已取消', { exact: true }).count(), 0);
    await writeFile(resolve(evidence, 'plugin-auto-applying-too-late.png'), await device.screenshot());
    control.finish();
    const completed = await operation('finish', 'complete');
    assert.equal(await completed.getAttribute('data-operation-id'), operationId);
    await completed.getByText('已完成', { exact: true }).waitFor();
    report.finish = { started: finishing.started, progress: finishing.progress, requestId: finishing.requestId,
      operationId, cancellation, formalTooLateNoticeShown: true, actualCompletionShown: true,
      settled: await control.settled('finish'), inventory: await control.verify('finish', true), removed: await remove('finish') };
    await mark('official-install-applying-too-late-original-completion-not-cancelled');

    const interrupted = await start('host');
    await returnManager();
    const hostPending = await operation('host', 'pending');
    const hostOperationId = await hostPending.getAttribute('data-operation-id');
    report.restart = await control.restart();
    await main.waitFor({ timeout: 60000 });
    await page.getByTestId('remote-offline-status').waitFor({ state: 'detached', timeout: 60000 });
    if (!await manager.count()) await openManager();
    await manager.waitFor();
    const unknown = await operation('host', 'unknown');
    assert.equal(await unknown.getAttribute('data-operation-id'), hostOperationId);
    await unknown.getByText('无法确认结果，请核对电脑插件列表。', { exact: true }).waitFor();
    assert.equal(await unknown.getByRole('button').count(), 0);
    report.host = { started: interrupted.started, progress: interrupted.progress, requestId: interrupted.requestId,
      operationId: hostOperationId, unknownResultShown: true, noAutomaticRetryControl: true,
      settled: await control.settled('host'), inventory: await control.verify('host', true) };
    await writeFile(resolve(evidence, 'plugin-auto-applying-host-unknown.png'), await device.screenshot());
    report.host.removed = await remove('host');
    report.controller.removed = await remove('controller');
    report.policy = await control.policyUnchanged(); report.restored = await control.unchanged();
    await mark('official-install-applying-host-exit-unknown-existing-selection-without-reinstall');
    report.passed = true;
    return report;
  } catch (error) { report.failure = error.message; throw error; }
  finally { await writeFile(resolve(evidence, 'plugin-auto-applying.json'), JSON.stringify(report, null, 2) + '\n'); }
}
