import assert from 'node:assert/strict';

/** 真实列表/旁栏入口及浏览器输入事件；协议数据仍为明确隔离的合成记录。 */
export async function checkRemoteHistoryAutoInputs(page) {
  const main = page.getByTestId('remote-workspace');
  const state = () => page.evaluate(() => window.fixture.longHistoryState());
  const settle = () => page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(() => requestAnimationFrame(r)))));
  const top = async chat => { await chat.evaluate(el => { el.scrollTop = 0; }); await settle(); };
  const wheel = async chat => { await chat.hover(); await page.mouse.wheel(0, -80); };
  const loaded = async before => {
    await page.waitForFunction(first => window.fixture.longHistoryState().first < first, before.first);
    await page.waitForFunction(() => !document.querySelector('[data-history-loader]:disabled'));
    await settle();
  };
  await page.evaluate(async () => { await window.fixture.select(null); window.fixture.longHistory({ turns: 80, paragraphs: 8 }); });
  await main.locator('.remote-session-row').filter({ hasText: 'one' }).click();
  const chat = main.getByRole('region', { name: '聊天内容', exact: true });
  await chat.locator('[data-history-group]').first().waitFor();
  await top(chat); const beforeTouch = await state();
  const box = await chat.boundingBox(), cdp = await page.context().newCDPSession(page);
  const point = y => [{ x: box.x + box.width / 2, y, id: 1 }];
  const start = box.y + Math.min(60, box.height / 4);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: point(start) });
  for (let i = 1; i <= 4; i++) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: point(start + i * 12) });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await loaded(beforeTouch); await cdp.detach();
  assert.equal((await state()).calls, beforeTouch.calls + 1, '手机向下拖动到顶只加载一批');

  await top(chat); const beforeOffline = await state();
  await page.evaluate(() => window.fixture.connectionState('disconnected'));
  await wheel(chat); await settle(); assert.equal((await state()).calls, beforeOffline.calls);
  await page.evaluate(() => window.fixture.connectionState('connected'));
  await settle(); assert.equal((await state()).calls, beforeOffline.calls, '恢复连接不重放旧手势');
  await chat.focus(); await page.keyboard.press('Home'); await loaded(beforeOffline);

  await top(chat); const beforeSwitch = await state();
  await page.evaluate(() => window.fixture.longHistoryHold()); await wheel(chat);
  await page.waitForFunction(calls => window.fixture.longHistoryState().calls > calls, beforeSwitch.calls);
  await main.getByRole('button', { name: '返回', exact: true }).click();
  await main.locator('.remote-session-row').filter({ hasText: 'two' }).click();
  await page.evaluate(() => window.fixture.longHistoryRelease()); await settle();
  assert.equal(await page.evaluate(() => window.fixture.sidebarState().selected), 'two');
  assert.equal(await chat.getByText(/HISTORY_/).count(), 0, '迟到历史不能写入另一个会话');
  assert.equal(await main.getByRole('alert').count(), 0);

  await page.evaluate(async () => { await window.fixture.select(null); window.fixture.longHistory({ turns: 40, paragraphs: 8 }); });
  await main.locator('.remote-session-row').filter({ hasText: 'one' }).click();
  await chat.locator('[data-history-group]').first().waitFor();
  for (let i = 0; i < 4 && (await state()).first > 0; i++) {
    await top(chat); const before = await state(); await wheel(chat); await loaded(before);
  }
  assert.equal((await state()).first, 0);
  await chat.getByRole('status').filter({ hasText: '没有更早的消息' }).waitFor();
  const finished = (await state()).calls;
  await top(chat); await wheel(chat); await settle(); assert.equal((await state()).calls, finished);

  await page.evaluate(async () => { await window.fixture.select(null); window.fixture.longHistory({ turns: 100, paragraphs: 8, sessionId: 'child-chat' }); await window.fixture.enableSidebarResources(); });
  await main.locator('.remote-session-row').filter({ hasText: 'one' }).click();
  await main.getByRole('button', { name: 'Remote 选项', exact: true }).click();
  await page.getByRole('button', { name: '子会话', exact: true }).click();
  await page.getByRole('dialog', { name: '子会话', exact: true }).getByRole('group', { name: '分析助手', exact: true })
    .getByRole('button', { name: '在旁栏打开', exact: true }).click();
  const aside = page.getByTestId('remote-sidebar-conversation').filter({ visible: true });
  const asideChat = aside.getByRole('region', { name: '聊天内容', exact: true });
  await asideChat.locator('[data-history-group]').first().waitFor();
  for (let i = 0; i < 4; i++) {
    await top(asideChat); const before = await state(); await wheel(asideChat); await loaded(before);
    assert.equal((await state()).calls, before.calls + 1);
  }
  assert.equal(await page.evaluate(() => window.fixture.sidebarState().selected), 'one', '旁栏历史保持主会话');
  await page.getByRole('region', { name: '插件面板', exact: true }).getByRole('button', { name: '返回聊天', exact: true }).click();
  return { realTouch: true, keyboard: true, offlineNoReplay: true, inflightSwitch: true, endOfHistory: true, sidebarAutoPages: 4 };
}
