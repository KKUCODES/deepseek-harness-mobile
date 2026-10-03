import assert from 'node:assert/strict';

export async function checkDirectFactory(page) {
  const retainedBefore = await page.evaluate(() => window.fixture.retainedSources('child-chat'));
  await page.evaluate(async () => { await window.fixture.select('one'); await window.fixture.enableDirectFactoryProbe(); });
  const panel = page.getByRole('region', { name: '插件面板', exact: true });
  const view = panel.getByTestId('remote-sidebar-conversation');
  const input = view.getByRole('textbox', { name: '消息', exact: true });
  const control = panel.getByTestId('factory-width');
  await input.waitFor();
  const originalChild = await input.innerText();
  await input.fill('独立工厂子会话草稿');
  await control.click();
  await page.evaluate(() => window.fixture.setFactoryBlock('child-chat', '独立子会话暂停'));
  await page.waitForFunction(() => document.querySelector('[data-testid="factory-width"]')?.dataset.block === '独立子会话暂停');
  assert.equal(await input.getAttribute('contenteditable'), 'false');
  assert.equal(await input.innerText(), '独立工厂子会话草稿');
  await page.evaluate(() => window.fixture.setFactoryBlock('child-chat', undefined));
  await input.fill(originalChild);
  await view.getByRole('button', { name: '返回父会话', exact: true }).click();
  await view.locator('.remote-heading strong').getByText('one', { exact: true }).waitFor();
  assert.equal(await page.evaluate(() => window.fixture.directFactoryFocus()), 'one');
  assert.match(await page.evaluate(() => window.fixture.invokeFactorySelection()), /聊天已变化/);
  await control.click();
  assert.match(await page.evaluate(() => window.fixture.invokeFactorySelection()), /工作区已不存在/);
  await page.evaluate(() => { window.fixture.setFactoryBlock('child-chat', '旧子会话暂停'); window.fixture.setFactoryBlock('one', '独立父会话暂停'); });
  await page.waitForFunction(() => document.querySelector('[data-testid="factory-width"]')?.dataset.block === '独立父会话暂停');
  assert.equal(await input.getAttribute('contenteditable'), 'false');
  await page.evaluate(() => { window.fixture.setFactoryBlock('child-chat', undefined); window.fixture.setFactoryBlock('one', undefined); });
  const geometry = await input.evaluate(node => ({ bottom: node.getBoundingClientRect().bottom, viewport: innerHeight }));
  assert.ok(geometry.bottom <= geometry.viewport, JSON.stringify(geometry));
  await page.evaluate(() => window.fixture.disableFactoryProbe());
  await panel.getByTestId('direct-factory-host').waitFor({ state: 'detached' });
  await page.waitForFunction(() => window.fixture.directFactoryFocus() === null);
  assert.deepEqual(await page.evaluate(() => window.fixture.retainedSources('child-chat')), retainedBefore);
  await panel.getByRole('button', { name: '返回聊天', exact: true }).click();
  assert.equal(await page.getByTestId('remote-workspace').locator('.remote-heading strong').innerText(), 'one');
  return { directCaller: true, independentNavigation: true, composerBlockRebound: true, staleCallbackRejected: true,
    currentCallbackRebound: true, unloadReleasesView: true, referencesReleased: true, geometry };
}
