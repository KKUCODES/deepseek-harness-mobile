import assert from 'node:assert/strict';

/** Uses real conversation tools on DSH-TEST only; no synthetic projection in Android. */
export async function verifyRemoteSchedules(page, live = false) {
  const report = { live }, original = await page.getByTestId('remote-workspace').locator('.remote-heading').innerText();
  const menu = async name => {
    await page.getByRole('button', { name: 'Remote 选项', exact: true }).click();
    await page.getByRole('button', { name, exact: true }).click();
  };
  const sheet = page.getByRole('dialog', { name: '定时任务', exact: true });
  const send = async (text, reply) => {
    await page.getByRole('textbox', { name: '消息', exact: true }).fill(text);
    await page.getByRole('button', { name: '发送消息', exact: true }).click();
    await page.getByRole('article', { name: '模型回复' }).getByText(reply, { exact: true }).waitFor({ timeout: 90000 });
    await page.getByRole('button', { name: '停止生成', exact: true }).waitFor({ state: 'detached', timeout: 60000 });
  };
  if (live) {
    assert.equal(process.env.DSHM_RUN_LIVE, '1');
    await menu('新建聊天');
    await page.getByRole('dialog', { name: '选择工作区', exact: true }).getByRole('button', { name: 'DSH-TEST', exact: true }).click();
    report.chat = `DSHM 定时任务联调 ${Date.now()}`;
    await menu('重命名聊天');
    await page.getByRole('textbox', { name: '聊天名称', exact: true }).fill(report.chat);
    await page.getByRole('button', { name: '保存名称', exact: true }).click();
    await send('这是专用定时提醒验证。仅调用 schedule_create 两次：第一条 after_seconds=60，prompt="只回复 DSHM_SCHEDULE_FIRED，不调用工具，不创建其他提醒。"；第二条 every_seconds=300，prompt="DSHM_SCHEDULE_REPEAT_TEST"。不使用任何其他工具、不写文件、不执行命令。两个工具成功后只回复 DSHM_SCHEDULE_READY。', 'DSHM_SCHEDULE_READY');
  }
  await menu('定时任务');
  await sheet.waitFor();
  if (live) {
    await sheet.getByText('每 5 分钟', { exact: true }).waitFor();
    await sheet.getByText('单次提醒', { exact: true }).waitFor();
    assert.equal(await sheet.getByRole('listitem').count(), 2);
    report.created = await sheet.innerText();
    await page.screenshot({ path: 'artifacts/remote-schedules-created-android.png' });
    await sheet.getByRole('button', { name: '关闭窗口', exact: true }).click();
    await send('只调用 schedule_delete 删除刚创建的 prompt 为 DSHM_SCHEDULE_REPEAT_TEST 的重复提醒，使用刚才工具返回的准确 id。保留单次提醒，不创建其他提醒，不使用其他工具。删除成功后只回复 DSHM_SCHEDULE_DELETED。', 'DSHM_SCHEDULE_DELETED');
    await menu('定时任务');
    await sheet.getByText('DSHM_SCHEDULE_REPEAT_TEST', { exact: true }).waitFor({ state: 'detached' });
    report.repeatDeleted = true;
    await sheet.getByText('当前没有待触发的定时任务。', { exact: true }).waitFor({ timeout: 90000 });
    report.dispatched = true;
  }
  report.text = await sheet.innerText();
  assert.equal(await sheet.evaluate(el => el.scrollWidth > el.clientWidth + 1), false);
  await page.screenshot({ path: 'artifacts/remote-schedules-android.png' });
  await sheet.getByRole('button', { name: '关闭窗口', exact: true }).click();
  if (live) {
    await page.getByRole('article', { name: '模型回复' }).getByText('DSHM_SCHEDULE_FIRED', { exact: true }).waitFor({ timeout: 60000 });
    report.reply = true;
    await page.getByRole('button', { name: '停止生成', exact: true }).waitFor({ state: 'detached', timeout: 60000 });
    await menu('归档聊天');
    if (await page.getByRole('region', { name: '聊天内容', exact: true }).count()) await page.getByRole('button', { name: '返回', exact: true }).click();
    await page.getByRole('button', { name: new RegExp(`^${original}`) }).click();
  }
  return report;
}
