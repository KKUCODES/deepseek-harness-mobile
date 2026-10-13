import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { verifyOfficialPlannedDiff, verifyOfficialTurnReview } from './official-change-review.mjs';

/** 由真实模型申请两次单次写入，在手机允许/拒绝，并与官方日志及磁盘相互核对。 */
export async function verifyOfficialWriteApprovals({ page, device, evidence, inference, mark }) {
  const main = page.getByTestId('remote-workspace');
  const permissions = page.getByRole('dialog', { name: '会话权限', exact: true });
  const openPermissions = async () => {
    await main.getByRole('button', { name: 'Remote 选项', exact: true }).click();
    await page.getByRole('button', { name: '会话权限', exact: true }).click();
  };
  await openPermissions();
  await permissions.getByText('当前权限：工作区内修改', { exact: true }).waitFor();
  await permissions.getByRole('button', { name: '仅可查看', exact: true }).click();
  await permissions.getByText('当前权限：仅可查看', { exact: true }).waitFor();
  await permissions.getByRole('button', { name: '关闭窗口', exact: true }).click();
  const results = [];
  for (const outcome of ['allow', 'reject']) {
    const fileName = inference.pluginSourceWrite ? `creator-${outcome}.mjs` : `approval-${outcome}.txt`;
    const path = resolve(inference.workspacePath, fileName);
    assert.equal(dirname(path), resolve(inference.workspacePath));
    const before = inference.pluginSourceWrite ? 'export const marker = "DSHM_OFFICIAL_BEFORE";\n' : 'DSHM_OFFICIAL_BEFORE';
    const after = inference.pluginSourceWrite
      ? `export const name = 'dshm-creator-validation';\nexport function apply(ctx) { ctx.logger.info('DSHM_CREATOR_${randomUUID().slice(0, 8)}'); }`
      : 'DSHM_OFFICIAL_AFTER_' + randomUUID().slice(0, 8);
    await writeFile(path, before, { flag: 'wx' });
    if (inference.trackApprovalFixture) await inference.trackApprovalFixture({ fileName, before, after });
    if (inference.reviewPreview) await inference.reviewPreview.trackFixture({ fileName, before, after });
    const initialSeq = await inference.beforeTool();
    const token = 'DSHM_OFFICIAL_' + (outcome === 'allow' ? 'WRITE_DONE' : 'WRITE_REJECTED');
    const seed = { fileName, before, after, initialSeq, outcome, sent: false, answered: false };
    const save = () => writeFile(resolve(evidence, `approval-${outcome}.json`), JSON.stringify(seed, null, 2) + '\n');
    await save();
    try {
      await main.locator('[data-composer-input]').fill(`这是 DSHM 官方纯插件真实工具和审批验收。只执行本条消息，不补做之前请求。仅使用 write 工具把当前工作区文件 ${fileName} 的内容替换为 ${after}。可以读取该文件；不要执行命令、修改其他文件或权限。当前仅可查看，请正常申请本次写入的单次批准并等待。完成只回复 DSHM_OFFICIAL_WRITE_DONE；如果审批被拒绝，请立即停止，不重试，不用其他工具或路径绕过，并只回复 DSHM_OFFICIAL_WRITE_REJECTED。`);
      await main.getByRole('button', { name: '发送消息', exact: true }).click();
      seed.sent = true; await save();
      const pending = page.locator('[data-approval-key]');
      await pending.waitFor({ timeout: 180000 });
      assert.equal(await pending.count(), 1);
      assert.match(await pending.innerText(), /write|写入/i);
      seed.callId = await main.locator('[data-chat-call-id]').last().getAttribute('data-chat-call-id');
      const pendingProof = await inference.verifyTool({ ...seed, pending: true });
      const details = page.getByRole('dialog', { name: '工具详情', exact: true });
      await main.getByRole('button', { name: '工具详情', exact: true }).last().click();
      await details.getByText('write · 执行中', { exact: true }).waitFor();
      const fileButton = details.getByRole('button', { name: new RegExp('^打开文件：(?:.*[\\\\/])?' + fileName.replace('.', '\\.') + '$') });
      if (process.env.DSHM_OFFICIAL_ALPHA2_CHECK === '1'
        && !/^(?:[A-Za-z]:[\\/]|[\\/])/.test(pendingProof.argumentPath)) {
        // 新版只在结果确认目标后导航运行中的相对路径；预览仍显示原调用的实际修改。
        assert.equal(await fileButton.count(), 0);
        await details.getByText(fileName, { exact: true }).waitFor();
        await details.getByRole('button', { name: '查看本次修改', exact: true }).waitFor();
        seed.relativePathNavigationDeferred = true;
      } else await fileButton.waitFor();
      assert.ok((await details.innerText()).includes(after));
      await writeFile(resolve(evidence, `approval-${outcome}-diff.png`), await device.screenshot());
      if (inference.reviewPreview) {
        seed.plannedPreview = await verifyOfficialPlannedDiff({ page, device, evidence, seed, details });
        await save();
      } else await details.getByRole('button', { name: '关闭工具详情', exact: true }).click();
      assert.equal(await readFile(path, 'utf8'), before);
      const callIds = await main.locator('[data-chat-call-id]').evaluateAll(elements =>
        elements.map(element => element.getAttribute('data-chat-call-id')));
      seed.answerAttempted = true; await save();
      await pending.getByRole('button', { name: outcome === 'allow' ? '允许一次' : '拒绝', exact: true }).click();
      seed.answered = true; await save();
      await pending.waitFor({ state: 'detached' });
      await main.getByRole('article', { name: '模型回复', exact: true }).filter({ hasText: token })
        .waitFor({ timeout: 180000 });
      await main.getByRole('button', { name: '停止生成', exact: true }).waitFor({ state: 'hidden', timeout: 180000 });
      assert.equal((await readFile(path, 'utf8')).trim(), (outcome === 'allow' ? after : before).trim());
      if (inference.pluginSourceWrite) await promisify(execFile)(process.execPath, ['--check', path], { windowsHide: true });
      if (outcome === 'reject') assert.deepEqual(await main.locator('[data-chat-call-id]').evaluateAll(elements =>
        elements.map(element => element.getAttribute('data-chat-call-id'))), callIds);
      seed.finished = true; await save();
      const official = await inference.verifyTool({ ...seed });
      if (inference.reviewPreview && outcome === 'allow') {
        const record = await inference.reviewPreview.verify(seed);
        seed.turnReview = await verifyOfficialTurnReview({ page, device, evidence, seed, record });
        await save();
        await mark('official-actual-turn-review-and-current-file');
      }
      results.push({ ...official, fileName, diffPreviewVerified: true, diskContentVerified: true,
        ...(inference.reviewPreview ? { plannedPreview: seed.plannedPreview, ...(seed.turnReview ? { turnReview: seed.turnReview } : {}) } : {}),
        ...(inference.pluginSourceWrite ? { pluginSourceSyntaxVerified: true } : {}),
        ...(outcome === 'reject' ? { rejectedWithoutWrite: true, noToolRetry: true } : { actualWriteVerified: true }) });
      seed.passed = true; await save();
      await mark('official-real-write-approval-' + outcome);
    } finally {
      // 失败时保留现场供官方取消后核查；已结束的测试文件恢复原内容。
      if (seed.finished) { await writeFile(path, before); seed.fileRestored = true; await save(); }
    }
  }
  await openPermissions();
  await permissions.getByText('当前权限：仅可查看', { exact: true }).waitFor();
  await permissions.getByRole('button', { name: '工作区内修改', exact: true }).click();
  await permissions.getByText('当前权限：工作区内修改', { exact: true }).waitFor();
  await permissions.getByRole('button', { name: '关闭窗口', exact: true }).click();
  return results;
}
