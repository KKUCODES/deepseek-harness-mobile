import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

/** 仅通过手机真实模型编辑器临时修改一个默认行；公开电脑目录核对后沿原恢复按钮撤销。 */
export async function verifyOfficialDeepSeekModels({ page, device, evidence, settings, fingerprint, title, mark }) {
  const report = {}, main = page.getByTestId('remote-workspace');
  const editor = main.locator('[data-composer-input]');
  const dialog = page.getByRole('dialog', { name: '电脑设置', exact: true });
  const models = dialog.getByRole('region', { name: '编辑 DeepSeek 模型清单', exact: true });
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
  const view = () => main.evaluate(node => {
    for (let fiber = node[Object.keys(node).find(name => name.startsWith('__reactFiber$'))]; fiber; fiber = fiber.return) {
      const current = fiber.memoizedProps?.model?.deepSeekModels?.view;
      if (current) return { revision: current.revision, overridden: current.overridden,
        advancedEditable: current.advancedEditable, compatEditable: current.compatEditable,
        rows: current.rows.map(({ source, ...row }) => row) };
    }
    return null;
  });
  const settle = async (overridden, name) => {
    await page.waitForFunction(({ overridden, name }) => {
      const node = document.querySelector('[data-testid="remote-workspace"]');
      for (let fiber = node?.[Object.keys(node).find(key => key.startsWith('__reactFiber$'))]; fiber; fiber = fiber.return) {
        const service = fiber.memoizedProps?.model?.deepSeekModels;
        if (service?.view) return !service.busy && service.view.overridden === overridden && service.view.rows[0].name === name;
      }
      return false;
    }, { overridden, name });
    await models.getByRole('button', { name: '保存模型清单', exact: true }).waitFor();
    await models.getByText('正在处理…', { exact: true }).waitFor({ state: 'hidden' });
    assert.equal(await models.getByRole('button', { name: '保存模型清单', exact: true }).isEnabled(), false);
  };
  let granted = false;
  await editor.fill('OFFICIAL_MODEL_SETTINGS_DRAFT');
  try {
    await open();
    await dialog.getByText('请先在电脑端授予此设备管理权限，再查看或修改电脑设置。', { exact: true }).waitFor();
    assert.equal(await dialog.locator('input,select').count(), 0); report.managementRequired = true;
    await settings.management(fingerprint, true); granted = true; await reconnect();
    await models.getByRole('button', { name: '编辑 DeepSeek 模型清单', exact: true }).click();
    const name = models.getByRole('textbox', { name: '模型名称 1', exact: true });
    const capacity = models.getByRole('textbox', { name: '上下文容量（Token） 1', exact: true });
    await name.waitFor({ timeout: 60000 });
    const original = await settings.models.verify('initial', await view());
    assert.equal(await name.inputValue(), original.originalName);
    assert.equal(await models.locator('.remote-provider-model-row').count(), original.count);
    report.original = original;
    await name.fill(original.changedName); await capacity.fill(String(original.changedContextWindow));
    await models.locator('.remote-model-capabilities').first().locator(':scope > summary').click();
    await models.getByRole('combobox', { name: '输入类型 1', exact: true }).selectOption('text');
    await models.getByRole('button', { name: '保存模型清单', exact: true }).click();
    await settle(true, original.changedName);
    report.changed = await settings.models.verify('changed', await view());
    await name.scrollIntoViewIfNeeded();
    await writeFile(resolve(evidence, 'deepseek-models-changed.png'), await device.screenshot());
    await mark('official-phone-deepseek-model-row-saved-and-public-directory-updated');
    await dialog.getByRole('button', { name: '关闭窗口', exact: true }).click();
    await editor.click();
    await page.getByRole('button', { name: /^选择模型，当前 / }).click();
    await page.getByRole('button', { name: original.changedName, exact: true }).waitFor();
    await writeFile(resolve(evidence, 'deepseek-model-picker-live-name.png'), await device.screenshot());
    await page.getByRole('button', { name: '关闭窗口', exact: true }).click();
    assert.equal(await editor.innerText(), 'OFFICIAL_MODEL_SETTINGS_DRAFT');
    report.phonePickerUpdated = true;
    await open(); await models.getByRole('button', { name: '编辑 DeepSeek 模型清单', exact: true }).click();
    await name.waitFor(); assert.equal(await name.inputValue(), original.changedName);
    await models.getByRole('button', { name: '恢复默认模型清单', exact: true }).click();
    await models.getByRole('button', { name: '保存模型清单', exact: true }).click();
    await settle(false, original.originalName);
    report.restored = await settings.models.verify('restored', await view());
    await models.getByRole('button', { name: '重新读取模型清单', exact: true }).click();
    await name.waitFor(); await settle(false, original.originalName);
    assert.equal(await name.inputValue(), original.originalName);
    await mark('official-phone-model-list-default-inheritance-and-full-rows-restored');
    await settings.management(fingerprint, false); granted = false; await reconnect();
    await dialog.getByText('请先在电脑端授予此设备管理权限，再查看或修改电脑设置。', { exact: true }).waitFor();
    assert.equal(await dialog.locator('input,select').count(), 0);
    await dialog.getByRole('button', { name: '关闭窗口', exact: true }).click();
    assert.equal(await editor.innerText(), 'OFFICIAL_MODEL_SETTINGS_DRAFT'); await editor.fill('');
    report.managementReturned = true; report.draftPreserved = true;
    await mark('official-model-settings-management-revoked-chat-retained');
    return report;
  } catch (error) { report.failure = error.message; throw error; }
  finally {
    if (granted) await settings.management(fingerprint, false);
    await writeFile(resolve(evidence, 'deepseek-model-settings.json'), JSON.stringify(report, null, 2) + '\n');
  }
}
