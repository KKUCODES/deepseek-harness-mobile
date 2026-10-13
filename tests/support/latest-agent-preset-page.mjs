import assert from 'node:assert/strict';

/** 原 Creator 入口在历史会话之外着陆；再从空会话进入时复用它，不修改旧聊天。 */
export async function verifyPresetCreator(page, title, verify) {
  await page.locator('.remote-topbar').getByRole('button', { name: '返回', exact: true }).click();
  await page.getByRole('button').filter({ hasText: title }).click();
  let first;
  for (const phase of ['history', 'blank', 'plugin']) {
    await verify('prepare', phase);
    await page.getByRole('button', { name: 'Remote 选项', exact: true }).click();
    if (phase === 'plugin') {
      await page.getByRole('button', { name: '电脑插件', exact: true }).click();
      await page.getByRole('button', { name: '管理电脑插件', exact: true }).click();
      // 同一组固定远程表单也须能从新版原管理页打开，不能只修复菜单入口。
      const manager = page.getByRole('region', { name: '管理电脑插件', exact: true });
      for (const [id, field] of Object.entries({ bash: '#plugin-config-shell-timeout',
        'agent-loop': '#plugin-config-agent-loop-parallel', subagent: '#plugin-config-subagent-depth',
        'web-search': '#plugin-config-web-search-max-uses' })) {
        await manager.locator(`[data-plugin-item="${id}"]`).getByRole('button').click();
        await manager.locator(`${field}:not(:disabled)`).waitFor();
        await manager.getByRole('button', { name: '返回插件列表', exact: true }).click();
      }
      await page.getByRole('button', { name: '选择添加插件方式', exact: true }).click();
      await page.getByRole('menuitem').filter({ hasText: '让 Agent 创建插件' }).click();
      await page.getByRole('button', { name: '选择添加插件方式', exact: true }).waitFor({ state: 'detached' });
    } else {
      await page.getByRole('button', { name: '电脑设置', exact: true }).click();
      await page.getByRole('combobox', { name: '设置页面', exact: true }).selectOption('agent-presets');
      await page.getByRole('button', { name: '让 Agent 帮我创建预设模式', exact: true }).click();
      await page.getByRole('combobox', { name: '设置页面', exact: true }).waitFor({ state: 'detached' });
    }
    const id = await verify('applied', phase);
    // 原介绍动画按字拆成 span，读屏名称可能在字间插入空白。
    await page.getByRole('button', { name: /^(Agent 模式，当前 )?创\s*造\s*模\s*式$/, exact: true }).waitFor();
    if (first) assert.equal(id, first, '已有空白聊天应复用，不另建会话');
    else first = id;
    assert.equal(await page.locator('iframe').count(), 0);
  }
}

export async function verifyCodingTools(page, verify) {
  await page.getByRole('button', { name: 'Remote 选项', exact: true }).click();
  await page.getByRole('button', { name: '电脑设置', exact: true }).click();
  const section = page.getByRole('combobox', { name: '设置页面', exact: true });
  await section.selectOption('general');
  const toggle = page.getByRole('switch', { name: '显示代码工作视图', exact: true });
  await page.getByRole('switch', { name: '显示代码工作视图', exact: true, checked: true }).waitFor();
  await verify('prepare');
  await toggle.click();
  await page.getByRole('switch', { name: '显示代码工作视图', exact: true, checked: false }).and(page.locator('button:not(:disabled)')).waitFor();
  await verify('off');
  await section.selectOption('agent-presets');
  await page.locator('[data-agent-preset-id="standard"]').waitFor();
  await page.locator('[data-agent-preset-id="ptc"]').waitFor({ state: 'detached' });
  await page.locator('[data-agent-preset-id="minimal"]').waitFor({ state: 'detached' });
  await section.selectOption('general');
  await page.getByRole('button', { name: '恢复默认', exact: true }).click();
  await page.getByRole('switch', { name: '显示代码工作视图', exact: true, checked: true }).and(page.locator('button:not(:disabled)')).waitFor();
  await verify('restored');
  await section.selectOption('agent-presets');
  await page.locator('[data-agent-preset-id="ptc"]').waitFor();
  await page.locator('[data-agent-preset-id="minimal"]').waitFor();
  await verify('desktop-off');
  await page.locator('[data-agent-preset-id="ptc"]').waitFor({ state: 'detached' });
  await verify('desktop-restore');
  await page.locator('[data-agent-preset-id="ptc"]').waitFor();
  await page.getByRole('button', { name: '关闭窗口', exact: true }).click();
}

export async function verifyLockedPreset(page, preset) {
  await page.getByRole('button', { name: /^Agent 模式，当前 / }).click();
  await page.getByText('本次聊天已开始，模式不能更换。', { exact: true }).waitFor();
  const option = page.locator(`[data-agent-preset="${preset.id}"]`);
  await option.waitFor();
  assert.equal(await option.isDisabled(), true);
  await page.getByRole('button', { name: '关闭窗口', exact: true }).click();
}

/** 通过手机真实模式窗口提交，电脑投影确认后再检查手机同步状态。 */
export async function verifyBlankPreset(page, preset, verifyPreset) {
  await page.getByRole('button', { name: '关闭窗口', exact: true }).click();
  await page.locator('.remote-topbar').getByRole('button', { name: '返回', exact: true }).click();
  await page.getByRole('button', { name: '在已有工作区新建聊天', exact: true }).click();
  await page.getByLabel('选择工作区', { exact: true }).getByRole('button', { name: preset.workspaceTitle, exact: true }).click();
  await page.getByRole('button', { name: 'Remote 选项', exact: true }).click();
  await page.getByRole('button', { name: 'Agent 模式', exact: true }).click();
  const option = page.locator(`[data-agent-preset="${preset.id}"]`);
  await option.waitFor();
  assert.equal(await option.isDisabled(), false, '新版没有旧模式开关，空会话仍应可选');
  await option.click();
  await verifyPreset();
  await page.locator(`[data-agent-preset="${preset.id}"][aria-pressed="true"]`).waitFor();
  await page.getByRole('button', { name: '关闭窗口', exact: true }).click();
}

/** 原设置卡片的真实点击，经固定管理通道保存，再由原桌面接口核验新会话继承。 */
export async function verifyPresetDefault(page, preset, verifyDefault) {
  await page.getByRole('button', { name: 'Remote 选项', exact: true }).click();
  await page.getByRole('button', { name: '电脑设置', exact: true }).click();
  await page.getByRole('combobox', { name: '设置页面', exact: true }).selectOption('agent-presets');
  const card = page.locator(`[data-agent-preset-id="${preset.id}"]`);
  await card.locator('button[aria-pressed="false"]:not(:disabled)').waitFor();
  await card.locator('button[aria-pressed="false"]').click();
  await card.locator('button[aria-pressed="true"]').waitFor();
  await verifyDefault(preset.id);
  // 核验回调在电脑恢复继承并广播；旧手机快照必须锁住修改，由人主动重读。
  await page.getByRole('button', { name: '重新读取设置', exact: true }).click();
  await card.locator('button[aria-pressed="false"]:not(:disabled)').waitFor();
  await page.getByRole('button', { name: '关闭窗口', exact: true }).click();
}

/** 手机自己的设置入口显示原 profile 保存位置；换预设立即清掉旧路径。 */
export async function verifyPresetDirectory(page, preset) {
  await page.getByRole('button', { name: 'Remote 选项', exact: true }).click();
  await page.getByRole('button', { name: '电脑设置', exact: true }).click();
  await page.getByRole('combobox', { name: '设置页面', exact: true }).selectOption('agent-presets');
  const section = page.getByRole('region', { name: '预设配置位置', exact: true });
  const select = section.getByRole('combobox', { name: '选择预设', exact: true });
  await select.selectOption(preset.id);
  await section.getByRole('button', { name: '查看配置位置', exact: true }).click();
  await section.getByText(preset.documentPath, { exact: true }).waitFor();
  assert.equal(await section.locator('code').innerText(), preset.documentPath);
  assert.equal(await section.evaluate(element => element.scrollWidth > element.clientWidth), false, '长 Windows 路径应换行而不是撑开手机页面');
  await select.selectOption('');
  assert.equal(await section.locator('code').count(), 0);
  assert.equal(await section.getByRole('button', { name: '查看配置位置', exact: true }).isDisabled(), true);
  await page.getByRole('button', { name: '关闭窗口', exact: true }).click();
}

/** 自有设置入口复制、取消删除、确认删除；电脑原接口/配置由独立回调核验。 */
export async function verifyPresetManagement(page, preset, verifyManagement) {
  await page.getByRole('button', { name: 'Remote 选项', exact: true }).click();
  await page.getByRole('button', { name: '电脑设置', exact: true }).click();
  await page.getByRole('combobox', { name: '设置页面', exact: true }).selectOption('agent-presets');
  const section = page.getByRole('region', { name: '复制与删除模式', exact: true });
  const select = section.getByRole('combobox', { name: '管理模式', exact: true });
  await select.selectOption(preset.id);
  await section.getByRole('button', { name: '读取模式信息', exact: true }).click();
  await section.getByText('此模式来自电脑基础配置，不能在这里删除。', { exact: true }).waitFor();
  await section.getByRole('textbox', { name: '新模式标识', exact: true }).fill(preset.copyId);
  await section.getByRole('textbox', { name: '新模式名称', exact: true }).fill('手机模式复制验收');
  await section.getByRole('button', { name: '复制模式', exact: true }).click();
  await section.getByText('模式已复制到电脑。', { exact: true }).waitFor();
  await verifyManagement('copied', preset.copyId);
  await select.selectOption(preset.copyId);
  await section.getByRole('button', { name: '读取模式信息', exact: true }).click();
  const remove = section.getByRole('button', { name: '删除模式', exact: true });
  await remove.waitFor(); await remove.click();
  const confirmation = section.getByRole('group', { name: '确认删除模式', exact: true });
  await confirmation.getByRole('button', { name: '取消', exact: true }).click();
  assert.equal(await confirmation.count(), 0);
  await verifyManagement('cancelled', preset.copyId);
  await remove.click();
  await confirmation.getByRole('button', { name: '确认删除模式', exact: true }).click();
  await section.getByText('模式已删除，已有聊天保留。', { exact: true }).waitFor();
  await verifyManagement('deleted', preset.copyId);
  assert.equal(await section.evaluate(element => element.scrollWidth > element.clientWidth), false);
  await page.getByRole('button', { name: '关闭窗口', exact: true }).click();
}
