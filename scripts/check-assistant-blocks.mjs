import assert from 'node:assert/strict';

// 回放原消息事件，经过正式 RemoteWorkspace，而非直接挂载被测组件。
export async function checkAssistantBlocks(page) {
  await page.evaluate(() => window.fixture.select('two'));
  await page.evaluate(() => window.fixture.assistantBlocks([
    { type: 'text', text: '图片之前' },
    ...['图一', '图二'].map((name, index) => ({ type: 'image', attachment: { attachmentId: `fixture-${index}`, name, mediaType: 'image/png', bytes: 1 } })),
    { type: 'text', text: '图片之后' },
    { type: 'reasoning', text: '保留原位置的思考' },
    { type: 'text', text: '最终说明' },
    { type: 'fixture-extension', value: '<script>window.untrustedExecuted = true</script>', long: 'x'.repeat(21000) },
  ]));
  const answer = page.getByRole('article', { name: '模型回复', exact: true });
  await answer.getByText('图片之前', { exact: true }).waitFor();
  const text = await answer.textContent();
  const labels = ['图片之前', '图一', '图二', '图片之后', '思考过程', '最终说明', '扩展内容'];
  const positions = labels.map(label => text.indexOf(label));
  assert.ok(positions.every((position, index) => position >= 0 && (!index || position > positions[index - 1])), `内容顺序：${text}`);
  assert.equal(await answer.locator('.remote-files').count(), 1, '相邻图片合为一组');
  assert.equal(await answer.locator('.remote-files .remote-inline-image').count(), 2);
  assert.equal(await answer.locator('pre').count(), 0, '扩展数据初始收起');
  await answer.getByRole('button', { name: /扩展内容/ }).click();
  assert.match(await answer.locator('pre').innerText(), /内容较长，仅显示部分/);
  assert.equal(await page.evaluate(() => window.untrustedExecuted), undefined);
  assert.equal(await answer.locator('script').count(), 0);
  // 关闭的最终回复仍保留可搜索的思考内容，浏览器查找可以展开其所属过程。
  const reasoning = answer.locator('[data-turn-process-inline]');
  assert.equal(await reasoning.getAttribute('hidden'), 'until-found');
  await reasoning.evaluate(element => element.dispatchEvent(new Event('beforematch')));
  await page.waitForFunction(() => !document.querySelector('[data-turn-process-inline]')?.hasAttribute('hidden'));
  await answer.locator('summary').click();
  await answer.getByText('保留原位置的思考', { exact: true }).waitFor();
  await page.evaluate(() => window.fixture.assistantBlocks([], 2, 5));
  await page.evaluate(() => window.fixture.assistantBlocks([{ type: 'text', text: '空回复之后' }], 3, 10));
  await page.getByText('空回复之后', { exact: true }).waitFor();
  assert.equal(await page.getByRole('article', { name: '模型回复', exact: true }).count(), 2, '空回复不生成空消息');
  return { originalOrder: true, adjacentImageGroup: true, unknownVisibleAndBounded: true, dataNotExecuted: true, searchableReasoning: true, emptyReplySkipped: true };
}
