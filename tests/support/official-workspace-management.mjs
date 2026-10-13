import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

/** 手机只操作电脑预先登记的独立测试工作区；公开投影、磁盘和原历史分别核对。 */
export async function verifyOfficialWorkspaceManagement({ page, device, evidence, workspaceManagement: seed,
  fingerprint, title, mark }) {
  const report = {}, main = page.getByTestId('remote-workspace');
  const manager = page.getByTestId('remote-workspace-manager');
  const dialog = page.getByRole('dialog', { name: '管理工作区', exact: true });
  const editor = main.locator('[data-composer-input]');
  const openManager = async () => {
    await main.waitFor({ timeout: 60000 });
    const row = main.locator('.remote-session-row').filter({ hasText: title });
    if (await row.count()) await row.click();
    await main.getByRole('button', { name: 'Remote 选项', exact: true }).click();
    await page.getByRole('dialog', { name: 'Remote 选项', exact: true })
      .getByRole('button', { name: '管理工作区', exact: true }).click();
  };
  const reconnect = async () => {
    await page.getByText('电脑已调整这台手机的权限，请重新连接。', { exact: true }).waitFor();
    await page.getByRole('button', { name: '重新连接', exact: true }).click();
    await openManager();
  };
  const button = name => manager.getByRole('button', { name, exact: true });
  await editor.fill('OFFICIAL_WORKSPACE_DRAFT');
  let granted = false;
  try {
    await openManager();
    await manager.getByText('请在电脑 DSH Mobile 插件中，为此设备授予管理权限。', { exact: true }).waitFor();
    assert.equal(await manager.getByRole('button').count(), 0);
    report.managementRequired = true;
    await seed.management(fingerprint, true); granted = true;
    await reconnect();
    await button(seed.name).click();
    await button('重命名工作区').click();
    await manager.getByRole('textbox', { name: '工作区名称', exact: true }).fill(seed.renamed);
    await button('保存工作区名称').click();
    await button(seed.renamed).waitFor();
    report.rename = await seed.verify('rename');
    await mark('official-phone-workspace-rename-synchronized');
    await button(seed.renamed).click(); await button('调整排序').click();
    await button('移到「' + seed.anchor + '」前面').click();
    await button(seed.renamed).waitFor();
    report.before = await seed.verify('before');
    await button(seed.renamed).click(); await button('调整排序').click();
    await button('移到最后').click(); await button(seed.renamed).waitFor();
    const order = await manager.getByRole('button').allTextContents();
    assert.equal(order.at(-1), seed.renamed);
    report.last = await seed.verify('last');
    await mark('official-phone-workspace-sort-two-positions');
    await button(seed.renamed).click(); await button('移除工作区注册').click();
    assert.equal(await button('确认移除注册').isEnabled(), false);
    await manager.getByRole('checkbox', { name: '我确认移除「' + seed.renamed + '」的工作区注册', exact: true }).check();
    await writeFile(resolve(evidence, 'workspace-remove-confirm.png'), await device.screenshot());
    await button('确认移除注册').click();
    await manager.getByRole('heading', { name: seed.renamed, exact: true }).waitFor({ state: 'detached' });
    assert.equal(await button(seed.renamed).count(), 0);
    report.remove = await seed.verify('remove');
    await dialog.getByRole('button', { name: '关闭窗口', exact: true }).click();
    await main.locator('.remote-topbar').getByRole('button', { name: '返回', exact: true }).click();
    await main.locator('.remote-session-row').filter({ hasText: seed.chat }).click();
    await main.getByRole('article', { name: '模型回复', exact: true }).filter({ hasText: seed.token }).waitFor();
    report.chatReadableAfterRemoval = true;
    await mark('official-workspace-unregistered-file-history-and-phone-chat-retained');
    await main.locator('.remote-topbar').getByRole('button', { name: '返回', exact: true }).click();
    await main.locator('.remote-session-row').filter({ hasText: title }).click();
    assert.equal(await editor.innerText(), 'OFFICIAL_WORKSPACE_DRAFT');
    await seed.management(fingerprint, false); granted = false;
    await reconnect();
    await manager.getByText('请在电脑 DSH Mobile 插件中，为此设备授予管理权限。', { exact: true }).waitFor();
    assert.equal(await manager.getByRole('button').count(), 0);
    await dialog.getByRole('button', { name: '关闭窗口', exact: true }).click();
    assert.equal(await editor.innerText(), 'OFFICIAL_WORKSPACE_DRAFT'); await editor.fill('');
    report.managementReturned = true; report.draftPreserved = true;
    await mark('official-workspace-management-revoked-chat-retained');
    return report;
  } catch (error) { report.failure = error.message; report.failureText = await page.locator('body').innerText(); throw error; }
  finally {
    if (granted) await seed.management(fingerprint, false);
    await writeFile(resolve(evidence, 'workspace-management.json'), JSON.stringify(report, null, 2) + '\n');
  }
}
