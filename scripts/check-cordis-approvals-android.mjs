import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';

/** 原 Host run/审批和原手机运行器；维护门闩仅阻止测试回执触发模型。 */
export async function checkCordisApprovalsAndroid(page, main, { onPending } = {}) {
  let seed = JSON.parse(await readFile('artifacts/cordis-live-host.json', 'utf8'));
  let sequence = 0;
  const host = async (action, version) => {
    const id = `cordis-approval-${Date.now()}-${++sequence}`;
    await writeFile('artifacts/cordis-approval-control.json', JSON.stringify({ id, runId: seed.runId, action, version }));
    const until = Date.now() + 10000;
    while (Date.now() < until) {
      let value;
      try { value = JSON.parse(await readFile('artifacts/cordis-approval-host.json', 'utf8')); }
      catch (error) { if (error.code !== 'ENOENT' && !(error instanceof SyntaxError)) throw error; }
      if (value?.id === id) { assert.equal(value.error, undefined, value.error); return value; }
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    throw Error(`Host verification timed out: ${action}`);
  };
  const report = {};
  const panel = page.getByRole('region', { name: '插件面板', exact: true });
  const popup = panel.locator('[data-cordis-panel]');
  const row = popup.locator(`[data-cordis-row="${seed.pluginId}"]`);
  const view = main.getByRole('button', { name: '查看请求', exact: true });
  const close = () => panel.getByRole('button', { name: '返回聊天', exact: true }).click();
  const openNotice = async () => {
    await view.click(); await row.locator('[data-cordis-approve]').waitFor();
    const box = await popup.boundingBox();
    const viewport = await page.evaluate(() => ({ width: innerWidth, height: innerHeight }));
    assert.ok(box.x >= 0 && box.y >= 0 && box.x + box.width <= viewport.width + 1 && box.y + box.height <= viewport.height + 1);
    return box;
  };
  const echo = async text => {
    const button = main.getByTestId('cordis-live-echo');
    await button.getByText('验证 Host 调用', { exact: true }).waitFor();
    await button.click();
    await button.getByText(text, { exact: true }).waitFor();
  };
  try {
    const rejected = await host('request', 1);
    assert.equal(rejected.result.status, 'awaiting-approval');
    assert.equal(rejected.inventory[0].activeRun, undefined);
    await view.waitFor();
    if (onPending) report.noticeLanguage = await onPending();
    await page.screenshot({ path: 'artifacts/cordis-approval-notice-android.png' });
    report.bounds = await openNotice();
    await page.screenshot({ path: 'artifacts/cordis-approval-pending-android.png' });
    await row.locator('[data-cordis-decline]').click();
    await view.waitFor({ state: 'detached' }); await close();
    const declined = await host('inspect');
    assert.equal(declined.inventory[0].latestRun.status, 'rejected');
    assert.equal(declined.inventory[0].activeRun, undefined);
    report.declined = true;

    assert.equal((await host('request', 1)).result.status, 'awaiting-approval');
    await openNotice(); await row.locator('[data-cordis-approve]').click();
    await view.waitFor({ state: 'detached' });
    await main.getByTestId('cordis-live-echo').waitFor({ state: 'attached' }); await close();
    await echo('DSHM_CORDIS_ECHO');
    const first = await host('inspect'); assert.equal(first.inventory[0].latestRun.status, 'running');
    report.approvedOnce = first.inventory[0].currentPackageId;

    assert.equal((await host('request', 2)).result.status, 'awaiting-approval');
    await openNotice(); await row.locator('[data-cordis-approve-plugin]').click();
    await view.waitFor({ state: 'detached' });
    await popup.waitFor({ state: 'detached' }); await close();
    await echo('DSHM_CORDIS_ECHO_V2');
    const second = await host('inspect'); assert.equal(second.inventory[0].latestRun.status, 'running');
    assert.notEqual(second.inventory[0].currentPackageId, report.approvedOnce);
    report.approvedFuture = second.inventory[0].currentPackageId;

    assert.equal((await host('request', 3)).result.status, 'starting');
    await echo('DSHM_CORDIS_ECHO_V3');
    assert.equal(await view.count(), 0);
    const third = await host('inspect'); assert.equal(third.inventory[0].latestRun.status, 'running');
    assert.notEqual(third.inventory[0].currentPackageId, report.approvedFuture);
    report.futureVersionAutomatic = third.inventory[0].currentPackageId;
    await page.screenshot({ path: 'artifacts/cordis-approval-v3-android.png' });

    if (process.env.DSHM_CORDIS_HOST_FAILURE === '1') {
      const before = (await host('inspect')).inventory[0];
      const button = main.getByTestId('cordis-live-failure');
      await button.click();
      await button.getByText('Host 调用失败', { exact: true }).waitFor();
      const failure = await button.getAttribute('data-host-error');
      assert.match(failure, /DSHM_EXPECTED_HOST_HANDLER_FAILURE/);
      const echoButton = main.getByTestId('cordis-live-echo');
      await echoButton.click();
      await page.waitForFunction(() => document.querySelector('[data-testid="cordis-live-echo"]')?.dataset.hostCalls === '2');
      assert.equal(await echoButton.getAttribute('data-host-failures'), '1', '失败调用只执行一次且没有自动重试');
      assert.equal(await echoButton.innerText(), 'DSHM_CORDIS_ECHO_V3');
      const after = (await host('inspect')).inventory[0];
      assert.equal(after.latestRun.status, 'running');
      assert.equal(after.activeRun.pluginRunId, before.activeRun.pluginRunId);
      assert.equal(after.currentPackageId, before.currentPackageId);
      report.hostFailure = { failure, packageId: after.currentPackageId, pluginRunId: after.activeRun.pluginRunId,
        failures: 1, successfulCalls: 2, continuedRunning: true };
      await page.screenshot({ path: 'artifacts/cordis-host-failure-android.png' });
    }

    if (process.env.DSHM_CORDIS_RENDER_FAILURE === '1') {
      const before = (await host('inspect')).inventory[0];
      const editor = main.getByRole('textbox', { name: '消息', exact: true });
      const draft = await editor.textContent();
      await main.getByTestId('cordis-live-render-failure').click();
      await main.getByTestId('cordis-live-echo').waitFor({ state: 'detached' });
      assert.equal(await editor.isEditable(), true);
      assert.equal(await editor.textContent(), draft);
      await main.getByRole('button', { name: 'Remote 选项', exact: true }).click();
      await main.getByRole('button', { name: '插件面板', exact: true }).click();
      await panel.locator('[data-cordis-badge]').click();
      await row.getByRole('alert').filter({ hasText: 'DSHM_EXPECTED_CLIENT_RENDER_FAILURE' }).first().waitFor();
      const failed = (await host('inspect')).inventory[0];
      assert.equal(failed.latestRun.status, 'failed');
      assert.equal(failed.latestRun.error.phase, 'client-render');
      assert.equal(failed.activeRun.pluginRunId, before.activeRun.pluginRunId);
      await page.screenshot({ path: 'artifacts/cordis-render-failure-android.png' });
      await row.locator('[data-cordis-switch="stop"]').click();
      await row.locator('[data-cordis-switch="run"]').click();
      await main.getByTestId('cordis-live-echo').waitFor({ state: 'attached' });
      await panel.locator('[data-cordis-badge]').click(); await close();
      await echo('DSHM_CORDIS_ECHO_V3');
      const recovered = (await host('inspect')).inventory[0];
      assert.equal(recovered.latestRun.status, 'running');
      assert.equal(recovered.currentPackageId, before.currentPackageId);
      assert.notEqual(recovered.activeRun.pluginRunId, before.activeRun.pluginRunId);
      assert.equal(await editor.textContent(), draft);
      report.renderFailure = { phase: failed.latestRun.error.phase, message: failed.latestRun.error.message,
        failedRun: before.activeRun.pluginRunId, recoveredRun: recovered.activeRun.pluginRunId,
        stoppedAndRestarted: true, editorEditable: true, draftPreserved: true };
    }

    if (process.env.DSHM_CORDIS_FAILURE === '1') {
      assert.equal((await host('request', 4)).result.status, 'starting');
      await main.getByTestId('cordis-live-echo').waitFor({ state: 'detached' });
      await main.getByRole('button', { name: 'Remote 选项', exact: true }).click();
      await main.getByRole('button', { name: '插件面板', exact: true }).click();
      await panel.locator('[data-cordis-badge]').click();
      await row.getByRole('alert').filter({ hasText: 'DSHM_EXPECTED_CLIENT_FAILURE_V4' }).waitFor();
      const failed = (await host('inspect')).inventory[0];
      assert.equal(failed.latestRun.status, 'failed'); assert.equal(failed.activeRun, undefined);
      assert.equal(failed.currentPackageId, report.futureVersionAutomatic);
      assert.notEqual(failed.nextPackageId, failed.currentPackageId);
      await page.screenshot({ path: 'artifacts/cordis-update-failure-android.png' });
      report.failedUpdate = { current: failed.currentPackageId, next: failed.nextPackageId, phase: failed.latestRun.error.phase };
      await row.getByRole('button', { name: '回退', exact: true }).click();
      await main.getByTestId('cordis-live-echo').waitFor({ state: 'attached' });
      await panel.locator('[data-cordis-badge]').click(); await close();
      await echo('DSHM_CORDIS_ECHO_V3');
      const restored = (await host('inspect')).inventory[0];
      assert.equal(restored.latestRun.status, 'running');
      assert.equal(restored.currentPackageId, report.futureVersionAutomatic);
      assert.equal(restored.nextPackageId, undefined);
      report.rollback = restored.currentPackageId;
      assert.equal((await host('request', 5)).result.status, 'starting');
      await echo('DSHM_CORDIS_ECHO_V5');
      const repaired = (await host('inspect')).inventory[0];
      assert.equal(repaired.latestRun.status, 'running');
      assert.notEqual(repaired.currentPackageId, report.rollback);
      report.recoveredUpdate = repaired.currentPackageId;
      await page.screenshot({ path: 'artifacts/cordis-update-recovered-android.png' });
    }

    if (process.env.DSHM_CORDIS_RECONNECT === '1') {
      const before = (await host('inspect')).inventory[0];
      console.log('CORDIS_READY_FOR_GATEWAY_STOP');
      await main.getByTestId('remote-offline-status').waitFor({ timeout: 60000 });
      const echoButton = main.getByTestId('cordis-live-echo');
      assert.equal(await echoButton.getAttribute('data-host-calls'), '1');
      await echoButton.click();
      await page.waitForFunction(() => {
        const text = document.querySelector('[data-testid="cordis-live-echo"]')?.textContent;
        return text && text !== 'DSHM_CORDIS_ECHO_V5' && text !== 'DSHM_CORDIS_ECHO_V3';
      });
      report.offlineCallError = await echoButton.innerText();
      assert.match(report.offlineCallError, /remote_not_connected|no active Connection/);
      assert.equal(await echoButton.getAttribute('data-host-calls'), '1');
      await page.screenshot({ path: 'artifacts/cordis-reconnect-offline-android.png' });
      console.log('CORDIS_OFFLINE_READY_FOR_GATEWAY_START');
      await main.getByTestId('remote-offline-status').waitFor({ state: 'detached', timeout: 60000 });
      await echoButton.click();
      await echoButton.getByText(process.env.DSHM_CORDIS_FAILURE === '1' ? 'DSHM_CORDIS_ECHO_V5' : 'DSHM_CORDIS_ECHO_V3', { exact: true }).waitFor();
      assert.equal(await echoButton.getAttribute('data-host-calls'), '2', '离线调用没有排队后重放，恢复后仅本次点击到达Host');
      const after = (await host('inspect')).inventory[0];
      assert.equal(after.currentPackageId, before.currentPackageId);
      assert.equal(after.latestRun.pluginRunId, before.latestRun.pluginRunId);
      assert.equal(after.latestRun.status, 'running');
      report.reconnected = { packageId: after.currentPackageId, pluginRunId: after.latestRun.pluginRunId };
      await page.screenshot({ path: 'artifacts/cordis-reconnect-recovered-android.png' });
    }

    if (process.env.DSHM_CORDIS_DESKTOP_RESTART === '1') {
      const editor = main.getByRole('textbox', { name: '消息', exact: true });
      const draft = await editor.textContent();
      const released = await host('prepare-restart');
      assert.equal(released.audit.newTurns, 0);
      assert.equal(released.audit.existingMessagesPreserved, true);
      const before = released.inventory[0];
      assert.equal(before.latestRun.status, 'running');
      report.beforeRestartMaintenance = released.audit;
      console.log('CORDIS_READY_FOR_DESKTOP_STOP');
      await main.getByTestId('remote-offline-status').waitFor({ timeout: 60000 });
      console.log('CORDIS_OFFLINE_READY_FOR_DESKTOP_START');
      const deadline = Date.now() + 60000;
      let next;
      while (Date.now() < deadline) {
        next = JSON.parse(await readFile('artifacts/cordis-live-host.json', 'utf8'));
        if (next.runId !== seed.runId) break;
        await new Promise(resolve => setTimeout(resolve, 200));
      }
      assert.notEqual(next.runId, seed.runId, '必须实际更换电脑进程');
      seed = next;
      await main.getByTestId('remote-offline-status').waitFor({ state: 'detached', timeout: 60000 });
      await main.getByTestId('cordis-live-echo').waitFor({ state: 'detached' });
      await editor.waitFor();
      assert.equal(await editor.textContent(), draft);
      const idle = (await host('hold')).inventory[0];
      assert.equal(idle.activeRun, undefined, '新进程不能自动运行旧实例');
      // define只登记packages；发起运行才设置next，成功后才提升为current。
      assert.equal(idle.currentPackageId, undefined);
      assert.equal(idle.nextPackageId, undefined);
      assert.deepEqual(idle.packages.map(item => item.packageId), [seed.packageId]);
      await main.getByRole('button', { name: 'Remote 选项', exact: true }).click();
      await main.getByRole('button', { name: '插件面板', exact: true }).click();
      await panel.locator('[data-cordis-badge]').click();
      await row.locator('[data-cordis-switch="run"]').waitFor();
      await page.screenshot({ path: 'artifacts/cordis-desktop-restarted-idle.png' });
      await row.locator('[data-cordis-switch="run"]').click();
      await main.getByTestId('cordis-live-echo').waitFor({ state: 'attached' });
      await panel.locator('[data-cordis-badge]').click(); await close();
      await echo('DSHM_CORDIS_ECHO');
      const after = (await host('inspect')).inventory[0];
      assert.equal(after.latestRun.status, 'running');
      assert.equal(await main.getByTestId('cordis-live-echo').getAttribute('data-host-calls'), '1');
      report.desktopRestart = { previousPackage: before.currentPackageId, currentPackage: after.currentPackageId,
        oldUiRemoved: true, idleBeforeExplicitRun: true, draftPreserved: true, freshHostCalls: 1 };
      await page.screenshot({ path: 'artifacts/cordis-desktop-restarted-running.png' });
    }

    await main.getByRole('button', { name: 'Remote 选项', exact: true }).click();
    await main.getByRole('button', { name: '插件面板', exact: true }).click();
    await panel.locator('[data-cordis-badge]').click();
    await row.locator('[data-cordis-switch="stop"]').click();
    await main.getByTestId('cordis-live-echo').waitFor({ state: 'detached' });
    await row.locator('[data-cordis-remove]').click(); await row.waitFor({ state: 'detached' });
    await close(); assert.deepEqual((await host('inspect')).inventory, []);
    report.removed = true;
  } finally {
    const cleanup = await host('cleanup'); report.maintenance = cleanup.audit;
    await writeFile('artifacts/cordis-approval-details.json', JSON.stringify(report, null, 2));
    assert.equal(cleanup.audit?.newTurns, 0); assert.equal(cleanup.audit?.existingMessagesPreserved, true);
  }
  return report;
}
