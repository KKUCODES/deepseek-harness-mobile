import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';

/** 原 Session 状态和 turn/start 投影，覆盖首段之前及收尾；不替换生产状态函数。 */
export async function checkRemoteRunningStatus(page, output) {
  await page.waitForFunction(() => !!window.fixture);
  await page.evaluate(async () => { window.fixture.locale('zh'); await window.fixture.select('one'); });
  const main = page.getByTestId('remote-workspace'), indicator = main.locator('[data-chat-running]');
  const input = main.getByRole('textbox', { name: '消息', exact: true });
  await page.evaluate(() => window.fixture.status('one', true));
  await main.getByRole('button', { name: '停止生成', exact: true }).waitFor();
  if (process.argv.includes('--measure-only')) {
    const evidence = { stopVisible: true, indicatorCount: await indicator.count(), assistantRows: await main.locator('[data-chat-flow-kind="assistant-step"]').count() };
    await page.screenshot({ path: join(output, 'running-status-before.png') });
    await writeFile(join(output, 'running-status-before.json'), JSON.stringify(evidence, null, 2));
    return evidence;
  }
  await input.fill('等待期间保留草稿');
  await indicator.getByRole('status').waitFor();
  assert.match(await indicator.innerText(), /深度求索中/);
  assert.doesNotMatch(await indicator.innerText(), /用时/);
  const started = Date.now() - 75000;
  await page.evaluate(time => window.fixture.waitingTurn('one', 'start', time), started);
  await indicator.getByText(/深度求索中，用时.*1.*秒/).waitFor();
  const clockBefore = await indicator.innerText();
  await page.waitForTimeout(1100);
  assert.notEqual(await indicator.innerText(), clockBefore);
  await page.screenshot({ path: join(output, 'running-status-after.png') });
  const viewport = page.viewportSize(), presentations = [];
  for (const width of [320, 420]) for (const dark of [false, true]) {
    await page.setViewportSize({ width, height: 860 });
    await page.evaluate(dark => document.body.toggleAttribute('data-ds-dark-theme', dark), dark);
    const style = await indicator.evaluate(item => {
      const computed = getComputedStyle(item);
      return { font: parseFloat(computed.fontSize), color: computed.color,
        animations: item.getAnimations({ subtree: true }).length,
        overflow: document.documentElement.scrollWidth > innerWidth };
    });
    assert.ok(style.font >= 14); assert.notEqual(style.color, 'rgb(0, 0, 0)');
    assert.ok(style.animations > 0); assert.equal(style.overflow, false);
    presentations.push({ width, dark, ...style });
  }
  await page.setViewportSize(viewport);
  await page.evaluate(() => document.body.removeAttribute('data-ds-dark-theme'));
  await page.evaluate(() => window.fixture.connectionState('disconnected'));
  await indicator.waitFor({ state: 'detached' });
  await page.evaluate(() => window.fixture.connectionState('connected'));
  await indicator.waitFor();
  await page.evaluate(() => window.fixture.waitingTurn('one', 'text', Date.now()));
  await main.getByText('首段真实投影回放', { exact: true }).waitFor();
  assert.equal(await indicator.count(), 1);
  await page.evaluate(() => window.fixture.waitingTurn('one', 'end', Date.now()));
  await indicator.waitFor({ state: 'detached' });
  assert.equal(await input.innerText(), '等待期间保留草稿');
  await page.evaluate(() => window.fixture.status('one', true)); await indicator.waitFor();
  await page.evaluate(() => window.fixture.select('two'));
  await indicator.waitFor({ state: 'detached' });
  await page.evaluate(() => window.fixture.status('two', true)); await indicator.waitFor();
  await page.evaluate(() => window.fixture.status('two', false)); await indicator.waitFor({ state: 'detached' });
  for (const phase of ['stop', 'error']) {
    await page.reload(); await page.waitForFunction(() => !!window.fixture);
    await page.evaluate(async () => { window.fixture.locale('zh'); await window.fixture.select('one'); window.fixture.waitingTurn('one', 'start', Date.now()); });
    await indicator.waitFor();
    await page.evaluate(phase => window.fixture.waitingTurn('one', phase, Date.now()), phase);
    await indicator.waitFor({ state: 'detached' });
    assert.equal(await main.getByRole('button', { name: '停止生成', exact: true }).count(), 0);
  }
  await page.evaluate(() => window.fixture.select('two'));
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.evaluate(() => window.fixture.status('two', true)); await indicator.waitFor();
  assert.equal(await indicator.getByRole('status').count(), 1);
  await page.evaluate(() => window.fixture.status('two', false)); await indicator.waitFor({ state: 'detached' });
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.reload(); await page.waitForFunction(() => !!window.fixture);
  await page.evaluate(async () => {
    window.fixture.locale('zh'); await window.fixture.select('one'); window.fixture.toolLayoutEmbedded();
  });
  const aside = page.getByTestId('remote-sidebar-conversation').filter({ visible: true });
  await aside.getByRole('textbox', { name: '消息', exact: true }).waitFor();
  const childIndicator = aside.locator('[data-chat-running]');
  await page.evaluate(() => window.fixture.waitingTurn('one', 'start', Date.now() - 5000));
  await childIndicator.getByText(/深度求索中，用时/).waitFor();
  assert.equal(await childIndicator.count(), 1);
  await page.evaluate(() => window.fixture.waitingTurn('one', 'end', Date.now()));
  await childIndicator.waitFor({ state: 'detached' });
  return { firstTokenWait: true, missingAnchorNoFakeClock: true, originalStartAndTicker: true, streamRetainsStatus: true, endClears: true, stoppedClears: true, failureClears: true, disconnectedClears: true, reconnectRestores: true, sessionIsolation: true, embeddedEntry: true, draftPreserved: true, reducedMotion: true, presentations };
}
