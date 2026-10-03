import assert from 'node:assert/strict';

export async function checkAgentPresetStage(page) {
  await page.evaluate(async () => {
    window.fixture.presetFailure(false);
    await window.fixture.enableSidebarResources();
    await window.fixture.select('one');
    await window.fixture.enablePresetStage();
    await window.fixture.enableFactoryEmptyProbe();
    window.fixture.workspaceRows([{ ...window.fixture.factoryWorkspaceCandidate(), workspaceId: 'preset-workspace' }]);
  });
  const main = page.getByTestId('remote-workspace'), panel = page.getByRole('region', { name: '插件面板', exact: true });
  await main.getByRole('button', { name: 'Remote 选项', exact: true }).click();
  await main.getByRole('button', { name: '子会话', exact: true }).click();
  await page.getByRole('dialog', { name: '子会话', exact: true }).getByRole('group', { name: '分析助手', exact: true })
    .getByRole('button', { name: '在旁栏打开', exact: true }).click();
  const empty = panel.getByTestId('remote-empty-conversation'); await empty.waitFor();
  const before = await page.evaluate(() => window.fixture.presetWrites());
  const target = await page.evaluate(() => window.fixture.factoryPreset()) === 'minimal' ? 'standard' : 'minimal';
  const label = target === 'minimal' ? /^(极简模式|Minimal mode)$/ : /^(标准模式|Standard mode)$/;
  assert.equal((await page.evaluate(() => window.fixture.retainedSources('one'))).mainView, 1);
  assert.equal((await page.evaluate(() => window.fixture.retainedSources('child-chat'))).mainView, undefined);
  await empty.getByRole('button', { name: /^(标准模式|Standard mode)$/ }).click();
  await page.getByRole('menuitem', { name: target === 'minimal' ? /极简模式|Minimal mode/ : /标准模式|Standard mode/ }).click();
  await empty.getByRole('button', { name: label }).waitFor();
  assert.equal(await page.evaluate(() => window.fixture.presetWrites()), before, '选工作区前不修改当前聊天');
  await page.evaluate(() => window.fixture.holdPreset());
  await empty.getByRole('button', { name: '选择工作区', exact: true }).click();
  await page.getByRole('dialog', { name: '选择工作区', exact: true }).getByRole('button', { name: '联调工作区', exact: true }).click();
  await panel.waitFor({ state: 'hidden' });
  await page.waitForFunction(before => window.fixture.presetWrites() === before + 1, before);
  assert.ok((await page.evaluate(() => window.fixture.presetPending())).includes('agent-blank'), '原预选路径必须取得共享发送锁');
  await page.waitForFunction(() => document.querySelector('[data-testid="remote-workspace"] [role="textbox"]')?.getAttribute('contenteditable') === 'false');
  assert.equal(await main.getByRole('button', { name: '发送消息', exact: true }).isDisabled(), true);
  assert.equal(await main.getByRole('textbox', { name: '消息', exact: true }).getAttribute('contenteditable'), 'false');
  await page.evaluate(() => window.fixture.releasePreset());
  await main.getByRole('button', { name: label }).waitFor();
  await page.waitForFunction(() => document.querySelector('[data-testid="remote-workspace"] [role="textbox"]')?.getAttribute('contenteditable') === 'true');
  assert.equal((await page.evaluate(() => window.fixture.retainedSources('agent-blank'))).mainView, 1);
  assert.equal((await page.evaluate(() => window.fixture.retainedSources('one'))).mainView, undefined);
  await page.evaluate(async () => { await window.fixture.disableFactoryProbe(); await window.fixture.disablePresetStage(); await window.fixture.select('one'); window.fixture.workspaceRows([]); });
  if (!await panel.isVisible()) {
    await main.getByRole('button', { name: 'Remote 选项', exact: true }).click();
    await main.getByRole('button', { name: '插件面板', exact: true }).click();
  }
  await panel.getByRole('button', { name: '面板操作', exact: true }).click();
  await page.getByRole('menuitem', { name: '关闭当前面板', exact: true }).click();
  if (await panel.isVisible()) await panel.getByRole('button', { name: '返回聊天', exact: true }).click();
  return { originalPlugin: true, stagedWithoutWrite: true, mainViewOnly: true, appliedAfterWorkspace: true, sendingBlocked: true, editorRestored: true };
}
