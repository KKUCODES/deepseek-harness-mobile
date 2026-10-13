import assert from 'node:assert/strict';

/** 在独立提供方的实际表单验证能力、兼容参数和协议切换；由原 Host 核对完整配置。 */
export async function verifyModelAdvancedManagement(form, verify) {
  const button = (root, name) => root.getByRole('button', { name, exact: true });
  const select = (root, name) => root.getByRole('combobox', { name, exact: true });
  const models = form.getByRole('region', { name: '编辑模型清单', exact: true });
  const row = models.locator('.remote-provider-model-row').first();
  const open = async details => {
    if (await details.getAttribute('open') === null) await details.locator(':scope > summary').click();
  };
  const saveModels = async () => {
    await button(models, '保存模型清单').click();
    await models.getByText('已保存到电脑。', { exact: true }).waitFor();
  };
  const readSettings = async () => {
    await button(form, '重新读取设置').click();
    await button(form, '重新读取设置').waitFor();
    assert.equal(await button(form, '重新读取设置').isEnabled(), true);
  };
  const savedSettings = () => form.locator(':scope > p[role="status"]')
    .getByText('已保存到电脑。', { exact: true }).waitFor();
  await verify('advanced-prepare');
  await open(row.locator('.remote-model-capabilities').first());
  await select(row, '输入类型 1').selectOption('image,text');
  await select(row, '思考能力 1').selectOption('custom');
  await row.getByRole('checkbox', { name: '启用档位 off 1', exact: true }).check();
  await row.getByRole('checkbox', { name: '启用档位 high 1', exact: true }).check();
  await row.getByRole('textbox', { name: '服务参数值 high 1', exact: true }).fill('high');
  await open(row.locator('.remote-model-compat'));
  await select(row, '支持保存请求 1').selectOption('false');
  await select(row, '输出容量参数名 1').selectOption('max_tokens');
  await select(row, '思考参数格式 1').selectOption('chat-template');
  await row.getByRole('spinbutton', { name: '调度优先级 1', exact: true }).fill('-1');
  await row.getByRole('textbox', { name: '聊天模板参数 1', exact: true }).fill(JSON.stringify({
    enable_thinking: { $var: 'thinking.enabled' }, effort: { $var: 'thinking.effort', omitWhenOff: true }, marker: 'latest', count: 3, enabled: false, empty: null,
  }));
  await row.getByRole('textbox', { name: 'Baseten 模板参数 1', exact: true }).fill(JSON.stringify({ budget: { $var: 'thinking.budget' } }));
  await saveModels();
  await verify('advanced-set');
  await button(models, '重新读取模型清单').click();
  await models.getByText('正在处理…', { exact: true }).waitFor({ state: 'hidden' });
  await open(row.locator('.remote-model-capabilities').first());
  await open(row.locator('.remote-model-compat'));
  assert.equal(await select(row, '思考能力 1').inputValue(), 'custom');
  assert.equal(await select(row, '输入类型 1').inputValue(), 'image,text');
  assert.equal(await row.getByRole('textbox', { name: '服务参数值 high 1', exact: true }).inputValue(), 'high');
  assert.equal(JSON.parse(await row.getByRole('textbox', { name: '聊天模板参数 1', exact: true }).inputValue()).marker, 'latest');
  await select(row, '思考能力 1').selectOption('disabled');
  await saveModels();
  await verify('advanced-disabled');
  await open(row.locator('.remote-model-capabilities').first());
  await open(row.locator('.remote-model-compat'));
  await select(row, '输入类型 1').selectOption('inherit');
  await select(row, '思考能力 1').selectOption('inherit');
  await button(row, '恢复本模型兼容设置').click();
  await saveModels();
  await verify('advanced-restored');

  await readSettings();
  const scalar = form.locator(':scope > form');
  await open(scalar.locator('.remote-model-compat'));
  await select(scalar, '支持严格模式 提供方').selectOption('true');
  await button(scalar, '保存到电脑').click();
  await savedSettings();
  await verify('advanced-provider-defaults');
  await select(scalar, '服务协议').selectOption('openai-responses');
  await button(scalar, '保存到电脑').click();
  const confirmation = scalar.getByRole('group', { name: '确认服务协议更改', exact: true });
  await button(confirmation, '取消').click();
  await verify('advanced-protocol-cancel');
  await button(scalar, '保存到电脑').click();
  await button(confirmation, '确认保存协议').click();
  await savedSettings();
  await verify('advanced-protocol-switched');
  await readSettings();
  assert.equal(await select(scalar, '服务协议').inputValue(), 'openai-responses');
  await select(scalar, '服务协议').selectOption('openai-completions');
  await button(scalar, '保存到电脑').click();
  await button(confirmation, '确认保存协议').click();
  await savedSettings();
  await verify('advanced-protocol-restored');
  await readSettings();
  await open(scalar.locator('.remote-model-compat'));
  await button(scalar, '恢复提供方兼容设置').click();
  await button(scalar, '保存到电脑').click();
  await savedSettings();
  await verify('advanced-provider-restored');
}
