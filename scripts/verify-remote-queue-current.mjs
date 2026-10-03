import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';

const reportUrl = new URL('../artifacts/remote-queue-current-android.json', import.meta.url);

/** 只接收已创建的专用测试聊天；真实生成期间操作电脑权威队列，不注入事件。 */
export async function verifyRemoteQueueCurrent(page, report, onProgress = () => {}) {
  assert.equal(page.url(), 'https://remote.dshm.invalid/assets/web/remote.html');
  assert.match(report.testTitle, /^DSHM 队列验收 \d+$/);
  const main = page.getByTestId('remote-workspace');
  const input = main.locator('[contenteditable=true]');
  const history = main.getByRole('region', { name: '聊天内容', exact: true });
  assert.equal(await main.locator('.remote-heading strong').innerText(), report.testTitle);
  assert.equal(await input.textContent(), '');
  await page.getByRole('button', { name: '发送消息', exact: true }).waitFor();
  const repliesBefore = await history.getByRole('article', { name: '模型回复', exact: true }).count();
  const stamp = Date.now();
  report.originalMarker = `DSHM_QUEUE_ORIGINAL_${stamp}`;
  report.editedMarker = `DSHM_QUEUE_EDITED_${stamp}`;
  report.cancelledMarker = `DSHM_QUEUE_CANCELLED_${stamp}`;
  const save = () => writeFile(reportUrl, JSON.stringify(report, null, 2) + '\n');
  try {
    await input.fill('这是队列验收的持续生成阶段。不要调用工具或提问，不操作文件。请按1至300逐行写中文句子，每行介绍一种颜色的使用场景，每句不少于15字。连续生成直到第300行。');
    await page.getByRole('button', { name: '发送消息', exact: true }).click();
    await page.getByRole('button', { name: '停止生成', exact: true }).waitFor({ timeout: 45000 });
    await page.waitForFunction(count => {
      const rows = [...document.querySelectorAll('article[aria-label="模型回复"]')];
      return rows.length > count && rows.at(-1).textContent.length > 80;
    }, repliesBefore, { timeout: 45000 });
    report.outputStartedBeforeQueue = true;
    await input.fill(`请只回复 ${report.originalMarker}，不调用工具。`);
    await page.getByRole('button', { name: '加入队列', exact: true }).click();
    const queue = page.getByLabel('待发送队列', { exact: true });
    await queue.getByRole('button', { name: '编辑', exact: true }).click();
    await queue.getByRole('textbox', { name: '编辑排队消息', exact: true }).fill(`请只回复 ${report.editedMarker}，不调用工具。`);
    await queue.getByRole('button', { name: '保存修改', exact: true }).click();
    await queue.getByText(`请只回复 ${report.editedMarker}，不调用工具。`, { exact: true }).waitFor();
    report.editObservedFromHost = true;
    await input.fill(`这条消息用于取消测试，取消后不应执行：${report.cancelledMarker}`);
    await page.getByRole('button', { name: '加入队列', exact: true }).click();
    const cancelled = queue.locator('.remote-queue-row').filter({ hasText: report.cancelledMarker });
    await cancelled.getByRole('button', { name: '取消排队', exact: true }).click();
    await cancelled.waitFor({ state: 'detached' });
    report.cancelObservedFromHost = true;
    await input.focus();
    await page.getByRole('button', { name: /^选择模型，当前/ }).click();
    const models = page.getByRole('dialog', { name: '选择模型', exact: true });
    await models.getByText('回复进行中，结束后可切换模型。', { exact: true }).waitFor();
    const choices = await models.locator('button[aria-pressed]').all();
    assert.ok(choices.length > 0);
    for (const choice of choices) assert.equal(await choice.isEnabled(), false);
    report.runningModelDisabled = true;
    await models.getByRole('button', { name: '关闭窗口', exact: true }).click();
    await save(); onProgress({ phase: 'edited-and-cancelled', runningModelDisabled: true });
    // 不调用 stop 改变原队列语义；让当前生成自然结束并执行保留的排队消息。
    await history.getByRole('article', { name: '模型回复', exact: true }).getByText(report.editedMarker, { exact: true }).waitFor({ timeout: 180000 });
    await page.getByRole('button', { name: '停止生成', exact: true }).waitFor({ state: 'detached', timeout: 30000 });
    await queue.waitFor({ state: 'detached' });
    const text = await history.innerText();
    assert.ok(!text.includes(report.originalMarker));
    assert.ok(!text.includes(report.cancelledMarker));
    report.onlyEditedMessageExecuted = true;
    report.draftEmpty = await input.textContent() === '';
    assert.equal(report.draftEmpty, true);
    assert.deepEqual(report.errors, []);
    report.completed = true;
  } catch (error) {
    report.failure = error.message;
    throw error;
  } finally { await save(); }
  return report;
}

export async function restoreAfterQueueCheck(page, report) {
  assert.equal(report.completed, true);
  assert.match(report.testTitle, /^DSHM 队列验收 \d+$/);
  const main = page.getByTestId('remote-workspace');
  assert.equal(await main.locator('.remote-heading strong').innerText(), report.testTitle);
  assert.equal(await page.getByRole('button', { name: '停止生成', exact: true }).count(), 0);
  await main.getByRole('button', { name: 'Remote 选项', exact: true }).click();
  await page.getByRole('button', { name: '归档聊天', exact: true }).click();
  await page.getByText(report.originalTitle, { exact: true }).click();
  await main.locator('.remote-heading strong').getByText(report.originalTitle, { exact: true }).waitFor();
  report.testArchived = true;
  await main.getByRole('article', { name: '模型回复', exact: true }).first().waitFor();
  assert.equal(await main.locator('[contenteditable=true]').textContent(), '');
  report.restoredReplies = await main.getByRole('article', { name: '模型回复', exact: true }).count();
  assert.ok(report.restoredReplies > 0);
  report.testArchived = true;
  report.restored = true;
  assert.deepEqual(report.errors, []);
  await writeFile(reportUrl, JSON.stringify(report, null, 2) + '\n');
}
