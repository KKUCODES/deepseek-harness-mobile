import assert from 'node:assert/strict';

export async function checkReferenceMenu(page) {
  await page.evaluate(async () => { await window.fixture.select('one'); await window.fixture.referenceMenuSetup(); });
  const main = page.getByTestId('remote-workspace'), input = main.getByRole('textbox', { name: '消息', exact: true });
  await input.fill('保留正文');
  await page.evaluate(() => window.fixture.referenceMenuSeed());
  assert.equal(await input.locator('[data-composer-chip]').count(), 1);
  const add = async name => {
    await main.getByRole('button', { name: '添加附件', exact: true }).click();
    await page.getByRole('dialog', { name: '附件', exact: true }).getByRole('button', { name: '引用文件或聊天', exact: true }).click();
    const picker = page.getByRole('dialog', { name: '引用文件或聊天', exact: true });
    await picker.getByRole('button', { name: `引用 ${name}`, exact: true }).click();
    await picker.waitFor({ state: 'detached' });
  };
  await add('menu file.txt');
  assert.equal(await input.locator('[data-composer-chip]').count(), 2);
  await add('菜单聊天');
  assert.equal(await input.locator('[data-composer-chip]').count(), 3);
  const saved = await page.evaluate(() => window.fixture.referenceMenuDraft());
  const chips = saved.editor.root.children.flatMap(n => n.children ?? []).filter(n => n.type === 'reference-chip');
  assert.deepEqual(chips.map(n => [n.source, n.ref]), [['fixture', 'original-id'], ['reference', '@"menu file.txt"'], ['reference', '@dsh-session:two']]);
  assert.ok(saved.text.startsWith('保留正文'));
  await page.evaluate(async () => { await window.fixture.select('two'); await window.fixture.select('one'); });
  await input.locator('[data-composer-chip]').first().waitFor();
  assert.equal(await input.locator('[data-composer-chip]').count(), 3);
  await input.fill('');
  return { originalIdentityPreserved: true, fileChip: true, chatChip: true, textPreserved: true, reopened: true };
}
