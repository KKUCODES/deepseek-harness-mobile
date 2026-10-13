import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { verifyOfficialBackgroundControl } from './official-background-control.mjs';
import { verifyOfficialBackgroundHost } from './official-background-host.mjs';
import { verifyOfficialBackgroundStop } from './official-background-stop.mjs';

/** 真实后台进程由模型发起；手机和另一个中转客户端观察同一官方输出，不推进模型游标。 */
export async function verifyOfficialBackgroundOutput({ page, device, evidence, inference, disconnect, reconnect, mark, packageName, title, replacePage }) {
  if (inference.jobs.stop) return verifyOfficialBackgroundStop({ page, device, evidence, inference, packageName, mark });
  if (inference.jobs.host) return verifyOfficialBackgroundHost({ page, device, evidence, inference, packageName, mark });
  if (inference.jobs.control) return verifyOfficialBackgroundControl({ page, device, evidence,
    inference, disconnect, reconnect, mark, packageName, title, replacePage });
  const main = page.getByTestId('remote-workspace');
  const snapshot = () => main.evaluate(element => {
    const key = Object.keys(element).find(name => name.startsWith('__reactFiber$'));
    for (let fiber = element[key]; fiber; fiber = fiber.return) if (fiber.memoizedProps?.model?.client) {
      const model = fiber.memoizedProps.model, state = model.getSnapshot();
      return { selected: state.selected, jobs: state.jobs,
        reader: model.captureJobOutput?.().reader.snapshot };
    }
    throw Error('official_background_model_missing');
  });
  await main.getByRole('button', { name: 'Remote 选项', exact: true }).click();
  await page.getByRole('button', { name: '会话权限', exact: true }).click();
  const permissions = page.getByRole('dialog', { name: '会话权限', exact: true });
  await permissions.getByRole('button', { name: '仅可查看', exact: true }).click();
  await permissions.getByText('当前权限：仅可查看', { exact: true }).waitFor();
  await permissions.getByRole('button', { name: '关闭窗口', exact: true }).click();
  const initialSeq = await inference.beforeTool();
  const command = "Write-Output 'DSHM_BG_BEGIN'; Write-Error 'DSHM_BG_STDERR'; Start-Sleep -Seconds 45; Write-Output 'DSHM_BG_END'";
  await main.locator('[data-composer-input]').fill(`这是 DSHM 官方纯插件后台输出验收。只执行本条，不补做之前请求。只调用一次 pwsh，command 严格为：${command}。run_in_background=true，timeoutMs=60000。领取 jobId 后立即只回复 DSHM_BG_READY，不等待结束。Write-Error 是预期输出。不读写文件、联网、提权，不调用其他工具，不重试；之后收到完成通知也不要调用工具。`);
  await main.getByRole('button', { name: '发送消息', exact: true }).click();
  await main.getByRole('article', { name: '模型回复', exact: true }).filter({ hasText: 'DSHM_BG_READY' })
    .waitFor({ timeout: 180000 });
  await main.getByRole('button', { name: '停止生成', exact: true }).waitFor({ state: 'hidden', timeout: 180000 });
  const state = await snapshot();
  const matches = state.jobs.rows[state.selected].filter(job => job.kind === 'pwsh' && job.label === command);
  assert.equal(matches.length, 1);
  const job = matches[0];
  assert.equal(job.owner, state.selected);
  assert.equal(job.status, 'running');
  const target = { jobId: job.id, startedAt: job.startedAt, initialSeq, command };
  await inference.jobs.started(target);
  const openJobs = async () => {
    await main.getByRole('button', { name: 'Remote 选项', exact: true }).click();
    await page.getByRole('button', { name: '后台任务', exact: true }).click();
    const jobs = page.getByRole('dialog', { name: '后台任务', exact: true });
    await jobs.waitFor();
    return jobs;
  };
  const jobs = await openJobs();
  await jobs.locator('li[data-job-id]').filter({ hasText: command })
    .getByRole('button', { name: '查看实时输出', exact: true }).click();
  const output = page.getByRole('dialog', { name: '实时任务输出', exact: true });
  await output.waitFor();
  const text = () => output.getByLabel('独立任务输出', { exact: true });
  await text().filter({ hasText: 'DSHM_BG_BEGIN' }).waitFor();
  assert.ok(!(await text().innerText()).includes('DSHM_BG_STDERR'));
  await output.getByRole('button', { name: '错误输出', exact: true }).click();
  await text().filter({ hasText: 'DSHM_BG_STDERR' }).waitFor();
  assert.ok(!(await text().innerText()).includes('DSHM_BG_BEGIN'));
  assert.equal((await snapshot()).jobs.rows[state.selected].find(row => row.id === job.id).status, 'running');
  const live = await inference.jobs.output({ ...target, status: 'running' });
  await writeFile(resolve(evidence, 'background-running.png'), await device.screenshot());
  await mark('official-background-stdout-stderr-before-settlement');
  await output.getByRole('button', { name: '关闭任务输出', exact: true }).click();
  await jobs.getByRole('button', { name: '关闭窗口', exact: true }).click();
  const deadline = Date.now() + 75000;
  let completed;
  do {
    completed = (await snapshot()).jobs.rows[state.selected].find(row => row.id === job.id);
    if (completed.status === 'completed') break;
    assert.ok(Date.now() < deadline, 'official_background_did_not_complete');
    await new Promise(done => setTimeout(done, 250));
  } while (true);
  // 离开再进入输出窗口，通过官方环形缓存重读，不能只核对旧窗口的内存快照。
  const reopened = await openJobs();
  await reopened.locator('li[data-job-id]').filter({ hasText: command })
    .getByRole('button', { name: '查看实时输出', exact: true }).click();
  await text().filter({ hasText: 'DSHM_BG_END' }).waitFor();
  await output.getByText(/^输出已读完/).waitFor();
  const stdout = await text().innerText();
  const stdoutRaw = (await snapshot()).reader.text;
  assert.ok(stdout.includes('DSHM_BG_BEGIN'));
  assert.ok(!stdout.includes('DSHM_BG_STDERR'));
  await output.getByRole('button', { name: '错误输出', exact: true }).click();
  await text().filter({ hasText: 'DSHM_BG_STDERR' }).waitFor();
  await output.getByText(/^输出已读完/).waitFor();
  const stderr = await text().innerText();
  const stderrRaw = (await snapshot()).reader.text;
  assert.ok(!stderr.includes('DSHM_BG_BEGIN'));
  const settled = await inference.jobs.output({ ...target, status: 'completed',
    raw: { stdout: stdoutRaw, stderr: stderrRaw } });
  await writeFile(resolve(evidence, 'background-completed.png'), await device.screenshot());
  await output.getByRole('button', { name: '关闭任务输出', exact: true }).click();
  await reopened.getByRole('button', { name: '关闭窗口', exact: true }).click();
  await mark('official-background-completed-output-reopened');
  const report = { jobId: job.id, startedAt: job.startedAt, live, settled,
    readOnlyPreserved: true, twoIndependentObserversVerified: true,
    displayedChannelMarkersVerified: true, nonConsumingApi: 'JobRegistry.readAt' };
  await writeFile(resolve(evidence, 'background.json'), JSON.stringify(report, null, 2) + '\n');
  return report;
}
