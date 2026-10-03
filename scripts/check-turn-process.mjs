import assert from 'node:assert/strict';

// 使用真实投影、原 ChatNodeSeat 和原会话 store；只回放事件，不伪造折叠结果。
export async function checkTurnProcess(page) {
  await page.evaluate(() => window.fixture.select('two'));
  await page.evaluate(() => window.fixture.processTurn('two', 1, 0));
  await page.getByText('Process two 1', { exact: true }).waitFor();
  await page.getByText('Answer two 1', { exact: true }).waitFor();
  assert.equal(await page.locator('button[data-turn-process]:visible').count(), 0);
  await page.evaluate(() => window.fixture.processTurn('two', 1, 0, true));
  const toggle = page.locator('button[data-turn-process="1"]');
  await toggle.waitFor();
  assert.equal(await toggle.getAttribute('aria-expanded'), 'false');
  const member = page.locator('[data-turn-process-member]').filter({ hasText: 'Process two 1' });
  assert.equal(await member.getAttribute('hidden'), 'until-found');
  await page.getByText('Answer two 1', { exact: true }).waitFor();
  const gap = await page.evaluate(() => {
    const control = document.querySelector('[data-chat-flow-kind="turn-process"]');
    const answer = [...document.querySelectorAll('[data-chat-flow-kind="assistant-step"]')].find(item => item.textContent.includes('Answer two 1'));
    return answer.getBoundingClientRect().top - control.getBoundingClientRect().bottom;
  });
  assert.ok(gap >= 23 && gap <= 25, `折叠内容不留下额外空白: ${gap}`);
  await toggle.click();
  await page.waitForFunction(() => !document.querySelector('[data-turn-process-member]')?.hasAttribute('hidden'));
  assert.equal(await toggle.getAttribute('aria-expanded'), 'true');
  await toggle.click();
  assert.equal(await member.getAttribute('hidden'), 'until-found');
  await member.evaluate(element => element.dispatchEvent(new Event('beforematch')));
  await page.waitForFunction(() => document.querySelector('button[data-turn-process="1"]')?.getAttribute('aria-expanded') === 'true');
  await page.evaluate(() => window.fixture.processTurn('two', 2, 8));
  await page.evaluate(() => window.fixture.processTurn('two', 2, 8, true));
  const second = page.locator('button[data-turn-process="2"]');
  await second.waitFor();
  assert.equal(await second.getAttribute('aria-expanded'), 'false');
  assert.equal(await toggle.getAttribute('aria-expanded'), 'true');
  await page.evaluate(() => window.fixture.select('one'));
  await page.evaluate(() => window.fixture.processTurn('one', 1, 0));
  await page.evaluate(() => window.fixture.processTurn('one', 1, 0, true));
  await toggle.waitFor();
  assert.equal(await toggle.getAttribute('aria-expanded'), 'false');
  await page.reload();
  await page.waitForFunction(() => !!window.fixture);
  await page.evaluate(() => { window.fixture.historyTesting(true); return window.fixture.select('one'); });
  await page.evaluate(() => window.fixture.processTurn('one', 2, 11));
  await page.evaluate(() => window.fixture.processTurn('one', 2, 11, true));
  await page.getByText('Answer one 2', { exact: true }).waitFor();
  assert.equal(await page.locator('button[data-turn-process]:visible').count(), 0);
  await page.getByText('Process one 2', { exact: true }).waitFor();
  return { runningVisible: true, incompleteHistoryVisible: true, completedCollapsed: true, finalAnswerVisible: true, sharedNodeState: true, browserFindReveals: true, independentTurnsAndSessions: true, collapsedGap: gap };
}
