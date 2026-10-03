import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { androidAppWebView } from './android-app-webview.mjs';

/** 两个独立UID/凭据和WebView读取同一个真实Host；仅使用公开页面操作。 */
export async function checkCordisTwoClients(device, firstPage, seed, host, { approvals = false, overlap = false, proxy } = {}) {
  const report = { at: new Date().toISOString(), errors: [], resources: [] };
  const artifact = overlap ? 'cordis-approval-overlap' : approvals ? 'cordis-approval-race' : 'cordis-two-clients';
  let secondPage;
  const controls = (page, packageName) => {
    const focus = async () => {
      // 同一模拟器一次只显示一个App；切到真实Android任务，不强制点击暂停中的WebView。
      const recents = (await device.shell('dumpsys activity recents')).toString();
      const blocks = recents.split(/(?=\* Recent #\d+:)/);
      const escaped = packageName.replaceAll('.', '\\.');
      const block = blocks.find(text => new RegExp(`A=\\d+:${escaped}\\s`).test(text)
        && text.includes('Activities=[') && text.includes('/.RemoteActivity'));
      // 独立applicationId的Activity类名仍使用原包名。
      const matching = block ?? blocks.find(text => new RegExp(`A=\\d+:${escaped}\\s`).test(text)
        && text.includes('Activities=[') && text.includes('/dev.dshmobile.validation.RemoteActivity'));
      const taskId = matching?.match(/Task\{[^\n]*#(\d+) /)?.[1];
      assert.ok(taskId, `Missing live Remote task for ${packageName}`);
      const result = (await device.shell(`am task focus ${taskId}`)).toString();
      assert.ok(result.includes(`Setting focus to task ${taskId}`));
      await page.waitForFunction(() => document.visibilityState === 'visible');
    };
    const main = page.getByTestId('remote-workspace');
    const panel = page.getByRole('region', { name: '插件面板', exact: true });
    const row = panel.locator(`[data-cordis-row="${seed.pluginId}"]`);
    return { main, panel, row, focus, echo: main.getByTestId('cordis-live-echo'),
      editor: main.getByRole('textbox', { name: '消息', exact: true }),
      open: async () => {
        await focus();
        await main.getByRole('button', { name: 'Remote 选项', exact: true }).click();
        await main.getByRole('button', { name: '插件面板', exact: true }).click();
        await panel.locator('[data-cordis-badge]').click();
      },
      close: async () => {
        await focus();
        if (await panel.locator('[data-cordis-panel]').isVisible()) await panel.locator('[data-cordis-badge]').click();
        await panel.getByRole('button', { name: '返回聊天', exact: true }).click();
      },
      status: async value => {
        await focus();
        await page.waitForFunction(({ id, value }) => document.querySelector(`[data-cordis-row="${id}"]`)?.dataset.cordisStatus === value, { id: seed.pluginId, value });
      },
    };
  };
  try {
    await device.shell('am start -f 0x20020000 -n dev.dshmobile.validation/.ValidationActivity');
    const startupDeadline = Date.now() + 15000;
    while (!(await device.shell('pidof dev.dshmobile.validation')).toString().trim()) {
      assert.ok(Date.now() < startupDeadline, 'Daily App did not start');
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    const context = (await (await androidAppWebView(device)).page()).context();
    const ordinary = context.pages().find(item => item.url().startsWith('https://appassets.androidplatform.net/'));
    assert.ok(ordinary);
    await ordinary.getByRole('button', { name: '打开侧边抽屉', exact: true }).click();
    await ordinary.getByRole('button', { name: 'Remote', exact: true }).click();
    const deadline = Date.now() + 20000;
    while (!secondPage && Date.now() < deadline) {
      secondPage = context.pages().find(item => item.url().startsWith('https://remote.dshm.invalid/'));
      if (!secondPage) await new Promise(resolve => setTimeout(resolve, 100));
    }
    assert.ok(secondPage); secondPage.setDefaultTimeout(25000);
    secondPage.on('pageerror', error => report.errors.push(error.message));
    secondPage.on('console', message => { if (message.type() === 'error') report.errors.push(message.text()); });
    secondPage.on('response', response => { if (response.status() >= 400) report.resources.push({ path: new URL(response.url()).pathname, status: response.status() }); });
    const first = controls(firstPage, 'dev.dshmobile.validation.pairingtest'), second = controls(secondPage, 'dev.dshmobile.validation');
    await second.main.waitFor({ timeout: 45000 });
    if (await second.main.locator('.remote-heading strong').innerText() === 'Remote') {
      await second.main.locator('button.remote-session-row').filter({ has: secondPage.getByText('DSHM Remote 联调提示', { exact: true }) }).click();
    }
    await second.main.locator('.remote-heading').getByText('DSHM Remote 联调提示', { exact: true }).waitFor();
    await second.editor.waitFor();
    const firstDraft = await first.editor.textContent(), secondDraft = await second.editor.textContent();
    if (approvals) {
      await first.open(); await first.row.locator('[data-cordis-switch="stop"]').click(); await first.status('idle');
      await second.open(); await second.status('idle');
      report.resolutions = [];
      for (const scenario of overlap ? [
        { version: 2, winner: 'approve', late: 'decline', status: 'running' },
        { version: 3, winner: 'approve', late: 'approve', status: 'running' },
      ] : [
        { version: 2, winner: 'approve', late: 'decline', status: 'running' },
        { version: 3, winner: 'decline', late: 'approve', status: 'rejected' },
      ]) {
        report.stage = `request-v${scenario.version}`;
        assert.equal((await host('request', scenario.version)).result.status, 'awaiting-approval');
        for (const client of [first, second]) {
          await client.focus();
          if (!await client.panel.locator('[data-cordis-panel]').isVisible()) await client.panel.locator('[data-cordis-badge]').click();
          await client.row.locator('[data-cordis-approve]').waitFor();
        }
        assert.equal((await proxy(overlap ? 'pause' : 'pause-cordis')).selectedDevices, 1);
        report.stage = `winner-${scenario.winner}-v${scenario.version}`;
        await second.row.locator(`[data-cordis-${scenario.winner}]`).click();
        if (overlap) {
          const deadline = Date.now() + 10000;
          let pending;
          while (true) {
            pending = (await host('inspect')).inventory[0];
            if (pending.latestRun.status === 'client-pending') break;
            assert.ok(Date.now() < deadline, 'Host did not reach Client activation');
          }
          assert.equal(await second.echo.getByText(`DSHM_CORDIS_ECHO_V${scenario.version}`, { exact: true }).count(), 0, 'New Client code must not be activated yet');
          report.stage = `overlap-${scenario.late}-v${scenario.version}`;
          const rejectedBefore = (await proxy('stats')).selectedRejectedApprovals;
          await first.focus(); await first.row.locator(`[data-cordis-${scenario.late}]`).click();
          await proxy('pause-others');
          // Host仍保留正在激活的审批，重读可能再次展示弹层；以原结算拒绝实际放行为完成证据。
          const rejectedDeadline = Date.now() + 10000;
          while ((await proxy('stats')).selectedRejectedApprovals !== rejectedBefore + 1) {
            assert.ok(Date.now() < rejectedDeadline, 'Late resolution was not rejected by the original Host');
            await new Promise(resolve => setTimeout(resolve, 100));
          }
          const stillPending = (await host('inspect')).inventory[0];
          report.overlapObserved = stillPending;
          assert.equal(stillPending.latestRun.status, 'client-pending', 'Another page must not settle an activation in progress');
          assert.equal(stillPending.latestRun.approvalRequestId, pending.latestRun.approvalRequestId);
          assert.deepEqual(stillPending.activeRun, pending.activeRun);
          await proxy('resume'); await second.focus();
          await second.panel.locator('[data-cordis-panel]').waitFor({ state: 'detached' });
          await second.panel.locator('[data-cordis-badge]').click();
          await second.row.locator('select').selectOption(`pkg-${scenario.version}`);
          await second.status('running');
          const settled = (await host('inspect')).inventory[0];
          assert.equal(settled.latestRun.status, 'running');
          assert.deepEqual(settled.activeRun, pending.activeRun);
          report.resolutions.push({ ...scenario, activeRun: settled.activeRun, pendingRequestPreserved: true });
          continue;
        }
        // 原审批动作完成后自动收起清单；按钮消失本身不代表异步审批已经完成。
        await second.panel.locator('[data-cordis-panel]').waitFor({ state: 'detached' });
        await second.panel.locator('[data-cordis-badge]').click();
        if (scenario.status === 'running') {
          await second.row.locator('select').selectOption(`pkg-${scenario.version}`);
          await second.status('running');
        }
        const settled = (await host('inspect')).inventory[0];
        assert.equal(settled.latestRun.status, scenario.status);
        const held = await proxy('stats'); assert.ok(held.heldBytes > 0);
        // 第一端仍显示原按钮，迟到操作必须经过真实UI发出，不能直接伪造RPC。
        report.stage = `late-${scenario.late}-v${scenario.version}`;
        await first.focus(); await first.row.locator(`[data-cordis-${scenario.late}]`).click();
        const deadline = Date.now() + 10000;
        while ((await proxy('stats')).heldStaleApprovalResults !== 1) {
          assert.ok(Date.now() < deadline, 'The original Host did not reject the late approval operation');
          await new Promise(resolve => setTimeout(resolve, 100));
        }
        await proxy('resume');
        await first.panel.locator('[data-cordis-panel]').waitFor({ state: 'detached' });
        const after = (await host('inspect')).inventory[0];
        assert.deepEqual(after.activeRun, settled.activeRun);
        assert.equal(after.latestRun.status, settled.latestRun.status);
        assert.equal(after.latestRun.pluginRunId, settled.latestRun.pluginRunId);
        report.resolutions.push({ ...scenario, activeRun: after.activeRun, latestRun: after.latestRun.pluginRunId, heldBytes: held.heldBytes, lateOperationRejectedByHost: true });
      }
      await second.close(); await second.echo.click();
      await second.echo.getByText(overlap ? 'DSHM_CORDIS_ECHO_V3' : 'DSHM_CORDIS_ECHO_V2', { exact: true }).waitFor();
      assert.equal(await second.echo.getAttribute('data-host-calls'), '1');
      assert.equal(await first.echo.count(), 0);
      if (!overlap) report.rejectedVersionDidNotExecute = true;
      await second.open(); await second.row.locator('select').selectOption(overlap ? 'pkg-3' : 'pkg-2');
      await second.row.locator('[data-cordis-switch="stop"]').click(); await second.status('idle');
      report.stage = 'remove-after-approvals';
      await second.row.locator('[data-cordis-remove]').click();
      report.stage = 'wait-removal-on-acting-client';
      await second.row.waitFor({ state: 'detached' });
      report.stage = 'wait-removal-on-other-client';
      await first.focus(); await first.row.waitFor({ state: 'detached' });
      assert.deepEqual((await host('inspect')).inventory, []);
      await first.close(); await second.close(); await first.focus();
    } else {
    const initial = (await host('inspect')).inventory[0].activeRun;
    await second.open(); await second.status('client-pending');
    assert.equal(await second.echo.count(), 0);
    report.hostRunningSecondClientPending = true;
    await second.row.locator('[data-cordis-switch="run"]').click(); await second.status('running');
    assert.deepEqual((await host('inspect')).inventory[0].activeRun, initial);
    await second.close(); await second.echo.click();
    await second.echo.getByText('DSHM_CORDIS_ECHO', { exact: true }).waitFor();
    assert.equal(await second.echo.getAttribute('data-host-calls'), '2');
    report.sharedRunAndHostCalls = true;
    await first.open(); await first.status('running');
    await second.open(); await second.row.locator('[data-cordis-switch="stop"]').click();
    await second.status('idle'); await first.status('idle');
    await first.echo.waitFor({ state: 'detached' }); await second.echo.waitFor({ state: 'detached' });
    assert.equal((await host('inspect')).inventory[0].activeRun, undefined);
    report.secondStopUpdatedBothClients = true;
    await first.focus();
    await first.row.locator('[data-cordis-switch="run"]').click(); await first.status('running');
    await second.status('client-pending');
    const restarted = (await host('inspect')).inventory[0].activeRun;
    assert.notEqual(restarted.pluginRunId, initial.pluginRunId);
    await first.close(); await first.echo.click();
    await first.echo.getByText('DSHM_CORDIS_ECHO', { exact: true }).waitFor();
    assert.equal(await first.echo.getAttribute('data-host-calls'), '1');
    report.firstRestartUpdatedSecond = true;
    await second.focus();
    await secondPage.screenshot({ path: 'artifacts/cordis-two-clients-second-pending.png' });
    await first.open();
    await second.focus();
    await second.row.locator('[data-cordis-remove]').click();
    await second.row.waitFor({ state: 'detached' }); await first.row.waitFor({ state: 'detached' });
    await first.echo.waitFor({ state: 'detached' });
    assert.deepEqual((await host('inspect')).inventory, []);
    report.secondRemovalUpdatedBothClients = true;
    await first.close(); await second.close();
    await first.focus();
    }
    assert.equal(await first.editor.textContent(), firstDraft);
    assert.equal(await second.editor.textContent(), secondDraft);
    report.draftsPreserved = true;
    assert.deepEqual(report.errors, []); assert.deepEqual(report.resources, []);
    report.ok = true;
  } catch (error) {
    report.failure = error.message;
    if (approvals) report.failureInventory = (await host('inspect')).inventory;
    report.remainingTestRows = await Promise.all([firstPage, secondPage].map(async page => page
      ? page.locator(`[data-cordis-row="${seed.pluginId}"]`).evaluateAll(rows => rows.map(row => ({
        status: row.dataset.cordisStatus, awaiting: row.dataset.cordisAwaiting, text: row.textContent,
      }))) : []));
    throw error;
  }
  finally {
    if (approvals) await proxy('resume').catch(() => {});
    await writeFile(`artifacts/${artifact}-details.json`, JSON.stringify(report, null, 2));
  }
  return report;
}
