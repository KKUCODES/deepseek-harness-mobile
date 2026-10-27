import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';

export const tableMarkdown = '| # | 级别 | 位置 | 问题 | 最右列 |\n|---|---|---|---|---|\n' +
  Array.from({ length: 5 }, (_, i) => `| ${i + 1} | P0 | listOrders | 需要完整查阅的表格内容_${i} | TABLE_RIGHT_EDGE_${i} |`).join('\n') +
  '\n\n| 项目 | 状态 |\n|---|---|\n| 窄表 | 正常 |\n\n' + '表格之后仍可纵向继续查阅聊天。\n\n'.repeat(12);

export async function checkChatTable(page, scope) {
  const cdp = await page.context().newCDPSession(page);
  // Chromium会在独立CDP会话detach后清除触摸仿真；每个入口显式建立同一触屏环境。
  await cdp.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 1 });
  const table = scope.locator('.md-table-wide'); await table.waitFor(); await table.scrollIntoViewIfNeeded();
  // 列表点击的位置可能恰好落在新表格上，浏览器残留hover会掩盖触屏问题。
  await cdp.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: 1, y: 1 });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: 1, y: 1 }] });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  const before = await table.evaluate(el => ({ width: el.clientWidth, total: el.scrollWidth, overflow: getComputedStyle(el).overflowX,
    left: el.scrollLeft, right: el.getBoundingClientRect().right, viewport: innerWidth,
    touch: matchMedia('(hover: none), (pointer: coarse)').matches }));
  assert.equal(before.touch, true);
  assert.ok(before.total > before.width, '宽表保持原自然列宽');
  assert.ok(before.width <= before.viewport && before.right <= before.viewport + 1, '原滚动容器受手机内容宽度约束');
  assert.ok(['auto', 'scroll'].includes(before.overflow), `触摸时无需hover即可滚动：${JSON.stringify(before)}`);
  const box = await table.boundingBox();
  const y = Math.max(box.y, 140) + Math.min(60, box.height / 2), start = box.x + box.width - 16, end = box.x + 16;
  for (let pass = 0; pass < 5; pass++) {
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: start, y }] });
    for (let i = 1; i <= 8; i++) {
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: start + (end - start) * i / 8, y }] });
      await page.evaluate(() => new Promise(requestAnimationFrame));
    }
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await page.waitForTimeout(150);
  }
  const after = await table.evaluate(el => ({ left: el.scrollLeft, width: el.clientWidth, total: el.scrollWidth,
    cell: el.querySelector('tr:last-child td:last-child').getBoundingClientRect().toJSON(), rect: el.getBoundingClientRect().toJSON() }));
  assert.ok(after.left > 20, '实际触摸手势推进scrollLeft，不能用程序赋值代替');
  assert.ok(after.total - after.width - after.left < 3, JSON.stringify(after));
  assert.ok(after.cell.right <= after.rect.right + 1 && after.cell.left >= after.rect.left - 1, '最后一列完整进入可视区');
  assert.equal(await table.locator('td').last().textContent(), 'TABLE_RIGHT_EDGE_4');
  assert.equal(await scope.locator('table').count(), 2, '窄表仍使用原填充规则');
  const vertical = await table.evaluate(el => { const chat = el.closest('.conversation'); return chat && { top: chat.scrollTop, floor: chat.scrollHeight - chat.clientHeight }; });
  if (vertical) {
    const startY = Math.min(box.y + box.height - 35, 600), x = box.x + box.width / 2;
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y: startY }] });
    for (let i = 1; i <= 8; i++) {
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y: startY - i * 20 }] });
      await page.evaluate(() => new Promise(requestAnimationFrame));
    }
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await page.waitForTimeout(150);
    assert.ok(await table.evaluate((el, top) => el.closest('.conversation').scrollTop > top + 10, vertical.top), '从表格上纵向滑动仍能查阅聊天');
  }
  await cdp.detach();
  return { before, after, touchToRightEdge: true, narrowTable: true, verticalConversationScroll: !!vertical };
}

export async function checkRemoteTable(page, { aside = false } = {}) {
  await page.evaluate(() => { window.fixture.toolLocale('zh'); return window.fixture.select(null); });
  const main = page.getByTestId('remote-workspace');
  await main.locator('.remote-session-row,[data-remote-home-session]').filter({ hasText: 'one' }).first().click();
  await page.waitForFunction(() => document.querySelector('[data-testid="remote-workspace"] button[aria-label="返回"]')?.disabled === false);
  if (aside) {
    await page.evaluate(async () => { await window.fixture.enableSidebarResources(); window.preview15.model.sessions.handleSessionStatus('one', false); });
    await main.getByRole('button', { name: 'Remote 选项', exact: true }).click();
    await page.getByRole('button', { name: '子会话', exact: true }).click();
    await page.getByRole('group', { name: '分析助手', exact: true }).getByRole('button', { name: '在旁栏打开', exact: true }).click();
  }
  await page.evaluate(({ text, aside }) => window.fixture.emitTurn(aside ? 'child-chat' : 'one', 1, 0, text), { text: tableMarkdown, aside });
  const scope = aside ? page.getByTestId('remote-sidebar-conversation').filter({ visible: true }) : main;
  const report = await checkChatTable(page, scope);
  await writeFile(`artifacts/chat-table-dom${process.argv.includes('--alpha2') ? '-alpha2' : ''}${aside ? '-aside' : ''}.html`, await page.content());
  if (!aside) for (const modern of [true, false]) {
    await page.evaluate(({ modern, text }) => modern ? window.fixture.fileLayout('table.md', text) : window.fixture.legacyLinkPreview(text), { modern, text: tableMarkdown });
    const preview = modern ? page.getByRole('region', { name: '插件面板', exact: true }) : page.getByRole('dialog', { name: '文件预览', exact: true });
    await checkChatTable(page, preview);
  }
  return report;
}
