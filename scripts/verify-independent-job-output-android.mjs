import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { _android } from 'playwright';
import { androidAppWebView } from './android-app-webview.mjs';

// run 只创建一次专用后台任务；中断后使用 observe，不重新发送模型请求。
const action = process.argv[2] ?? 'inspect';
assert.ok(['inspect', 'run', 'observe', 'model-read', 'cleanup'].includes(action));
if (action === 'run' || action === 'model-read') assert.equal(process.env.DSHM_RUN_LIVE, '1');
const device = (await _android.devices({ omitDriverInstall: true })).find(item => item.serial() === process.env.DSHM_ANDROID_SERIAL);
assert.ok(device);
const prefix = process.env.DSHM_OUTPUT_CASE === 'source-start' ? 'source-start-job-output'
  : process.env.DSHM_OUTPUT_CASE === 'host-restart' ? 'post-restart-job-output' : 'independent-job-output';
const seedPath = `artifacts/${prefix}-seed.json`;
const report = { at: new Date().toISOString(), action, errors: [] };
try {
  const first = await (await androidAppWebView(device)).page(), context = first.context();
  let page = context.pages().find(item => item.url().startsWith('https://remote.dshm.invalid/'));
  if (!page) {
    const ordinary = context.pages().find(item => item.url().startsWith('https://appassets.androidplatform.net/'));
    assert.ok(ordinary);
    await ordinary.getByRole('button', { name: '打开侧边抽屉', exact: true }).click();
    const opened = context.waitForEvent('page');
    await ordinary.getByRole('button', { name: 'Remote', exact: true }).click(); await opened;
    page = context.pages().find(item => item.url().startsWith('https://remote.dshm.invalid/'));
  }
  assert.ok(page); page.setDefaultTimeout(20000);
  page.on('pageerror', error => report.errors.push(error.message));
  const menu = async name => {
    await page.getByRole('button', { name: 'Remote 选项', exact: true }).click();
    await page.getByRole('button', { name, exact: true }).click();
  };
  if (action === 'inspect') {
    report.text = (await page.locator('body').innerText()).slice(0, 2200);
  } else {
    let seed;
    if (action === 'run') {
      if ((await page.getByTestId('remote-workspace').locator('.remote-heading').innerText()) === 'Remote')
        await page.getByRole('button', { name: /^DSHM Remote 联调提示/ }).click();
      await page.getByTestId('remote-workspace').locator('.remote-heading').filter({ hasText: 'DSHM Remote 联调提示' }).waitFor();
      const original = await page.getByTestId('remote-workspace').locator('.remote-heading').innerText();
      assert.equal(original, 'DSHM Remote 联调提示');
      seed = { original, title: `DSHM 独立输出联调 ${Date.now()}`, command: 'Write-Output "DSHM_STREAM_BEGIN 中文"; Write-Error "DSHM_STREAM_ERR 中文"; Start-Sleep -Seconds 35; Write-Output "DSHM_STREAM_END 完成"' };
      await writeFile(seedPath, JSON.stringify(seed, null, 2));
      await menu('新建聊天');
      await page.getByRole('dialog', { name: '选择工作区', exact: true }).getByRole('button', { name: 'DSH-TEST', exact: true }).click();
      await menu('重命名聊天');
      await page.getByRole('textbox', { name: '聊天名称', exact: true }).fill(seed.title);
      await page.getByRole('button', { name: '保存名称', exact: true }).click();
      await page.getByRole('dialog', { name: '重命名聊天', exact: true }).waitFor({ state: 'detached' });
      await page.getByRole('textbox', { name: '消息', exact: true }).fill(`这是 DSHM 独立后台输出验证。只调用一次 pwsh，command 精确为：${seed.command}。run_in_background=true，description=DSHM_INDEPENDENT_OUTPUT。不要读取或修改文件，不访问网络，不重试，不调用 job_output；任务启动后立即回复 DSHM_OUTPUT_STARTED，不等待结束。Write-Error 是预期的标准错误输出测试。`);
      await page.getByRole('button', { name: '发送消息', exact: true }).click();
      const approval = page.getByRole('region', { name: '等待审批', exact: true });
      const started = page.getByRole('article', { name: '模型回复' }).filter({ hasText: 'DSHM_OUTPUT_STARTED' });
      await Promise.race([started.waitFor({ timeout: 60000 }), approval.waitFor({ timeout: 60000 })]);
      if (await approval.count()) {
        assert.match(await approval.innerText(), /pwsh/);
        await approval.getByRole('button', { name: '允许一次', exact: true }).click();
      }
      await started.waitFor({ timeout: 60000 });
    } else {
      seed = JSON.parse(await readFile(seedPath, 'utf8'));
      if ((await page.getByTestId('remote-workspace').locator('.remote-heading').innerText()) === 'Remote') {
        await page.getByRole('button', { name: new RegExp(`^${seed.title}`) }).click();
        await page.getByTestId('remote-workspace').locator('.remote-heading').filter({ hasText: seed.title }).waitFor();
      }
    }
    report.title = seed.title;
    if (action === 'cleanup') {
      assert.equal(await page.getByTestId('remote-workspace').locator('.remote-heading').innerText(), seed.title);
      const close = page.getByRole('button', { name: '关闭任务输出', exact: true });
      if (await close.count()) await close.click();
      const jobs = page.getByRole('dialog', { name: '后台任务', exact: true });
      if (await jobs.count()) await jobs.getByRole('button', { name: '关闭窗口', exact: true }).click();
      await page.getByRole('button', { name: '停止生成', exact: true }).waitFor({ state: 'detached', timeout: 60000 });
      await menu('归档聊天');
      if (await page.getByRole('region', { name: '聊天内容', exact: true }).count()) await page.getByRole('button', { name: '返回', exact: true }).click();
      await page.getByRole('button', { name: new RegExp(`^${seed.original}`) }).click();
      report.restored = true;
    } else if (action === 'model-read') {
      assert.equal(await page.getByTestId('remote-workspace').locator('.remote-heading').innerText(), seed.title);
      const result = JSON.parse(await readFile(`artifacts/${prefix}-run-android.json`, 'utf8'));
      assert.equal(result.title, seed.title); assert.equal(result.completed, true);
      await page.getByRole('textbox', { name: '消息', exact: true }).fill(`只调用 job_output 读取本会话已存在的后台任务 ${result.jobId}，不要创建新任务，不访问文件或网络。读取后只回复 DSHM_MODEL_OUTPUT_READ_DONE。`);
      await page.getByRole('button', { name: '发送消息', exact: true }).click();
      await page.getByRole('article', { name: '模型回复' }).filter({ hasText: 'DSHM_MODEL_OUTPUT_READ_DONE' }).waitFor({ timeout: 60000 });
      await page.getByRole('button', { name: '停止生成', exact: true }).waitFor({ state: 'detached', timeout: 60000 });
      await menu('后台任务');
      const jobs = page.getByRole('dialog', { name: '后台任务', exact: true });
      await jobs.locator(`[data-job-id="${result.jobId}"]`).getByRole('button', { name: '查看输出记录', exact: true }).click();
      const records = page.getByRole('dialog', { name: '后台任务输出', exact: true });
      await records.locator('pre').filter({ hasText: 'DSHM_STREAM_BEGIN 中文' }).waitFor();
      const text = await records.locator('pre').allTextContents();
      assert.match(text.join('\n'), /DSHM_STREAM_END 完成/); assert.match(text.join('\n'), /DSHM_STREAM_ERR 中文/);
      report.modelOutputPreserved = true;
      await page.screenshot({ path: `artifacts/${prefix}-model-android.png` });
      await records.getByRole('button', { name: '关闭任务输出', exact: true }).click();
      await jobs.getByRole('button', { name: '关闭窗口', exact: true }).click();
    } else {
      if (await page.getByRole('button', { name: '关闭任务输出', exact: true }).count()) await page.getByRole('button', { name: '关闭任务输出', exact: true }).click();
      const jobs = page.getByRole('dialog', { name: '后台任务', exact: true });
      if (!await jobs.count()) await menu('后台任务');
      const job = jobs.getByRole('listitem').filter({ hasText: seed.command });
      await job.waitFor({ timeout: 60000 });
      report.jobId = await job.getAttribute('data-job-id');
      report.runningBeforeRead = await job.getByText('运行中', { exact: true }).count() === 1;
      await job.getByRole('button', { name: '查看实时输出', exact: true }).click();
      const output = page.getByRole('dialog', { name: '实时任务输出', exact: true });
      await output.locator('pre').filter({ hasText: 'DSHM_STREAM_BEGIN 中文' }).waitFor();
      report.earlyText = await output.locator('pre').innerText();
      report.beforeExit = !report.earlyText.includes('DSHM_STREAM_END');
      await page.screenshot({ path: `artifacts/${prefix}-live-android.png` });
      await output.getByRole('button', { name: '错误输出', exact: true }).click();
      await output.locator('pre').filter({ hasText: 'DSHM_STREAM_ERR 中文' }).waitFor();
      report.stderr = true;
      await output.getByRole('button', { name: '标准输出', exact: true }).click();
      await output.locator('pre').filter({ hasText: 'DSHM_STREAM_END 完成' }).waitFor({ timeout: 60000 });
      report.completeText = await output.locator('pre').innerText();
      await output.getByRole('button', { name: '从头查看', exact: true }).click();
      await output.locator('pre').filter({ hasText: 'DSHM_STREAM_END 完成' }).waitFor();
      assert.equal(await output.locator('pre').innerText(), report.completeText); report.independentHistory = true;
      await output.getByRole('button', { name: '放大窗口', exact: true }).click();
      assert.match(await output.getAttribute('class'), /is-fullscreen/);
      assert.equal(await output.evaluate(el => el.scrollWidth > el.clientWidth + 1), false);
      await page.screenshot({ path: `artifacts/${prefix}-complete-android.png` });
      await output.getByRole('button', { name: '关闭任务输出', exact: true }).click();
      await job.getByText('已完成', { exact: true }).waitFor(); report.completed = true;
      await jobs.getByRole('button', { name: '关闭窗口', exact: true }).click();
    }
  }
} catch (error) { report.errors.push(error.message); process.exitCode = 1; }
finally { await writeFile(`artifacts/${prefix}-${action}-android.json`, JSON.stringify(report, null, 2)); console.log(JSON.stringify(report)); await device.close(); }
