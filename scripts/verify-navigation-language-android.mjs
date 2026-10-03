import assert from 'node:assert/strict';

// 只在已有联调聊天读取目录和核对确认页；不提交权限、模式或工作区变更。
export async function verifyNavigationLanguage(page, device, language, checks) {
  const open = async name => {
    await page.getByRole('button', { name: 'Remote options', exact: true }).click();
    await page.getByRole('button', { name, exact: true }).click();
    return page.getByRole('dialog', { name, exact: true });
  };
  const close = panel => panel.getByRole('button', { name: /^(Close|关闭窗口)$/, exact: true }).click();
  let panel = await open('Agent mode');
  await panel.getByText('This chat has started. Its mode cannot be changed.', { exact: true }).waitFor();
  await panel.getByRole('button', { name: 'Standard mode', exact: true }).waitFor();
  assert.ok(await panel.getByRole('button', { name: 'Standard mode', exact: true }).isDisabled());
  await device.screenshot({ path: 'artifacts/navigation-language-presets-en.png' });
  await close(panel);
  checks.push('Real existing chat mode is translated and locked after chat start; no selection submitted');

  panel = await open('Chat permissions');
  await panel.getByRole('button', { name: 'Full access', exact: true }).waitFor();
  const current = await panel.locator('[aria-pressed=true]').getAttribute('aria-label');
  // 不把“点击已选权限”误算为打开确认；当前值只从真实投影读取。
  assert.notEqual(current, 'Full access');
  await panel.getByRole('button', { name: 'Full access', exact: true }).click();
  await panel.getByRole('checkbox', { name: 'I understand the risks and want to continue', exact: true }).check();
  await device.screenshot({ path: 'artifacts/navigation-language-permission-en.png' });
  await language('zh'); panel = page.getByRole('dialog', { name: '会话权限', exact: true });
  assert.ok(await panel.getByRole('checkbox', { name: '我已了解风险，并愿意继续', exact: true }).isChecked());
  await panel.getByRole('button', { name: '取消', exact: true }).click();
  await language('en'); panel = page.getByRole('dialog', { name: 'Chat permissions', exact: true });
  assert.equal(await panel.locator('[aria-pressed=true]').getAttribute('aria-label'), current);
  await close(panel);
  checks.push('Real permission confirmation/acknowledgement retained across language then canceled; original permission unchanged');

  await page.getByRole('button', { name: 'Add attachment', exact: true }).click();
  await page.getByRole('button', { name: 'Choose skill', exact: true }).click();
  panel = page.getByRole('dialog', { name: 'Choose skill', exact: true });
  await panel.getByRole('button', { name: 'Reload skills', exact: true }).waitFor();
  const skills = await panel.locator('.remote-skill-pick strong').allTextContents();
  await panel.getByRole('searchbox', { name: 'Search skills', exact: true }).fill('DSHM_LANGUAGE_NO_MATCH');
  await panel.getByText('No matching skills', { exact: true }).waitFor();
  await device.screenshot({ path: 'artifacts/navigation-language-skills-en.png' });
  await language('zh'); panel = page.getByRole('dialog', { name: '选择技能', exact: true });
  assert.equal(await panel.getByRole('searchbox', { name: '搜索技能', exact: true }).inputValue(), 'DSHM_LANGUAGE_NO_MATCH');
  await panel.getByRole('searchbox', { name: '搜索技能', exact: true }).fill('');
  assert.deepEqual(await panel.locator('.remote-skill-pick strong').allTextContents(), skills);
  await close(panel); await language('en');
  checks.push({ check: 'Real skill search retained across language; original names preserved, no skill inserted or sent', skills: skills.length });

  panel = await open('Subchats');
  await panel.getByRole('region', { name: 'Subchat list', exact: true }).waitFor();
  await panel.getByRole('button', { name: 'Refresh subchats', exact: true }).click();
  await page.waitForFunction(() => [...document.querySelectorAll('dialog button')].some(button => button.textContent === 'Refresh subchats' && !button.disabled));
  await device.screenshot({ path: 'artifacts/navigation-language-subchats-en.png' });
  checks.push({ check: 'Real subchat catalog opened and refreshed', entries: await panel.locator('.option').count() });
  await close(panel);

  panel = await open('Manage workspaces');
  await panel.getByText("Grant this device management access in the computer's DSH Mobile plugin.", { exact: true }).waitFor();
  await close(panel); checks.push('Real workspace management remains inaccessible without management grant');

  panel = await open('Export chat log');
  await panel.getByRole('checkbox', { name: 'Include subchats', exact: true }).check();
  await language('zh'); panel = page.getByRole('dialog', { name: '导出会话日志', exact: true });
  assert.ok(await panel.getByRole('checkbox', { name: '包含子会话', exact: true }).isChecked());
  await language('en'); panel = page.getByRole('dialog', { name: 'Export chat log', exact: true });
  await panel.getByRole('button', { name: 'Export and save', exact: true }).click();
  await panel.getByText('Choose a save location…', { exact: true }).waitFor({ timeout: 60000 });
  await device.shell('input keyevent 4');
  await panel.getByText('Export canceled.', { exact: true }).waitFor();
  await device.screenshot({ path: 'artifacts/navigation-language-export-en.png' });
  await close(panel);
  checks.push('Real export with subchats reached Android save picker then canceled; translated cancellation, no archive saved');
}
