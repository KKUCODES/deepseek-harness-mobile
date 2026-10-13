import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

/** 手机真实确认停止；故障点和第二条请求都经过原生产鉴权中转。 */
export async function verifyOfficialBackgroundStop({ page, device, evidence, inference, packageName, mark }) {
  assert.equal(packageName, 'dev.dshmobile.validation.officialtest');
  const control = inference.jobs.stop, main = page.getByTestId('remote-workspace');
  const jobs = page.getByRole('dialog', { name: '后台任务', exact: true });
  const report = { passed: false, cases: [], draft: 'DSHM_BACKGROUND_STOP_DRAFT' };
  const save = () => writeFile(resolve(evidence, 'background-stop.json'), JSON.stringify(report, null, 2) + '\n');
  const pid = async () => (await device.shell(`pidof ${packageName}`)).toString().trim();
  const snapshot = () => main.evaluate(element => {
    const key = Object.keys(element).find(name => name.startsWith('__reactFiber$'));
    for (let fiber = element[key]; fiber; fiber = fiber.return) if (fiber.memoizedProps?.model?.client) {
      const model = fiber.memoizedProps.model, state = model.getSnapshot();
      return { selected: state.selected, connection: state.connectionState, jobs: state.jobs,
        pending: [...model.jobActions.pending], uncertain: [...model.jobActions.uncertain] };
    }
    throw Error('official_background_stop_model_missing');
  });
  const rowFor = target => jobs.locator(`li[data-job-id="${target.jobId}"]`);
  const confirm = async target => {
    const row = rowFor(target);
    await row.getByRole('button', { name: '停止任务', exact: true }).click();
    await row.getByRole('button', { name: '确认停止任务', exact: true }).click();
  };
  try {
    report.appPid = await pid(); assert.match(report.appPid, /^[1-9]\d*$/);
    report.prepared = await control.prepare();
    await main.getByRole('button', { name: 'Remote 选项', exact: true }).click();
    await page.getByRole('button', { name: '会话权限', exact: true }).click();
    const permissions = page.getByRole('dialog', { name: '会话权限', exact: true });
    await permissions.getByRole('button', { name: '仅可查看', exact: true }).click();
    await permissions.getByText('当前权限：仅可查看', { exact: true }).waitFor();
    await permissions.getByRole('button', { name: '关闭窗口', exact: true }).click();
    report.sessionId = (await snapshot()).selected;
    for (const mode of ['before-forward', 'after-receipt', 'race']) {
      const item = { mode }, ready = `${control.marker}_${mode}_READY`;
      report.cases.push(item);
      const initialSeq = await inference.beforeTool();
      await main.locator('[data-composer-input]').fill(`这是DSHM官方纯插件后台停止联调，只执行本条。只调用一次pwsh，command严格为：${control.commands[mode]}。run_in_background=true、timeoutMs=180000。只请求本机自有测试服务，不读写文件、外网、凭据或权限；领取jobId后立即只回复${ready}，不等完成、不查job_output、不重试、不调用其他工具；任务结束也不要继续操作。`);
      await main.getByRole('button', { name: '发送消息', exact: true }).click();
      await main.getByRole('article', { name: '模型回复', exact: true }).getByText(ready, { exact: true }).first().waitFor({ timeout: 180000 });
      await main.getByRole('button', { name: '停止生成', exact: true }).waitFor({ state: 'hidden', timeout: 180000 });
      const state = await snapshot(), matches = state.jobs.rows[state.selected]
        .filter(job => job.kind === 'pwsh' && job.label === control.commands[mode]);
      assert.equal(matches.length, 1); assert.equal(matches[0].status, 'running'); assert.equal(matches[0].owner, state.selected);
      item.target = { jobId: matches[0].id, startedAt: matches[0].startedAt, initialSeq };
      item.started = await control.started(mode, item.target);
      await main.locator('[data-composer-input]').fill(report.draft);
      await main.getByRole('button', { name: 'Remote 选项', exact: true }).click();
      await page.getByRole('button', { name: '后台任务', exact: true }).click(); await jobs.waitFor();
      const row = rowFor(item.target);
      if (mode === 'race') {
        control.raceArm(); await confirm(item.target); await control.raceHeld(1);
        assert.equal(await row.getByRole('button', { name: '确认停止任务', exact: true }).isDisabled(), true);
        item.secondConnection = control.startPeer(); item.concurrent = await control.raceRelease();
      } else {
        control.arm(mode); await confirm(item.target); item.cut = await control.cut(mode); await save();
        await jobs.getByText('停止结果尚未确认，请重新连接并核对任务状态。', { exact: true }).waitFor({ timeout: 30000 });
        await jobs.getByText('连接已断开，以下为最近收到的任务状态。', { exact: true }).waitFor();
        const offlineStop = row.getByRole('button', { name: '停止任务', exact: true });
        item.offlineStopButtons = await offlineStop.count(); assert.ok(item.offlineStopButtons <= 1);
        if (item.offlineStopButtons) assert.equal(await offlineStop.isDisabled(), true);
        assert.equal((await snapshot()).pending.length, 0); item.unknownShownAndNoUsableOfflineStop = true;
        await writeFile(resolve(evidence, `background-stop-${mode}-unknown.png`), await device.screenshot());
        control.resume();
        await page.waitForFunction(() => document.querySelectorAll('[data-testid="remote-offline-status"]').length === 0,
          undefined, { timeout: 60000 });
        item.reconnected = await control.afterReconnect(mode);
        if (mode === 'before-forward') {
          await row.getByText('运行中', { exact: true }).waitFor();
          await confirm(item.target); item.explicitRetry = true;
        }
      }
      item.settled = await control.settled(mode);
      await row.getByText('已取消', { exact: true }).waitFor({ timeout: 30000 });
      await jobs.getByText('任务已取消。', { exact: true }).waitFor({ timeout: 30000 });
      assert.equal(await jobs.getByText('停止结果尚未确认，请重新连接并核对任务状态。', { exact: true }).count(), 0);
      item.terminalNoticeSettled = true;
      assert.equal(await row.getByRole('button', { name: '停止任务', exact: true }).count(), 0);
      assert.equal(await pid(), report.appPid); assert.equal((await snapshot()).selected, report.sessionId);
      assert.equal(await main.locator('[data-composer-input]').innerText(), report.draft);
      assert.equal(await page.locator('iframe').count(), 0);
      item.sameAppAndOriginalChatAndDraft = true; item.passed = true;
      await writeFile(resolve(evidence, `background-stop-${mode}-settled.png`), await device.screenshot());
      await jobs.getByRole('button', { name: '关闭窗口', exact: true }).click();
      await save(); await mark(`official-background-stop-${mode}-original-killed-and-no-replay`);
    }
    report.passed = true; return { stop: report };
  } catch (error) { report.failure = error.message; throw error; }
  finally { await save(); }
}
