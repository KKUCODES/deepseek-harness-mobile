import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

/** 真模型写入审批：断线重投、其他连接答复和两个独立连接的相反答复竞争。 */
export async function verifyOfficialApprovalRecovery({ page, device, evidence, inference, disconnect, reconnect, mark }) {
  const main = page.getByTestId('remote-workspace');
  const scope = inference.approvalRecovery;
  const pending = page.locator('[data-approval-key]');
  const report = { cases: [], completed: false };
  const save = () => writeFile(resolve(evidence, 'approval-recovery.json'), JSON.stringify(report, null, 2) + '\n');
  const permissions = page.getByRole('dialog', { name: '会话权限', exact: true });
  const openPermissions = async () => {
    await main.getByRole('button', { name: 'Remote 选项', exact: true }).click();
    await page.getByRole('button', { name: '会话权限', exact: true }).click();
  };
  try {
    await openPermissions();
    await permissions.getByText('当前权限：工作区内修改', { exact: true }).waitFor();
    await permissions.getByRole('button', { name: '仅可查看', exact: true }).click();
    await permissions.getByText('当前权限：仅可查看', { exact: true }).waitFor();
    await permissions.getByRole('button', { name: '关闭窗口', exact: true }).click();
    for (const kind of ['offline', 'other-client', 'race']) {
      const fileName = `approval-${kind}.txt`, path = resolve(inference.workspacePath, fileName);
      assert.equal(dirname(path), resolve(inference.workspacePath));
      const before = 'DSHM_APPROVAL_BEFORE', after = 'DSHM_APPROVAL_AFTER_' + randomUUID();
      await scope.prepare(fileName, before, after);
      const suffix = kind.replaceAll('-', '_').toUpperCase();
      const done = 'DSHM_APPROVAL_DONE_' + suffix, rejected = 'DSHM_APPROVAL_REJECTED_' + suffix;
      const seed = { kind, fileName, before, after, initialSeq: await inference.beforeTool(), sent: false };
      report.cases.push(seed); await save();
      await main.locator('[data-composer-input]').fill(`这是独立的 DSHM 审批验证，只执行本条请求。仅使用 write 工具把当前工作区 ${fileName} 内容替换为 ${after}。可以读取此文件；不要执行命令、修改其他文件或权限。当前仅可查看，请申请本次写入单次批准并等待。成功只回复 ${done}；若拒绝请立即停止，不重试或绕过，只回复 ${rejected}。`);
      await main.getByRole('button', { name: '发送消息', exact: true }).click();
      seed.sent = true; await save();
      await pending.waitFor({ timeout: 180000 });
      assert.equal(await pending.count(), 1);
      seed.callId = await main.locator('[data-chat-call-id]').last().getAttribute('data-chat-call-id');
      assert.ok(seed.callId);
      await inference.verifyTool({ ...seed, pending: true });
      assert.equal(await readFile(path, 'utf8'), before);
      seed.observers = await scope.observe(seed.callId, kind === 'race' ? 2 : 1);
      await save();
      if (kind === 'offline') {
        const originalEventId = seed.observers[0].eventId;
        await scope.release(seed.callId);
        await disconnect();
        await page.getByTestId('remote-offline-status').waitFor();
        // 本地渲染 key 可重建；离线不能保留可提交的旧审批按钮。
        await page.waitForFunction(() => [...document.querySelectorAll('[data-approval-key] button')]
          .every(button => button.disabled));
        assert.equal(await readFile(path, 'utf8'), before);
        await inference.verifyTool({ ...seed, pending: true });
        await reconnect();
        await page.getByTestId('remote-offline-status').waitFor({ state: 'detached', timeout: 45000 });
        await pending.waitFor();
        assert.equal(await pending.count(), 1);
        assert.equal(await main.locator('[data-chat-call-id]').last().getAttribute('data-chat-call-id'), seed.callId);
        seed.reconnectedObservers = await scope.observe(seed.callId);
        assert.equal(seed.reconnectedObservers[0].eventId, originalEventId);
        assert.notEqual(seed.reconnectedObservers[0].clientId, seed.observers[0].clientId);
        seed.originalEventRedelivered = true;
        await pending.getByRole('button', { name: '允许一次', exact: true }).click();
      } else if (kind === 'other-client') {
        seed.otherDecision = await scope.answer(seed.callId);
      } else {
        // 两条实际中转连接同时提交相反决定；手机只观察竞争结果，不冒充手机提交。
        seed.competingDecisions = await scope.compete(seed.callId);
      }
      await pending.waitFor({ state: 'detached' });
      await main.getByRole('article', { name: '模型回复', exact: true })
        .filter({ hasText: new RegExp(`DSHM_APPROVAL_(DONE|REJECTED)_${suffix}`) }).waitFor({ timeout: 180000 });
      await main.getByRole('button', { name: '停止生成', exact: true }).waitFor({ state: 'hidden', timeout: 180000 });
      const content = (await readFile(path, 'utf8')).trim();
      assert.ok([before, after].includes(content));
      seed.outcome = content === after ? 'allow' : 'reject';
      if (kind === 'offline') assert.equal(seed.outcome, 'allow');
      if (kind === 'other-client') assert.equal(seed.outcome, 'reject');
      seed.official = await inference.verifyTool(seed);
      seed.reply = await inference.verifyReply(seed.outcome === 'allow' ? done : rejected);
      seed.duplicate = await scope.duplicate(seed.callId, seed.outcome);
      assert.equal((await readFile(path, 'utf8')).trim(), content);
      assert.equal(await pending.count(), 0);
      await writeFile(resolve(evidence, `approval-${kind}.png`), await device.screenshot());
      await writeFile(path, before);
      seed.fileRestored = true;
      await scope.release(seed.callId);
      seed.passed = true; await save();
      await mark(`official-approval-${kind}-single-settlement`);
    }
    await openPermissions();
    await permissions.getByText('当前权限：仅可查看', { exact: true }).waitFor();
    await permissions.getByRole('button', { name: '工作区内修改', exact: true }).click();
    await permissions.getByText('当前权限：工作区内修改', { exact: true }).waitFor();
    await permissions.getByRole('button', { name: '关闭窗口', exact: true }).click();
    report.completed = true;
  } catch (error) { report.failure = error.message; throw error; }
  finally { await save(); }
  return report;
}
