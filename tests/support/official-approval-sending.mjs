import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

/** 在真实传输边界丢弃批准或确认；电脑记录与文件是结算依据，手机不自动重发。 */
export async function verifyOfficialApprovalSending({ page, device, evidence, inference, packageName, mark }) {
  assert.equal(packageName, 'dev.dshmobile.validation.officialtest');
  const scope = inference.approvalRecovery, transport = scope.sending;
  assert.ok(transport);
  const report = { cases: [], completed: false };
  const save = () => writeFile(resolve(evidence, 'approval-sending.json'), JSON.stringify(report, null, 2) + '\n');
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
  const settled = async (item, token) => {
    item.reply = await scope.settled(token);
    await pending().waitFor({ state: 'detached', timeout: 30000 });
    await page.getByRole('article', { name: '模型回复', exact: true })
      .getByText(token, { exact: true }).waitFor({ timeout: 30000 });
    item.official = await inference.verifyTool(item);
    item.history = await scope.verifyCheckpoint({ ...item, pending: false });
    assert.equal(await editor().innerText(), report.draft);
    await editor().click();
    await page.getByRole('button', { name: report.modelLabel, exact: true }).waitFor({ timeout: 30000 });
    assert.equal(await pid(), report.appPid);
    assert.equal(await page.locator('iframe').count(), 0);
    item.sameAppAndOriginalChatDraftAndModel = true;
  };
  try {
    report.appPid = await pid(); assert.match(report.appPid, /^[1-9]\d*$/);
    // 只订阅已存在的载体，不替换任何响应或生产方法；不记录令牌/票据/私钥。
    await page.getByTestId('remote-workspace').evaluate(element => {
      const key = Object.keys(element).find(name => name.startsWith('__reactFiber$'));
      for (let fiber = element[key]; fiber; fiber = fiber.return) if (fiber.memoizedProps?.model?.client) {
        const client = fiber.memoizedProps.model.client, events = [];
        const unsubscribe = client.subscribe(frame => {
          if (events.length < 128 && ['closed', 'ready'].includes(frame.type)) events.push({ at: Date.now(), type: frame.type, reason: frame.reason, hostOnline: frame.hostOnline });
        });
        window.__dshmApprovalTransportProbe = { events, unsubscribe, connected: () => client.connected }; return;
      }
      throw Error('real_remote_model_missing');
    });
    await permission('仅可查看');
    report.draft = 'OFFICIAL_APPROVAL_SENDING_UNSENT_DRAFT';
    report.modelLabel = await page.getByRole('button', { name: /^选择模型，当前 / }).getAttribute('aria-label');
    for (const mode of ['before-forward', 'after-receipt']) {
      const fileName = 'approval-send-' + mode + '.txt', path = resolve(inference.workspacePath, fileName);
      assert.equal(dirname(path), resolve(inference.workspacePath));
      const before = 'DSHM_SENDING_BEFORE_' + mode, after = 'DSHM_SENDING_AFTER_' + randomUUID();
      await scope.prepare(fileName, before, after);
      await editor().fill(report.draft);
      await new Promise(done => setTimeout(done, 1000));
      const doneToken = 'DSHM_SENDING_DONE_' + randomUUID().replaceAll('-', '');
      const rejectedToken = 'DSHM_SENDING_REJECTED_' + randomUUID().replaceAll('-', '');
      const item = { mode, fileName, before, after, initialSeq: await inference.beforeTool(), outcome: mode === 'before-forward' ? 'reject' : 'allow' };
      report.cases.push(item);
      item.prompt = `这是独立DSHM审批传输测试，只执行本条请求。仅使用write工具把当前工作区${fileName}内容替换为${after}，可读取此文件，不执行命令或修改其他文件和权限。当前仅可查看，请申请本次写入的单次批准并等待。成功只回复${doneToken}；若拒绝立即停止，不重试或绕过，只回复${rejectedToken}。`;
      item.submission = await scope.start(item.prompt);
      await page.getByText(item.prompt, { exact: true }).waitFor();
      await pending().waitFor({ timeout: 180000 }); assert.equal(await pending().count(), 1);
      item.callId = await page.locator('[data-chat-call-id]').last().getAttribute('data-chat-call-id');
      assert.ok(item.callId); await inference.verifyTool({ ...item, pending: true });
      assert.equal(await readFile(path, 'utf8'), before);
      item.observer = (await scope.observe(item.callId))[0];
      item.checkpoint = await scope.checkpoint(item);
      await transport.arm({ ...item.observer, mode }); await save();
      await pending().getByRole('button', { name: '允许一次', exact: true }).click();
      item.cut = await transport.cut(); await save();
      assert.equal(item.cut.callId, item.callId); assert.equal(item.cut.eventId, item.observer.eventId);
      assert.equal(item.cut.decision, 'allowed-once'); assert.equal(item.cut.socketClosed, true);
      assert.equal(item.cut.requestForwarded, mode === 'after-receipt');
      assert.notEqual(item.cut.clientId, item.observer.clientId);
      if (mode === 'before-forward') assert.equal(item.cut.receipt, undefined);
      else { assert.equal(item.cut.receipt.type, 'result'); assert.equal(item.cut.receipt.value.ok, true); }
      await page.getByTestId('remote-offline-status').waitFor({ timeout: 30000 });
      await page.waitForFunction(() => [...document.querySelectorAll('[data-approval-key] button')]
        .every(button => button.disabled), null, { timeout: 30000 });
      assert.equal(await pid(), report.appPid);
      item.phoneOfflineAndOldApprovalDisabled = true;
      await writeFile(resolve(evidence, 'approval-sending-' + mode + '-offline.png'), await device.screenshot());

      if (mode === 'before-forward') {
        item.offlineHistory = await scope.verifyCheckpoint({ ...item, pending: true });
        assert.equal(item.offlineHistory.currentRecords, item.checkpoint.records);
        assert.equal(await readFile(path, 'utf8'), before);
      } else {
        item.offlineReply = await scope.settled(doneToken);
        item.offlineHistory = await scope.verifyCheckpoint({ ...item, pending: false });
        item.offlineOfficial = await inference.verifyTool(item);
        assert.equal((await readFile(path, 'utf8')).trim(), after);
      }
      assert.equal((await transport.answers(item.observer.eventId)).length, 1);
      await transport.resume();
      await page.getByTestId('remote-offline-status').waitFor({ state: 'detached', timeout: 60000 });
      await page.getByText(item.prompt, { exact: true }).waitFor();
      if (mode === 'before-forward') {
        await pending().waitFor({ timeout: 30000 }); assert.equal(await pending().count(), 1);
        item.reconnectedHistory = await scope.verifyCheckpoint({ ...item, pending: true });
        assert.equal(item.reconnectedHistory.currentRecords, item.checkpoint.records);
        assert.equal(await readFile(path, 'utf8'), before);
        assert.equal((await transport.answers(item.observer.eventId)).length, 1);
        // 批准没有送达；重连后显式拒绝同一审批，证明旧批准不会被自动重放。
        await pending().getByRole('button', { name: '拒绝', exact: true }).click();
        await settled(item, rejectedToken);
        assert.equal(await readFile(path, 'utf8'), before);
        item.answers = await transport.answers(item.observer.eventId);
        assert.equal(item.answers.length, 2);
        assert.deepEqual(item.answers.map(answer => [answer.decision, answer.forwarded]), [['allowed-once', false], ['rejected', true]]);
        assert.notEqual(item.answers[0].clientId, item.answers[1].clientId);
      } else {
        await settled(item, doneToken);
        item.answers = await transport.answers(item.observer.eventId);
        assert.equal(item.answers.length, 1);
        assert.equal(item.answers[0].forwarded, true);
        assert.equal((await readFile(path, 'utf8')).trim(), after);
      }
      item.noAutomaticAnswerReplay = true;
      item.duplicate = await scope.duplicate(item.callId, item.outcome);
      await scope.release(item.callId);
      await writeFile(path, before); item.fileRestored = true; item.passed = true;
      await writeFile(resolve(evidence, 'approval-sending-' + mode + '-restored.png'), await device.screenshot());
      await save(); await mark('official-approval-sending-' + mode + '-without-replay');
    }
    await editor().fill(''); await permission('工作区内修改');
    report.completed = true;
  } catch (error) { report.failure = error.message; throw error; }
  finally {
    report.carrier = await page.evaluate(() => {
      const probe = window.__dshmApprovalTransportProbe;
      if (!probe) return null;
      const result = { events: probe.events, connected: probe.connected() };
      probe.unsubscribe(); delete window.__dshmApprovalTransportProbe; return result;
    }).catch(() => null);
    await save();
  }
  return report;
}
