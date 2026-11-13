import assert from 'node:assert/strict';

/** 列表点击、原 Session follow、真实聊天界面与滚动区均参与验收。 */
export async function checkRecentRemoteChat(page) {
  const main = page.getByTestId('remote-workspace');
  const chat = main.getByRole('region', { name: '聊天内容', exact: true });
  const row = name => main.locator('.remote-session-row,[data-remote-home-session]').filter({ hasText: name }).first();
  const back = main.getByRole('button', { name: '返回', exact: true });
  const loading = chat.getByText('正在读取聊天记录…', { exact: true });
  const cached = chat.locator('[data-cached-history]');
  const frame = main.locator('.remote-chat-frame');
  const hold = id => page.evaluate(id => { window.releaseRecentOpening = window.preview15.holdOpening(id); }, id);
  const release = () => page.evaluate(() => window.releaseRecentOpening());
  const visibleGroup = () => chat.evaluate(host => {
    const top = host.getBoundingClientRect().top;
    const row = [...host.querySelectorAll('[data-history-group]')].find(row => row.getBoundingClientRect().bottom > top);
    return row && { key: row.dataset.historyGroup, offset: row.getBoundingClientRect().top - top };
  });
  await page.evaluate(async () => {
    await window.fixture.select(null);
    window.preview15.history.setup({ turns: 70, paragraphs: 4 });
  });
  await hold('one');
  await row('one').click();
  await loading.waitFor();
  await release();
  const editor = main.getByRole('textbox', { name: '消息', exact: true });
  await editor.fill('保留最近会话草稿');
  await editor.blur();
  await chat.getByText('HISTORY_70', { exact: true }).waitFor();
  await back.click();
  await row('one').waitFor();

  await hold('one');
  await row('one').click();
  await cached.getByText('HISTORY_70', { exact: true }).waitFor();
  assert.equal(await loading.count(), 0);
  assert.equal(await cached.evaluate(el => el.inert), true);
  await page.evaluate(() => { window.preview15.history.latest += 5; });
  await release();
  await cached.waitFor({ state: 'detached' });
  await chat.getByText('HISTORY_71', { exact: true }).waitFor();
  assert.equal(await editor.innerText(), '保留最近会话草稿');
  assert.equal(await frame.getAttribute('data-chat-following-tail'), '');

  const older = chat.locator('[data-history-loader]');
  for (let index = 0; index < 2; index++) {
    await chat.evaluate(host => { host.scrollTop = 0; });
    const count = await page.evaluate(() => window.preview15.state().records);
    await older.click();
    await page.waitForFunction(count => window.preview15.state().records > count, count);
    await older.isEnabled();
  }
  await chat.evaluate(host => { host.scrollTop = 650; });
  await page.waitForFunction(() => window.preview15.model.sessionView.readingAnchor?.seq < 255);
  const before = await visibleGroup();
  await back.click();
  await hold('one');
  await row('one').click();
  await cached.waitFor();
  await page.waitForFunction(key => [...document.querySelectorAll('[data-cached-history] [data-history-group]')].some(node => node.dataset.historyGroup === key), before.key);
  await release();
  await cached.waitFor({ state: 'detached' });
  await page.waitForFunction(key => {
    const host = document.querySelector('.conversation'), top = host.getBoundingClientRect().top;
    return [...host.querySelectorAll('[data-history-group]')].find(row => row.getBoundingClientRect().bottom > top)?.dataset.historyGroup === key;
  }, before.key);
  const after = await visibleGroup();
  assert.ok(Math.abs(after.offset - before.offset) < 45, JSON.stringify({ before, after }));
  assert.equal(await frame.getAttribute('data-chat-following-tail'), null);
  assert.equal(await editor.innerText(), '保留最近会话草稿');
  const beforeLive = await page.evaluate(() => window.preview15.state().last);
  await page.evaluate(() => window.preview15.live());
  await page.waitForFunction(last => window.preview15.state().last > last, beforeLive);
  assert.equal((await visibleGroup()).key, before.key);
  const pages = await page.evaluate(() => window.preview15.history.calls);
  await page.evaluate(() => {
    window.preview15.history.hold();
    window.preview15.breakFollow('one');
  });
  await page.waitForFunction(pages => window.preview15.history.calls > pages, pages);
  assert.equal(await chat.locator(`[data-history-group="${before.key}"]`).count(), 1, '重新建立 follow 时仍保留原锚点');
  await page.evaluate(() => window.preview15.history.release());
  await page.waitForFunction(() => !window.preview15.model.getSnapshot().restoringHistory);
  await page.waitForFunction(key => document.querySelector(`[data-history-group="${key}"]`)?.getBoundingClientRect().bottom
    > document.querySelector('.conversation').getBoundingClientRect().top, before.key);
  return { coldLoading: true, warmReadOnly: true, freshTail: true, draft: true, oldAnchor: before.key,
    offsetDelta: after.offset - before.offset, liveWhileReading: true, reconnectAtAnchor: true };
}
