import assert from 'node:assert/strict';

/** 仅在专用会话做有限轮次、无工具目标验证；保留中间暂停状态供电脑页面核对。 */
export async function verifyRemoteGoals(page) {
  const create = process.env.DSHM_GOAL_NEW_NAME, existing = process.env.DSHM_GOAL_CHAT;
  if (create || existing) { assert.equal(process.env.DSHM_RUN_LIVE, '1'); assert.match(create || existing, /^DSHM 目标联调 /); }
  const original = (await page.getByTestId('remote-workspace').locator('.remote-heading').innerText()).split('\n')[0];
  const menu = async () => { await page.getByRole('button', { name: 'Remote 选项', exact: true }).click(); };
  if (create) {
    await menu(); await page.getByRole('button', { name: '新建聊天', exact: true }).click();
    await page.getByRole('dialog', { name: '选择工作区', exact: true }).getByRole('button', { name: 'DSH-TEST', exact: true }).click();
    await page.getByRole('dialog', { name: '选择工作区', exact: true }).waitFor({ state: 'detached' });
    await menu(); await page.getByRole('button', { name: '重命名聊天', exact: true }).click();
    await page.getByRole('textbox', { name: '聊天名称', exact: true }).fill(create);
    await page.getByRole('button', { name: '保存名称', exact: true }).click();
    await page.getByRole('dialog', { name: '重命名聊天', exact: true }).waitFor({ state: 'detached' });
    await page.getByRole('textbox', { name: '消息', exact: true }).fill('这是 DSHM 目标联调，仅回复 DSHM_GOAL_SESSION_READY，不调用任何工具。');
    await page.getByRole('button', { name: '发送消息', exact: true }).click();
    await page.getByRole('article', { name: '模型回复' }).filter({ hasText: 'DSHM_GOAL_SESSION_READY' }).waitFor({ timeout: 60000 });
    await page.getByRole('button', { name: '停止生成', exact: true }).waitFor({ state: 'detached' });
  } else if (existing) {
    await page.getByRole('button', { name: '返回', exact: true }).click();
    await page.getByRole('button', { name: new RegExp(`^${existing}`) }).click();
  }
  await menu(); await page.getByRole('button', { name: '当前目标', exact: true }).click();
  const sheet = page.getByRole('dialog', { name: '当前目标', exact: true });
  await sheet.getByRole('button', { name: '重新读取目标', exact: true }).waitFor();
  const report = { chat: create || existing || original };
  if (create) {
    await sheet.getByRole('textbox', { name: '目标内容', exact: true }).fill('这是 DSHM 目标生命周期联调，只回复 DSHM_GOAL_AUTO_READY，不调用任何工具，不修改文件，目标由用户暂停和完成。');
    await sheet.getByRole('spinbutton', { name: '最多执行轮次', exact: true }).fill('1');
    await sheet.getByRole('button', { name: '开始目标', exact: true }).click();
    await sheet.getByRole('button', { name: '暂停目标', exact: true }).click();
    await sheet.getByText('已暂停', { exact: true }).waitFor();
    report.createdAndPaused = true;
  } else if (existing) {
    await sheet.getByText('已暂停', { exact: true }).waitFor();
    await sheet.getByText(/DSHM_GOAL_PC_EDIT/).waitFor(); report.pcEditObserved = true;
    await sheet.getByRole('button', { name: '编辑目标', exact: true }).click();
    await sheet.getByRole('textbox', { name: '目标内容', exact: true }).fill('这是 DSHM 目标继续联调，只回复 DSHM_GOAL_RESUMED，不调用任何工具，不修改文件。');
    await sheet.getByRole('spinbutton', { name: '最多执行轮次', exact: true }).fill('2');
    await sheet.getByRole('button', { name: '保存目标', exact: true }).click();
    await sheet.getByRole('button', { name: '继续目标', exact: true }).click();
    await sheet.getByRole('button', { name: '暂停目标', exact: true }).waitFor();
    await sheet.getByRole('button', { name: '标记完成', exact: true }).click();
    await sheet.getByText('已完成', { exact: true }).waitFor();
    report.editedResumedCompleted = true;
    await sheet.getByRole('button', { name: '清除目标', exact: true }).click();
    await sheet.getByRole('button', { name: '取消清除', exact: true }).click();
    await sheet.getByText('已完成', { exact: true }).waitFor();
    await sheet.getByRole('button', { name: '清除目标', exact: true }).click();
    await sheet.getByRole('button', { name: '确认清除目标', exact: true }).click();
    await sheet.getByRole('button', { name: '开始目标', exact: true }).waitFor();
    report.cleared = true;
  } else {
    await sheet.getByRole('button', { name: '开始目标', exact: true }).waitFor();
    report.emptyState = true;
  }
  await page.screenshot({ path: 'artifacts/remote-goals-android.png' });
  await sheet.getByRole('button', { name: '关闭窗口', exact: true }).click();
  if (create || existing) {
    await page.getByRole('button', { name: '返回', exact: true }).click();
    await page.getByRole('button', { name: new RegExp(`^${original}`) }).click();
  }
  return report;
}
