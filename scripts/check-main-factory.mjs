import assert from 'node:assert/strict';

export async function checkMainFactory(page) {
  await page.evaluate(() => window.fixture.select('one'));
  const main = page.getByTestId('remote-workspace');
  const input = main.getByRole('textbox', { name: '消息', exact: true });
  await input.waitFor();
  const original = await input.innerText();
  await input.fill('主聊天工厂草稿');
  const editor = await input.elementHandle();
  const frame = main.locator('[data-conversation-content][data-content-variant="main"]');
  await frame.waitFor();
  assert.equal(await frame.getAttribute('data-content-phase'), 'active');
  await page.evaluate(() => window.fixture.emitTurn('one', 1, 0, '主聊天阅读定位\n\n'.repeat(80)));
  const scroller = main.getByRole('region', { name: '聊天内容', exact: true });
  await scroller.evaluate(async node => {
    node.scrollTop = 40;
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  });
  assert.equal(await scroller.evaluate(node => node.scrollTop), 40);
  await page.evaluate(() => window.fixture.replaceFactorySession());
  const replacement = main.getByTestId('factory-session-replacement');
  await replacement.waitFor();
  assert.equal(await replacement.getAttribute('data-session'), 'one');
  assert.equal(await replacement.getAttribute('data-open'), 'open');
  assert.equal(await replacement.getAttribute('data-main-count'), '1');
  await page.waitForFunction(() => window.fixture.readingContexts().at(-1) === null);
  assert.equal(await input.evaluate((node, before) => node === before, editor), true);
  assert.equal(await input.innerText(), '主聊天工厂草稿');
  await page.evaluate(() => window.fixture.restoreFactorySession());
  await replacement.waitFor({ state: 'detached' });
  await page.waitForFunction(() => document.querySelector('[data-testid="remote-workspace"] .conversation')?.scrollTop === 40);
  await page.waitForFunction(() => window.fixture.readingContexts().at(-1) === 'one');
  assert.equal(await input.evaluate((node, before) => node === before, editor), true);
  await input.fill(original); await editor.dispose();
  const size = await input.evaluate(node => ({ bottom: node.getBoundingClientRect().bottom, height: innerHeight,
    width: document.documentElement.scrollWidth, viewport: innerWidth }));
  assert.ok(size.bottom <= size.height && size.width <= size.viewport, JSON.stringify(size));
  return { mainFactory: true, sharedSessionSlot: true, mainReferencePreserved: true, residentComposer: true,
    draftPreserved: true, readingRestored: true, unloadRestored: true, viewport: size };
}
