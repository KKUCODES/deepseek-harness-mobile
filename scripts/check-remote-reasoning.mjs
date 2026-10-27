import assert from 'node:assert/strict';

export async function checkRemoteReasoning(page, { aside = false } = {}) {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.evaluate(aside => { window.fixture.toolLocale('zh'); return window.preview15.reasoning.setup({ sessionId: aside ? 'child-chat' : 'one' }); }, aside);
  const main = page.getByTestId('remote-workspace');
  if (aside) {
    await page.evaluate(async () => { await window.fixture.enableSidebarResources(); window.preview15.model.sessions.handleSessionStatus('one', false); });
    await main.getByRole('button', { name: 'Remote 选项', exact: true }).click();
    await page.getByRole('button', { name: '子会话', exact: true }).click();
    await page.getByRole('group', { name: '分析助手', exact: true }).getByRole('button', { name: '在旁栏打开', exact: true }).click();
  }
  const scope = aside ? page.getByTestId('remote-sidebar-conversation').filter({ visible: true }) : main;
  const chat = scope.getByRole('region', { name: '聊天内容', exact: true });
  const process = turn => scope.locator(`button[data-turn-process="${turn}"]`);
  const row = turn => scope.locator(`[data-chat-turn="${turn}"] [data-variant="think"], [data-chat-turn="${turn}"] .reply details:has(.thought)`);
  const toggle = locator => locator.locator('[data-disclosure-row], summary').first();
  const body = turn => row(turn).locator('[data-markdown-variant="compact"], .thought');
  const settle = () => page.waitForTimeout(350);
  async function seek(turn) {
    for (let i = 0; i < 60 && !await process(turn).count(); i++) {
      await chat.evaluate(el => { el.scrollTop = Math.max(0, el.scrollTop - 350); }); await page.waitForTimeout(35);
    }
    await process(turn).waitFor(); await process(turn).scrollIntoViewIfNeeded();
  }
  const assertVisible = async (turn, index = 0) => {
    const state = await row(turn).nth(index).evaluate(el => {
      const ancestors = []; for (let p = el; p && !p.classList.contains('conversation'); p = p.parentElement)
        ancestors.push({ hidden: p.hidden, opacity: getComputedStyle(p).opacity, display: getComputedStyle(p).display, height: p.getBoundingClientRect().height });
      const body = el.querySelector('[data-markdown-variant="compact"], .thought');
      return { text: body?.textContent, height: body?.getBoundingClientRect().height ?? 0, ancestors };
    });
    assert.ok(state.ancestors.every(x => !x.hidden && x.opacity !== '0' && (x.display === 'contents' || x.height > 0)), JSON.stringify(state.ancestors));
    assert.ok(state.height > 30, '验证展开的完整正文，不能仅凭预览摘要宣布通过');
    assert.match(state.text, new RegExp(`REASONING_${turn}_`));
  };
  const openProcess = async turn => { await seek(turn); if (await process(turn).getAttribute('aria-expanded') === 'false') { await process(turn).click(); await settle(); } };
  const openRow = async (turn, index = 0) => {
    const header = toggle(row(turn).nth(index));
    if (await header.getAttribute('aria-expanded') !== 'true') { await header.click(); await settle(); }
    await assertVisible(turn, index);
  };
  await seek(49);
  if (await process(49).getAttribute('aria-expanded') === 'false') await process(49).click();
  await toggle(row(49)).click(); await settle(); await assertVisible(49);
  // 原故障需要先进入可见状态，再收起外层并重开，单独点一次内层不能复现。
  await process(49).click(); await settle(); await process(49).click(); await settle();
  await assertVisible(49);
  assert.equal(await row(49).locator('details').count(), 0, 'Remote直接使用原ReasoningRow而非手机details近似件');
  const report = { outerReopen: true, originalReasoningRow: true, originalContentFactory: true };
  for (let i = 0; i < 3; i++) {
    await toggle(row(49)).click(); await settle(); assert.equal(await body(49).count(), 0);
    await openRow(49);
  }
  // 原DisclosureRow还保留键盘操作；快速反向后最终状态必须可见且无隐藏样式残留。
  await toggle(row(49)).press('Enter'); await settle(); await toggle(row(49)).press('Space'); await settle(); await assertVisible(49);
  for (let i = 0; i < 5; i++) { await process(49).dispatchEvent('click'); await page.waitForTimeout(15); }
  await settle(); await openProcess(49); await openRow(49);
  assert.equal(await chat.evaluate(el => el.style.overflowAnchor), '', '折叠结束恢复原生锚定');
  assert.equal(await row(49).first().evaluate(el => el.closest('.conversation').querySelector('[data-chat-motion="collapse"]') !== null), false);
  report.repeatedAndCancelled = true;
  await page.emulateMedia({ reducedMotion: 'reduce' }); await process(49).click(); await process(49).click(); await settle(); await openRow(49);
  await page.emulateMedia({ reducedMotion: 'no-preference' }); report.reducedMotion = true;
  await page.evaluate(() => window.preview15.reasoning.plugin());
  await row(49).locator('[data-reasoning-plugin] [data-markdown-variant="compact"]').waitFor(); await assertVisible(49);
  await page.evaluate(() => window.preview15.reasoning.disable());
  await page.waitForFunction(() => !document.querySelector('[data-reasoning-plugin]')); await assertVisible(49);
  report.pluginBodyAndFactory = true;
  await toggle(row(49)).click(); await settle();
  await chat.evaluate(el => { el.scrollTop = el.scrollHeight; }); await settle(); await openProcess(50);
  assert.equal(await row(50).count(), 2, '工具前后两段思考独立展开');
  await openRow(50, 0); await openRow(50, 1);
  assert.match(await row(50).nth(0).innerText(), /REASONING_50_1/); assert.match(await row(50).nth(1).innerText(), /REASONING_50_2/);
  await process(50).click(); await settle(); await process(50).click(); await settle();
  await openRow(50, 0); await openRow(50, 1); report.multiStep = true;
  const input = scope.getByRole('textbox', { name: '消息', exact: true }); await input.fill('reasoning draft'); await input.blur();
  await page.evaluate(() => { const m = window.preview15.model; window.__reasoningReference = (m.conversationFocus.getSnapshot() ?? m).reference; });
  // 前插原连续历史仍走正式按钮及锚点接线；增加足够轮次后验证离屏卸载/重挂。
  for (let i = 0; i < 2; i++) {
    await chat.evaluate(el => { el.scrollTop = 0; }); await settle();
    const anchor = await chat.locator('[data-history-group]').first().evaluate(el => ({ key: el.dataset.historyGroup, top: el.getBoundingClientRect().top }));
    const calls = await page.evaluate(() => window.preview15.reasoning.state().calls);
    await scope.getByRole('button', { name: '加载更早的消息', exact: true }).click();
    await page.waitForFunction(calls => window.preview15.reasoning.state().calls > calls, calls); await settle();
    const delta = await chat.locator(`[data-history-group="${anchor.key}"]`).evaluate((el, top) => el.getBoundingClientRect().top - top, anchor.top);
    assert.ok(Math.abs(delta) < 4, `历史前插锚点 ${delta}`);
  }
  await chat.evaluate(el => { el.scrollTop = 0; }); await settle();
  assert.equal(await row(49).count(), 0, '旧思考组件确实离屏卸载');
  await chat.evaluate(el => { el.scrollTop = el.scrollHeight; }); await settle();
  await openProcess(49); await openRow(49); report.historyAndRemount = true;
  assert.equal(await input.innerText(), 'reasoning draft');
  assert.equal(await page.evaluate(() => { const m = window.preview15.model; return (m.conversationFocus.getSnapshot() ?? m).reference === window.__reasoningReference; }), true);
  await toggle(row(49)).click(); await settle();
  await chat.dispatchEvent('wheel', { deltaY: -300, bubbles: true });
  await chat.evaluate(el => { el.scrollTop = Math.max(0, el.scrollTop - 300); }); await settle();
  const beforeLive = await chat.evaluate(el => el.scrollTop); await page.evaluate(() => window.preview15.reasoning.live()); await settle();
  assert.ok(Math.abs((await chat.evaluate(el => el.scrollTop)) - beforeLive) < 4, '读旧记录时实时追加不拉动位置');
  report.liveAndDraft = true;
  if (!aside) {
    // 动画尚未结算就离开会话，原clear/cancel必须释放全部临时样式。
    await seek(49); await process(49).dispatchEvent('click'); await page.evaluate(() => window.fixture.select(null));
    await page.evaluate(() => window.fixture.select('one')); await settle();
    await openProcess(49); await openRow(49); report.detachDuringFold = true;
    await page.evaluate(() => window.fixture.toolLocale('en'));
    await toggle(row(49)).getByText('Think', { exact: true }).waitFor(); report.locale = true;
  }
  return report;
}
