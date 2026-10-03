import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';

/** 等待原 userQuestions 的真实 90 秒 signal 到期；不伪造取消事件或修改手机时钟。 */
export async function verifyInteractionTimeout(page, report) {
  assert.equal(process.env.DSHM_RUN_LIVE, '1');
  const main = page.getByTestId('remote-workspace');
  const input = main.getByRole('textbox', { name: '消息', exact: true });
  const readDraft = () => input.evaluate(node => node.textContent === '' ? '' : node.innerText);
  const probe = page.getByTestId('live-interactions');
  const panel = page.getByRole('region', { name: '插件面板', exact: true });
  const original = await readDraft();
  const draft = `${original}DSHM_TIMEOUT_DRAFT`;
  const sessionId = await probe.getAttribute('data-session');
  assert.ok(sessionId);
  report.timeouts = [];
  const begin = async kind => {
    const id = `${Date.now()}-timeout-${kind}`;
    await writeFile('artifacts/original-interactions-host-control.json', JSON.stringify({ id, kind, sessionId }));
    return id;
  };
  async function result(id, timeout) {
    const until = Date.now() + timeout;
    do {
      const value = await readFile('artifacts/original-interactions-host-result.json', 'utf8').then(JSON.parse).catch(() => ({}));
      if (value.id === id) return value;
      await new Promise(resolve => setTimeout(resolve, 200));
    } while (Date.now() < until);
    throw new Error(`Original Host result missing for ${id}`);
  }
  await input.fill(draft);
  try {
    for (const kind of ['question', 'plan']) {
      const started = Date.now();
      const id = await begin(kind);
      const card = page.locator(kind === 'question' ? '[data-question-key]' : '[data-plan-review-key]');
      if (kind === 'plan') {
        await panel.getByText('不执行文件或命令操作', { exact: true }).filter({ visible: true }).waitFor();
        await panel.getByRole('button', { name: '返回聊天', exact: true }).click();
      }
      await card.waitFor();
      if (kind === 'question') {
        await card.getByRole('checkbox', { name: '草稿保留', exact: true }).click();
        await card.getByPlaceholder('输入你的答案').fill('DSHM_UNSUBMITTED_ANSWER');
      }
      const oldCard = await card.elementHandle();
      console.log(`timeout: ${kind} visible; waiting for original Host deadline`);
      const outcome = await result(id, 105000);
      assert.equal(outcome.error, 'ASK_ABORTED');
      assert.ok(Date.now() - started >= 89000, 'Must wait for the real fixture deadline');
      await card.waitFor({ state: 'detached' });
      assert.equal(await oldCard.evaluate(node => node.isConnected), false);
      await oldCard.dispose();
      await input.waitFor(); assert.equal(await readDraft(), draft);
      await page.screenshot({ path: `artifacts/interaction-timeout-${kind}-android.png` });
      report.timeouts.push({ kind, hostAborted: true, expiredCardRemoved: true, draftPreserved: true });
      console.log(`timeout: ${kind} passed`);
    }
    const recovery = await begin('question');
    const question = page.locator('[data-question-key]');
    await question.waitFor();
    assert.equal(await question.getByPlaceholder('输入你的答案').inputValue(), '');
    assert.equal(await question.getByRole('checkbox', { name: '草稿保留', exact: true }).getAttribute('aria-checked'), 'false');
    await question.getByRole('button', { name: '放弃整组问题', exact: true }).click();
    assert.equal((await result(recovery, 10000)).error, 'ASK_CANCELLED');
    await input.waitFor(); assert.equal(await readDraft(), draft);
    report.nextRequestIndependent = true;
  } finally {
    if (await panel.isVisible()) await panel.getByRole('button', { name: '返回聊天', exact: true }).click();
    await input.waitFor();
    // 只恢复本测试写入且未被外部修改的草稿。
    assert.equal(await readDraft(), draft);
    await input.press('ControlOrMeta+A'); await input.press('Backspace');
    if (original) await input.fill(original);
    await page.waitForFunction(value => {
      const node = document.querySelector('[data-testid="remote-workspace"] [contenteditable="true"][role="textbox"]');
      return node && (node.textContent === '' ? '' : node.innerText) === value;
    }, original);
    report.draftRestored = true;
  }
}
