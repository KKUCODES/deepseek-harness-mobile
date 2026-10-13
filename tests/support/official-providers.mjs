import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { verifyProviderManagement } from './latest-provider-page.mjs';

/** 复用实际手机完整提供方表单；不传原生Key写入回调，不使用任何电脑凭据。 */
export async function verifyOfficialProviders({ page, device, evidence, settings, fingerprint, title, mark }) {
  const report = { phases: [] }, main = page.getByTestId('remote-workspace');
  const editor = main.locator('[data-composer-input]');
  const dialog = page.getByRole('dialog', { name: '电脑设置', exact: true });
  const open = async () => {
    await main.waitFor({ timeout: 60000 });
    const row = main.locator('.remote-session-row').filter({ hasText: title }); if (await row.count()) await row.click();
    await main.getByRole('button', { name: 'Remote 选项', exact: true }).click();
    await page.getByRole('dialog', { name: 'Remote 选项', exact: true }).getByRole('button', { name: '电脑设置', exact: true }).click();
  };
  const reconnect = async () => {
    await page.getByText('电脑已调整这台手机的权限，请重新连接。', { exact: true }).waitFor();
    await page.getByRole('button', { name: '重新连接', exact: true }).click();
  };
  let granted = false;
  await editor.fill('OFFICIAL_PROVIDER_DRAFT');
  try {
    await open(); await dialog.getByText('请先在电脑端授予此设备管理权限，再查看或修改电脑设置。', { exact: true }).waitFor();
    assert.equal(await dialog.locator('input,select').count(), 0); report.managementRequired = true;
    await settings.management(fingerprint, true); granted = true; await reconnect();
    await main.waitFor({ timeout: 60000 });
    const session = main.locator('.remote-session-row').filter({ hasText: title });
    if (await session.count()) await session.click();
    await editor.waitFor();
    assert.equal(await editor.innerText(), 'OFFICIAL_PROVIDER_DRAFT');
    await verifyProviderManagement(page, async (phase, route) => {
      const result = await settings.providers.verify(phase, route); report.phases.push(phase);
      await writeFile(resolve(evidence, 'provider-management.json'), JSON.stringify(report, null, 2) + '\n');
      if (['created', 'advanced-set', 'advanced-protocol-switched', 'removed'].includes(phase)) {
        await writeFile(resolve(evidence, 'provider-' + phase + '.png'), await device.screenshot());
        await mark('official-provider-' + phase);
      }
      return result;
    });
    assert.equal(await editor.innerText(), 'OFFICIAL_PROVIDER_DRAFT');
    await settings.management(fingerprint, false); granted = false; await reconnect(); await open();
    await dialog.getByText('请先在电脑端授予此设备管理权限，再查看或修改电脑设置。', { exact: true }).waitFor();
    assert.equal(await dialog.locator('input,select').count(), 0);
    await dialog.getByRole('button', { name: '关闭窗口', exact: true }).click();
    assert.equal(await editor.innerText(), 'OFFICIAL_PROVIDER_DRAFT'); await editor.fill('');
    report.managementReturned = true; report.draftPreserved = true;
    await mark('official-provider-management-revoked-chat-retained');
    return report;
  } catch (error) { report.failure = error.message; throw error; }
  finally {
    if (granted) await settings.management(fingerprint, false);
    await writeFile(resolve(evidence, 'provider-management.json'), JSON.stringify(report, null, 2) + '\n');
  }
}
