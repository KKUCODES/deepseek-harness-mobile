import assert from 'node:assert/strict';
import { join } from 'node:path';

/** 原节点、反馈插槽与正式聊天入口；分支请求只由隔离传输记录并拒绝，不创建实际会话。 */
export async function checkRemoteForkActions(page, output) {
  await page.waitForFunction(() => !!window.fixture);
  await page.evaluate(async () => {
    window.fixture.locale('zh'); await window.fixture.select('two'); await window.fixture.enableFeedback();
    window.fixture.processTurn('two', 1, 0); window.fixture.processTurn('two', 1, 0, true);
  });
  const main = page.getByTestId('remote-workspace');
  const button = main.getByRole('button', { name: '从第 1 轮分支', exact: true });
  await button.waitFor();
  if (process.argv.includes('--measure-only')) {
    const baseline = { text: await button.innerText(), icons: await button.locator('svg').count() };
    await page.screenshot({ path: join(output, 'remote-fork-actions-before.png') });
    return baseline;
  }
  assert.equal(await button.innerText(), ''); assert.equal(await button.locator('svg').count(), 1);
  const cases = [];
  for (const width of [320, 420]) for (const dark of [false, true]) {
    await page.setViewportSize({ width, height: 860 });
    await page.evaluate(dark => document.body.toggleAttribute('data-ds-dark-theme', dark), dark);
    const value = await button.evaluate(item => {
      const box = item.getBoundingClientRect(), row = item.closest('[data-turn-tail]');
      return { width: box.width, height: box.height,
        buttons: [...row.querySelectorAll('button')].map(button => {
          const r = button.getBoundingClientRect(), icon = button.querySelector('svg').getBoundingClientRect();
          return { label: button.getAttribute('aria-label'), left: r.left, right: r.right, center: r.top + r.height / 2,
            width: r.width, height: r.height, iconWidth: icon.width, iconHeight: icon.height };
        }),
        overflow: document.documentElement.scrollWidth > innerWidth };
    });
    assert.ok(value.width >= 43.9 && value.height >= 43.9); assert.equal(value.overflow, false);
    assert.ok(value.buttons.length >= 3, '反馈与分支共用一行');
    assert.ok(value.buttons.every(button => button.width >= 43.9 && button.height >= 43.9), JSON.stringify(value.buttons));
    assert.ok(value.buttons.every(button => Math.abs(button.iconWidth - 20) < .1 && Math.abs(button.iconHeight - 20) < .1), JSON.stringify(value.buttons));
    assert.ok(Math.max(...value.buttons.map(item => item.center)) - Math.min(...value.buttons.map(item => item.center)) < 2);
    for (let index = 1; index < value.buttons.length; index++) {
      const gap = value.buttons[index].left - value.buttons[index - 1].right;
      assert.ok(Math.abs(gap - 4) < .1, `图标操作间距统一4px，实际 ${gap}`);
    }
    cases.push({ viewport: width, dark, ...value });
  }
  await page.evaluate(() => document.body.style.setProperty('--dsh-content-font-delta', '4px'));
  const enlarged = await button.locator('..').locator('button svg').evaluateAll(icons => icons.map(icon => icon.getBoundingClientRect().width));
  assert.ok(enlarged.length >= 3 && enlarged.every(width => Math.abs(width - 24) < .1));
  await page.evaluate(() => document.body.style.removeProperty('--dsh-content-font-delta'));
  await main.getByRole('textbox', { name: '消息', exact: true }).fill('保留分支前的草稿');
  await page.evaluate(() => window.fixture.connectionState('disconnected'));
  assert.equal(await button.isDisabled(), true);
  await page.evaluate(() => window.fixture.connectionState('connected'));
  assert.equal(await button.isEnabled(), true);
  await button.focus(); await page.keyboard.press('Enter');
  await page.waitForFunction(() => window.fixture.forkActionRequests().length === 1);
  await main.getByRole('alert').filter({ hasText: '隔离分支请求已记录' }).waitFor();
  const request = await page.evaluate(() => window.fixture.forkActionRequests()[0]);
  assert.equal(request.sessionId, 'two'); assert.equal(request.atSeq, 5);
  assert.equal(await main.getByRole('textbox', { name: '消息', exact: true }).innerText(), '保留分支前的草稿');
  await page.screenshot({ path: join(output, 'remote-fork-actions-after.png') });
  await page.evaluate(() => window.fixture.toolLayoutEmbedded());
  const aside = page.getByTestId('remote-sidebar-conversation').filter({ visible: true });
  const embeddedButton = aside.getByRole('button', { name: '从第 1 轮分支', exact: true });
  await embeddedButton.waitFor(); assert.equal(await embeddedButton.innerText(), '');
  const embeddedIcons = await embeddedButton.locator('..').locator('button svg').evaluateAll(icons => icons.map(icon => icon.getBoundingClientRect().width));
  assert.ok(embeddedIcons.length >= 3 && embeddedIcons.every(width => Math.abs(width - 20) < .1));
  await embeddedButton.tap();
  await page.waitForFunction(() => window.fixture.forkActionRequests().length === 2);
  assert.equal(await aside.getByRole('textbox', { name: '消息', exact: true }).innerText(), '保留分支前的草稿');
  return { cases, enlarged, keyboard: true, touch: true, exactAnchor: request, offlineDisabled: true, embedded: true, draftPreserved: true };
}
