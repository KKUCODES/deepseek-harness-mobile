import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

/** 操作官方局部管理界面与原安装审批；脚本执行证据来自独立本机HTTP服务。 */
export async function verifyOfficialPluginScripts({ page, device, evidence, plugins, mark }) {
  const control = plugins.scripts, report = {};
  const manager = page.getByRole('region', { name: '管理电脑插件', exact: true });
  const start = async mode => {
    await manager.getByRole('button', { name: '添加插件', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: '添加插件', exact: true });
    await dialog.getByRole('textbox', { name: '包名或地址', exact: true }).fill(control.specs[mode]);
    await dialog.getByRole('button', { name: '安装', exact: true }).click();
    return page.getByRole('dialog').last();
  };
  const approve = async (current, mode) => {
    await current.locator('[data-install-phase="failed"]').waitFor({ timeout: 120000 });
    const approval = current.locator('[data-install-approval]');
    const entries = approval.locator('li code');
    await entries.first().waitFor();
    assert.equal(await entries.count(), 1);
    const key = await entries.innerText();
    const proof = await control.blocked(mode, key);
    (report.approvals ??= []).push({ mode, key, ...proof });
    await approval.getByRole('button', { name: '允许这些脚本并重试', exact: true }).click();
    return proof;
  };
  try {
    let current = await start('cancel');
    await current.locator('[data-install-phase="failed"]').waitFor({ timeout: 120000 });
    report.blocked = { ...(await control.blocked('cancel', await current.locator('[data-install-approval] li code').innerText())), inventory: await plugins.verify(false) };
    await writeFile(resolve(evidence, 'plugin-script-approval.png'), await device.screenshot());
    await mark('official-plugin-script-blocked-until-phone-approval');
    await approve(current, 'cancel');
    report.cancelStarted = await control.started('cancel');
    await current.getByRole('button', { name: '取消安装', exact: true }).click();
    await page.getByRole('textbox', { name: '包名或地址', exact: true }).waitFor({ timeout: 60000 });
    await page.getByText('已取消安装，插件未启用，下载的文件可能保留', { exact: true }).waitFor();
    report.cancel = { ...(await control.settled('cancel')), inventory: await plugins.verify(false) };
    await page.keyboard.press('Escape');
    await current.waitFor({ state: 'detached' });
    await mark('official-approved-script-cancelled-process-and-files-restored');

    current = await start('failure');
    await approve(current, 'failure');
    report.failureStarted = await control.started('failure');
    control.finish('failure');
    await current.locator('[data-install-phase="failed"]').waitFor({ timeout: 60000 });
    report.failure = { ...(await control.settled('failure')), inventory: await plugins.verify(false), failureShown: true };
    await writeFile(resolve(evidence, 'plugin-script-failed.png'), await device.screenshot());
    await page.keyboard.press('Escape');
    await current.waitFor({ state: 'detached' });
    await mark('official-approved-script-failure-without-automatic-retry');

    current = await start('success');
    await approve(current, 'success');
    report.successStarted = await control.started('success');
    control.finish('success');
    await current.locator('[data-install-phase="done"]').waitFor({ timeout: 60000 });
    report.success = { ...(await control.settled('success')), inventory: await plugins.verify(true, control.versions.success) };
    // 新装包只提供立即启用；使用官方关闭按钮保留完成结果，再正常卸载。
    await current.getByRole('button', { name: '关闭', exact: true }).click();
    await current.waitFor({ state: 'detached' });
    const card = manager.locator(`[data-plugin-package="${plugins.packageName}"]`);
    await card.getByRole('button', { name: '查看 ' + plugins.packageName, exact: true }).click();
    await manager.getByRole('button', { name: '卸载 ' + plugins.packageName, exact: true }).click();
    const confirm = page.getByRole('dialog', { name: '卸载「' + plugins.packageName + '」？', exact: true });
    plugins.removing();
    await confirm.getByRole('button', { name: '卸载', exact: true }).click();
    await confirm.waitFor({ state: 'detached', timeout: 120000 });
    await card.waitFor({ state: 'detached' });
    report.removed = await plugins.verify(false);
    plugins.removed();
    report.policy = await control.restorePolicy();
    assert.equal(report.policy.originalPolicyBytesRestored, true);
    await mark('official-approved-script-success-uninstall-and-policy-restored');
    report.passed = true;
    return report;
  } catch (error) { report.error = error.message; throw error; }
  finally { await writeFile(resolve(evidence, 'plugin-scripts.json'), JSON.stringify(report, null, 2) + '\n'); }
}
