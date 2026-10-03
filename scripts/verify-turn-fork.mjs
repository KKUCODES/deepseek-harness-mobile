import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';

export async function verifyForkAvailability(history) {
  const buttons = history.getByRole('button', { name: /^查看第 \d+ 轮文件改动$/ });
  const turns = [];
  for (const button of await buttons.all()) {
    const turn = Number((await button.innerText()).match(/第 (\d+) 轮/)[1]);
    assert.equal(await history.getByRole('button', { name: `从第 ${turn} 轮分支`, exact: true }).isEnabled(), true);
    turns.push(turn);
  }
  assert.ok(turns.length, '专用会话应包含已完成的文件修改轮次');
  return { fileChangesDoNotBlockFork: turns };
}

/** 只分支专用联调会话；新分支独立续聊后归档，原会话与草稿保持不变。 */
export async function verifyTurnFork(page, history) {
  assert.equal(process.env.DSHM_RUN_LIVE, '1');
  const sourceTitle = 'DSHM Remote 联调提示', stamp = Date.now();
  const input = page.getByRole('textbox', { name: '消息', exact: true });
  assert.equal(await input.inputValue(), '', '不覆盖用户草稿');
  const buttons = history.locator('.remote-turn-actions button:not(:disabled)');
  const count = await buttons.count(); assert.ok(count >= 2);
  const target = buttons.nth(count - 2);
  const selectedTurn = Number(await target.locator('..').getAttribute('data-turn-tail'));
  const latestTurn = Number(await buttons.last().locator('..').getAttribute('data-turn-tail'));
  assert.ok(selectedTurn < latestTurn);
  const prefix = await target.evaluate(button => {
    const tail = button.closest('[data-turn-tail]');
    return [...tail.parentElement.querySelectorAll('article.reply')]
      .filter(reply => !!(reply.compareDocumentPosition(tail) & Node.DOCUMENT_POSITION_FOLLOWING)).map(reply => reply.textContent);
  });
  assert.ok(prefix.length);
  const sourceReplies = await history.locator('article.reply').allTextContents();
  const draft = `DSHM_BRANCH_DRAFT_${stamp}`;
  await input.fill(draft); await input.blur();
  await target.click();
  const heading = page.getByTestId('remote-workspace').locator('.remote-heading');
  await heading.filter({ hasText: /DSHM Remote 联调提示.+/ }).waitFor();
  await history.locator(`[data-turn-tail="${selectedTurn}"]`).waitFor();
  assert.equal(await history.locator(`[data-turn-tail="${latestTurn}"]`).count(), 0);
  const inherited = await history.locator('article.reply').allTextContents();
  assert.deepEqual(inherited.slice(-prefix.length), prefix);
  assert.equal(await input.inputValue(), '', '分支不复制原会话未发送草稿');
  const options = async name => {
    await page.getByRole('button', { name: 'Remote 选项', exact: true }).click();
    await page.getByRole('button', { name, exact: true }).click();
  };
  const branchTitle = `DSHM 按轮分支联调 ${stamp}`, marker = `DSHM_TURN_FORK_OK_${stamp}`;
  await options('重命名聊天');
  await page.getByRole('textbox', { name: '聊天名称', exact: true }).fill(branchTitle);
  await page.getByRole('button', { name: '保存名称', exact: true }).click();
  await heading.filter({ hasText: branchTitle }).waitFor();
  await writeFile('artifacts/remote-turn-fork-fixture.json', JSON.stringify({ sourceTitle, branchTitle, selectedTurn, latestTurn, marker }));
  await input.fill(`这是独立分支联调，请只回复 ${marker}，不调用工具。`);
  await page.getByRole('button', { name: '发送消息', exact: true }).click();
  await history.getByRole('article', { name: '模型回复' }).filter({ hasText: marker }).waitFor({ timeout: 90000 });
  await page.getByRole('button', { name: '发送消息', exact: true }).waitFor();
  await page.screenshot({ path: 'artifacts/remote-turn-fork-android.png' });
  await options('归档聊天');
  await page.getByRole('button', { name: new RegExp(`^${sourceTitle}`) }).filter({ hasText: sourceTitle }).first().click();
  await heading.filter({ hasText: sourceTitle }).waitFor();
  await history.locator(`[data-turn-tail="${latestTurn}"]`).waitFor();
  assert.deepEqual(await history.locator('article.reply').allTextContents(), sourceReplies);
  assert.equal(await history.getByRole('article', { name: '模型回复' }).filter({ hasText: marker }).count(), 0);
  assert.equal(await input.inputValue(), draft); await input.fill('');
  return { sourceTitle, branchTitle, selectedTurn, latestTurn, inheritedReplies: prefix.length,
    prefixPreserved: true, laterTurnsExcluded: true, independentReply: marker, originalUnchanged: true, draftPreserved: true, branchArchived: true };
}
