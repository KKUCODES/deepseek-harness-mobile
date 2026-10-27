import assert from 'node:assert/strict';

/** 实际首页进入官方Session及手机Workspace；协议是独立合成回放，不模拟模型执行。 */
export async function checkRemoteScrollBottom(page, { aside = false } = {}) {
  await page.evaluate(() => window.fixture.toolLocale('zh'));
  await page.evaluate(async aside => {
    await window.fixture.select(null);
    window.preview15.history.setup({ turns: 200, paragraphs: 30, sessionId: aside ? 'child-chat' : 'one' });
  }, aside);
  const main = page.getByTestId('remote-workspace');
  await main.locator('.remote-session-row,[data-remote-home-session]').filter({ hasText: 'one' }).first().click();
  if (aside) {
    await page.evaluate(async () => { await window.fixture.enableSidebarResources(); window.preview15.model.sessions.handleSessionStatus('one', false); });
    await main.getByRole('button', { name: 'Remote 选项', exact: true }).click();
    await page.getByRole('button', { name: '子会话', exact: true }).click();
    await page.getByRole('group', { name: '分析助手', exact: true }).getByRole('button', { name: '在旁栏打开', exact: true }).click();
  }
  const owner = aside ? page.getByTestId('remote-sidebar-conversation').filter({ visible: true }) : main;
  const chat = owner.getByRole('region', { name: '聊天内容', exact: true });
  const button = owner.getByRole('button', { name: '回到底部', exact: true });
  const metrics = () => chat.evaluate(el => ({ top: el.scrollTop, floor: el.scrollHeight - el.clientHeight }));
  const settle = () => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(() => requestAnimationFrame(resolve)))));
  const waitFloor = async () => {
    await page.waitForFunction(test => {
      const root = document.querySelector(`[data-testid="${test}"]:not([hidden])`);
      const el = root?.querySelector('.conversation');
      return el?.clientHeight > 0 && Math.abs(el.scrollHeight - el.clientHeight - el.scrollTop) < 2;
    }, aside ? 'remote-sidebar-conversation' : 'remote-workspace');
    await settle();
    const value = await metrics();
    assert.ok(Math.abs(value.floor - value.top) < 2, JSON.stringify(value));
  };
  await waitFloor();
  assert.equal(await button.count(), 0, '首次真正到底，不显示返回按钮');
  assert.equal(await chat.evaluate(el => window.preview15.originalScrollOwner(el)), true, '直接使用原源码的ScrollFollow并公开绑定原滚动所有者');
  const input = owner.getByRole('textbox', { name: '消息', exact: true });
  await input.fill('scroll-bottom draft'); await input.blur(); await page.waitForTimeout(300); await waitFloor();
  await page.evaluate(() => {
    const model = window.preview15.model;
    window.__scrollBottomReference = (model.conversationFocus.getSnapshot() ?? model).reference;
  });
  const box = await chat.boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.wheel(0, -900); await button.waitFor(); await page.waitForTimeout(250);
  const reading = await metrics(); assert.ok(reading.floor - reading.top > 100);
  const geometry = await button.evaluate(el => {
    const b = el.getBoundingClientRect(), frame = el.closest('.remote-chat-frame').getBoundingClientRect(), style = getComputedStyle(el);
    return { width: b.width, height: b.height, bottomGap: frame.bottom - b.bottom, right: b.right, frameRight: frame.right,
      background: style.backgroundColor, shadow: style.boxShadow, svg: !!el.querySelector('svg') };
  });
  assert.equal(geometry.width, 34); assert.equal(geometry.height, 34); assert.ok(geometry.svg);
  assert.equal(geometry.bottomGap, 16); assert.ok(geometry.right <= geometry.frameRight);
  assert.notEqual(geometry.shadow, 'none', '保留原浮动控件阴影');
  await page.evaluate(() => window.preview15.live()); await settle();
  assert.ok(Math.abs((await metrics()).top - reading.top) < 4, '阅读旧消息时新输出不拉回底部');
  await button.click(); await waitFloor(); assert.equal(await button.count(), 0);
  const calls = await page.evaluate(() => window.preview15.history.calls);
  for (let i = 0; i < 4; i++) {
    await page.evaluate(() => window.preview15.live()); await waitFloor();
    assert.equal(await button.count(), 0, '持续新输出和虚拟高度测量仍跟随底部');
  }
  await page.setViewportSize({ width: 390, height: 620 }); await waitFloor();
  await page.setViewportSize({ width: 320, height: 740 }); await waitFloor();
  await page.mouse.move(150, 350); await page.mouse.wheel(0, -700); await button.waitFor();
  await page.emulateMedia({ reducedMotion: 'reduce' }); await button.click(); await waitFloor();
  assert.equal(await button.count(), 0);
  assert.equal(await page.evaluate(() => window.preview15.history.calls), calls, '返回底部不增加历史RPC');
  assert.equal(await input.innerText(), 'scroll-bottom draft');
  assert.equal(await page.evaluate(() => {
    const model = window.preview15.model;
    return (model.conversationFocus.getSnapshot() ?? model).reference === window.__scrollBottomReference;
  }), true, '按钮不重建会话和插件作用域');
  if (!aside) {
    await page.evaluate(() => window.fixture.toolLocale('en'));
    await page.mouse.move(150, 350); await page.mouse.wheel(0, -700);
    await owner.getByRole('button', { name: 'Back to bottom', exact: true }).waitFor();
    await page.evaluate(() => window.fixture.toolLocale('zh'));
    await page.evaluate(() => window.fixture.replaceFactorySession());
    await page.getByTestId('factory-session-replacement').waitFor();
    assert.equal(await button.count(), 0, '独立插件Views取代正文时不叠加宿主按钮');
    await page.evaluate(() => window.fixture.restoreFactorySession());
    await button.waitFor(); await button.click(); await waitFloor();
    assert.equal(await input.innerText(), 'scroll-bottom draft');
    await chat.evaluate(el => { window.__previousScrollPort = el; });
    await main.getByRole('button', { name: '返回', exact: true }).click();
    await page.waitForFunction(() => window.preview15.model.getSnapshot().selected === null);
    assert.equal(await page.evaluate(() => window.preview15.originalScrollOwner(window.__previousScrollPort)), false,
      '退出正文后释放原控制器所有者');
    await main.locator('.remote-session-row,[data-remote-home-session]').filter({ hasText: 'one' }).first().click();
    await waitFloor(); assert.equal(await button.count(), 0, '从真实列表再次进入时重置跟随');
    assert.equal(await chat.evaluate(el => window.preview15.originalScrollOwner(el)), true);
    assert.equal(await input.innerText(), 'scroll-bottom draft');
  } else {
    await page.mouse.move(150, 350); await page.mouse.wheel(0, -700); await button.waitFor();
    await page.evaluate(() => window.fixture.enableFactoryProbe(true));
    const custom = page.getByTestId('factory-custom-view').filter({ visible: true }); await custom.waitFor();
    // 更换整个factory会创建新的正文；在该factory内部验证Views临时切换的阅读状态。
    await waitFloor();
    await page.mouse.move(150, 350); await page.mouse.wheel(0, -700); await button.waitFor();
    await custom.getByRole('button', { name: '仅显示插件内容', exact: true }).click();
    assert.equal(await button.count(), 0, '旁栏原factory局部Views取代正文时不叠加按钮');
    await custom.getByRole('button', { name: '恢复聊天内容', exact: true }).click();
    await button.waitFor(); await button.click(); await waitFloor();
  }
  return { aside, originalController: true, originalGeometry: geometry, readingUnaffectedByLiveOutput: true,
    returnsToMeasuredFloor: true, followsLiveAndResize: true, reducedMotion: true, noPageRequests: true, draftAndReference: true, pluginViews: true };
}
