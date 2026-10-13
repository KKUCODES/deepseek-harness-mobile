import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

/** 从手机实际选择PTC、新会话发送程序、打开结果并停止内层工具。 */
export async function verifyOfficialPtc({ page, device, evidence, inference, title, workspaceTitle, mark }) {
  const main = page.getByTestId('remote-workspace'), editor = main.locator('[data-composer-input]');
  const checks = inference.ptc, report = { completed: false };
  const marker = checks.marker, selected = () => main.evaluate(element => {
    const key = Object.keys(element).find(key => key.startsWith('__reactFiber$'));
    for (let fiber = element[key]; fiber; fiber = fiber.return)
      if (fiber.memoizedProps?.model?.client) return fiber.memoizedProps.model.getSnapshot().selected;
    throw Error('official_ptc_model_missing');
  });
  const send = async (code, reply, description) => {
    const initialSeq = await checks.before();
    await editor.fill(`这是 DSHM 纯官方 PTC 验收。只调用一次 run_code，description 为 ${description}，code 完整严格为 ${code}。timeoutMs=120000；遵守当前仅可查看权限，不要求提权，不读写文件、不联网、不调用其他工具、不重试。程序完成后只回复 ${reply}；如果用户停止则不要继续执行或补做。`);
    await main.getByRole('button', { name: '发送消息', exact: true }).click();
    return initialSeq;
  };
  try {
    report.prepared = await checks.prepare();
    await editor.fill('OFFICIAL_PTC_PARENT_DRAFT');
    await main.locator('.remote-topbar').getByRole('button', { name: '返回', exact: true }).click();
    await page.getByRole('button', { name: '在已有工作区新建聊天', exact: true }).click();
    await page.getByLabel('选择工作区', { exact: true }).getByRole('button', { name: workspaceTitle, exact: true }).click();
    await editor.waitFor();
    await main.getByRole('button', { name: 'Remote 选项', exact: true }).click();
    await page.getByRole('dialog', { name: 'Remote 选项', exact: true }).getByRole('button', { name: 'Agent 模式', exact: true }).click();
    const option = page.locator('[data-agent-preset="ptc"]');
    await option.waitFor(); assert.equal(await option.isEnabled(), true); await option.click();
    await page.locator('[data-agent-preset="ptc"][aria-pressed="true"]').waitFor();
    await page.getByRole('button', { name: '关闭窗口', exact: true }).click();
    await main.getByRole('button', { name: 'Remote 选项', exact: true }).click();
    await page.getByRole('dialog', { name: 'Remote 选项', exact: true }).getByRole('button', { name: '会话权限', exact: true }).click();
    const permissions = page.getByRole('dialog', { name: '会话权限', exact: true });
    await permissions.getByRole('button', { name: '仅可查看', exact: true }).click();
    await permissions.getByText('当前权限：仅可查看', { exact: true }).waitFor();
    await permissions.getByRole('button', { name: '关闭窗口', exact: true }).click();
    report.selected = await checks.select(await selected());
    await mark('official-phone-ptc-preset-in-new-readonly-session');

    const command = `Write-Output '${marker}_INNER'`, reply = marker + '_DONE', returned = marker + '_RETURN';
    const code = `console.log('${marker}_BEGIN'); const value = await tools.pwsh(${JSON.stringify({ command, description: 'DSHM PTC 输出测试文字', run_in_background: false, timeoutMs: 120000 })}); console.log(JSON.stringify(value)); return '${returned}';`;
    const initialSeq = await send(code, reply, 'DSHM PTC 自然完成');
    await main.getByRole('article', { name: '模型回复', exact: true }).filter({ hasText: reply }).waitFor({ timeout: 180000 });
    await main.getByRole('button', { name: '停止生成', exact: true }).waitFor({ state: 'hidden', timeout: 30000 });
    report.natural = await checks.settled({ initialSeq, code, command, reply, endMarker: marker + '_INNER', returnMarker: returned });
    const turn = main.locator('[data-turn-process]').last();
    if (await turn.getAttribute('aria-expanded') === 'false') await turn.click();
    for (const id of [report.natural.callId, report.natural.subCallId]) await main.locator(`[data-chat-call-id="${id}"]`).waitFor();
    await main.getByRole('button', { name: '工具详情', exact: true }).last().click();
    const details = page.getByRole('dialog', { name: '工具详情', exact: true });
    const output = await details.locator('.remote-tool-card').first().evaluate(node => {
      const clone = node.cloneNode(true);
      for (const child of clone.querySelectorAll(':scope > pre, :scope > details, :scope > summary, :scope > button')) child.remove();
      return clone.textContent;
    });
    // 排除参数源码和内层参数，标记必须来自实际根工具结果正文。
    assert.ok(output.includes(marker + '_INNER')); assert.ok(output.includes(returned));
    report.natural.actualResultBodyShown = true;
    await writeFile(resolve(evidence, 'ptc-natural-result.png'), await device.screenshot());
    await details.getByRole('button', { name: '关闭工具详情', exact: true }).click();
    await mark('official-ptc-real-program-inner-command-and-result-on-phone');

    const stopCommand = `Write-Output '${marker}_STOP_BEGIN'; Start-Sleep -Seconds 45; Write-Output '${marker}_STOP_END'`;
    const stopCode = `const value = await tools.pwsh(${JSON.stringify({ command: stopCommand, description: 'DSHM PTC 只读等待停止测试', run_in_background: false, timeoutMs: 120000 })}); console.log(JSON.stringify(value)); return '${marker}_STOP_RETURN';`;
    const stopReply = marker + '_SHOULD_NOT_REPLY', stopSeq = await send(stopCode, stopReply, 'DSHM PTC 内层等待');
    report.running = await checks.started(stopSeq, stopCode, stopCommand);
    await main.locator(`[data-chat-call-id="${report.running.subCallId}"]`).waitFor();
    // 现有发送键在有草稿时用于排队；空输入时才显示停止，父会话草稿另行核对。
    assert.equal(await editor.innerText(), '');
    await main.getByRole('button', { name: '停止生成', exact: true }).click();
    await main.getByRole('button', { name: '停止生成', exact: true }).waitFor({ state: 'hidden', timeout: 30000 });
    report.stopped = await checks.settled({ initialSeq: stopSeq, code: stopCode, command: stopCommand,
      reply: stopReply, stopped: true, endMarker: marker + '_STOP_END' });
    await main.locator('[data-turn-process]').last().getByText('已停止', { exact: true }).waitFor();
    assert.equal(await editor.innerText(), '');
    report.stopped.actualStoppedTurnShown = true; report.stopped.emptyDraftRemainsEmpty = true;
    await writeFile(resolve(evidence, 'ptc-nested-stopped.png'), await device.screenshot());
    await mark('official-phone-stops-real-ptc-inner-command-without-retry');

    await main.locator('.remote-topbar').getByRole('button', { name: '返回', exact: true }).click();
    await main.locator('.remote-session-row').filter({ hasText: title }).click();
    await editor.waitFor(); assert.equal(await editor.innerText(), 'OFFICIAL_PTC_PARENT_DRAFT');
    report.original = await checks.unchanged();
    assert.equal(await page.locator('iframe').count(), 0);
    await editor.fill(''); report.completed = true; report.parentDraftPreserved = true; report.iframeAbsent = true;
  } catch (error) { report.failure = error.message; throw error; }
  finally { await writeFile(resolve(evidence, 'ptc.json'), JSON.stringify(report, null, 2) + '\n'); }
  return report;
}
