import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';

export const codeSource = '{\n  "narrow": "iiii WWWW",\n\n  "long": "' + 'keep_source_columns_'.repeat(24) + '"\n}';
export const codeMarkdown = '```json\n' + codeSource + '\n```';

/** 实际消息入口共用的代码卡验收，不自行创建代码块替身。 */
export async function checkChatCodeBlock(page, card) {
  await card.waitFor(); await card.scrollIntoViewIfNeeded();
  assert.ok(await page.evaluate(async () => (await document.fonts.load('11px "JetBrains Mono"')).length > 0),
    '随包提供DSH字体栈中的JetBrains Mono，不依赖电脑字体或公网资源');
  const source = card.locator('pre');
  assert.equal(await source.textContent(), codeSource, '原始换行和空行不丢失');
  const wrap = card.getByRole('button', { name: '自动换行', exact: true });
  await wrap.waitFor();
  assert.equal(await wrap.getAttribute('aria-pressed'), 'true');
  await wrap.click();
  assert.equal(await card.getAttribute('data-code-wrap'), 'false');
  assert.equal(await source.evaluate(el => getComputedStyle(el).whiteSpace), 'pre');
  assert.ok(await source.evaluate(el => el.scrollWidth > el.clientWidth), '取消自动换行保留长行并允许横向滚动');
  await wrap.click();
  assert.equal(await card.getAttribute('data-code-wrap'), 'true');
  assert.equal(await source.evaluate(el => getComputedStyle(el).whiteSpace), 'pre-wrap');
  assert.equal(await source.textContent(), codeSource);
  // 模拟Android不存在桌面字体的情况；保留生产变量解析路径，仅替换字体可用性。
  const fallback = await card.evaluate(el => {
    const style = document.body.style, previous = style.getPropertyValue('--dsh-font-family-code-default');
    style.setProperty('--dsh-font-family-code-default', 'DSHMUnavailableDesktopFont');
    try {
      const code = el.querySelector('pre code'), font = getComputedStyle(code), ctx = document.createElement('canvas').getContext('2d');
      ctx.font = font.font;
      return { family: font.fontFamily, size: font.fontSize, narrow: ctx.measureText('iiii').width, wide: ctx.measureText('WWWW').width };
    } finally { if (previous) style.setProperty('--dsh-font-family-code-default', previous); else style.removeProperty('--dsh-font-family-code-default'); }
  });
  assert.ok(Math.abs(fallback.narrow - fallback.wide) < .1, `桌面字体缺失时仍等宽：${JSON.stringify(fallback)}`);
  await card.getByRole('button', { name: '复制', exact: true }).click();
  await card.getByRole('button', { name: '复制成功', exact: true }).waitFor();
  const copied = await page.evaluate(() => navigator.clipboard.readText());
  assert.equal(copied.replaceAll('\r\n', '\n'), codeSource, '复制保留原始内容及换行（Windows系统剪贴板使用CRLF）');
  await page.setViewportSize({ width: 320, height: 740 });
  assert.ok(await card.evaluate(el => el.getBoundingClientRect().right <= innerWidth + 1));
  return { originalToolbar: true, sourceNewlines: true, wrapAndHorizontalScroll: true, fallback, copy: true, narrow: true };
}

export async function checkRemoteCodeBlock(page) {
  await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.evaluate(() => window.fixture.toolLocale('zh'));
  await page.evaluate(() => window.fixture.select(null));
  const main = page.getByTestId('remote-workspace');
  await main.locator('.remote-session-row,[data-remote-home-session]').filter({ hasText: 'one' }).first().click();
  await page.waitForFunction(() => document.querySelector('[data-testid="remote-workspace"] button[aria-label="返回"]')?.disabled === false);
  await page.evaluate(text => window.fixture.emitTurn('one', 1, 0, text), codeMarkdown);
  const result = await checkChatCodeBlock(page, main.locator('.md-code-block').filter({ hasText: 'keep_source_columns_' }).last());
  await writeFile(`artifacts/code-block-dom${process.argv.includes('--alpha2') ? '-alpha2' : ''}.html`, await page.content());
  for (const modern of [true, false]) {
    await page.evaluate(({ modern, text }) => modern ? window.fixture.fileLayout('code-card.md', text) : window.fixture.legacyLinkPreview(text), { modern, text: codeMarkdown });
    const preview = modern ? page.getByRole('region', { name: '插件面板', exact: true }) : page.getByRole('dialog', { name: '文件预览', exact: true });
    const card = preview.locator('.md-code-block'); await card.waitFor();
    assert.equal(await card.locator('pre').textContent(), codeSource);
    const wrap = card.getByRole('button', { name: '自动换行', exact: true });
    await wrap.click(); assert.equal(await card.getAttribute('data-code-wrap'), 'false');
    await wrap.click(); assert.equal(await card.getAttribute('data-code-wrap'), 'true');
  }
  // 相同共享组件的流式专项；消息入口已在上面实际进入，下面只控制公开text/streaming属性。
  await page.evaluate(text => window.fixture.markdownStream(text), '```json\n' + codeSource.slice(0, 70));
  const card = page.locator('.md-code-block'); await card.waitFor();
  const original = await card.elementHandle();
  await card.getByRole('button', { name: '自动换行', exact: true }).click();
  for (const end of [120, 240, codeSource.length]) {
    await page.evaluate(text => window.fixture.markdownStream(text), '```json\n' + codeSource.slice(0, end));
    await page.waitForFunction(length => document.querySelector('.md-code-block pre')?.textContent.length === length, end);
    assert.equal(await original.evaluate(el => el === document.querySelector('.md-code-block')), true);
    assert.equal(await card.getAttribute('data-code-wrap'), 'false', '流式追加不重建代码卡或丢失换行选择');
  }
  await page.evaluate(text => window.fixture.markdownStream(text, false), codeMarkdown);
  assert.equal(await card.locator('pre').textContent(), codeSource);
  assert.equal(await card.getAttribute('data-code-wrap'), 'false');
  await page.evaluate(text => window.fixture.markdownStream(text, false, 'en'), codeMarkdown);
  await card.getByRole('button', { name: 'Wrap lines', exact: true }).waitFor();
  assert.equal(await card.getAttribute('data-code-wrap'), 'false');
  return { ...result, modernAndLegacyMarkdownPreview: true, sharedComponentStreamingIdentity: true, localeSwitch: true };
}
