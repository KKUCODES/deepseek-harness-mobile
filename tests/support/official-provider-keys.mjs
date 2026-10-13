import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { verifyNativeProviderKey } from './latest-native-model-probe.mjs';

/** 手机密码窗口操作虚构值；官网模型 Key 未配置，目录 HTTP 不模拟推理。 */
export async function verifyOfficialProviderKeys({ page, device, evidence, settings, fingerprint, title, packageName, mark }) {
  assert.equal(packageName, 'dev.dshmobile.validation.officialtest');
  const route = 'dshm-phone-management', report = { phases: [], inferenceVerified: false };
  const main = page.getByTestId('remote-workspace'), editor = main.locator('[data-composer-input]');
  const dialog = page.getByRole('dialog', { name: '电脑设置', exact: true });
  const verify = async phase => {
    const result = await settings.providerKeys.verify(phase); report.phases.push(phase);
    await writeFile(resolve(evidence, 'provider-keys.json'), JSON.stringify(report, null, 2) + '\n');
    await mark('official-provider-key-' + phase); return result;
  };
  const open = async () => {
    await main.waitFor({ timeout: 60000 });
    const row = main.locator('.remote-session-row').filter({ hasText: title }); if (await row.count()) await row.click();
    await editor.waitFor();
    await main.getByRole('button', { name: 'Remote 选项', exact: true }).click();
    await page.getByRole('dialog', { name: 'Remote 选项', exact: true }).getByRole('button', { name: '电脑设置', exact: true }).click();
  };
  const reconnect = async () => {
    await page.getByText('电脑已调整这台手机的权限，请重新连接。', { exact: true }).waitFor();
    await page.getByRole('button', { name: '重新连接', exact: true }).click();
    await main.waitFor({ timeout: 60000 });
    const row = main.locator('.remote-session-row').filter({ hasText: title }); if (await row.count()) await row.click();
    await editor.waitFor();
  };
  let granted = false;
  await editor.fill('OFFICIAL_PROVIDER_KEY_DRAFT');
  try {
    await open(); await dialog.getByText('请先在电脑端授予此设备管理权限，再查看或修改电脑设置。', { exact: true }).waitFor();
    assert.equal(await dialog.locator('input,select').count(), 0); report.managementRequired = true;
    await settings.management(fingerprint, true); granted = true; await reconnect();
    assert.equal(await editor.innerText(), 'OFFICIAL_PROVIDER_KEY_DRAFT');
    const targets = await verify('prepare');
    for (const kind of ['existing', 'creation']) {
      await open(); await page.getByRole('combobox', { name: '设置页面', exact: true }).selectOption('models');
      const providers = page.getByRole('region', { name: '其他模型提供方', exact: true });
      await providers.getByRole('button', { name: '其他模型提供方', exact: true }).click();
      const creation = providers.getByRole('region', { name: '新增模型提供方', exact: true });
      await creation.getByRole('button', { name: '新增模型提供方', exact: true }).click();
      await creation.getByRole('combobox', { name: /^提供方来源/ }).selectOption('custom');
      await creation.getByLabel('提供方标识', { exact: true }).fill(route);
      await creation.getByRole('combobox', { name: /^服务协议/ }).selectOption('openai-completions');
      await creation.getByLabel('服务地址', { exact: true }).fill(targets.baseURL);
      await creation.getByRole('textbox', { name: '模型 ID 1', exact: true }).fill('phone-model');
      await creation.getByRole('textbox', { name: '模型名称 1', exact: true }).fill('Phone model');
      await creation.getByRole('checkbox', { name: '使用 API Key，创建后在原生窗口配置', exact: true }).setChecked(kind === 'creation');
      assert.equal(await creation.getByRole('region', { name: '从当前地址获取模型', exact: true }).count(), 0);
      await creation.getByRole('button', { name: '核对提供方', exact: true }).click();
      await creation.getByRole('group', { name: '确认新增提供方', exact: true }).getByRole('button', { name: '确认新增', exact: true }).click();
      await creation.getByRole('button', { name: '查看提供方设置', exact: true }).waitFor();
      await verify(kind + '-created');
      if (kind === 'creation') {
        const createdKey = creation.getByRole('region', { name: '电脑提供方 Key', exact: true });
        await createdKey.getByText('尚未配置', { exact: true }).waitFor();
        await verifyNativeProviderKey(device, packageName, page, createdKey, 'set', route);
        await verify(kind + '-saved-key');
      }
      await creation.getByRole('button', { name: '查看提供方设置', exact: true }).click();
      const form = providers.locator('.remote-provider-form');
      if (kind === 'existing') {
        const setup = form.getByRole('region', { name: '启用提供方 API Key', exact: true });
        await setup.getByRole('button', { name: '启用 API Key', exact: true }).click();
        await setup.getByRole('button', { name: '确认启用 API Key', exact: true }).click();
        await form.getByRole('region', { name: '电脑提供方 Key', exact: true }).getByText('尚未配置', { exact: true }).waitFor();
        await verify('existing-enabled');
      }
      const key = form.getByRole('region', { name: '电脑提供方 Key', exact: true });
      if (kind === 'existing') {
        await verifyNativeProviderKey(device, packageName, page, key, 'cancel', route); await verify('existing-cancelled');
        await verifyNativeProviderKey(device, packageName, page, key, 'invalid', route); await verify('existing-invalid');
        await verifyNativeProviderKey(device, packageName, page, key, 'set', route); await verify('existing-saved-key');
      }
      const models = form.getByRole('region', { name: '编辑模型清单', exact: true });
      await models.getByRole('button', { name: '编辑模型清单', exact: true }).click();
      await models.getByRole('button', { name: '获取可用模型', exact: true }).click();
      await models.getByRole('checkbox', { name: 'HTTP 新模型 · probe-discovered', exact: true }).waitFor();
      await verify(kind + '-authenticated');
      await writeFile(resolve(evidence, 'provider-key-' + kind + '-configured.png'), await device.screenshot());
      await verifyNativeProviderKey(device, packageName, page, key, 'remove', route); await verify(kind + '-removed-key');
      if (kind === 'existing') {
        await models.getByRole('button', { name: '获取可用模型', exact: true }).click();
        await models.getByText('无法获取可用模型，请检查电脑上的提供方配置，或手动添加模型。', { exact: true }).waitFor();
        await verify('existing-missing-key');
      }
      const removal = form.getByRole('region', { name: '移除提供方', exact: true });
      await removal.getByRole('button', { name: '移除提供方', exact: true }).click();
      await removal.getByRole('group', { name: '确认移除提供方', exact: true }).getByRole('button', { name: '确认移除', exact: true }).click();
      await form.waitFor({ state: 'detached' }); await verify(kind + '-removed-provider');
      await dialog.getByRole('button', { name: '关闭窗口', exact: true }).click();
    }
    assert.equal(await editor.innerText(), 'OFFICIAL_PROVIDER_KEY_DRAFT');
    await settings.management(fingerprint, false); granted = false; await reconnect(); await open();
    await dialog.getByText('请先在电脑端授予此设备管理权限，再查看或修改电脑设置。', { exact: true }).waitFor();
    assert.equal(await dialog.locator('input,select').count(), 0); await dialog.getByRole('button', { name: '关闭窗口', exact: true }).click();
    assert.equal(await editor.innerText(), 'OFFICIAL_PROVIDER_KEY_DRAFT'); await editor.fill('');
    report.managementReturned = true; report.draftPreserved = true; await mark('official-provider-key-management-revoked');
    return report;
  } catch (error) { report.failure = error.message; throw error; }
  finally {
    if (granted) await settings.management(fingerprint, false);
    await writeFile(resolve(evidence, 'provider-keys.json'), JSON.stringify(report, null, 2) + '\n');
  }
}
