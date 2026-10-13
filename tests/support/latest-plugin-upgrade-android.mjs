import assert from 'node:assert/strict';
import { _android } from 'playwright';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { androidAppWebView } from '../../scripts/android-app-webview.mjs';

/** 使用独立测试 UID 和真实电脑插件管理局部组件，安装不含脚本/依赖的测试包。 */
export async function verifyLatestPluginUpgradeAndroid({ origin, pairLink, title, packageName, tarballs, approve, receipt, restart, verifyRemoved, revoke, cancellation }) {
  const device = (await _android.devices({ omitDriverInstall: true })).find(item => item.serial() === process.env.DSHM_ANDROID_SERIAL);
  assert.ok(device); assert.ok(process.env.DSHM_ADB_PATH);
  const app = 'dev.dshmobile.validation.latesttest', port = new URL(origin).port;
  const evidence = resolve(import.meta.dirname, '../../artifacts/latest-mobile-runtime');
  await mkdir(evidence, { recursive: true });
  const adb = promisify(execFile), options = { windowsHide: true };
  await adb(process.env.DSHM_ADB_PATH, ['-s', device.serial(), 'reverse', `tcp:${port}`, `tcp:${port}`], options);
  const report = { at: new Date().toISOString(), app, pageErrors: [], consoleErrors: [], passed: false };
  let page;
  try {
    assert.equal((await device.shell(`pm clear ${app}`)).toString().trim(), 'Success');
    const key = new URLSearchParams(new URL(pairLink).hash.slice(1)).get('key');
    assert.match(key, /^[A-Za-z0-9_-]{43}$/);
    await device.shell(`am start -W -a android.intent.action.VIEW -c android.intent.category.BROWSABLE -d 'dshm://pair?server=${encodeURIComponent(origin)}#key=${key}' -p ${app}`);
    const first = await (await androidAppWebView(device, app)).page();
    page = first.context().pages().find(item => item.url().startsWith('https://remote.dshm.invalid/'))
      ?? await first.context().waitForEvent('page', { predicate: item => item.url().startsWith('https://remote.dshm.invalid/'), timeout: 30000 });
    page.setDefaultTimeout(30000);
    page.on('pageerror', error => report.pageErrors.push(error.message));
    page.on('console', message => { if (message.type() === 'error') report.consoleErrors.push(message.text()); });
    await page.getByLabel('设备名称', { exact: true }).fill('DSHM latest package upgrade Android');
    await page.getByRole('button', { name: '继续配对', exact: true }).click();
    await page.getByRole('heading', { name: '等待电脑批准', exact: true }).waitFor();
    const fingerprint = await page.getByTestId('remote-fingerprint').innerText();
    await approve(fingerprint);
    await page.getByRole('button', { name: '我已在电脑批准', exact: true }).click();
    await page.getByTestId('remote-workspace').waitFor({ timeout: 60000 });
    await page.getByRole('button').filter({ hasText: title }).click();
    const manager = page.getByRole('region', { name: '管理电脑插件', exact: true });
    const openManager = async () => {
      if (await manager.count()) return;
      await page.getByRole('button', { name: 'Remote 选项', exact: true }).click();
      await page.getByRole('button', { name: '电脑插件', exact: true }).click();
      await page.getByRole('dialog', { name: '电脑插件', exact: true }).getByRole('button', { name: '管理电脑插件', exact: true }).click();
      await manager.getByRole('button', { name: '添加插件', exact: true }).waitFor();
    };
    const install = async tarball => {
      await manager.getByRole('button', { name: '添加插件', exact: true }).click();
      const dialog = page.getByRole('dialog', { name: '添加插件', exact: true });
      await dialog.getByRole('textbox', { name: '包名或地址', exact: true }).fill(tarball);
      await dialog.getByRole('button', { name: '安装', exact: true }).click();
      console.log('latest-package-stage: installing ' + tarballs.indexOf(tarball));
      // 原弹窗完成安装后会更换 accessible title；保持当前弹窗定位，而非锁定“添加插件”。
      const current = page.getByRole('dialog').last();
      const settled = current.locator('[data-install-phase="done"], [data-install-phase="failed"]');
      await settled.waitFor({ timeout: 90000 });
      assert.equal(await settled.getAttribute('data-install-phase'), 'done', await current.innerText());
      return current;
    };
    await openManager();
    const card = manager.locator(`[data-plugin-package="${packageName}"]`);
    assert.equal(await card.count(), 0);
    if (cancellation) {
      await cancellation.before();
      await manager.getByRole('button', { name: '添加插件', exact: true }).click();
      const pending = page.getByRole('dialog', { name: '添加插件', exact: true });
      await pending.getByRole('textbox', { name: '包名或地址', exact: true }).fill(cancellation.url);
      await pending.getByRole('button', { name: '安装', exact: true }).click();
      await cancellation.started();
      const active = page.getByRole('dialog').last();
      await active.locator('[data-install-phase="running"]').waitFor();
      await active.getByRole('button', { name: '取消安装', exact: true }).click();
      // 原管理器收到电脑取消确认后才返回编辑；保留地址，不能将未确认/未知状态当成已取消。
      await page.getByRole('dialog', { name: '添加插件', exact: true }).getByRole('textbox', { name: '包名或地址', exact: true }).waitFor();
      await page.getByText('已取消安装，插件未启用，下载的文件可能保留', { exact: true }).waitFor();
      await cancellation.settled();
      assert.equal(await page.getByRole('dialog', { name: '添加插件', exact: true }).getByRole('textbox', { name: '包名或地址', exact: true }).inputValue(), cancellation.url);
      await page.getByRole('dialog', { name: '添加插件', exact: true }).getByRole('button', { name: '关闭', exact: true }).click();
      assert.equal(await card.count(), 0);
      report.downloadCancellationConfirmed = true;
      await writeFile(resolve(evidence, 'latest-plugin-cancellation-confirmed.png'), await device.screenshot());
    }
    let dialog = await install(tarballs[0]);
    const enable = dialog.getByRole('button', { name: '立即启用', exact: true });
    await enable.waitFor({ timeout: 90000 }); await enable.click();
    await dialog.waitFor({ state: 'detached' });
    report.firstInstallCanEnable = true;
    report.beforeUpgrade = await receipt('0.0.1');
    await card.waitFor();
    dialog = await install(tarballs[1]);
    await dialog.getByText(/下次启动后加载/).waitFor({ timeout: 90000 });
    report.restartMessage = await dialog.innerText();
    assert.equal(await dialog.getByRole('button', { name: '立即启用', exact: true }).count(), 0);
    report.noImmediateEnableOnUpgrade = true;
    report.beforeRestart = await receipt('0.0.1');
    assert.deepEqual(report.beforeRestart, report.beforeUpgrade);
    await dialog.getByRole('button', { name: '完成', exact: true }).click();
    await restart();
    report.afterRestart = await receipt('0.0.2');
    assert.notEqual(report.afterRestart.pid, report.beforeRestart.pid);
    await openManager();
    await manager.getByRole('button', { name: '添加插件', exact: true }).waitFor({ timeout: 60000 });
    await card.getByRole('button', { name: '查看 ' + packageName, exact: true }).click();
    await manager.getByText('v0.0.2', { exact: true }).waitFor({ timeout: 30000 });
    report.detailAfterRestart = await manager.innerText();
    assert.match(report.detailAfterRestart, /v0\.0\.2/);
    assert.match(report.detailAfterRestart, /1 运行中/);
    await manager.getByRole('button', { name: '卸载 ' + packageName, exact: true }).click();
    const confirm = page.getByRole('dialog', { name: '卸载「' + packageName + '」？', exact: true });
    await confirm.getByRole('button', { name: '卸载', exact: true }).click();
    // 原控制器先关确认框，再异步卸载；详情页中本来也没有列表卡片，不能用其消失冒充结算。
    await confirm.waitFor({ state: 'detached' });
    await verifyRemoved();
    await manager.getByRole('button', { name: '添加插件', exact: true }).waitFor({ timeout: 60000 });
    await card.waitFor({ state: 'detached' });
    report.uninstalled = true;
    assert.equal(await page.locator('iframe').count(), 0);
    assert.deepEqual(report.pageErrors, []); assert.deepEqual(report.consoleErrors, []);
    await revoke(); report.authorityRevoked = true;
    report.passed = true;
  } catch (error) {
    report.error = String(error);
    const details = page?.getByText('查看安装详情', { exact: true });
    if (await details?.isVisible().catch(() => false)) await details.click().catch(() => {});
    report.pageText = await page?.locator('body').innerText().catch(() => 'page_closed'); throw error;
  } finally {
    const reportName = cancellation ? 'latest-plugin-cancellation-android' : 'latest-plugin-upgrade-android';
    await writeFile(resolve(evidence, reportName + '.png'), await device.screenshot()).catch(() => {});
    await device.shell(`am force-stop ${app}`);
    await adb(process.env.DSHM_ADB_PATH, ['-s', device.serial(), 'reverse', '--remove', `tcp:${port}`], options);
    await device.close();
    await writeFile(resolve(evidence, reportName + '.json'), JSON.stringify(report, null, 2) + '\n');
  }
  return report;
}
