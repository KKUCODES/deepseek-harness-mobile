import assert from 'node:assert/strict';
import { verifyModelAdvancedManagement } from './latest-model-advanced-page.mjs';

/** 真实手机表单管理独立测试路由；电脑原设置接口逐步核验，不发模型请求。 */
export async function verifyProviderManagement(page, verify, nativeProbe, nativeKey) {
  const route = 'dshm-phone-management';
  const targets = await verify('prepare', route);
  const modelProbe = targets.modelProbeAvailable !== false;
  if (!modelProbe) assert.equal(Boolean(nativeProbe || nativeKey), false);
  await page.getByRole('button', { name: 'Remote 选项', exact: true }).click();
  await page.getByRole('button', { name: '电脑设置', exact: true }).click();
  await page.getByRole('combobox', { name: '设置页面', exact: true }).selectOption('models');
  const providers = page.getByRole('region', { name: '其他模型提供方', exact: true });
  await providers.getByRole('button', { name: '其他模型提供方', exact: true }).click();
  const creation = providers.getByRole('region', { name: '新增模型提供方', exact: true });
  await creation.getByRole('button', { name: '新增模型提供方', exact: true }).click();
  await creation.getByRole('combobox', { name: /^提供方来源/ }).selectOption('custom');
  await creation.getByLabel('提供方标识', { exact: true }).fill(route);
  await creation.getByRole('combobox', { name: /^服务协议/ }).selectOption('openai-completions');
  await creation.getByLabel('服务地址', { exact: true }).fill(targets.baseURL);
  const probe = creation.getByRole('region', { name: '从当前地址获取模型', exact: true });
  const confirmation = probe.getByRole('group', { name: '确认模型请求', exact: true });
  if (modelProbe) {
    await probe.getByRole('button', { name: '从当前地址获取模型', exact: true }).click();
    await confirmation.getByRole('button', { name: '取消', exact: true }).click();
    await verify('probe-cancelled', route);
    await probe.getByRole('button', { name: '从当前地址获取模型', exact: true }).click();
    await confirmation.getByRole('button', { name: '确认获取模型', exact: true }).click();
    await probe.getByRole('checkbox', { name: 'HTTP 新模型 · probe-discovered', exact: true }).check();
    await verify('probe-discovered', route);
    await probe.getByRole('button', { name: '加入编辑草稿', exact: true }).click();
    assert.equal(await creation.getByRole('textbox', { name: '模型 ID 1', exact: true }).inputValue(), 'probe-discovered');
    await verify('probe-adopted', route);
    await creation.getByLabel('服务地址', { exact: true }).fill(targets.redirectURL);
    await probe.getByRole('button', { name: '从当前地址获取模型', exact: true }).click();
    await confirmation.getByRole('button', { name: '确认获取模型', exact: true }).click();
    await probe.getByText('无法获取可用模型，请检查电脑上的提供方配置，或手动添加模型。', { exact: true }).waitFor();
    await verify('probe-redirect', route);
    if (nativeProbe) {
      await creation.getByLabel('服务地址', { exact: true }).fill(targets.baseURL);
      await probe.getByRole('combobox', { name: /^获取模型时使用的认证/ }).selectOption('temporary');
      await nativeProbe(probe, phase => verify(phase, route));
      await probe.getByRole('combobox', { name: /^获取模型时使用的认证/ }).selectOption('none');
    }
  } else {
    assert.equal(await probe.count(), 0);
    await verify('probe-unavailable', route);
  }
  await creation.getByLabel('服务地址', { exact: true }).fill(targets.baseURL);
  await creation.getByRole('textbox', { name: '模型 ID 1', exact: true }).fill('phone-model');
  await creation.getByRole('textbox', { name: '模型名称 1', exact: true }).fill('Phone model');
  await creation.getByRole('textbox', { name: '上下文容量（Token） 1', exact: true }).fill('128001');
  await creation.getByRole('textbox', { name: '输出容量（Token） 1', exact: true }).fill('4097');
  await creation.getByLabel('显示名称（可选）', { exact: true }).fill('手机提供方验收');
  await creation.getByRole('checkbox', { name: '使用 API Key，创建后在原生窗口配置', exact: true }).uncheck();
  await creation.getByRole('button', { name: '核对提供方', exact: true }).click();
  await creation.getByRole('group', { name: '确认新增提供方', exact: true })
    .getByRole('button', { name: '确认新增', exact: true }).click();
  await creation.getByRole('button', { name: '查看提供方设置', exact: true }).waitFor();
  await verify('created', route);
  await creation.getByRole('button', { name: '查看提供方设置', exact: true }).click();
  const form = providers.locator('.remote-provider-form');
  const name = form.getByRole('textbox', { name: '提供方名称', exact: true });
  await name.waitFor();
  assert.equal(await name.inputValue(), '手机提供方验收');
  await name.fill('手机提供方改名');
  await form.getByRole('button', { name: '保存到电脑', exact: true }).click();
  await form.locator(':scope > p[role="status"]').getByText('已保存到电脑。', { exact: true }).waitFor();
  await verify('renamed', route);
  const models = form.getByRole('region', { name: '编辑模型清单', exact: true });
  await models.getByRole('button', { name: '编辑模型清单', exact: true }).click();
  const modelName = models.getByRole('textbox', { name: '模型名称 1', exact: true });
  await modelName.waitFor();
  assert.equal(await modelName.inputValue(), 'Phone model');
  await models.getByRole('button', { name: '获取可用模型', exact: true }).click();
  await models.getByRole('checkbox', { name: 'HTTP 新模型 · probe-discovered', exact: true }).check();
  await verify('existing-discovered', route);
  await models.getByRole('button', { name: '加入编辑草稿', exact: true }).click();
  assert.equal(await models.getByRole('textbox', { name: '模型 ID 2', exact: true }).inputValue(), 'probe-discovered');
  await verify('existing-adopted', route);
  await modelName.fill('手机模型改名');
  await models.getByRole('button', { name: '保存模型清单', exact: true }).click();
  await models.getByText('已保存到电脑。', { exact: true }).waitFor();
  await verify('model-renamed', route);
  // 地址仍是未保存的手机草稿；两个发现入口应分别读取草稿地址与电脑保存值。
  await form.getByRole('textbox', { name: '新的完整服务地址', exact: true }).fill(targets.draftURL);
  const savedProbe = models.getByRole('region', { name: '从当前地址获取模型', exact: true });
  const requestConfirmation = savedProbe.getByRole('group', { name: '确认模型请求', exact: true });
  if (modelProbe) {
    await savedProbe.getByRole('button', { name: '从当前地址获取模型', exact: true }).click();
    await requestConfirmation.getByRole('button', { name: '确认获取模型', exact: true }).click();
    await savedProbe.getByText('没有可添加的新模型。', { exact: true }).waitFor();
    await verify('existing-draft', route);
  } else {
    assert.equal(await savedProbe.count(), 0);
    await verify('existing-draft-unavailable', route);
  }
  await models.getByRole('button', { name: '获取可用模型', exact: true }).click();
  await models.getByText('没有可添加的新模型。', { exact: true }).waitFor();
  await verify('existing-saved-address', route);
  if (nativeKey) {
    const setup = form.getByRole('region', { name: '启用提供方 API Key', exact: true });
    await setup.getByRole('button', { name: '启用 API Key', exact: true }).click();
    await setup.getByRole('button', { name: '确认启用 API Key', exact: true }).click();
    // 模型保存已更新电脑版本；上方标量表单的旧快照必须被拒绝，重读后再启用 Key。
    await form.getByText('电脑设置已变化或页面已过期，请重新读取后再修改。', { exact: true }).waitFor();
    await verify('existing-key-setup-stale', route);
    await form.getByRole('button', { name: '重新读取设置', exact: true }).click();
    await setup.getByRole('button', { name: '启用 API Key', exact: true }).click();
    await setup.getByRole('button', { name: '确认启用 API Key', exact: true }).click();
    const key = form.getByRole('region', { name: '电脑提供方 Key', exact: true });
    await key.getByText('尚未配置', { exact: true }).waitFor();
    await nativeKey(key, 'set', route);
    await verify('existing-key-saved', route);
    await models.getByRole('button', { name: '获取可用模型', exact: true }).click();
    await models.getByText('没有可添加的新模型。', { exact: true }).waitFor();
    await verify('existing-authenticated', route);
    await form.getByRole('textbox', { name: '新的完整服务地址', exact: true }).fill(targets.draftURL);
    await savedProbe.getByRole('combobox', { name: /^获取模型时使用的认证/ }).selectOption('stored');
    await savedProbe.getByRole('button', { name: '从当前地址获取模型', exact: true }).click();
    await requestConfirmation.getByText(route, { exact: true }).waitFor();
    await requestConfirmation.getByRole('button', { name: '确认获取模型', exact: true }).click();
    await savedProbe.getByText('没有可添加的新模型。', { exact: true }).waitFor();
    await verify('existing-draft-authenticated', route);
    await nativeKey(key, 'remove', route);
    await verify('existing-key-removed', route);
    await models.getByRole('button', { name: '获取可用模型', exact: true }).click();
    await models.getByText('无法获取可用模型，请检查电脑上的提供方配置，或手动添加模型。', { exact: true }).waitFor();
    await verify('existing-missing-key', route);
  }
  await verifyModelAdvancedManagement(form, phase => verify(phase, route));
  const removal = form.getByRole('region', { name: '移除提供方', exact: true });
  await removal.getByRole('button', { name: '移除提供方', exact: true }).click();
  const removalConfirmation = removal.getByRole('group', { name: '确认移除提供方', exact: true });
  await removalConfirmation.getByRole('button', { name: '取消', exact: true }).click();
  await verify('cancelled', route);
  await removal.getByRole('button', { name: '移除提供方', exact: true }).click();
  await removalConfirmation.getByRole('button', { name: '确认移除', exact: true }).click();
  await form.waitFor({ state: 'detached' });
  await verify('removed', route);
  await page.getByRole('button', { name: '关闭窗口', exact: true }).click();
}
