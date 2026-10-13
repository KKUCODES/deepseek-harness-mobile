import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

/** 扩展检查单独记录；不重复审批测试，不把官方精确实时输出缺失写成已支持。 */
export async function verifyOfficialQuestionAndCommand({ page, device, evidence, inference, mark }) {
  const main = page.getByTestId('remote-workspace');
  const send = async text => {
    await main.locator('[data-composer-input]').fill(text);
    await main.getByRole('button', { name: '发送消息', exact: true }).click();
  };
  const finish = async token => {
    await main.getByRole('article', { name: '模型回复', exact: true }).filter({ hasText: token })
      .waitFor({ timeout: 180000 });
    await main.getByRole('button', { name: '停止生成', exact: true }).waitFor({ state: 'hidden', timeout: 180000 });
  };
  const results = [];
  const question = '请选择本次验收的颜色';
  let initialSeq = await inference.beforeTool();
  await send(`这是 DSHM 官方纯插件提问验收。只执行本条，不补做之前请求。只调用一次 ask_user_question，问题id为 color_check，正文为“${question}”，提供“蓝色”和“绿色”两个单选选项，不标记推荐项。等待用户选择后，只回复 DSHM_QUESTION_ANSWER_加选中的中文颜色。不要执行其他工具、读写文件或修改设置。`);
  const card = page.locator('[data-question-key]');
  await card.waitFor({ timeout: 180000 });
  assert.equal(await card.count(), 1);
  await card.getByText(question, { exact: true }).waitFor();
  await card.getByRole('radio', { name: '绿色', exact: true }).click();
  assert.equal(await card.getByRole('radio', { name: '绿色', exact: true }).getAttribute('aria-checked'), 'true');
  await writeFile(resolve(evidence, 'question-selected.png'), await device.screenshot());
  await card.getByRole('button', { name: '提交', exact: true }).click();
  await card.waitFor({ state: 'detached' });
  await finish('DSHM_QUESTION_ANSWER_绿色');
  results.push(await inference.extensions.verify({ initialSeq, kind: 'question', question }));
  await mark('official-question-answer-from-phone');
  await main.getByRole('button', { name: 'Remote 选项', exact: true }).click();
  await page.getByRole('button', { name: '会话权限', exact: true }).click();
  const permissions = page.getByRole('dialog', { name: '会话权限', exact: true });
  await permissions.getByRole('button', { name: '仅可查看', exact: true }).click();
  await permissions.getByText('当前权限：仅可查看', { exact: true }).waitFor();
  await permissions.getByRole('button', { name: '关闭窗口', exact: true }).click();
  initialSeq = await inference.beforeTool();
  const command = "Write-Output 'DSHM_STDOUT_OK'; Write-Error 'DSHM_STDERR_OK'; Write-Output 'DSHM_COMPLETE_OK'";
  await send(`这是 DSHM 官方纯插件只读命令结果验收。只执行本条，不补做之前请求。只调用一次 pwsh，command 严格为：${command}。run_in_background=false，timeoutMs=30000。Write-Error 是预期测试输出。不读写文件、联网、提权，不使用其他工具、不重试。完成只回复 DSHM_COMMAND_DONE。`);
  await finish('DSHM_COMMAND_DONE');
  const turn = main.getByRole('button', { name: /用时/ }).last();
  await turn.waitFor();
  if (await turn.getAttribute('aria-expanded') === 'false') await turn.click();
  await main.getByRole('button', { name: '工具详情', exact: true }).last().click();
  const details = page.getByRole('dialog', { name: '命令详情', exact: true });
  await details.waitFor();
  // 只核对输出正文；完整命令自身也包含标记，不能用整个弹窗文本冒充输出证据。
  const terminal = details.locator('[data-terminal]');
  const output = await terminal.count() ? terminal.locator(':scope > div:last-child')
    : details.locator('.remote-command-output');
  await output.waitFor();
  const outputText = await output.innerText();
  for (const marker of ['DSHM_STDOUT_OK', 'DSHM_STDERR_OK', 'DSHM_COMPLETE_OK']) {
    assert.ok(outputText.includes(marker), `手机命令输出缺少 ${marker}`);
  }
  assert.equal(await details.getByRole('group', { name: '命令输出视图', exact: true }).count(), 0);
  const result = await inference.extensions.verify({ initialSeq, kind: 'command', command });
  results.push({ ...result, phoneCompletedResultVerified: true, preciseLiveOutputOffered: false });
  await writeFile(resolve(evidence, 'command-result.png'), await device.screenshot());
  await details.getByRole('button', { name: '关闭命令详情', exact: true }).click();
  await mark('official-completed-command-output-on-phone');
  await writeFile(resolve(evidence, 'question-command.json'), JSON.stringify(results, null, 2) + '\n');
  return results;
}
