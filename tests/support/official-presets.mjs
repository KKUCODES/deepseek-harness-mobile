import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

/** 模式窗口和原公开设置卡片均从自己的手机页面实际操作；不调用旧复制/删除入口。 */
export async function verifyOfficialPresets({ page, device, evidence, settings, fingerprint, title, workspaceTitle, mark }) {
  const report = {}, main = page.getByTestId('remote-workspace'), checks = settings.presets;
  const editor = main.locator('[data-composer-input]'), dialog = page.getByRole('dialog', { name: '电脑设置', exact: true });
  const state = () => main.evaluate(element => {
    for (let fiber = element[Object.keys(element).find(key => key.startsWith('__reactFiber$'))]; fiber; fiber = fiber.return) {
      const model = fiber.memoizedProps?.model;
      if (model?.client) return { selected: model.getSnapshot().selected, agentPreset: model.getSnapshot().agentPreset };
    }
    throw Error('official_preset_model_missing');
  });
  const openSettings = async () => {
    await main.getByRole('button', { name: 'Remote 选项', exact: true }).click();
    await page.getByRole('dialog', { name: 'Remote 选项', exact: true }).getByRole('button', { name: '电脑设置', exact: true }).click();
  };
  const reconnect = async () => {
    await page.getByText('电脑已调整这台手机的权限，请重新连接。', { exact: true }).waitFor();
    await page.getByRole('button', { name: '重新连接', exact: true }).click();
    await main.waitFor({ timeout: 60000 });
    const row = main.locator('.remote-session-row').filter({ hasText: title });
    if (await row.count()) await row.click();
  };
  const chooseBlank = async () => {
    await main.locator('.remote-topbar').getByRole('button', { name: '返回', exact: true }).click();
    await page.getByRole('button', { name: '在已有工作区新建聊天', exact: true }).click();
    await page.getByLabel('选择工作区', { exact: true }).getByRole('button', { name: workspaceTitle, exact: true }).click();
    await editor.waitFor();
  };
  const returnHistory = async () => {
    await main.locator('.remote-topbar').getByRole('button', { name: '返回', exact: true }).click();
    await main.locator('.remote-session-row').filter({ hasText: title }).click();
    await editor.waitFor(); assert.equal(await editor.innerText(), 'OFFICIAL_PRESETS_DRAFT');
  };
  let granted = false;
  await editor.fill('OFFICIAL_PRESETS_DRAFT');
  try {
    const original = report.original = await checks.verify('initial');
    await main.getByRole('button', { name: /^Agent 模式，当前 / }).click();
    await page.getByText('本次聊天已开始，模式不能更换。', { exact: true }).waitFor();
    const options = page.locator('[data-agent-preset]');
    assert.ok(await options.count() > 1);
    for (const option of await options.all()) assert.equal(await option.isDisabled(), true);
    await page.getByRole('button', { name: '关闭窗口', exact: true }).click();
    report.historyLocked = true; await mark('official-started-session-preset-choice-disabled');

    await chooseBlank();
    // 空白聊天使用原 Hero 入口，菜单是空白与历史会话共同的选择入口。
    await main.getByRole('button', { name: 'Remote 选项', exact: true }).click();
    await page.getByRole('dialog', { name: 'Remote 选项', exact: true }).getByRole('button', { name: 'Agent 模式', exact: true }).click();
    const chosen = page.locator(`[data-agent-preset="${original.chosen}"]`);
    await chosen.waitFor(); assert.equal(await chosen.isEnabled(), true); await chosen.click();
    await page.locator(`[data-agent-preset="${original.chosen}"][aria-pressed="true"]`).waitFor();
    report.blank = await checks.verify('blank', (await state()).selected);
    await page.getByRole('button', { name: '关闭窗口', exact: true }).click();
    await mark('official-phone-blank-session-preset-synchronized');
    await returnHistory(); await openSettings();
    await dialog.getByText('请先在电脑端授予此设备管理权限，再查看或修改电脑设置。', { exact: true }).waitFor();
    assert.equal(await dialog.locator('input,select').count(), 0); report.managementRequired = true;
    await settings.management(fingerprint, true); granted = true; await reconnect(); await openSettings();
    await dialog.getByRole('combobox', { name: '设置页面', exact: true }).selectOption('agent-presets');
    for (const row of original.rows) await dialog.locator(`[data-agent-preset-id="${row.id}"]`).waitFor();
    const card = dialog.locator(`[data-agent-preset-id="${original.chosen}"]`);
    await card.getByRole('button', { name: /^查看配置[:：]/ }).click();
    const preview = page.getByRole('dialog').filter({ has: page.locator('pre') });
    await preview.locator('pre').waitFor();
    report.declaration = await checks.verify('declaration', undefined, await preview.locator('pre').innerText());
    await writeFile(resolve(evidence, 'preset-declaration.png'), await device.screenshot());
    await preview.getByRole('button', { name: '关闭', exact: true }).last().click();
    const location = dialog.getByRole('region', { name: '预设配置位置', exact: true });
    await location.getByRole('combobox', { name: '选择预设', exact: true }).selectOption(original.chosen);
    await location.getByRole('button', { name: '查看配置位置', exact: true }).click();
    const directory = await checks.verify('location');
    await location.getByText(directory.path, { exact: true }).waitFor();
    assert.equal(await location.locator('code').innerText(), directory.path);
    assert.equal(await location.evaluate(node => node.scrollWidth > node.clientWidth), false);
    await location.getByRole('combobox', { name: '选择预设', exact: true }).selectOption('');
    assert.equal(await location.locator('code').count(), 0);
    report.location = { officialPathMatched: true, oldLocationCleared: true, mobileWidthContained: true };
    assert.equal(await dialog.getByRole('region', { name: '预设归档管理', exact: true }).count(), 0);
    await mark('official-preset-declaration-and-location-without-archive-management');

    await card.locator('button[aria-pressed="false"]:not(:disabled)').click();
    await card.locator('button[aria-pressed="true"]').waitFor();
    report.defaults = await checks.verify('default');
    assert.equal((await state()).agentPreset, original.originalPreset);
    await dialog.getByRole('button', { name: '关闭窗口', exact: true }).click();
    await chooseBlank();
    await page.waitForFunction(expected => {
      const element = document.querySelector('[data-testid="remote-workspace"]');
      for (let fiber = element?.[Object.keys(element).find(key => key.startsWith('__reactFiber$'))]; fiber; fiber = fiber.return)
        if (fiber.memoizedProps?.model?.client) return fiber.memoizedProps.model.getSnapshot().agentPreset === expected;
      return false;
    }, original.chosen);
    report.inherited = await checks.verify('inherited', (await state()).selected);
    await mark('official-phone-default-preset-new-session-inheritance-history-unchanged');
    report.restored = await checks.verify('restore');
    await returnHistory(); await openSettings();
    await dialog.getByRole('combobox', { name: '设置页面', exact: true }).selectOption('agent-presets');
    await dialog.locator(`[data-agent-preset-id="${original.originalDefault}"] button[aria-pressed="true"]`).waitFor();
    await dialog.getByRole('button', { name: '关闭窗口', exact: true }).click();
    await mark('official-preset-default-and-original-inheritance-restored');
    await settings.management(fingerprint, false); granted = false; await reconnect(); await openSettings();
    await dialog.getByText('请先在电脑端授予此设备管理权限，再查看或修改电脑设置。', { exact: true }).waitFor();
    assert.equal(await dialog.locator('input,select').count(), 0);
    await dialog.getByRole('button', { name: '关闭窗口', exact: true }).click();
    assert.equal(await editor.innerText(), 'OFFICIAL_PRESETS_DRAFT'); await editor.fill('');
    assert.equal(await page.locator('iframe').count(), 0);
    report.managementReturned = true; report.draftPreserved = true;
    await mark('official-preset-management-revoked-chat-and-draft-retained');
    return report;
  } catch (error) { report.failure = error.message; throw error; }
  finally {
    if (granted) await settings.management(fingerprint, false);
    await writeFile(resolve(evidence, 'presets.json'), JSON.stringify(report, null, 2) + '\n');
  }
}
