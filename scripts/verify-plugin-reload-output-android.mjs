import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { _android } from 'playwright';
import { androidAppWebView } from './android-app-webview.mjs';

// 复用已经完成且仍在当前 Jobs 注册表中的专用任务，不发新提示或改变归档状态。
const action = process.argv[2] ?? 'verify';
assert.ok(['verify', 'finish'].includes(action));
const seed = JSON.parse(await readFile('artifacts/post-restart-job-output-seed.json', 'utf8'));
const report = { at: new Date().toISOString(), action, title: seed.title, errors: [] };
const device = (await _android.devices({ omitDriverInstall: true })).find(item => item.serial() === process.env.DSHM_ANDROID_SERIAL);
assert.ok(device);
try {
  const first = await (await androidAppWebView(device)).page();
  const page = first.context().pages().find(item => item.url().startsWith('https://remote.dshm.invalid/'));
  assert.ok(page); page.setDefaultTimeout(25000);
  page.on('pageerror', error => report.errors.push(error.message));
  const menu = async name => {
    await page.getByRole('button', { name: 'Remote 选项', exact: true }).click();
    await page.getByRole('button', { name, exact: true }).click();
  };
  const heading = page.getByTestId('remote-workspace').locator('.remote-heading');
  const jobs = page.getByRole('dialog', { name: '后台任务', exact: true });
  const output = page.getByRole('dialog', { name: '实时任务输出', exact: true });
  if (action === 'verify') {
    if (await output.count()) await output.getByRole('button', { name: '关闭任务输出', exact: true }).click();
    if (await jobs.count()) await jobs.getByRole('button', { name: '关闭窗口', exact: true }).click();
    if (await heading.innerText() !== seed.title) {
      if (await heading.innerText() !== 'Remote') await page.getByRole('button', { name: '返回', exact: true }).click();
      const row = page.getByRole('button', { name: new RegExp(`^${seed.title}`) });
      if (!await row.count()) await menu('查看已归档聊天');
      await row.click();
    }
    await heading.filter({ hasText: seed.title }).waitFor();
    await menu('后台任务');
    const job = jobs.getByRole('listitem').filter({ hasText: seed.command });
    await job.getByText('已完成', { exact: true }).waitFor();
    report.jobId = await job.getAttribute('data-job-id');
    await job.getByRole('button', { name: '查看实时输出', exact: true }).click();
    await output.locator('pre').filter({ hasText: 'DSHM_STREAM_END 完成' }).waitFor();
    const original = await output.locator('pre').innerText();
    const position = await output.getByRole('status').filter({ hasText: '字节' }).innerText();
    console.log('READY_FOR_PLUGIN_RELOAD');
    await output.getByTestId('remote-offline-status').waitFor({ timeout: 120000 });
    assert.equal(await output.locator('pre').innerText(), original);
    report.retainedOffline = true;
    console.log('PLUGIN_OFFLINE_OBSERVED');
    const streamButton = output.getByRole('button', { name: '标准输出', exact: true });
    const deadline = Date.now() + 120000;
    while (!await streamButton.isEnabled() && Date.now() < deadline) await page.waitForTimeout(100);
    assert.equal(await streamButton.isEnabled(), true, 'Plugin reconnect must enable output controls');
    await output.getByRole('alert').filter({ hasText: /任务已变化/ }).waitFor();
    await output.getByRole('button', { name: '重新读取', exact: true }).click();
    assert.equal(await output.locator('pre').innerText(), original);
    assert.equal((await output.getByRole('status').filter({ hasText: '字节' }).innerText()).split(' · ')[1], position.split(' · ')[1]);
    report.oldReaderRejected = true;
    await page.screenshot({ path: 'artifacts/plugin-reload-output-stale-android.png' });
    await output.getByRole('button', { name: '关闭任务输出', exact: true }).click();
    await jobs.getByRole('listitem').filter({ hasText: seed.command }).getByRole('button', { name: '查看实时输出', exact: true }).click();
    await output.locator('pre').filter({ hasText: 'DSHM_STREAM_END 完成' }).waitFor();
    assert.equal(await output.locator('pre').innerText(), original);
    await output.getByRole('status').filter({ hasText: '输出已读完' }).waitFor();
    report.sameTaskReadableAfterReopen = true;
    await output.getByRole('button', { name: '错误输出', exact: true }).click();
    await output.locator('pre').filter({ hasText: 'DSHM_STREAM_ERR 中文' }).waitFor();
    report.stderrReadable = true;
    await page.screenshot({ path: 'artifacts/plugin-reload-output-recovered-android.png' });
  }
  if (await output.count()) await output.getByRole('button', { name: '关闭任务输出', exact: true }).click();
  if (await jobs.count()) await jobs.getByRole('button', { name: '关闭窗口', exact: true }).click();
  if (await heading.innerText() !== 'Remote') await page.getByRole('button', { name: '返回', exact: true }).click();
  await page.getByRole('button', { name: 'Remote 选项', exact: true }).click();
  const recent = page.getByRole('button', { name: '查看最近聊天', exact: true });
  if (await recent.count()) await recent.click();
  else await page.getByRole('dialog', { name: 'Remote 选项', exact: true }).getByRole('button', { name: '关闭窗口', exact: true }).click();
  await page.getByRole('button', { name: new RegExp(`^${seed.original}`) }).click();
  await heading.filter({ hasText: seed.original }).waitFor();
  report.returned = true;
} catch (error) { report.errors.push(error.message); process.exitCode = 1; }
finally {
  report.finishedAt = new Date().toISOString();
  await writeFile(`artifacts/plugin-reload-output-${action}-android.json`, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report)); await device.close();
}
