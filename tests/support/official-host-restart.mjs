import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

/** 真模型write审批等待与已结算时结束官方测试Host；原手机进程自行重连。 */
export async function verifyOfficialHostRestart({ page, device, evidence, inference, packageName, mark }) {
  assert.equal(packageName, 'dev.dshmobile.validation.officialtest');
  const scope = inference.approvalRecovery, host = scope.hostRestart;
  assert.ok(host);
  const report = { restarts: [], completed: false };
  const save = () => writeFile(resolve(evidence, 'host-restart.json'), JSON.stringify(report, null, 2) + '\n');
  const pid = async () => (await device.shell(`pidof ${packageName}`)).toString().trim();
  const editor = () => page.locator('[data-composer-input]');
  const pending = () => page.locator('[data-approval-key]');
  const permission = async name => {
    await page.getByRole('button', { name: 'Remote 选项', exact: true }).click();
    await page.getByRole('button', { name: '会话权限', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: '会话权限', exact: true });
    await dialog.getByRole('button', { name, exact: true }).click();
    await dialog.getByText('当前权限：' + name, { exact: true }).waitFor();
    await dialog.getByRole('button', { name: '关闭窗口', exact: true }).click();
  };
  const offline = async item => {
    item.stop = await host.stop(); await save();
    await page.getByTestId('remote-offline-status').waitFor({ timeout: 30000 });
    await page.waitForFunction(() => [...document.querySelectorAll('[data-approval-key] button')]
      .every(button => button.disabled));
    assert.equal(await pid(), report.appPid);
    item.phoneOfflineAndOldApprovalDisabled = true;
    await writeFile(resolve(evidence, 'host-restart-' + item.phase + '-offline.png'), await device.screenshot());
  };
  const online = async item => {
    item.start = await host.start(); await save();
    await page.getByTestId('remote-offline-status').waitFor({ state: 'detached', timeout: 60000 });
    await pending().waitFor({ state: 'detached', timeout: 45000 });
    await page.getByText(report.seed.prompt, { exact: true }).waitFor();
    assert.equal(await pid(), report.appPid);
    assert.equal(await page.locator('iframe').count(), 0);
    assert.equal(await editor().innerText(), report.draft);
    await editor().click();
    await page.getByRole('button', { name: report.modelLabel, exact: true }).waitFor({ timeout: 30000 });
    assert.equal(await page.getByRole('button', { name: /^选择模型，当前 / }).getAttribute('aria-label'), report.modelLabel);
    item.sameAppAndOriginalChatAndDraftAndModel = true;
  };
  try {
    report.appPid = await pid(); assert.match(report.appPid, /^[1-9]\d*$/);
    await permission('仅可查看');
    const fileName = 'approval-host-restart.txt', path = resolve(inference.workspacePath, fileName);
    assert.equal(dirname(path), resolve(inference.workspacePath));
    const before = 'DSHM_HOST_RESTART_BEFORE', after = 'DSHM_HOST_RESTART_AFTER_' + randomUUID();
    await scope.prepare(fileName, before, after);
    const seed = report.seed = { fileName, before, after, initialSeq: await inference.beforeTool() };
    report.draft = 'OFFICIAL_HOST_RESTART_UNSENT_DRAFT';
    await editor().fill(report.draft);
    report.modelLabel = await page.getByRole('button', { name: /^选择模型，当前 / }).getAttribute('aria-label');
    await new Promise(done => setTimeout(done, 1000));
    seed.prompt = `这是独立DSHM电脑重启审批测试，只执行本条请求。仅使用write工具把当前工作区${fileName}内容替换为${after}，可读取此文件，不执行命令或修改其他文件和权限。当前仅可查看，请申请本次写入的单次批准并等待。成功只回复DSHM_HOST_INITIAL_DONE；若拒绝立即停止，不重试或绕过。`;
    seed.submission = await scope.start(seed.prompt);
    await page.getByText(seed.prompt, { exact: true }).waitFor();
    await pending().waitFor({ timeout: 180000 }); assert.equal(await pending().count(), 1);
    seed.callId = await page.locator('[data-chat-call-id]').last().getAttribute('data-chat-call-id');
    assert.ok(seed.callId); await inference.verifyTool({ ...seed, pending: true });
    assert.equal(await readFile(path, 'utf8'), before);
    seed.observer = (await scope.observe(seed.callId))[0]; seed.checkpoint = await scope.checkpoint(seed);
    await save();
    const waiting = { phase: 'waiting' }; report.restarts.push(waiting);
    await offline(waiting); assert.equal(await readFile(path, 'utf8'), before);
    await online(waiting);
    waiting.official = await host.recovered(seed);
    waiting.history = await scope.verifyCheckpoint({ ...seed, pending: false });
    const interrupted = page.locator('button[data-turn-process]').filter({ hasText: '已中断' });
    await interrupted.waitFor(); assert.equal(await interrupted.count(), 1);
    assert.equal(await interrupted.isDisabled(), true);
    assert.equal(await interrupted.getAttribute('aria-expanded'), 'true');
    const oldTool = page.locator(`[data-chat-call-id="${seed.callId}"]`);
    await oldTool.getByText(/The tool call was interrupted after it was recorded/).waitFor();
    waiting.interruptedLabelAndUnknownToolResultVisible = true;
    const oldNode = page.locator('[data-chat-flow-kind="tool-call"]').filter({ has: oldTool });
    await oldNode.locator('[data-tool-details]').click();
    const detail = page.getByRole('dialog', { name: '工具详情', exact: true });
    const diagnostic = detail.getByText(/The tool call was interrupted after it was recorded/);
    await diagnostic.waitFor();
    waiting.toolDetailFontPx = await diagnostic.evaluate(element => Number.parseFloat(getComputedStyle(element).fontSize));
    assert.ok(waiting.toolDetailFontPx >= 12);
    await writeFile(resolve(evidence, 'host-restart-waiting-detail.png'), await device.screenshot());
    await detail.getByRole('button', { name: '关闭工具详情', exact: true }).click();
    waiting.unknownToolDetailReadable = true;
    assert.equal(await readFile(path, 'utf8'), before);
    waiting.staleDecision = await host.staleDecision(seed.callId);
    assert.equal(await readFile(path, 'utf8'), before);
    await scope.release(seed.callId);
    await writeFile(resolve(evidence, 'host-restart-waiting-restored.png'), await device.screenshot());
    waiting.passed = true; await save(); await mark('official-host-restart-pending-approval-interrupted-without-replay');

    // 已核对原文件未写入；显式发起新请求与新审批，不重用已终止的批准。
    const retry = report.retry = { ...seed, initialSeq: await inference.beforeTool(), outcome: 'allow' };
    retry.prompt = `上次测试因电脑重启中断，已核对${fileName}仍是${before}。现在明确发起新的独立请求：仅使用write工具把此文件替换为${after}，可以读取此文件，不调用命令、不改其他文件或权限。当前仅可查看，请重新申请本次单次批准并等待。成功只回复DSHM_HOST_RETRY_DONE；拒绝立即停止，不绕过、不自行重试。`;
    retry.submission = await scope.start(retry.prompt);
    await pending().waitFor({ timeout: 180000 }); assert.equal(await pending().count(), 1);
    retry.callId = await page.locator('[data-chat-call-id]').last().getAttribute('data-chat-call-id');
    assert.ok(retry.callId); assert.notEqual(retry.callId, seed.callId);
    await inference.verifyTool({ ...retry, pending: true });
    retry.observer = (await scope.observe(retry.callId))[0];
    assert.notEqual(retry.observer.eventId, seed.observer.eventId);
    retry.checkpoint = await scope.checkpoint(retry);
    await pending().getByRole('button', { name: '允许一次', exact: true }).click();
    await pending().waitFor({ state: 'detached' });
    await page.getByRole('article', { name: '模型回复', exact: true })
      .getByText('DSHM_HOST_RETRY_DONE', { exact: true }).waitFor({ timeout: 180000 });
    retry.reply = await scope.settled('DSHM_HOST_RETRY_DONE');
    retry.official = await inference.verifyTool(retry);
    retry.history = await scope.verifyCheckpoint({ ...retry, pending: false });
    assert.equal((await readFile(path, 'utf8')).trim(), after);
    retry.duplicate = await scope.duplicate(retry.callId, 'allow');
    await scope.release(retry.callId); await save();
    await mark('official-host-restart-explicit-new-approval-executes-once');

    const settled = { phase: 'settled', checkpoint: await host.idleCheckpoint(retry.callId) };
    report.restarts.push(settled); await offline(settled);
    assert.equal((await readFile(path, 'utf8')).trim(), after);
    await online(settled);
    await page.getByRole('article', { name: '模型回复', exact: true })
      .getByText('DSHM_HOST_RETRY_DONE', { exact: true }).waitFor();
    settled.history = await host.verifyIdle(retry.callId);
    assert.equal((await readFile(path, 'utf8')).trim(), after);
    assert.equal(await pending().count(), 0);
    settled.passed = true;
    await writeFile(resolve(evidence, 'host-restart-settled-restored.png'), await device.screenshot());
    await writeFile(path, before); report.fileRestored = true;
    await editor().fill(''); await permission('工作区内修改');
    report.completed = true; await mark('official-host-restart-settled-history-and-results-without-replay');
  } catch (error) { report.failure = error.message; throw error; }
  finally { await save(); }
  return report;
}
