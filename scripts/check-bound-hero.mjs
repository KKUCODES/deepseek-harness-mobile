import assert from 'node:assert/strict';

export async function checkBoundHero(page) {
  await page.evaluate(async () => { await window.fixture.beginWorkspaceDraftTest('hero'); await window.fixture.enableBoundHeroProbe(); });
  const main = page.getByTestId('remote-workspace'), hero = main.getByTestId('remote-bound-hero');
  const input = main.getByRole('textbox', { name: '消息', exact: true });
  await hero.getByTestId('bound-brand').waitFor();
  assert.equal(await input.getAttribute('contenteditable'), 'true', JSON.stringify(await page.evaluate(() => window.fixture.heroState())));
  assert.equal(await hero.getByTestId('bound-brand').getAttribute('data-size'), '34');
  await input.fill('空聊天保留草稿');
  const editor = await input.elementHandle();
  const rows = await page.evaluate(() => window.fixture.heroWorkspaceRows());
  assert.equal(rows.length, 2, JSON.stringify(await page.evaluate(() => window.fixture.heroState())));
  await page.evaluate(() => window.fixture.workspaceRows([]));
  await page.waitForFunction(() => document.querySelector('[data-testid="remote-workspace"] [role="textbox"]')?.getAttribute('contenteditable') === 'false');
  assert.equal(await input.getAttribute('data-placeholder'), '先选择工作区，再开始聊天');
  assert.equal(await main.getByRole('button', { name: '发送消息', exact: true }).isDisabled(), true);
  assert.equal(await input.innerText(), '空聊天保留草稿');
  assert.equal(await input.evaluate((node, before) => node === before, editor), true);
  // Host 删除的工作区 ID 永不复用，重新登记使用新 ID。
  await page.evaluate(items => window.fixture.workspaceRows(items), rows.map(item => ({ ...item, workspaceId: `${item.workspaceId}-registered` })));
  await page.waitForFunction(() => document.querySelector('[data-testid="remote-workspace"] [role="textbox"]')?.getAttribute('contenteditable') === 'true');
  await hero.getByRole('button', { name: '切换工作区', exact: true }).click();
  const picker = page.getByRole('dialog', { name: '插件工作区', exact: true });
  assert.equal(await picker.getAttribute('data-selected'), 'hero-from-registered');
  await picker.getByRole('button', { name: '关闭工作区', exact: true }).click();
  await picker.waitFor({ state: 'detached' });
  assert.equal(await input.innerText(), '空聊天保留草稿');
  await hero.getByRole('button', { name: '切换工作区', exact: true }).click();
  await picker.getByRole('button', { name: '草稿工作区 to', exact: true }).click();
  await main.locator('.remote-heading strong').getByText('draft-to', { exact: true }).waitFor();
  await page.waitForFunction(() => document.querySelector('[data-testid="remote-workspace"] [role="textbox"]')?.innerText === '空聊天保留草稿');
  await page.evaluate(() => window.fixture.disableFactoryProbe());
  await hero.getByTestId('bound-brand').waitFor({ state: 'detached' });
  await hero.getByRole('heading', { name: '探索未至之境' }).waitFor();
  await hero.getByRole('button', { name: '切换工作区', exact: true }).click();
  await page.getByRole('dialog', { name: '选择工作区', exact: true }).getByRole('button', { name: '关闭窗口', exact: true }).click();
  await page.screenshot({ path: 'artifacts/bound-hero-browser.png' });
  const nextEditor = await input.elementHandle();
  await page.evaluate(() => window.fixture.emitTurn('draft-to', 1, 0));
  await hero.waitFor({ state: 'detached' });
  assert.equal(await input.evaluate((node, before) => node === before, nextEditor), true);
  assert.equal(await input.innerText(), '空聊天保留草稿');
  await editor.dispose(); await nextEditor.dispose();
  await page.evaluate(() => window.fixture.endWorkspaceDraftTest());
  return { brandPlugin: true, workspacePlugin: true, selectionTransferredDraft: true, removalLocksInput: true,
    restorationUnlocks: true, unloadFallback: true, activeTransitionKeepsEditor: true };
}
