import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

/** 真实前台工具提供有界运行窗口；队列和停止均由手机提交，另读官方日志确认。 */
export async function verifyOfficialQueueControl({ page, device, evidence, inference, disconnect, reconnect, mark }) {
  const main = page.getByTestId('remote-workspace');
  const editor = main.locator('[data-composer-input]');
  const queue = page.getByLabel('待发送队列', { exact: true });
  const stamp = Date.now();
  const markers = Object.fromEntries(['original', 'edited', 'cancelled', 'steered', 'retained'].map(
    name => [name, `DSHM_QUEUE_${name.toUpperCase()}_${stamp}`]));
  const prompt = name => `请只回复 ${markers[name]}，不要调用工具。`;
  const report = { markers, completed: false, checks: [] };
  const save = () => writeFile(resolve(evidence, 'queue-control.json'), JSON.stringify(report, null, 2) + '\n');
  const snapshot = () => main.evaluate(element => {
    const key = Object.keys(element).find(name => name.startsWith('__reactFiber$'));
    for (let fiber = element[key]; fiber; fiber = fiber.return) if (fiber.memoizedProps?.model?.client) {
      const state = fiber.memoizedProps.model.getSnapshot();
      return { running: state.session?.running, inbox: state.inbox };
    }
    throw Error('official_queue_model_missing');
  });
  const check = async phase => {
    const value = await inference.queue.verify({ phase, phone: await snapshot(), markers });
    report.checks.push({ phase, ...value }); await save(); return value;
  };
  const enqueue = async name => {
    await editor.fill(prompt(name));
    await main.getByRole('button', { name: '加入队列', exact: true }).click();
    const row = queue.locator('.remote-queue-row').filter({ hasText: markers[name] });
    await row.getByText(prompt(name), { exact: true }).waitFor();
    return row;
  };
  const startTool = async (seconds, name) => {
    const initialSeq = await inference.beforeTool();
    const command = `Write-Output 'DSHM_QUEUE_${name}_BEGIN_${stamp}'; Start-Sleep -Seconds ${seconds}; Write-Output 'DSHM_QUEUE_${name}_END_${stamp}'`;
    await editor.fill(`这是 DSHM 官方纯插件队列验收。只调用一次 pwsh，command 严格为：${command}。run_in_background=false，timeoutMs=120000。不读写文件、联网、提权，不调用其他工具，不重试；命令结束后只回复 DSHM_QUEUE_TOOL_DONE_${stamp}。随后若收到新的用户消息，以新消息的要求为准。`);
    await main.getByRole('button', { name: '发送消息', exact: true }).click();
    await main.getByRole('button', { name: '停止生成', exact: true }).waitFor({ timeout: 45000 });
    const started = await inference.queue.running({ initialSeq, command });
    return { initialSeq, command, ...started };
  };
  try {
    await main.getByRole('button', { name: 'Remote 选项', exact: true }).click();
    await page.getByRole('button', { name: '会话权限', exact: true }).click();
    const permissions = page.getByRole('dialog', { name: '会话权限', exact: true });
    await permissions.getByRole('button', { name: '仅可查看', exact: true }).click();
    await permissions.getByText('当前权限：仅可查看', { exact: true }).waitFor();
    await permissions.getByRole('button', { name: '关闭窗口', exact: true }).click();
    report.tool = await startTool(45, 'NATURAL');
    await enqueue('original');
    const beforeEdit = await check('queued-original');
    report.editedId = beforeEdit.itemId;
    await queue.locator('.remote-queue-row').filter({ hasText: markers.original })
      .getByRole('button', { name: '编辑', exact: true }).click();
    await queue.getByRole('textbox', { name: '编辑排队消息', exact: true }).fill(prompt('edited'));
    await queue.getByRole('button', { name: '保存修改', exact: true }).click();
    await queue.getByText(prompt('edited'), { exact: true }).waitFor();
    assert.equal((await check('edited')).itemId, report.editedId);
    const cancelled = await enqueue('cancelled');
    report.cancelledId = (await check('queued-cancelled')).itemId;
    await cancelled.getByRole('button', { name: '取消排队', exact: true }).click();
    await cancelled.waitFor({ state: 'detached' });
    await check('removed-cancelled');
    const steered = await enqueue('steered');
    report.steeredId = (await check('queued-steered')).itemId;
    await steered.getByRole('button', { name: '立即引导', exact: true }).click();
    await steered.waitFor({ state: 'detached' });
    await check('steered-next-step');
    await editor.click();
    await main.getByRole('button', { name: /^选择模型，当前 / }).click();
    const models = page.getByRole('dialog', { name: '选择模型', exact: true });
    await models.getByText('回复进行中，结束后可切换模型。', { exact: true }).waitFor();
    const choices = await models.locator('button[aria-pressed]').all();
    assert.ok(choices.length > 0);
    for (const choice of choices) assert.equal(await choice.isEnabled(), false);
    await models.getByRole('button', { name: '关闭窗口', exact: true }).click();
    report.runningModelDisabled = true;
    await writeFile(resolve(evidence, 'queue-running.png'), await device.screenshot());
    await mark('official-phone-queue-edit-remove-and-steer-confirmed');
    for (const name of ['steered', 'edited']) {
      await main.getByRole('article', { name: '模型回复', exact: true })
        .getByText(markers[name], { exact: true }).waitFor({ timeout: 180000 });
    }
    await main.getByRole('button', { name: '停止生成', exact: true }).waitFor({ state: 'hidden', timeout: 180000 });
    await queue.waitFor({ state: 'detached' });
    report.settled = await inference.queue.settled({ ...report.tool, markers, editedId: report.editedId,
      cancelledId: report.cancelledId, steeredId: report.steeredId });
    await mark('official-only-edited-and-steered-messages-executed');

    report.stopTool = await startTool(60, 'STOP');
    await enqueue('retained');
    report.retainedId = (await check('queued-retained')).itemId;
    await main.getByRole('button', { name: '停止生成', exact: true }).click();
    await main.getByRole('button', { name: '停止生成', exact: true }).waitFor({ state: 'hidden', timeout: 30000 });
    report.stopped = await inference.queue.stopped({ ...report.stopTool, retainedId: report.retainedId });
    await queue.getByText(prompt('retained'), { exact: true }).waitFor();
    await check('stopped-retains-queue');
    await editor.fill('DSHM_QUEUE_OFFLINE_DRAFT');
    await disconnect();
    await page.getByTestId('remote-offline-status').waitFor();
    await reconnect();
    await page.getByTestId('remote-offline-status').waitFor({ state: 'detached', timeout: 45000 });
    await queue.getByText(prompt('retained'), { exact: true }).waitFor();
    assert.equal(await editor.innerText(), 'DSHM_QUEUE_OFFLINE_DRAFT');
    assert.equal((await check('reconnected-retains-queue')).itemId, report.retainedId);
    await queue.locator('.remote-queue-row').filter({ hasText: markers.retained })
      .getByRole('button', { name: '取消排队', exact: true }).click();
    await queue.waitFor({ state: 'detached' });
    await check('removed-retained');
    await editor.fill('');
    await writeFile(resolve(evidence, 'queue-stopped.png'), await device.screenshot());
    await mark('official-phone-stop-preserves-inbox-and-offline-recovery');
    report.completed = true;
  } catch (error) { report.failure = error.message; throw error; }
  finally { await save(); }
  return report;
}
