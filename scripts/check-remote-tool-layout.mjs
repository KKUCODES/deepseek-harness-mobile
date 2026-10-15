import assert from 'node:assert/strict';

async function measure(scope) {
  return scope.locator('[data-chat-call-id="layout-long"]').evaluate(element => {
    const text = Array.from(element.querySelectorAll('*')).find(item => item.childNodes.length === 1 && item.firstChild.nodeType === 3 && item.textContent.startsWith('Error: the user rejected'));
    const rect = text.getBoundingClientRect(), style = getComputedStyle(text);
    const ancestors = [];
    let scale = 1;
    for (let item = text; item && !item.matches('[data-chat-flow-key]'); item = item.parentElement) {
      const css = getComputedStyle(item), bounds = item.getBoundingClientRect();
      if (css.transform !== 'none') scale *= new DOMMatrix(css.transform).a;
      if (['hidden', 'clip'].includes(css.overflowY)) ancestors.push({ top: bounds.top, bottom: bounds.bottom });
    }
    const rows = Array.from(element.closest('.messages').querySelectorAll('[data-chat-flow-kind="tool-call"]')).slice(-3)
      .map(item => { const bounds = item.getBoundingClientRect(); return { top: bounds.top, height: bounds.height, marginBottom: getComputedStyle(item).marginBottom }; });
    return { font: Number.parseFloat(style.fontSize), renderedFont: Number.parseFloat(style.fontSize) * scale,
      height: rect.height, whiteSpace: style.whiteSpace, color: style.color, clipped: ancestors.some(bounds => rect.top < bounds.top - 1 || rect.bottom > bounds.bottom + 1), rows,
      pageWidth: document.documentElement.clientWidth, scrollWidth: document.documentElement.scrollWidth };
  });
}

function assertReadable(value) {
  assert.ok(value.renderedFont >= 14, JSON.stringify(value));
  assert.equal(value.whiteSpace, 'normal');
  if (value.pageWidth <= 420) assert.ok(value.height >= 40, 'Long error is wrapped rather than ellipsized');
  assert.equal(value.clipped, false, 'Wrapped errors remain fully visible');
  assert.ok(value.scrollWidth <= value.pageWidth, 'No page horizontal overflow');
  for (let index = 1; index < value.rows.length; index++) {
    const before = value.rows[index - 1], row = value.rows[index];
    const gap = row.top - before.top - before.height;
    assert.ok(gap >= 5 && gap <= 7, `Tool rows use the DSH 6px rhythm: ${gap}`);
  }
}

export async function checkRemoteToolLayout(page, output) {
  await page.waitForFunction(() => !!window.fixture);
  await page.evaluate(async () => {
    window.fixture.locale('zh'); await window.fixture.select('two');
    await window.fixture.enableOriginalTools(); window.fixture.toolLayoutCases();
  });
  const main = page.getByTestId('remote-workspace'), long = main.locator('[data-chat-call-id="layout-long"]');
  await long.waitFor({ state: 'attached' });
  const summary = main.locator('[data-turn-process]').first();
  if (!await long.isVisible()) await summary.click();
  await long.waitFor();
  await page.waitForTimeout(300);
  const cases = [];
  for (const width of [320, 375, 420, 760]) {
    await page.setViewportSize({ width, height: 760 });
    for (const dark of [false, true]) {
      await page.evaluate(dark => document.body.toggleAttribute('data-ds-dark-theme', dark), dark);
      const value = await measure(main);
      if (!process.argv.includes('--measure-only')) assertReadable(value);
      cases.push({ width, dark, ...value });
      if (width === 375) await page.screenshot({ path: output.replace('.png', dark ? '-dark.png' : '.png'), fullPage: true });
    }
  }
  if (process.argv.includes('--measure-only')) return { cases };
  await page.evaluate(() => document.body.removeAttribute('data-ds-dark-theme'));
  await page.setViewportSize({ width: 375, height: 667 });
  await main.getByRole('textbox', { name: '消息', exact: true }).fill('工具记录布局草稿');
  const node = main.locator('[data-chat-flow-kind="tool-call"]:has([data-chat-call-id="layout-long"])');
  await node.getByRole('button', { name: '工具详情', exact: true }).click();
  const detail = page.getByRole('dialog', { name: '工具详情', exact: true });
  await detail.getByText(/Error: the user rejected escalating/).waitFor();
  await detail.getByRole('button', { name: '关闭工具详情', exact: true }).click();
  assert.equal(await main.getByRole('textbox', { name: '消息', exact: true }).innerText(), '工具记录布局草稿');
  await summary.click(); await page.waitForTimeout(300);
  assert.equal(await main.locator('[data-chat-flow-kind="tool-call"]').last().getAttribute('hidden'), 'until-found');
  await summary.click(); await page.waitForTimeout(300); assertReadable(await measure(main));
  await page.evaluate(() => window.fixture.toolLayoutWide());
  const wideFrame = main.locator('[data-plugin-frame="@fixture/wide-tool"]').last();
  const wide = wideFrame.getByTestId('wide-tool'); await wide.waitFor();
  await page.waitForFunction(() => document.querySelector('[data-testid="wide-tool"]')?.getBoundingClientRect().width < 375);
  assert.equal(await wide.evaluate(element => element.offsetWidth), 720, 'Third-party internal size remains unchanged');
  await wide.click(); assert.equal(await wide.getAttribute('data-clicked'), 'yes');
  await page.evaluate(() => window.fixture.toolLayoutFit(false));
  assert.equal(await wide.evaluate(element => element.getBoundingClientRect().width), 720);
  assert.ok(await wideFrame.evaluate(element => { element.scrollLeft = 50; return element.scrollLeft > 0; }));
  await page.evaluate(() => { window.fixture.toolLayoutFit(undefined); window.fixture.toolLayoutWideOff(); });
  await long.waitFor(); await page.waitForTimeout(100); assertReadable(await measure(main));
  // 原旁栏自身使用 embedded RemoteWorkspace；子会话协议另由完整页面回归覆盖。
  await page.evaluate(() => window.fixture.toolLayoutEmbedded());
  const aside = page.getByTestId('remote-sidebar-conversation').filter({ visible: true });
  await aside.getByRole('textbox', { name: '消息', exact: true }).waitFor();
  await aside.locator('[data-chat-call-id="layout-long"]').waitFor({ state: 'attached' });
  await page.waitForTimeout(300);
  const sidebar = await measure(aside); assertReadable(sidebar);
  return { cases, sidebar, detailsAccessible: true, draftPreserved: true, collapseAndExpand: true, thirdPartyScalingAndOptOut: true };
}
