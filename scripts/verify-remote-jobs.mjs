import assert from 'node:assert/strict';

/** 通过 App 自有入口读取原后台进程镜像；可选的真实写入只发起有限时只读测试命令。 */
export async function verifyRemoteJobs(page, live, stop = false, output = false) {
  const original = await page.getByTestId('remote-workspace').locator('.remote-heading').innerText();
  const menu = async name => {
    await page.getByRole('button', { name: 'Remote 选项', exact: true }).click();
    await page.getByRole('button', { name, exact: true }).click();
  };
  const report = { live, stop };
  const command = `Start-Sleep -Seconds ${stop ? 60 : 25}; Write-Output "DSHM_BACKGROUND_DONE"`;
  if (live) {
    assert.equal(process.env.DSHM_RUN_LIVE, '1');
    const title = `DSHM 后台任务联调 ${Date.now()}`;
    report.chat = title;
    await menu('新建聊天');
    await page.getByRole('dialog', { name: '选择工作区', exact: true }).getByRole('button', { name: 'DSH-TEST', exact: true }).click();
    await menu('重命名聊天');
    await page.getByRole('textbox', { name: '聊天名称', exact: true }).fill(title);
    await page.getByRole('button', { name: '保存名称', exact: true }).click();
    await page.getByRole('dialog', { name: '重命名聊天', exact: true }).waitFor({ state: 'detached' });
    await page.getByRole('textbox', { name: '消息', exact: true }).fill(`这是 DSHM 后台任务联调。只调用一次 pwsh 工具，description 为 DSHM_BACKGROUND_VERIFY，command 精确使用 ${command}，run_in_background=true。不要读取或修改文件，不访问网络，不调用其他工具。若需要权限，只请求一次批准。后台任务成功启动后回复 DSHM_BACKGROUND_STARTED，不等待它结束。${stop ? '用户会在手机停止此任务，不要重启或重试任务。' : ''}`);
    await page.getByRole('button', { name: '发送消息', exact: true }).click();
    const started = page.getByRole('article', { name: '模型回复' }).filter({ hasText: 'DSHM_BACKGROUND_STARTED' });
    const approval = page.getByRole('region', { name: '等待审批', exact: true });
    await Promise.race([started.waitFor({ timeout: 60000 }), approval.waitFor({ timeout: 60000 })]);
    if (await approval.count()) {
      assert.match(await approval.innerText(), /pwsh/);
      await approval.getByRole('button', { name: '允许一次', exact: true }).click();
    }
  }
  await menu('后台任务');
  const sheet = page.getByRole('dialog', { name: '后台任务', exact: true });
  if (live) {
    // 原 pwsh 的 JobSnapshot.label 保存 command，而不是工具的 description。
    const job = sheet.getByRole('listitem').filter({ hasText: command });
    await job.getByText('运行中', { exact: true }).waitFor({ timeout: 60000 });
    report.jobId = await job.getAttribute('data-job-id');
    report.running = true;
    await page.screenshot({ path: 'artifacts/remote-jobs-running-android.png' });
    if (stop) {
      await job.getByRole('button', { name: '停止任务', exact: true }).click();
      await job.getByRole('button', { name: '继续运行', exact: true }).click();
      await job.getByText('运行中', { exact: true }).waitFor();
      await job.getByRole('button', { name: '停止任务', exact: true }).click();
      await job.getByRole('button', { name: '确认停止任务', exact: true }).click();
      await job.getByText('已取消', { exact: true }).waitFor({ timeout: 60000 });
      await sheet.getByText('任务已取消。', { exact: true }).waitFor();
      report.cancelConfirmed = true;
    } else {
      await job.getByText('已完成', { exact: true }).waitFor({ timeout: 60000 });
      report.completed = true;
    }
  }
  report.text = await sheet.innerText();
  assert.equal(await sheet.evaluate(el => el.scrollWidth > el.clientWidth + 1), false);
  await page.screenshot({ path: 'artifacts/remote-jobs-android.png' });
  if (stop) await page.screenshot({ path: 'artifacts/remote-job-stop-android.png' });
  await sheet.getByRole('button', { name: '关闭窗口', exact: true }).click();
  if (live && output && !stop) {
    await page.getByRole('button', { name: '停止生成', exact: true }).waitFor({ state: 'detached', timeout: 60000 });
    await page.getByRole('textbox', { name: '消息', exact: true }).fill(`只用 job_output 读取已存在的后台任务 ${report.jobId} 的输出，然后回复 DSHM_OUTPUT_READ_DONE。不要创建任务，不要读取或修改文件。`);
    await page.getByRole('button', { name: '发送消息', exact: true }).click();
    await page.getByRole('article', { name: '模型回复' }).filter({ hasText: 'DSHM_OUTPUT_READ_DONE' }).waitFor({ timeout: 90000 });
    await page.getByRole('button', { name: '停止生成', exact: true }).waitFor({ state: 'detached', timeout: 60000 });
    await menu('后台任务');
    await sheet.locator('[data-job-id]').filter({ hasText: command }).getByRole('button', { name: '查看输出记录', exact: true }).click();
    const detail = page.getByRole('dialog', { name: '后台任务输出', exact: true });
    await detail.locator('pre').filter({ hasText: 'DSHM_BACKGROUND_DONE' }).waitFor();
    report.output = await detail.locator('.remote-job-output-record').allTextContents();
    await detail.getByRole('button', { name: '放大窗口', exact: true }).click();
    assert.match(await detail.getAttribute('class'), /is-fullscreen/);
    assert.equal(await detail.evaluate(el => el.scrollWidth > el.clientWidth + 1), false);
    await page.screenshot({ path: 'artifacts/remote-job-output-android.png' });
    await detail.getByRole('button', { name: '缩小窗口', exact: true }).click();
    await detail.getByRole('button', { name: '关闭任务输出', exact: true }).click();
    await sheet.waitFor();
    await sheet.getByRole('button', { name: '关闭窗口', exact: true }).click();
    report.recordedOutputVerified = true;
  }
  if (live) {
    await page.getByRole('button', { name: '停止生成', exact: true }).waitFor({ state: 'detached', timeout: 60000 });
    await menu('归档聊天');
    if (await page.getByRole('region', { name: '聊天内容', exact: true }).count()) await page.getByRole('button', { name: '返回', exact: true }).click();
    await page.getByRole('button', { name: new RegExp(`^${original}`) }).click();
  }
  return report;
}
