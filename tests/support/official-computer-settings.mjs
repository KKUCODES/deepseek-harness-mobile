import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

/** 只把非敏感超时临时调整一秒，沿手机原表单恢复数值及继承；不操作Key或地址。 */
export async function verifyOfficialComputerSettings({ page, device, evidence, settings, fingerprint, title, mark }) {
  const report = {}, main = page.getByTestId('remote-workspace');
  const editor = main.locator('[data-composer-input]');
  const dialog = page.getByRole('dialog', { name: '电脑设置', exact: true });
  const open = async () => {
    await main.waitFor({ timeout: 60000 });
    const row = main.locator('.remote-session-row').filter({ hasText: title });
    if (await row.count()) await row.click();
    await main.getByRole('button', { name: 'Remote 选项', exact: true }).click();
    await page.getByRole('dialog', { name: 'Remote 选项', exact: true }).getByRole('button', { name: '电脑设置', exact: true }).click();
  };
  const reconnect = async () => {
    await page.getByText('电脑已调整这台手机的权限，请重新连接。', { exact: true }).waitFor();
    await page.getByRole('button', { name: '重新连接', exact: true }).click(); await open();
  };
  // 只读已经渲染的五项公开投影；不访问配置服务、原生凭据或未脱敏模型属性。
  const view = () => main.evaluate(node => {
    for (let fiber = node[Object.keys(node).find(key => key.startsWith('__reactFiber$'))]; fiber; fiber = fiber.return) {
      const current = fiber.memoizedProps?.model?.computerSettings?.view;
      if (current) return { documentId: current.documentId, fields: current.fields };
    }
    return null;
  });
  const field = dialog.getByRole('spinbutton', { name: '等待输出超时（毫秒）', exact: true });
  const form = dialog.locator('.remote-computer-settings form');
  const saveButton = form.getByRole('button', { name: '保存到电脑', exact: true });
  const save = async (value, overridden) => {
    await saveButton.click();
    // 官方设置事件触发自动重读，短暂确认文案会消失；等待实际投影与表单结算。
    await page.waitForFunction(({ value, overridden }) => {
      const node = document.querySelector('[data-testid="remote-workspace"]');
      for (let fiber = node?.[Object.keys(node).find(key => key.startsWith('__reactFiber$'))]; fiber; fiber = fiber.return) {
        const service = fiber.memoizedProps?.model?.computerSettings;
        const field = service?.view?.fields.find(item => item.key === 'streamIdleTimeoutMs');
        if (field) return !service.busy && field.value === value && field.overridden === overridden;
      }
      return false;
    }, { value, overridden });
    await dialog.getByRole('button', { name: '重新读取设置', exact: true }).waitFor();
    assert.equal(await saveButton.isEnabled(), false);
  };
  let granted = false;
  await editor.fill('OFFICIAL_SETTINGS_DRAFT');
  try {
    await open();
    await dialog.getByText('请先在电脑端授予此设备管理权限，再查看或修改电脑设置。', { exact: true }).waitFor();
    assert.equal(await dialog.locator('input,select').count(), 0); report.managementRequired = true;
    await settings.management(fingerprint, true); granted = true; await reconnect();
    await field.waitFor({ timeout: 60000 });
    const original = await settings.verify('initial', await view());
    assert.equal(Number(await field.inputValue()), original.original);
    assert.equal(await form.locator('.remote-computer-setting').count(), 5);
    report.read = original;
    await field.fill(String(original.changed)); await save(original.changed, true);
    assert.equal(Number(await field.inputValue()), original.changed);
    report.change = await settings.verify('change', await view());
    await writeFile(resolve(evidence, 'computer-settings-change.png'), await device.screenshot());
    await mark('official-phone-five-settings-read-and-timeout-write');
    if (original.overridden) await field.fill(String(original.original));
    else await field.locator('..').getByRole('button', { name: '恢复默认', exact: true }).click();
    await save(original.original, original.overridden);
    assert.equal(Number(await field.inputValue()), original.original);
    report.restore = await settings.verify('restore', await view());
    await dialog.getByRole('button', { name: '重新读取设置', exact: true }).click();
    await dialog.getByRole('button', { name: '重新读取设置', exact: true }).waitFor();
    assert.equal(Number(await field.inputValue()), original.original);
    await mark('official-phone-settings-value-and-inheritance-restored');
    await settings.management(fingerprint, false); granted = false; await reconnect();
    await dialog.getByText('请先在电脑端授予此设备管理权限，再查看或修改电脑设置。', { exact: true }).waitFor();
    assert.equal(await dialog.locator('input,select').count(), 0);
    await dialog.getByRole('button', { name: '关闭窗口', exact: true }).click();
    assert.equal(await editor.innerText(), 'OFFICIAL_SETTINGS_DRAFT'); await editor.fill('');
    report.managementReturned = true; report.draftPreserved = true;
    await mark('official-settings-management-revoked-chat-retained');
    return report;
  } catch (error) { report.failure = error.message; report.failureText = await page.locator('body').innerText(); throw error; }
  finally {
    if (granted) await settings.management(fingerprint, false);
    await writeFile(resolve(evidence, 'computer-settings.json'), JSON.stringify(report, null, 2) + '\n');
  }
}
