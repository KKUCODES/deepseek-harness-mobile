import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { androidAppWebView } from '../../scripts/android-app-webview.mjs';

/** 真实write审批等待时结束独立UID；正常Launcher恢复同一待办或已结算结果。 */
export async function verifyOfficialApprovalProcessRecovery({ page, device, evidence, inference,
  packageName, title, mark, replacePage }) {
  assert.equal(packageName, 'dev.dshmobile.validation.officialtest');
  const scope = inference.approvalRecovery, report = { cases: [], completed: false };
  assert.equal(scope.processOnly, true);
  const save = () => writeFile(resolve(evidence, 'approval-process.json'), JSON.stringify(report, null, 2) + '\n');
  const delay = ms => new Promise(done => setTimeout(done, ms));
  const pid = async () => (await device.shell(`pidof ${packageName}`)).toString().trim();
  const pending = () => page.locator('[data-approval-key]');
  const editor = () => page.locator('[data-composer-input]');
  const permissions = () => page.getByRole('dialog', { name: '会话权限', exact: true });
  const permission = async name => {
    await page.getByRole('button', { name: 'Remote 选项', exact: true }).click();
    await page.getByRole('button', { name: '会话权限', exact: true }).click();
    await permissions().getByRole('button', { name, exact: true }).click();
    await permissions().getByText('当前权限：' + name, { exact: true }).waitFor();
    await permissions().getByRole('button', { name: '关闭窗口', exact: true }).click();
  };
  const reopen = async seed => {
    const launch = (await device.shell(`am start -W -a android.intent.action.MAIN -c android.intent.category.LAUNCHER -n ${packageName}/dev.dshmobile.validation.ValidationActivity`)).toString();
    assert.match(launch, /Status: ok/); seed.newPid = await pid();
    assert.match(seed.newPid, /^[1-9]\d*$/); assert.notEqual(seed.newPid, seed.oldPid);
    const ordinary = await (await androidAppWebView(device, packageName)).page();
    await ordinary.getByRole('button', { name: '打开侧边抽屉', exact: true }).waitFor();
    assert.equal(ordinary.context().pages().length, 1);
    await ordinary.getByRole('button', { name: '打开侧边抽屉', exact: true }).click();
    const opening = ordinary.context().waitForEvent('page', {
      predicate: target => target.url().startsWith('https://remote.dshm.invalid/'), timeout: 30000,
    });
    await ordinary.getByRole('button', { name: 'Remote', exact: true }).click();
    page = await opening; replacePage(page);
    await page.getByTestId('remote-workspace').waitFor({ timeout: 45000 });
    await page.locator('.remote-session-row').filter({ hasText: title }).click();
    await page.getByText(seed.prompt, { exact: true }).waitFor();
    assert.equal(await page.locator('iframe').count(), 0);
    assert.equal(await editor().innerText(), seed.draft);
    seed.normalLauncherAndOwnRemotePage = true; seed.draftPreserved = true;
  };
  try {
    await permission('仅可查看');
    for (const kind of ['pending', 'settled']) {
      const fileName = 'approval-process-' + kind + '.txt', path = resolve(inference.workspacePath, fileName);
      assert.equal(dirname(path), resolve(inference.workspacePath));
      const before = 'DSHM_APPROVAL_PROCESS_BEFORE', after = 'DSHM_APPROVAL_PROCESS_AFTER_' + randomUUID();
      const done = 'DSHM_PROCESS_APPROVAL_DONE_' + kind.toUpperCase();
      const rejected = 'DSHM_PROCESS_APPROVAL_REJECTED_' + kind.toUpperCase();
      await scope.prepare(fileName, before, after);
      const seed = { kind, fileName, before, after, initialSeq: await inference.beforeTool(), sent: false,
        draft: 'OFFICIAL_APPROVAL_PROCESS_DRAFT_' + kind };
      seed.prompt = `这是独立DSHM进程恢复审批测试，只执行本条请求。仅使用write工具把当前工作区${fileName}内容替换为${after}，可读取此文件，不执行命令或修改其他文件和权限。当前仅可查看，请申请本次写入的单次批准并等待。成功只回复${done}；若拒绝请立即停止，不重试或绕过，只回复${rejected}。`;
      report.cases.push(seed); await save();
      // 手机先留下草稿，电脑正常发起同一会话任务；不与发送锁定/审批输入接管竞争。
      await editor().fill(seed.draft); await delay(1000);
      seed.submission = await scope.start(seed.prompt); seed.sent = true;
      await page.getByText(seed.prompt, { exact: true }).waitFor();
      await pending().waitFor({ timeout: 180000 });
      assert.equal(await pending().count(), 1);
      seed.callId = await page.locator('[data-chat-call-id]').last().getAttribute('data-chat-call-id');
      assert.ok(seed.callId); await inference.verifyTool({ ...seed, pending: true });
      assert.equal(await readFile(path, 'utf8'), before);
      seed.observerBefore = (await scope.observe(seed.callId))[0];
      seed.checkpoint = await scope.checkpoint(seed);
      seed.oldPid = await pid(); assert.match(seed.oldPid, /^[1-9]\d*$/);
      await writeFile(resolve(evidence, 'approval-process-' + kind + '-pending.png'), await device.screenshot());
      if (kind === 'pending') await scope.release(seed.callId);
      await device.shell(`am force-stop ${packageName}`); assert.equal(await pid(), '');
      await delay(1000); assert.equal(await pid(), '');
      seed.whileAppDead = await scope.verifyCheckpoint({ ...seed, pending: true });
      assert.equal(await readFile(path, 'utf8'), before); seed.actualProcessEnded = true;
      if (kind === 'settled') {
        seed.otherDecision = await scope.answer(seed.callId);
        seed.replyWhileDead = await scope.settled(rejected);
        seed.outcome = 'reject'; seed.officialWhileDead = await inference.verifyTool(seed);
        assert.equal(await pid(), ''); assert.equal(await readFile(path, 'utf8'), before);
        seed.finalWhileDead = await scope.verifyCheckpoint({ ...seed, pending: false });
      }
      await reopen(seed); await delay(2000);
      if (kind === 'pending') {
        await pending().waitFor(); assert.equal(await pending().count(), 1);
        assert.equal(await page.locator('[data-chat-call-id]').last().getAttribute('data-chat-call-id'), seed.callId);
        seed.observerAfter = (await scope.observe(seed.callId))[0];
        assert.equal(seed.observerAfter.eventId, seed.observerBefore.eventId);
        assert.notEqual(seed.observerAfter.clientId, seed.observerBefore.clientId);
        seed.afterReopen = await scope.verifyCheckpoint({ ...seed, pending: true });
        assert.equal(await readFile(path, 'utf8'), before);
        await writeFile(resolve(evidence, 'approval-process-pending-restored.png'), await device.screenshot());
        await pending().getByRole('button', { name: '允许一次', exact: true }).click(); seed.outcome = 'allow';
      } else {
        assert.equal(await pending().count(), 0);
        seed.noStaleApprovalAfterReopen = true;
      }
      await pending().waitFor({ state: 'detached' });
      await page.getByRole('article', { name: '模型回复', exact: true })
        .getByText(seed.outcome === 'allow' ? done : rejected, { exact: true }).waitFor({ timeout: 180000 });
      await page.getByRole('button', { name: '停止生成', exact: true }).waitFor({ state: 'hidden', timeout: 180000 });
      const content = (await readFile(path, 'utf8')).trim(); assert.equal(content, seed.outcome === 'allow' ? after : before);
      seed.official = await inference.verifyTool(seed);
      seed.reply = await scope.settled(seed.outcome === 'allow' ? done : rejected);
      seed.final = await scope.verifyCheckpoint({ ...seed, pending: false });
      seed.duplicate = await scope.duplicate(seed.callId, seed.outcome);
      assert.equal((await readFile(path, 'utf8')).trim(), content);
      assert.equal(await editor().innerText(), seed.draft);
      await writeFile(resolve(evidence, 'approval-process-' + kind + '-settled.png'), await device.screenshot());
      await writeFile(path, before); seed.fileRestored = true;
      await scope.release(seed.callId); await editor().fill('');
      seed.passed = true; await save(); await mark('official-approval-process-' + kind + '-single-settlement');
    }
    await permission('工作区内修改'); report.completed = true;
  } catch (error) { report.failure = error.message; throw error; }
  finally { await save(); }
  return report;
}
