import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { _android } from 'playwright';
import { androidAppWebView } from './android-app-webview.mjs';

// prepare 只发送一次；观察超时后继续 verify，绝不重放模型请求。
const action = process.argv[2] ?? 'inspect';
assert.ok(['inspect', 'prepare', 'verify', 'model-read', 'cleanup'].includes(action));
if (['prepare', 'verify', 'model-read'].includes(action)) assert.equal(process.env.DSHM_RUN_LIVE, '1');
const file = 'artifacts/stopped-job-output-seed.json';
const report = { at: new Date().toISOString(), action, errors: [] };
const device = (await _android.devices({ omitDriverInstall: true })).find(item => item.serial() === process.env.DSHM_ANDROID_SERIAL);
assert.ok(device);
let seed;
const save = () => writeFile(file, JSON.stringify(seed, null, 2));
const processAlive = pid => { try { process.kill(pid, 0); return true; } catch (error) { if (error.code === 'ESRCH') return false; throw error; } };
try {
  const first = await (await androidAppWebView(device)).page();
  const context = first.context();
  let page = context.pages().find(item => item.url().startsWith('https://remote.dshm.invalid/'));
  if (!page) {
    const ordinary = context.pages().find(item => item.url().startsWith('https://appassets.androidplatform.net/'));
    assert.ok(ordinary);
    if (!await ordinary.getByRole('dialog', { name: '侧边导航', exact: true }).count()) await ordinary.getByRole('button', { name: '打开侧边抽屉', exact: true }).click();
    const opened = context.waitForEvent('page');
    await ordinary.getByRole('button', { name: 'Remote', exact: true }).click(); await opened;
    page = context.pages().find(item => item.url().startsWith('https://remote.dshm.invalid/'));
  }
  assert.ok(page); page.setDefaultTimeout(20000);
  page.on('pageerror', error => report.errors.push(error.message));
  const heading = page.getByTestId('remote-workspace').locator('.remote-heading');
  const menu = async name => {
    await page.getByRole('button', { name: 'Remote 选项', exact: true }).click();
    await page.getByRole('button', { name, exact: true }).click();
  };
  const jobs = page.getByRole('dialog', { name: '后台任务', exact: true });
  const output = page.getByRole('dialog', { name: '实时任务输出', exact: true });
  const closeOutput = async () => {
    if (await output.count()) await output.getByRole('button', { name: '关闭任务输出', exact: true }).click();
  };
  if (action === 'inspect') report.text = (await page.locator('body').innerText()).slice(0, 1600);
  else {
    if (action === 'prepare') {
      try { const old = JSON.parse(await readFile(file, 'utf8')); assert.equal(old.cleaned, true, '上次测试尚未清理，请先观察，不能重复发送'); }
      catch (error) { if (error.code !== 'ENOENT') throw error; }
      await heading.waitFor();
      if (await heading.innerText() === 'Remote') await page.getByRole('button', { name: /^DSHM Remote 联调提示/ }).click();
      await heading.filter({ hasText: 'DSHM Remote 联调提示' }).waitFor();
      assert.equal(await heading.innerText(), 'DSHM Remote 联调提示');
      seed = { original: 'DSHM Remote 联调提示', title: `DSHM 停止输出联调 ${Date.now()}`,
        stopCommand: 'Write-Output "DSHM_STOP_PID=$PID"; Write-Error "DSHM_STOP_ERR 中文"; 1..45 | ForEach-Object { Write-Output "DSHM_STOP_TICK=$_"; Start-Sleep -Seconds 2 }; Write-Output "DSHM_STOP_UNEXPECTED_END"',
        keepCommand: 'Write-Output "DSHM_KEEP_PID=$PID"; 1..30 | ForEach-Object { Write-Output "DSHM_KEEP_TICK=$_"; Start-Sleep -Seconds 2 }; Write-Output "DSHM_KEEP_DONE 中文"' };
      await save();
      await menu('新建聊天');
      await page.getByRole('dialog', { name: '选择工作区', exact: true }).getByRole('button', { name: 'DSH-TEST', exact: true }).click();
      await menu('重命名聊天'); await page.getByRole('textbox', { name: '聊天名称', exact: true }).fill(seed.title);
      await page.getByRole('button', { name: '保存名称', exact: true }).click();
      await page.getByRole('dialog', { name: '重命名聊天', exact: true }).waitFor({ state: 'detached' });
      await page.getByRole('textbox', { name: '消息', exact: true }).fill(`这是DSHM停止任务与独立输出联调。只调用两次pwsh，两个都run_in_background=true，按顺序启动，不等待完成。第一次command精确为：${seed.stopCommand}。第二次command精确为：${seed.keepCommand}。不要读取或修改文件，不访问网络，不重试，不调用job_output。两次启动后只回复DSHM_STOP_PAIR_STARTED。用户会在手机停止第一个任务，请勿重启它。`);
      // 先记录已进入发送阶段，失败时由 verify 观察，不再次 prepare。
      seed.submittedAt = new Date().toISOString(); await save();
      await page.getByRole('button', { name: '发送消息', exact: true }).click();
    } else seed = JSON.parse(await readFile(file, 'utf8'));
    report.title = seed.title;
    assert.equal(await heading.innerText(), seed.title);
    if (['prepare', 'verify'].includes(action)) {
      const approval = page.getByRole('region', { name: '等待审批', exact: true });
      const started = page.getByRole('article', { name: '模型回复' }).filter({ hasText: 'DSHM_STOP_PAIR_STARTED' });
      const deadline = Date.now() + 90000;
      while (!(await started.count())) {
        assert.ok(Date.now() < deadline, '模型尚未确认两项启动，继续观察而不重发');
        if (await approval.count()) {
          const text = await approval.innerText();
          assert.match(text, /pwsh/);
          assert.ok(text.includes('DSHM_STOP_PID') || text.includes('DSHM_KEEP_PID'), '只能批准本次固定测试命令');
          await approval.getByRole('button', { name: '允许一次', exact: true }).click();
        }
        await new Promise(resolve => setTimeout(resolve, 250));
      }
      await closeOutput(); if (!await jobs.count()) await menu('后台任务');
      const stop = jobs.getByRole('listitem').filter({ hasText: seed.stopCommand });
      const keep = jobs.getByRole('listitem').filter({ hasText: seed.keepCommand });
      await stop.waitFor(); await keep.waitFor();
      seed.stopId = await stop.getAttribute('data-job-id'); seed.keepId = await keep.getAttribute('data-job-id'); await save();
      if (!seed.stopRequestedAt) {
        await stop.getByText('运行中', { exact: true }).waitFor(); await keep.getByText('运行中', { exact: true }).waitFor();
        await stop.getByRole('button', { name: '查看实时输出', exact: true }).click();
        await output.locator('pre').filter({ hasText: 'DSHM_STOP_TICK=' }).waitFor();
        seed.before = await output.locator('pre').innerText();
        seed.stopPid = Number(seed.before.match(/DSHM_STOP_PID=(\d+)/)?.[1]); assert.ok(seed.stopPid > 0); assert.ok(processAlive(seed.stopPid));
        await output.getByRole('button', { name: '错误输出', exact: true }).click();
        await output.locator('pre').filter({ hasText: 'DSHM_STOP_ERR 中文' }).waitFor();
        await closeOutput();
        await stop.getByRole('button', { name: '停止任务', exact: true }).click();
        await stop.getByRole('button', { name: '继续运行', exact: true }).click();
        assert.equal(await stop.getByText('运行中', { exact: true }).count(), 1); assert.ok(processAlive(seed.stopPid));
        report.cancelKeptRunning = true;
        await stop.getByRole('button', { name: '停止任务', exact: true }).click();
        seed.stopRequestedAt = new Date().toISOString(); await save();
        await stop.getByRole('button', { name: '确认停止任务', exact: true }).click();
      }
      if (!seed.stoppedAt) {
        // 确认请求的结果未知时只等待原终态，不能再次发送停止请求。
        await stop.getByText('已取消', { exact: true }).waitFor();
        assert.equal(processAlive(seed.stopPid), false, '电脑任务终态必须对应真实进程结束');
        seed.stoppedAt = new Date().toISOString(); await save();
      }
      await stop.getByRole('button', { name: '查看实时输出', exact: true }).click();
      await output.getByRole('status').filter({ hasText: '输出已读完' }).waitFor();
      report.stoppedOutput = await output.locator('pre').innerText();
      assert.ok(report.stoppedOutput.startsWith(seed.before)); assert.doesNotMatch(report.stoppedOutput, /DSHM_STOP_UNEXPECTED_END/);
      await output.getByRole('button', { name: '从头查看', exact: true }).click();
      await output.getByRole('status').filter({ hasText: '输出已读完' }).waitFor();
      assert.equal(await output.locator('pre').innerText(), report.stoppedOutput);
      await page.screenshot({ path: 'artifacts/stopped-job-output-stopped-android.png' });
      await output.getByRole('button', { name: '错误输出', exact: true }).click();
      await output.locator('pre').filter({ hasText: 'DSHM_STOP_ERR 中文' }).waitFor();
      report.stderrPreserved = true; await closeOutput();
      await keep.getByRole('button', { name: '查看实时输出', exact: true }).click();
      await output.locator('pre').filter({ hasText: 'DSHM_KEEP_TICK=' }).waitFor();
      const early = await output.locator('pre').innerText();
      const keepPid = Number(early.match(/DSHM_KEEP_PID=(\d+)/)?.[1]);
      assert.ok(keepPid > 0); assert.ok(processAlive(keepPid)); assert.doesNotMatch(early, /DSHM_KEEP_DONE/);
      await page.screenshot({ path: 'artifacts/stopped-job-output-retained-live-android.png' });
      await output.locator('pre').filter({ hasText: 'DSHM_KEEP_DONE 中文' }).waitFor({ timeout: 90000 });
      const complete = await output.locator('pre').innerText(); assert.ok(complete.length > early.length);
      await output.getByRole('status').filter({ hasText: '输出已读完' }).waitFor();
      assert.equal(processAlive(keepPid), false);
      await closeOutput(); await keep.getByText('已完成', { exact: true }).waitFor();
      report.unrelatedContinued = true; report.processStopped = true; report.completed = true;
      seed.verified = true; await save();
      await jobs.getByRole('button', { name: '关闭窗口', exact: true }).click();
    } else if (action === 'model-read') {
      assert.equal(seed.verified, true); assert.ok(!seed.modelReadRequestedAt, '不要重复发送模型读取请求');
      await page.getByRole('textbox', { name: '消息', exact: true }).fill(`只调用job_output读取已取消的任务${seed.stopId}，不要创建任务、访问文件或网络。读取后只回复DSHM_STOP_MODEL_READ_DONE。`);
      seed.modelReadRequestedAt = new Date().toISOString(); await save();
      await page.getByRole('button', { name: '发送消息', exact: true }).click();
      await page.getByRole('article', { name: '模型回复' }).filter({ hasText: 'DSHM_STOP_MODEL_READ_DONE' }).waitFor({ timeout: 60000 });
      await menu('后台任务');
      await jobs.locator(`[data-job-id="${seed.stopId}"]`).getByRole('button', { name: '查看输出记录', exact: true }).click();
      const records = page.getByRole('dialog', { name: '后台任务输出', exact: true });
      await records.locator('pre').filter({ hasText: 'DSHM_STOP_TICK=' }).waitFor();
      const text = (await records.locator('pre').allTextContents()).join('\n');
      assert.match(text, /DSHM_STOP_ERR 中文/); assert.doesNotMatch(text, /DSHM_STOP_UNEXPECTED_END/);
      report.modelReadPreserved = true;
      await records.getByRole('button', { name: '关闭任务输出', exact: true }).click();
      await jobs.getByRole('button', { name: '关闭窗口', exact: true }).click();
    } else {
      await closeOutput(); if (await jobs.count()) await jobs.getByRole('button', { name: '关闭窗口', exact: true }).click();
      await page.getByRole('button', { name: '停止生成', exact: true }).waitFor({ state: 'detached', timeout: 60000 });
      await menu('归档聊天');
      if (await page.getByRole('region', { name: '聊天内容', exact: true }).count()) await page.getByRole('button', { name: '返回', exact: true }).click();
      await page.getByRole('button', { name: new RegExp(`^${seed.original}`) }).click();
      seed.cleaned = true; await save(); report.restored = true;
    }
  }
} catch (error) { report.errors.push(error.stack); process.exitCode = 1; }
finally {
  report.finishedAt = new Date().toISOString();
  await writeFile(`artifacts/stopped-job-output-${action}-android.json`, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report)); await device.close();
}
