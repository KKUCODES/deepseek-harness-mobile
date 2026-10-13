import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

/** 操作实际设置和插件菜单的Creator入口；不替代按钮回调，不发送创造任务。 */
export async function verifyOfficialPresetCreator({ page, device, evidence, settings, fingerprint, title, workspaceTitle, mark }) {
  const report = { declarations: [], choices: [], creator: [] }, main = page.getByTestId('remote-workspace');
  const editor = main.locator('[data-composer-input]'), dialog = page.getByRole('dialog', { name: '电脑设置', exact: true });
  const checks = settings.presetCreator, draft = 'OFFICIAL_PRESET_CREATOR_DRAFT';
  const state = () => main.evaluate(element => {
    for (let fiber = element[Object.keys(element).find(key => key.startsWith('__reactFiber$'))]; fiber; fiber = fiber.return) {
      const model = fiber.memoizedProps?.model;
      if (model?.client) return { selected: model.getSnapshot().selected, agentPreset: model.getSnapshot().agentPreset };
    }
    throw Error('official_creator_model_missing');
  });
  const openMenu = async () => {
    await main.getByRole('button', { name: 'Remote 选项', exact: true }).click();
    return page.getByRole('dialog', { name: 'Remote 选项', exact: true });
  };
  const openSettings = async () => (await openMenu()).getByRole('button', { name: '电脑设置', exact: true }).click();
  const reconnect = async () => {
    await page.getByText('电脑已调整这台手机的权限，请重新连接。', { exact: true }).waitFor();
    await page.getByRole('button', { name: '重新连接', exact: true }).click();
    await main.waitFor({ timeout: 60000 });
    const row = main.locator('.remote-session-row').filter({ hasText: title });
    if (await row.count()) await row.click();
  };
  const returnHistory = async () => {
    await main.locator('.remote-topbar').getByRole('button', { name: '返回', exact: true }).click();
    await main.locator('.remote-session-row').filter({ hasText: title }).click();
    await editor.waitFor(); assert.equal(await editor.innerText(), draft);
  };
  let granted = false;
  await editor.fill(draft);
  try {
    report.original = await checks.verify('initial');
    await openSettings();
    await dialog.getByText('请先在电脑端授予此设备管理权限，再查看或修改电脑设置。', { exact: true }).waitFor();
    assert.equal(await dialog.locator('input,select').count(), 0); report.managementRequired = true;
    await settings.management(fingerprint, true); granted = true; await reconnect(); await openSettings();
    await dialog.getByRole('combobox', { name: '设置页面', exact: true }).selectOption('agent-presets');
    for (const row of report.original.rows) {
      await dialog.locator(`[data-agent-preset-id="${row.id}"]`).getByRole('button', { name: /^查看配置[:：]/ }).click();
      const preview = page.getByRole('dialog').filter({ has: page.locator('pre') });
      await preview.locator('pre').waitFor();
      report.declarations.push(await checks.verify('declaration', row.id, await preview.locator('pre').innerText()));
      if (row.id === 'cordis') await writeFile(resolve(evidence, 'creator-declaration.png'), await device.screenshot());
      await preview.getByRole('button', { name: '关闭', exact: true }).last().click();
    }
    await mark('official-all-four-preset-declarations-match-public-host');
    await dialog.getByRole('button', { name: '关闭窗口', exact: true }).click();
    report.creatorPreparation = await checks.verify('creator-ready');
    for (const phase of ['history', 'blank', 'plugin']) {
      if (phase === 'plugin') {
        await (await openMenu()).getByRole('button', { name: '电脑插件', exact: true }).click();
        await page.getByRole('dialog', { name: '电脑插件', exact: true }).getByRole('button', { name: '管理电脑插件', exact: true }).click();
        const manager = page.getByRole('region', { name: '管理电脑插件', exact: true });
        await manager.getByRole('button', { name: '选择添加插件方式', exact: true }).click();
        await page.getByRole('menuitem').filter({ hasText: '让 Agent 创建插件' }).click();
        await manager.waitFor({ state: 'detached' });
      } else {
        await openSettings();
        await dialog.getByRole('combobox', { name: '设置页面', exact: true }).selectOption('agent-presets');
        await dialog.getByRole('button', { name: '让 Agent 帮我创建预设模式', exact: true }).click();
        await dialog.waitFor({ state: 'detached' });
      }
      await page.getByRole('button', { name: /^(Agent 模式，当前 )?创\s*造\s*模\s*式$/, exact: true }).waitFor();
      const next = await state(); assert.equal(next.agentPreset, 'cordis');
      report.creator.push(await checks.verify(phase, next.selected));
      assert.equal(await editor.innerText(), '');
      await mark('official-creator-entry-' + phase + '-blank-session-without-task');
    }
    for (const row of report.original.rows) {
      await (await openMenu()).getByRole('button', { name: 'Agent 模式', exact: true }).click();
      const option = page.locator(`[data-agent-preset="${row.id}"]`);
      await option.waitFor(); assert.equal(await option.isEnabled(), true); await option.click();
      await page.locator(`[data-agent-preset="${row.id}"][aria-pressed="true"]`).waitFor();
      report.choices.push(await checks.verify('choice', (await state()).selected, row.id));
      await page.getByRole('button', { name: '关闭窗口', exact: true }).click();
    }
    await mark('official-all-four-blank-preset-selections-match-public-host');
    await writeFile(resolve(evidence, 'creator-blank.png'), await device.screenshot());
    await returnHistory(); report.final = await checks.verify('finish');
    await settings.management(fingerprint, false); granted = false; await reconnect(); await openSettings();
    await dialog.getByText('请先在电脑端授予此设备管理权限，再查看或修改电脑设置。', { exact: true }).waitFor();
    assert.equal(await dialog.locator('input,select').count(), 0);
    await dialog.getByRole('button', { name: '关闭窗口', exact: true }).click();
    assert.equal(await editor.innerText(), draft); await editor.fill('');
    assert.equal(await page.locator('iframe').count(), 0);
    report.managementReturned = true; report.draftPreserved = true; report.noEmbeddedDesktop = true;
    await mark('official-creator-management-revoked-original-chat-draft-preserved');
    return report;
  } catch (error) { report.failure = error.message; throw error; }
  finally {
    if (granted) await settings.management(fingerprint, false);
    await writeFile(resolve(evidence, 'preset-creator.json'), JSON.stringify(report, null, 2) + '\n');
  }
}
