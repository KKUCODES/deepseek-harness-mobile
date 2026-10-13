import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

/** 沿真实手机聊天创建提醒、打开只读目录；电脑负责执行，手机不维护执行时钟。 */
export async function verifyOfficialSchedules({ page, device, evidence, inference, disconnect, reconnect, mark }) {
  const main = page.getByTestId('remote-workspace'), checks = inference.schedules;
  const editor = main.locator('[data-composer-input]');
  const report = { completed: false };
  const save = () => writeFile(resolve(evidence, 'schedules.json'), JSON.stringify(report, null, 2) + '\n');
  const sheet = page.getByRole('dialog', { name: '定时任务', exact: true });
  const rows = sheet.getByRole('list', { name: '当前聊天定时任务', exact: true }).getByRole('listitem');
  const open = async () => {
    await main.getByRole('button', { name: 'Remote 选项', exact: true }).click();
    await page.getByRole('dialog', { name: 'Remote 选项', exact: true })
      .getByRole('button', { name: '定时任务', exact: true }).click();
  };
  const waitRows = count => page.waitForFunction(count => {
    const root = document.querySelector('.remote-schedules');
    return root && !root.querySelector('[role="alert"]') && root.querySelectorAll('li').length === count;
  }, count, { timeout: 150000 });
  const verifyRows = async records => {
    await waitRows(records.length);
    const actual = await rows.evaluateAll(elements => elements.map(element => ({
      title: element.querySelector('strong').textContent,
      scheduledAt: element.querySelector('time').dateTime,
      prompt: element.querySelector('p').textContent,
      rule: element.querySelector('p.muted').textContent,
    })));
    assert.equal(actual.length, records.length);
    for (const record of records) {
      const row = actual.find(row => row.title === record.title);
      assert.ok(row); assert.equal(row.scheduledAt, record.scheduledAt); assert.equal(row.prompt, record.prompt);
      if (record.kind === 'after' || record.kind === 'at') assert.equal(row.rule, '单次提醒');
      if (record.kind === 'every') assert.match(row.rule, /每.*1.*小时/);
      if (record.kind === 'daily') assert.equal(row.rule, '每天 23:59:00（UTC）');
      if (record.kind === 'weekly') assert.match(row.rule, /每周.*周一.*周三.*周五.*23:59:00（UTC）/);
      if (record.kind === 'cron') assert.equal(row.rule, '自定义周期：59 23 * * *（UTC）');
    }
    assert.equal(await rows.evaluateAll(elements => elements.every(element => element.scrollWidth <= element.clientWidth)), true);
    return actual;
  };
  try {
    const seeds = await checks.initial(), before = await checks.history();
    await editor.fill(`请仅调用六次 schedule_create，每项使用以下完整参数，不重试，不调用其他工具。${JSON.stringify(seeds)}。六项创建完成后只回复 ${checks.marker}。`);
    await main.getByRole('button', { name: '发送消息', exact: true }).click();
    await main.locator('[data-composer-input][contenteditable="true"]').fill('DSHM_SCHEDULE_PRESERVED_DRAFT');
    report.created = await checks.created(before);
    await main.getByRole('button', { name: '停止生成', exact: true }).waitFor({ state: 'hidden' });
    await open(); report.initialRows = await verifyRows(report.created.records);
    await writeFile(resolve(evidence, 'schedule-six-rules.png'), await device.screenshot());
    await rows.last().scrollIntoViewIfNeeded();
    await writeFile(resolve(evidence, 'schedule-calendar-rules.png'), await device.screenshot());
    await mark('official-schedule-six-real-model-created-rules-and-phone-catalog');
    report.computerEdit = await checks.renameOnComputer();
    await sheet.getByText(report.computerEdit.title, { exact: true }).waitFor();
    report.editedRows = await verifyRows(report.computerEdit.records);
    const checkpoint = await checks.history();
    await disconnect(); await page.getByTestId('remote-offline-status').waitFor();
    await sheet.getByText('连接已断开，以下为最近收到的定时任务。', { exact: true }).waitFor();
    assert.equal(await rows.count(), 6);
    assert.equal(await sheet.getByText('待核对', { exact: true }).count(), 6);
    await reconnect();
    await page.getByTestId('remote-offline-status').waitFor({ state: 'detached', timeout: 45000 });
    report.reconnectedRows = await verifyRows(report.computerEdit.records);
    assert.deepEqual((await checks.history()).records, checkpoint.records);
    await writeFile(resolve(evidence, 'schedule-reconnected.png'), await device.screenshot());
    await mark('official-schedule-computer-edit-live-refresh-and-reconnect-no-replay');
    report.delivered = await checks.delivered(checkpoint);
    report.remainingRows = await verifyRows(report.delivered.records);
    await sheet.getByRole('button', { name: '关闭窗口', exact: true }).click();
    const reply = main.getByRole('article', { name: '模型回复', exact: true }).filter({ hasText: checks.deliveryToken }).last();
    await reply.waitFor(); await reply.scrollIntoViewIfNeeded();
    assert.equal(await editor.innerText(), 'DSHM_SCHEDULE_PRESERVED_DRAFT');
    const settled = await checks.history();
    await writeFile(resolve(evidence, 'schedule-real-delivery.png'), await device.screenshot());
    await mark('official-schedule-one-shot-real-delivery-history-and-model-reply');
    report.cleanup = await checks.cleanup();
    await open(); await waitRows(0);
    await sheet.getByText('当前没有待触发的定时任务。', { exact: true }).waitFor();
    assert.deepEqual((await checks.history()).records, settled.records);
    assert.equal(await page.locator('iframe').count(), 0);
    await sheet.getByRole('button', { name: '关闭窗口', exact: true }).click(); await editor.fill('');
    await mark('official-schedule-test-tasks-cleaned-with-original-chat-preserved');
    report.completed = true;
  } catch (error) { report.failure = error.message; throw error; }
  finally { await save(); }
  return report;
}
