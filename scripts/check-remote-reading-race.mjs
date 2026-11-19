import assert from 'node:assert/strict';

/** 已加载长历史的真实分页入口；等待电脑时仍允许读者滚动。 */
export async function checkRemoteReadingDuringPage(page, chat) {
  const settle = () => page.evaluate(() => new Promise(done => requestAnimationFrame(() => requestAnimationFrame(() => requestAnimationFrame(done)))));
  const result = [];
  for (const distance of [-120, -240, -360, -480, 120, 480]) {
    await chat.evaluate(el => { el.scrollTop = 0; }); await settle();
    const before = await page.evaluate(() => window.preview15.state());
    await page.evaluate(() => window.preview15.history.hold());
    await chat.locator('[data-history-loader]').click();
    await page.waitForFunction(calls => window.preview15.history.calls > calls, before.calls);
    await chat.evaluate(el => { el.scrollTop = 900; }); await settle();
    const bounds = await chat.boundingBox();
    await page.mouse.move(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
    await page.mouse.wheel(0, distance); await settle();
    const anchor = await chat.locator('[data-history-group]').first().evaluate(el => ({ key: el.dataset.historyGroup, top: el.getBoundingClientRect().top }));
    await page.evaluate(() => window.preview15.history.release());
    await page.waitForFunction(records => window.preview15.state().records > records, before.records); await settle();
    const top = await chat.locator(`[data-history-group="${anchor.key}"]`).evaluate(el => el.getBoundingClientRect().top);
    const delta = top - anchor.top;
    assert.ok(Math.abs(delta) < 4, `分页响应撤销了读者刚才的滚动：${delta}px`);
    result.push({ distance, delta });
  }
  return result;
}

/** 多次向下拨动手指对应负 wheel；已加载的历史不能被拉回先前位置。 */
export async function checkRemoteOlderScrolling(page, chat) {
  const settle = () => page.evaluate(() => new Promise(done => requestAnimationFrame(() => requestAnimationFrame(() => requestAnimationFrame(done)))));
  await chat.evaluate(el => { el.scrollTop = el.scrollHeight * 0.65; }); await settle();
  const position = () => chat.evaluate(el => {
    const top = el.getBoundingClientRect().top;
    const group = [...el.querySelectorAll('[data-history-group]')].find(node => node.getBoundingClientRect().bottom > top);
    return { turn: Number(group.dataset.historyGroup.split(':')[1]), top: group.getBoundingClientRect().top - top };
  });
  const bounds = await chat.boundingBox(), result = [];
  await page.mouse.move(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
  for (let step = 0; step < 16; step++) {
    const before = await position();
    await page.mouse.wheel(0, -600); await settle();
    const after = await position();
    assert.ok(after.turn < before.turn || after.turn === before.turn && after.top > before.top + 400,
      `向更早记录滚动被撤销：${JSON.stringify({ before, after })}`);
    result.push(after);
  }
  return result;
}
