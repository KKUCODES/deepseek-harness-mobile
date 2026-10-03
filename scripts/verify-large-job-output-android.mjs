import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { _android } from 'playwright';
import { androidAppWebView } from './android-app-webview.mjs';

const action = process.argv[2] ?? 'read';
assert.ok(['run', 'read', 'reconnect', 'host-restart', 'disconnect', 'inflight', 'timeout', 'late', 'finish', 'cleanup'].includes(action));
if (action === 'run') assert.equal(process.env.DSHM_RUN_LIVE, '1');
const file = 'artifacts/large-job-output-seed.json';
const report = { at: new Date().toISOString(), action, errors: [] };
const fault = async path => {
  const response = await fetch(`http://127.0.0.1:18793/${path}`, { method: path === 'stats' ? 'GET' : 'POST', signal: AbortSignal.timeout(3000) });
  assert.ok(response.ok); return response.json();
};
const device = (await _android.devices({ omitDriverInstall: true })).find(item => item.serial() === process.env.DSHM_ANDROID_SERIAL);
assert.ok(device);
try {
  const first = await (await androidAppWebView(device)).page(), context = first.context();
  let page = context.pages().find(item => item.url().startsWith('https://remote.dshm.invalid/'));
  if (!page) {
    const ordinary = context.pages().find(item => item.url().startsWith('https://appassets.androidplatform.net/')); assert.ok(ordinary);
    if (!await ordinary.getByRole('dialog', { name: '侧边导航', exact: true }).count()) await ordinary.getByRole('button', { name: '打开侧边抽屉', exact: true }).click();
    const opened = context.waitForEvent('page'); await ordinary.getByRole('button', { name: 'Remote', exact: true }).click(); await opened;
    page = context.pages().find(item => item.url().startsWith('https://remote.dshm.invalid/'));
  }
  assert.ok(page); page.setDefaultTimeout(25000); page.on('pageerror', error => report.errors.push(error.message));
  const reconnect = page.getByRole('button', { name: '重新连接', exact: true });
  if (await reconnect.isVisible() && await reconnect.isEnabled()) await reconnect.click();
  const menu = async name => { await page.getByRole('button', { name: 'Remote 选项', exact: true }).click(); await page.getByRole('button', { name, exact: true }).click(); };
  await page.getByTestId('remote-workspace').locator('.remote-heading').waitFor();
  const leftoverMenu = page.getByRole('dialog', { name: 'Remote 选项', exact: true });
  if (await leftoverMenu.count()) await leftoverMenu.getByRole('button', { name: '关闭窗口', exact: true }).click();
  let seed;
  if (action === 'run') {
    if (await page.getByTestId('remote-workspace').locator('.remote-heading').innerText() === 'Remote') await page.getByRole('button', { name: /^DSHM Remote 联调提示/ }).click();
    await page.getByTestId('remote-workspace').locator('.remote-heading').filter({ hasText: 'DSHM Remote 联调提示' }).waitFor();
    seed = { title: `DSHM 大输出联调 ${Date.now()}`, original: 'DSHM Remote 联调提示',
      command: 'Write-Output "DSHM_LARGE_BEGIN"; Write-Output ("中文🙂0123456789" * 20000); Start-Sleep -Seconds 30; Write-Output "DSHM_LARGE_END"' };
    await writeFile(file, JSON.stringify(seed, null, 2));
    await menu('新建聊天');
    await page.getByRole('dialog', { name: '选择工作区', exact: true }).getByRole('button', { name: 'DSH-TEST', exact: true }).click();
    await menu('重命名聊天'); await page.getByRole('textbox', { name: '聊天名称', exact: true }).fill(seed.title);
    await page.getByRole('button', { name: '保存名称', exact: true }).click();
    await page.getByRole('dialog', { name: '重命名聊天', exact: true }).waitFor({ state: 'detached' });
    await page.getByRole('textbox', { name: '消息', exact: true }).fill(`这是DSHM大输出验证。只调用一次pwsh，command精确为：${seed.command}，run_in_background=true。不要访问网络，不要读取或修改用户文件，不重试，不调用job_output。后台启动后立即只回复DSHM_LARGE_STARTED。`);
    await page.getByRole('button', { name: '发送消息', exact: true }).click();
    const approval = page.getByRole('region', { name: '等待审批', exact: true }), started = page.getByRole('article', { name: '模型回复' }).filter({ hasText: 'DSHM_LARGE_STARTED' });
    await Promise.race([approval.waitFor({ timeout: 60000 }), started.waitFor({ timeout: 60000 })]);
    if (await approval.count()) { assert.match(await approval.innerText(), /pwsh/); await approval.getByRole('button', { name: '允许一次', exact: true }).click(); }
    await started.waitFor({ timeout: 60000 });
  } else {
    seed = JSON.parse(await readFile(file, 'utf8'));
    const heading = page.getByTestId('remote-workspace').locator('.remote-heading');
    if (await heading.innerText() !== seed.title) {
      if (await heading.innerText() !== 'Remote') await page.getByRole('button', { name: '返回', exact: true }).click();
      const row = page.getByRole('button', { name: new RegExp(`^${seed.title}`) });
      if (!await row.count()) await menu('查看已归档聊天');
      await row.click();
    }
    await page.getByTestId('remote-workspace').locator('.remote-heading').filter({ hasText: seed.title }).waitFor();
  }
  report.title = seed.title;
  const closeOutput = page.getByRole('button', { name: '关闭任务输出', exact: true });
  if (await closeOutput.count()) await closeOutput.click();
  const jobs = page.getByRole('dialog', { name: '后台任务', exact: true });
  if (action === 'finish') {
    if (await jobs.count()) await jobs.getByRole('button', { name: '关闭窗口', exact: true }).click();
    await page.getByRole('button', { name: '返回', exact: true }).click();
    await page.getByRole('button', { name: 'Remote 选项', exact: true }).click();
    const recent = page.getByRole('button', { name: '查看最近聊天', exact: true });
    if (await recent.count()) await recent.click();
    else await page.getByRole('button', { name: '关闭窗口', exact: true }).click();
    await page.getByRole('button', { name: new RegExp(`^${seed.original}`) }).click(); report.restored = true;
  } else if (action === 'disconnect') {
    if (await jobs.count()) await jobs.getByRole('button', { name: '关闭窗口', exact: true }).click();
    const userMessages = page.getByRole('region', { name: '聊天内容', exact: true }).getByText(/^这是DSHM大输出验证。只调用一次pwsh，command精确为：/);
    const messages = await userMessages.count(); assert.ok(messages > 0);
    await menu('电脑连接'); await page.getByRole('button', { name: '断开连接', exact: true }).click();
    await page.getByRole('heading', { name: '连接已断开', exact: true }).waitFor();
    const until = Date.now() + 10000;
    while (Date.now() < until) {
      assert.ok(await page.getByRole('heading', { name: '连接已断开', exact: true }).isVisible());
      await new Promise(resolve => setTimeout(resolve, 250));
    }
    report.noAutomaticReconnect = true;
    await page.getByRole('button', { name: '重新连接', exact: true }).click();
    await page.getByTestId('remote-workspace').locator('.remote-heading').filter({ hasText: /^Remote$/ }).waitFor();
    const restoredRow = page.getByRole('button', { name: new RegExp(`^${seed.title}`) });
    if (!await restoredRow.count()) await menu('查看已归档聊天');
    await restoredRow.click();
    await page.getByTestId('remote-workspace').locator('.remote-heading').filter({ hasText: seed.title }).waitFor();
    await userMessages.first().waitFor();
    assert.equal(await userMessages.count(), messages); report.userMessages = messages;
    report.manualReconnect = true;
  } else if (action === 'cleanup') {
    if (await jobs.count()) await jobs.getByRole('button', { name: '关闭窗口', exact: true }).click();
    await page.getByRole('button', { name: '停止生成', exact: true }).waitFor({ state: 'detached', timeout: 60000 });
    await menu('归档聊天');
    if (await page.getByRole('region', { name: '聊天内容', exact: true }).count()) await page.getByRole('button', { name: '返回', exact: true }).click();
    await page.getByRole('button', { name: new RegExp(`^${seed.original}`) }).click(); report.restored = true;
  } else {
    if (!await jobs.count()) await menu('后台任务');
    const job = jobs.getByRole('listitem').filter({ hasText: seed.command }); await job.waitFor({ timeout: 60000 });
    report.jobId = await job.getAttribute('data-job-id');
    await job.getByRole('button', { name: '查看实时输出', exact: true }).click();
    const output = page.getByRole('dialog', { name: '实时任务输出', exact: true });
    const status = output.getByRole('status').filter({ hasText: /字节/ });
    await status.filter({ hasText: '输出已读完' }).waitFor({ timeout: 60000 });
    report.liveChars = (await output.locator('pre').textContent()).length;
    assert.ok(report.liveChars <= 128 * 1024);
    await output.getByText(/当前显示最近的输出/).waitFor(); report.bounded = true;
    await output.getByRole('button', { name: '从头查看', exact: true }).click();
    // 本例在 Windows PowerShell 输出 CRLF；页面的原 ANSI 渲染器显示为 LF。
    const total = Buffer.byteLength('DSHM_LARGE_BEGIN\r\n' + '中文🙂0123456789'.repeat(20000) + '\r\nDSHM_LARGE_END\r\n');
    await status.filter({ hasText: `65,536 / ${total.toLocaleString()}` }).waitFor();
    if (['inflight', 'timeout', 'late'].includes(action)) {
      const before = await output.locator('pre').textContent();
      await fault('pause');
      await output.getByRole('button', { name: '读取下一段', exact: true }).click();
      await status.filter({ hasText: '正在读取' }).waitFor();
      let network;
      const deadline = Date.now() + 10000;
      do { network = await fault('stats'); if (network.heldBytes) break; await new Promise(resolve => setTimeout(resolve, 50)); } while (Date.now() < deadline);
      assert.ok(network.heldBytes > 0); assert.equal(network.devices, 1);
      await status.filter({ hasText: '65,536 /' }).waitFor();
      assert.equal(await output.locator('pre').textContent(), before);
      report.responseBytesHeld = network.heldBytes;
      if (action === 'late') {
        await output.getByRole('button', { name: '关闭任务输出', exact: true }).click();
        await jobs.getByRole('button', { name: '关闭窗口', exact: true }).click();
        await page.getByRole('button', { name: '返回', exact: true }).click();
        await page.getByRole('button', { name: 'Remote 选项', exact: true }).click();
        const recent = page.getByRole('button', { name: '查看最近聊天', exact: true });
        if (await recent.count()) await recent.click();
        else await page.getByRole('button', { name: '关闭窗口', exact: true }).click();
        await page.getByRole('button', { name: new RegExp(`^${seed.original}`) }).click();
        await fault('resume');
        await page.getByTestId('remote-workspace').locator('.remote-heading').filter({ hasText: seed.original }).waitFor();
        await page.getByRole('article', { name: '模型回复', exact: true }).first().waitFor();
        const end = Date.now() + 2000;
        while (Date.now() < end) {
          assert.equal(await output.count(), 0);
          assert.equal(await page.getByText('DSHM_LARGE_BEGIN', { exact: true }).count(), 0);
          await new Promise(resolve => setTimeout(resolve, 100));
        }
        report.lateResponseDiscardedAfterLeaving = true;
      } else {
        if (action === 'timeout') {
          const started = Date.now();
          await output.getByRole('alert').filter({ hasText: '读取输出失败，请检查连接后重试。' }).waitFor({ timeout: 45000 });
          report.timeoutWaitMs = Date.now() - started;
          await fault('resume');
          await new Promise(resolve => setTimeout(resolve, 1000));
          await output.getByRole('button', { name: '重新读取', exact: true }).waitFor();
        } else {
          report.responseBytesDropped = (await fault('drop')).droppedBytes;
          await output.getByRole('alert').filter({ hasText: '连接已变化，请重新读取输出。' }).waitFor({ timeout: 60000 });
        }
        assert.equal(await output.locator('pre').textContent(), before);
        await status.filter({ hasText: '65,536 /' }).waitFor();
        report.confirmedOffsetRetained = true;
        await output.getByRole('button', { name: '重新读取', exact: true }).click();
        await status.filter({ hasText: '131,072 /' }).waitFor();
        let text = before + await output.locator('pre').textContent();
        for (let offset = 196608; ; offset += 65536) {
          await output.getByRole('button', { name: '读取下一段', exact: true }).click();
          await status.filter({ hasText: `${Math.min(offset, total).toLocaleString()} /` }).waitFor();
          text += await output.locator('pre').textContent();
          if (offset >= total) break;
        }
        assert.equal(text, 'DSHM_LARGE_BEGIN\n' + '中文🙂0123456789'.repeat(20000) + '\nDSHM_LARGE_END\n');
        report.completeAfterResume = true; report.sha256 = createHash('sha256').update(text).digest('hex');
      }
      await page.screenshot({ path: `artifacts/large-job-output-${action}-android.png` });
    } else if (action === 'host-restart') {
      const before = await output.locator('pre').textContent();
      console.log('READY_FOR_DSH_RESTART: keep the gateway running');
      const offline = output.getByTestId('remote-offline-status');
      await offline.waitFor({ timeout: 120000 });
      assert.equal(await output.locator('pre').textContent(), before);
      console.log('DSH_OFFLINE: restore the same compiled entry and configuration');
      await offline.waitFor({ state: 'detached', timeout: 120000 });
      await output.getByRole('alert').filter({ hasText: '任务已变化，请返回任务列表重新查看。' }).waitFor();
      await output.getByRole('button', { name: '重新读取', exact: true }).click();
      assert.equal(await output.locator('pre').textContent(), before);
      await status.filter({ hasText: '65,536 /' }).waitFor();
      report.oldTaskRejected = true; report.retainedReadOnlyOutput = true;
      await page.screenshot({ path: 'artifacts/large-job-output-host-restart-android.png' });
      await output.getByRole('button', { name: '关闭任务输出', exact: true }).click();
      await jobs.getByText('当前没有后台任务。', { exact: true }).waitFor();
      report.registryCleared = true;
      await jobs.getByRole('button', { name: '关闭窗口', exact: true }).click();
    } else if (action === 'reconnect') {
      const before = await output.locator('pre').textContent();
      console.log('READY_FOR_GATEWAY_RESTART');
      const offline = output.getByTestId('remote-offline-status');
      await offline.waitFor({ timeout: 60000 });
      await offline.waitFor({ state: 'detached', timeout: 60000 });
      await output.getByRole('alert').filter({ hasText: '连接已变化，请重新读取输出。' }).waitFor({ timeout: 60000 });
      assert.equal(await output.locator('pre').textContent(), before); report.retainedAfterReconnect = true;
      assert.equal(await page.getByTestId('remote-workspace').locator('.remote-heading').innerText(), seed.title);
      await status.filter({ hasText: `65,536 / ${total.toLocaleString()}` }).waitFor();
      await output.getByRole('button', { name: '重新读取', exact: true }).click();
      await status.filter({ hasText: `131,072 / ${total.toLocaleString()}` }).waitFor();
      report.resumedOffset = 131072;
      await page.screenshot({ path: 'artifacts/large-job-output-reconnect-android.png' });
    } else {
      let text = '', pages = 0;
      for (let offset = Math.min(65536, total); ; offset = Math.min(offset + 65536, total)) {
        await status.filter({ hasText: `${offset.toLocaleString()} / ${total.toLocaleString()}` }).waitFor();
        text += await output.locator('pre').textContent(); pages++;
        if (offset === total) break;
        await output.getByRole('button', { name: '读取下一段', exact: true }).click();
      }
      const expected = 'DSHM_LARGE_BEGIN\n' + '中文🙂0123456789'.repeat(20000) + '\nDSHM_LARGE_END\n';
      assert.equal(text, expected); report.pages = pages; report.bytes = total;
      report.sha256 = createHash('sha256').update(text).digest('hex'); report.complete = true;
      assert.equal(await output.evaluate(el => el.scrollWidth > el.clientWidth + 1), false);
      await page.screenshot({ path: 'artifacts/large-job-output-history-android.png' });
    }
  }
} catch (error) { report.errors.push(error.message); process.exitCode = 1; }
finally {
  if (['inflight', 'timeout', 'late'].includes(action)) await fault('resume').catch(() => {});
  await writeFile(`artifacts/large-job-output-${action}-android.json`, JSON.stringify(report, null, 2)); console.log(JSON.stringify(report)); await device.close();
}
