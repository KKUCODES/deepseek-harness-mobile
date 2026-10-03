import assert from 'node:assert/strict';

export async function checkShellOverlays(page) {
  await page.evaluate(() => window.fixture.select('one'));
  const editor = page.getByTestId('remote-workspace').getByRole('textbox', { name: '消息', exact: true });
  const draft = await editor.innerText();
  await page.evaluate(() => window.fixture.enableShellOverlay());
  const wide = page.getByTestId('shell-overlay-wide'), fixed = page.getByTestId('shell-overlay-fixed');
  await wide.waitFor(); assert.equal(await wide.count(), 1);
  assert.equal(await wide.getAttribute('data-session'), 'none');
  await wide.click(); await fixed.click(); assert.equal(await wide.innerText(), 'Overlay 2');
  const geometry = await wide.evaluate(node => ({ natural: node.offsetWidth, displayed: node.getBoundingClientRect().width, viewport: innerWidth }));
  assert.equal(geometry.natural, 600); assert.ok(geometry.displayed <= geometry.viewport + 0.1);
  await editor.click(); assert.equal(await editor.innerText(), draft);
  await page.evaluate(() => window.fixture.select('two'));
  assert.equal(await wide.count(), 1); assert.equal(await wide.innerText(), 'Overlay 2');
  assert.equal(await wide.getAttribute('data-session'), 'none');
  await page.evaluate(() => window.fixture.select(null));
  assert.equal(await wide.count(), 1); assert.equal(await fixed.innerText(), 'Fixed 2');
  await page.evaluate(() => window.fixture.removeShellOverlay());
  await wide.waitFor({ state: 'detached' }); await fixed.waitFor({ state: 'detached' });
  await page.evaluate(() => window.fixture.select('one'));
  assert.equal(await editor.innerText(), draft);
  return { singleton: true, rootScope: true, interactive: true, geometry, doesNotBlockComposer: true, survivesNavigation: true, unloadClears: true, draftPreserved: true };
}
