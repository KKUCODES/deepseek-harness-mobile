import assert from 'node:assert/strict';

/** 合成事件经过真实会话、聊天节点和文件打开入口，不直接挂载Markdown组件。 */
export async function checkRemoteLinks(page) {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.waitForFunction(() => !!window.fixture);
  await page.evaluate(async () => {
    window.fixture.locale('zh');
    await window.fixture.select('two');
    window.fixture.assistantBlocks([
      { type: 'reasoning', text: '[思考网页](https://example.com/reasoning)' },
      { type: 'text', text: '[正文网页](https://example.com/chat)\n\nhttp://example.com/plain\n\n`https://example.com/code`\n\n[项目文件](links.md)\n\n[项目行号](links.md#L2)\n\n[恶意链接](javascript:alert(1))' },
    ]);
  });
  const expected = [];
  const click = async (name, url, scope = page) => {
    await scope.getByRole('link', { name, exact: true }).click({ noWaitAfter: true });
    expected.push(url);
    await page.waitForFunction(count => window.fixture.externalLinks.calls().length === count, expected.length, { timeout: 2000 });
    assert.deepEqual(await page.evaluate(() => window.fixture.externalLinks.calls()), expected);
  };
  await click('正文网页', 'https://example.com/chat');
  await click('http://example.com/plain', 'http://example.com/plain');
  await click('https://example.com/code', 'https://example.com/code');
  await page.locator('[data-turn-process-inline]').evaluate(el => el.dispatchEvent(new Event('beforematch')));
  await page.locator('article summary').first().click();
  await click('思考网页', 'https://example.com/reasoning');
  assert.equal(await page.locator('a[href^="javascript:"]').count(), 0);

  await page.evaluate(() => window.fixture.linkToolTurn());
  await page.locator('button[data-turn-process="2"]').click();
  const process = page.locator('[data-chat-turn="2"] details.remote-tool-card > summary').first();
  if (await process.count()) await process.click();
  await click('工具网页', 'https://example.com/tool');

  await page.evaluate(() => window.fixture.fileLayout('links.md', '[文件网页](https://example.com/document)'));
  const panel = page.getByRole('region', { name: '插件面板', exact: true });
  await click('文件网页', 'https://example.com/document', panel);
  await page.evaluate(() => window.fixture.externalLinks.fail('browser_unavailable'));
  await click('文件网页', 'https://example.com/document', panel);
  const previewError = page.getByRole('dialog', { name: '无法打开链接', exact: true });
  await previewError.getByRole('alert').getByText('未找到可打开网页的浏览器，请安装或启用浏览器后重试。', { exact: true }).waitFor();
  await previewError.getByRole('button', { name: '知道了', exact: true }).click();
  await panel.getByRole('link', { name: '文件网页', exact: true }).waitFor();
  await page.evaluate(() => window.fixture.externalLinks.fail(null));
  await panel.getByRole('button', { name: '返回聊天', exact: true }).click();
  await page.locator('.remote-plugin-panel:not(.remote-global-panel)').waitFor({ state: 'hidden' });
  await page.getByRole('button', { name: '项目文件', exact: true }).click();
  await panel.getByRole('link', { name: '文件网页', exact: true }).waitFor();
  assert.equal((await page.evaluate(() => window.fixture.externalLinks.calls())).length, expected.length, '打开项目文件不应调用浏览器');
  await panel.getByRole('button', { name: '返回聊天', exact: true }).click();
  await page.locator('.remote-plugin-panel:not(.remote-global-panel)').waitFor({ state: 'hidden' });
  await page.getByRole('button', { name: '项目行号', exact: true }).click();
  await panel.locator('[data-textpreview-url]').waitFor();
  assert.equal((await page.evaluate(() => window.fixture.linkFile())).line, 2, '项目文件行号参数仍交给原预览路径');
  assert.equal((await page.evaluate(() => window.fixture.externalLinks.calls())).length, expected.length, '文件行号仍进入源码预览');
  await panel.getByRole('button', { name: '返回聊天', exact: true }).click();
  await page.locator('.remote-plugin-panel:not(.remote-global-panel)').waitFor({ state: 'hidden' });

  for (const [code, message] of [['browser_unavailable', '未找到可打开网页的浏览器，请安装或启用浏览器后重试。'], ['invalid_link', '该链接不是有效的 HTTP 或 HTTPS 网页地址。'], ['remote_operation_failed', '无法打开网页，请稍后重试。']]) {
    await page.evaluate(value => window.fixture.externalLinks.fail(value), code);
    await click('正文网页', 'https://example.com/chat');
    const error = page.getByRole('dialog', { name: '无法打开链接', exact: true });
    await error.getByRole('alert').getByText(message, { exact: true }).waitFor();
    await error.getByRole('button', { name: '知道了', exact: true }).click();
  }
  await page.evaluate(() => { window.fixture.externalLinks.fail(null); window.fixture.legacyLinkPreview('[旧版文件网页](https://example.com/legacy)'); });
  await click('旧版文件网页', 'https://example.com/legacy', page.getByRole('dialog', { name: '文件预览', exact: true }));
  return { chat: true, reasoning: true, tool: true, modernMarkdownPreview: true, legacyMarkdownPreview: true, plainAndInlineUrls: true, projectFilesAndLinesPreserved: true, failureVisible: true, calls: expected };
}
