import assert from 'node:assert/strict';

export async function checkRemoteHeader(page) {
  await page.evaluate(() => window.fixture.select('one'));
  assert.equal(await page.locator('.remote-header-extensions').evaluate(node => node.clientHeight), 0);
  await page.evaluate(() => window.fixture.enableHeader());
  const leading = page.getByTestId('header-leading'), corner = page.getByTestId('header-corner');
  const actions = page.getByTestId('header-actions'), utilities = page.getByTestId('header-utilities');
  await leading.waitFor(); await actions.waitFor(); await utilities.waitFor(); await corner.waitFor();
  assert.deepEqual(await page.locator('.remote-header-extensions [data-testid]').evaluateAll(nodes => nodes.map(node => node.dataset.testid)), ['header-leading', 'header-actions', 'header-utilities', 'header-corner']);
  for (const [part, node] of [['leading', leading], ['corner', corner]]) {
    assert.equal(await node.getAttribute('data-session'), 'one');
    await node.click(); assert.equal(await node.innerText(), `${part}:one:1`);
  }
  assert.equal(await actions.getAttribute('data-session'), 'one');
  await actions.click(); await utilities.click();
  assert.equal(await actions.innerText(), 'actions:one:1');
  assert.equal(await utilities.innerText(), 'utilities:one:1');
  await page.waitForFunction(() => {
    const node = document.querySelector('[data-testid="header-actions"]');
    return node && node.getBoundingClientRect().width <= innerWidth;
  });
  const geometry = await actions.evaluate(node => ({ original: node.offsetWidth, displayed: node.getBoundingClientRect().width, viewport: innerWidth }));
  assert.equal(geometry.original, 720); assert.ok(geometry.displayed < 720);
  assert.equal(await actions.getAttribute('data-running'), 'false');
  await page.evaluate(() => window.fixture.status('one', true));
  await page.waitForFunction(() => document.querySelector('[data-testid="header-actions"]')?.dataset.running === 'true');
  assert.equal(await leading.getAttribute('data-running'), 'true');
  assert.equal(await corner.getAttribute('data-running'), 'true');
  await page.evaluate(() => window.fixture.status('one', false));
  await page.waitForFunction(() => document.querySelector('[data-testid="header-actions"]')?.dataset.running === 'false');
  await page.evaluate(() => window.fixture.select('two'));
  assert.equal(await actions.getAttribute('data-session'), 'two');
  assert.equal(await utilities.getAttribute('data-session'), 'two');
  assert.equal(await leading.getAttribute('data-session'), 'two');
  assert.equal(await corner.getAttribute('data-session'), 'two');
  await page.evaluate(() => window.fixture.removeHeader());
  await actions.waitFor({ state: 'detached' }); await utilities.waitFor({ state: 'detached' });
  await leading.waitFor({ state: 'detached' }); await corner.waitFor({ state: 'detached' });
  assert.equal(await page.locator('.remote-header-extensions').evaluate(node => node.clientHeight), 0);
  return { lateRegistration: true, actionsAndUtilities: true, leadingAndCorner: true, originalSlotOrder: true, geometry, realSessionUpdates: true, switchIsolation: true, unloadClears: true, noEmptyGap: true };
}
