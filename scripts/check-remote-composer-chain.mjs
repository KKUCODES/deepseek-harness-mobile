import assert from 'node:assert/strict';

export async function checkRemoteComposerChain(page) {
  await page.evaluate(async () => { await window.fixture.select('one'); await window.fixture.enableComposerProbe(); });
  const input = page.getByRole('textbox', { name: '消息', exact: true });
  await input.fill('接管前的草稿');
  const original = await input.elementHandle();
  await page.evaluate(() => window.fixture.composerTakeover());
  const panel = page.getByTestId('composer-takeover'); await panel.waitFor();
  assert.equal(await panel.getAttribute('data-priority'), '1'); // 原链按优先级升序选首个匹配。
  assert.equal(await panel.getAttribute('data-session'), 'one');
  assert.equal(await panel.locator('span').innerText(), '接管前的草稿');
  assert.equal(await input.count(), 0, '接管后默认输入不可交互');
  assert.equal(await original.evaluate(node => node.isConnected), true, '默认编辑器没有卸载');
  await panel.getByRole('button', { name: '完成插件输入' }).click();
  await input.waitFor(); assert.equal(await input.innerText(), '接管前的草稿');
  assert.equal(await input.evaluate((node, old) => node === old, original), true);
  await page.evaluate(() => window.fixture.composerTakeover());
  await panel.waitFor();
  await page.evaluate(() => window.fixture.select('two')); await input.waitFor();
  assert.equal(await panel.count(), 0, '另一会话不显示旧会话交互');
  await page.evaluate(() => window.fixture.select('one')); await panel.waitFor();
  await page.evaluate(() => window.fixture.disableComposerProbe());
  await input.waitFor(); assert.equal(await input.innerText(), '接管前的草稿');
  assert.equal(await page.evaluate(() => window.fixture.composerDelegated()), 1, '卸载沿原pending契约委托');
  await input.fill(''); await original.dispose();
  return { election: true, sessionIsolation: true, retainedEditor: true, draftRestored: true, unloadDelegated: true };
}
