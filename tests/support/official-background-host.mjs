import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

/** 真实手机保持原进程；电脑任务的目录与缓存按新官方进程的实际能力恢复。 */
export async function verifyOfficialBackgroundHost({ page, device, evidence, inference, packageName, mark }) {
  assert.equal(packageName, 'dev.dshmobile.validation.officialtest');
  const host = inference.jobs.host, main = page.getByTestId('remote-workspace');
  const jobs = page.getByRole('dialog', { name: '后台任务', exact: true });
  const output = page.getByRole('dialog', { name: '实时任务输出', exact: true });
  const report = { passed: false, cases: [], draft: 'DSHM_BACKGROUND_HOST_DRAFT' };
  const save = () => writeFile(resolve(evidence, 'background-host.json'), JSON.stringify(report, null, 2) + '\n');
  const pid = async () => (await device.shell(`pidof ${packageName}`)).toString().trim();
  const snapshot = () => main.evaluate(element => {
    const key = Object.keys(element).find(name => name.startsWith('__reactFiber$'));
    for (let fiber = element[key]; fiber; fiber = fiber.return) if (fiber.memoizedProps?.model?.client) {
      const model = fiber.memoizedProps.model, state = model.getSnapshot();
      return { selected: state.selected, jobs: state.jobs, reader: model.captureJobOutput?.()?.reader.snapshot };
    }
    throw Error('official_background_host_model_missing');
  });
  const openJobs = async () => {
    await main.getByRole('button', { name: 'Remote 选项', exact: true }).click();
    await page.getByRole('button', { name: '后台任务', exact: true }).click(); await jobs.waitFor();
  };
  try {
    report.appPid = await pid(); assert.match(report.appPid, /^[1-9]\d*$/);
    report.prepared = await host.prepare();
    await main.getByRole('button', { name: 'Remote 选项', exact: true }).click();
    await page.getByRole('button', { name: '会话权限', exact: true }).click();
    const permissions = page.getByRole('dialog', { name: '会话权限', exact: true });
    await permissions.getByRole('button', { name: '仅可查看', exact: true }).click();
    await permissions.getByText('当前权限：仅可查看', { exact: true }).waitFor();
    await permissions.getByRole('button', { name: '关闭窗口', exact: true }).click();
    report.sessionId = (await snapshot()).selected;
    for (const mode of ['running', 'settled']) {
      const item = { mode }, ready = `${host.marker}_${mode}_READY`;
      report.cases.push(item);
      const initialSeq = await inference.beforeTool();
      const prompt = `这是DSHM官方纯插件电脑退出后台测试，只执行本条。只调用一次pwsh，command严格为：${host.commands[mode]}。run_in_background=true、timeoutMs=180000。只请求本机自有测试服务，不读写文件、外网、凭据或权限；领取jobId后立即只回复${ready}，不等完成、不查询job_output、不重试、不调用其他工具；任务结束也不要继续操作。`;
      await main.locator('[data-composer-input]').fill(prompt);
      await main.getByRole('button', { name: '发送消息', exact: true }).click();
      await main.getByRole('article', { name: '模型回复', exact: true }).getByText(ready, { exact: true }).first().waitFor({ timeout: 180000 });
      await main.getByRole('button', { name: '停止生成', exact: true }).waitFor({ state: 'hidden', timeout: 180000 });
      const state = await snapshot(), matches = state.jobs.rows[state.selected]
        .filter(job => job.kind === 'pwsh' && job.label === host.commands[mode]);
      assert.equal(matches.length, 1); assert.equal(matches[0].status, 'running');
      assert.equal(matches[0].owner, state.selected);
      item.target = { jobId: matches[0].id, startedAt: matches[0].startedAt, initialSeq };
      item.started = await host.started(mode, item.target);
      await main.locator('[data-composer-input]').fill(report.draft);
      await openJobs();
      const row = jobs.locator(`li[data-job-id="${item.target.jobId}"]`);
      await row.getByRole('button', { name: '查看实时输出', exact: true }).click();
      await output.getByLabel('独立任务输出', { exact: true }).filter({ hasText: `${host.marker}_${mode}_BEGIN` }).waitFor();
      if (mode === 'settled') {
        item.released = host.release(mode); item.completed = await host.completed(item.target);
        await output.getByText(/^输出已读完/).waitFor({ timeout: 30000 });
        await output.getByLabel('独立任务输出', { exact: true }).filter({ hasText: `${host.marker}_settled_END` }).waitFor();
      }
      item.beforeOutput = (await snapshot()).reader;
      item.stop = await host.stop(mode); await save();
      await output.getByTestId('remote-offline-status').waitFor({ timeout: 30000 });
      assert.equal(await pid(), report.appPid);
      assert.equal(await output.getByRole('button', { name: '标准输出', exact: true }).isDisabled(), true);
      item.offlineShownAndReadsPaused = true;
      await writeFile(resolve(evidence, `background-host-${mode}-offline.png`), await device.screenshot());
      item.start = await host.start(); await save();
      await page.waitForFunction(() => document.querySelectorAll('[data-testid="remote-offline-status"]').length === 0,
        undefined, { timeout: 60000 });
      await main.locator('[data-composer-input]').waitFor({ timeout: 45000 });
      await main.getByRole('article', { name: '模型回复', exact: true }).getByText(ready, { exact: true }).first().waitFor();
      assert.equal(await pid(), report.appPid); assert.equal((await snapshot()).selected, report.sessionId);
      assert.equal(await main.locator('[data-composer-input]').innerText(), report.draft);
      assert.equal(await page.locator('iframe').count(), 0);
      if (await output.count()) {
        await output.getByText('任务已变化，请返回任务列表重新查看。', { exact: true }).waitFor({ timeout: 30000 });
        assert.equal((await snapshot()).reader.phase, 'error');
        await output.getByRole('button', { name: '重新读取', exact: true }).click();
        assert.equal((await snapshot()).reader.phase, 'error');
        item.oldOutputInvalidatedAndRetryRefused = true;
        await writeFile(resolve(evidence, `background-host-${mode}-output-stale.png`), await device.screenshot());
        await output.getByRole('button', { name: '关闭任务输出', exact: true }).click();
      } else item.oldOutputWindowClosed = true;
      if (!await jobs.count()) await openJobs();
      await jobs.getByText('当前没有后台任务。', { exact: true }).waitFor({ timeout: 30000 });
      assert.equal(await jobs.locator('li[data-job-id]').count(), 0);
      assert.equal((await snapshot()).jobs.rows[report.sessionId]?.length ?? 0, 0);
      item.recovered = await host.recovered(mode);
      item.sameAppAndOriginalChatAndDraft = true; item.officialEmptyRosterShown = true; item.passed = true;
      await writeFile(resolve(evidence, `background-host-${mode}-restored.png`), await device.screenshot());
      await jobs.getByRole('button', { name: '关闭窗口', exact: true }).click();
      await save(); await mark(`official-background-host-${mode}-exit-empty-roster-old-output-refused-and-no-replay`);
    }
    assert.equal(await main.locator('[data-composer-input]').innerText(), report.draft);
    report.passed = true; return { host: report };
  } catch (error) { report.failure = error.message; throw error; }
  finally { await save(); }
}
