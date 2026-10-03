import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { _android } from 'playwright';
import { androidAppWebView } from './android-app-webview.mjs';

// 独立实测会话只发送一次；失败后用 observe/cleanup，不重发模型请求。
const action = process.argv[2] ?? 'observe';
assert.ok(['run', 'observe', 'inspect', 'cleanup'].includes(action));
if (action === 'run') assert.equal(process.env.DSHM_RUN_LIVE, '1');
const seedPath = 'artifacts/foreground-reconnect-seed.json';
const report = { at: new Date().toISOString(), action, errors: [] };
const device = (await _android.devices({ omitDriverInstall: true })).find(item => item.serial() === process.env.DSHM_ANDROID_SERIAL);
assert.ok(device); device.setDefaultTimeout(20000);
let page;
try {
  const first = await (await androidAppWebView(device)).page(), context = first.context();
  page = context.pages().find(item => item.url().startsWith('https://remote.dshm.invalid/'));
  if (!page) {
    const ordinary = context.pages().find(item => item.url().startsWith('https://appassets.androidplatform.net/')); assert.ok(ordinary);
    await ordinary.getByRole('button', { name: '打开侧边抽屉', exact: true }).click();
    const opened = context.waitForEvent('page'); await ordinary.getByRole('button', { name: 'Remote', exact: true }).click(); await opened;
    page = context.pages().find(item => item.url().startsWith('https://remote.dshm.invalid/'));
  }
  assert.ok(page); page.setDefaultTimeout(30000);
  page.on('pageerror', error => report.errors.push(error.message));
  const heading = page.getByTestId('remote-workspace').locator('.remote-heading'); await heading.waitFor();
  const menu = async name => {
    await page.getByRole('button', { name: 'Remote 选项', exact: true }).click();
    await page.getByRole('button', { name, exact: true }).click();
  };
  let seed;
  if (action === 'run') {
    try { await readFile(seedPath); throw Error('Existing seed: observe/cleanup only'); }
    catch (error) { if (error.code !== 'ENOENT') throw error; }
    if (await heading.innerText() === 'Remote') await page.getByRole('button', { name: /^DSHM Remote 联调提示/ }).click();
    assert.equal(await heading.innerText(), 'DSHM Remote 联调提示');
    seed = { original: 'DSHM Remote 联调提示', title: `DSHM 前台重连 ${Date.now()}`, stage: 'prepared',
      command: 'Write-Output "DSHM_FOREGROUND_LARGE_BEGIN"; Write-Output ("中文🙂0123456789" * 5000); Start-Sleep -Seconds 5; Write-Output "DSHM_FOREGROUND_LARGE_END"' };
    await writeFile(seedPath, JSON.stringify(seed, null, 2), { flag: 'wx' });
    await menu('新建聊天');
    await page.getByRole('dialog', { name: '选择工作区', exact: true }).getByRole('button', { name: 'DSH-TEST', exact: true }).click();
    await menu('重命名聊天'); await page.getByRole('textbox', { name: '聊天名称', exact: true }).fill(seed.title);
    await page.getByRole('button', { name: '保存名称', exact: true }).click();
    await page.getByRole('dialog', { name: '重命名聊天', exact: true }).waitFor({ state: 'detached' });
    await page.getByRole('textbox', { name: '消息', exact: true }).fill(`这是DSHM前台输出重连验收。只调用一次pwsh，command精确为：${seed.command}。run_in_background=false，timeoutMs=60000，description=DSHM_FOREGROUND_RECONNECT。不读写文件、不访问网络、不调用其他工具、不重试。完成后只回复DSHM_FOREGROUND_RECONNECT_DONE。`);
    seed.stage = 'sending'; await writeFile(seedPath, JSON.stringify(seed, null, 2));
    await page.getByRole('button', { name: '发送消息', exact: true }).click();
    seed.stage = 'sent'; await writeFile(seedPath, JSON.stringify(seed, null, 2));
  } else {
    seed = JSON.parse(await readFile(seedPath, 'utf8'));
    if (await heading.innerText() === 'Remote') await page.getByRole('button', { name: new RegExp(`^${seed.title}`) }).click();
  }
  report.title = seed.title; await heading.filter({ hasText: seed.title }).waitFor();
  const panel = page.getByRole('dialog', { name: '命令详情', exact: true });
  if (action === 'inspect') {
    report.status = await panel.getByRole('status').allTextContents();
    report.alerts = await panel.getByRole('alert').allTextContents();
    report.selected = await panel.locator('button[aria-pressed="true"]').allTextContents();
    const output = panel.getByLabel('独立命令输出', { exact: true });
    report.output = await output.count() ? (await output.textContent()).slice(0, 100) : null;
  } else if (action !== 'cleanup') {
    const tool = page.getByRole('region', { name: '聊天内容', exact: true }).locator('details.remote-tool-card').filter({ hasText: 'DSHM_FOREGROUND_LARGE_BEGIN' }).last();
    await tool.waitFor({ timeout: 60000 });
    const approval = page.getByRole('region', { name: '等待审批', exact: true });
    if (await approval.count()) {
      const text = await approval.innerText(); assert.match(text, /pwsh/); assert.ok(text.includes(seed.command));
      await approval.getByRole('button', { name: '允许一次', exact: true }).click();
    }
    await page.getByRole('article', { name: '模型回复' }).filter({ hasText: 'DSHM_FOREGROUND_RECONNECT_DONE' }).waitFor({ timeout: 60000 });
    if (!await panel.count()) {
      if (await tool.getAttribute('open') === null) await tool.locator(':scope > summary').click();
      await tool.getByRole('button', { name: '查看命令详情', exact: true }).click();
    }
    await panel.getByRole('button', { name: '从头查看', exact: true }).click();
    const expected = 'DSHM_FOREGROUND_LARGE_BEGIN\n' + '中文🙂0123456789'.repeat(5000) + '\nDSHM_FOREGROUND_LARGE_END\n';
    const status = panel.getByRole('status').filter({ hasText: '字节' });
    await status.filter({ hasText: '65,536 /' }).waitFor();
    // 原始字节游标可能包括 UTF-8 BOM；全文完整性在解码后逐字核对。
    const total = Number((await status.innerText()).match(/65,536 \/ ([\d,]+)/)[1].replaceAll(',', ''));
    assert.ok(total > 65536 && total <= 131072); report.totalBytes = total;
    const output = panel.getByLabel('独立命令输出', { exact: true });
    const before = await output.textContent(); report.initialOffset = 65536;
    const expand = panel.getByRole('button', { name: '放大窗口', exact: true });
    if (await expand.count()) await expand.click();
    console.log('READY_FOR_FOREGROUND_RELAY_RESTART');
    const offline = panel.getByTestId('remote-offline-status');
    await offline.waitFor({ timeout: 120000 });
    assert.equal(await output.textContent(), before); report.offlineRetained = true;
    console.log('FOREGROUND_OFFLINE_OBSERVED');
    await offline.waitFor({ state: 'detached', timeout: 120000 });
    await panel.getByRole('button', { name: '重新读取', exact: true }).waitFor();
    assert.equal(await output.textContent(), before); assert.match(await panel.getAttribute('class'), /is-fullscreen/);
    assert.equal(await panel.getByRole('button', { name: '从头查看', exact: true }).getAttribute('aria-pressed'), 'true');
    await status.filter({ hasText: `65,536 / ${total.toLocaleString()}` }).waitFor();
    await panel.getByRole('button', { name: '重新读取', exact: true }).click();
    await status.filter({ hasText: `${total.toLocaleString()} / ${total.toLocaleString()}` }).waitFor();
    assert.equal(before + await output.textContent(), expected);
    report.resumedOffset = total; report.completeNoDuplicates = true;
    await page.screenshot({ path: 'artifacts/foreground-reconnect-android.png' });
  } else {
    if (await panel.count()) await panel.getByRole('button', { name: '关闭命令详情', exact: true }).click();
    await page.getByRole('button', { name: '停止生成', exact: true }).waitFor({ state: 'detached' });
    await menu('归档聊天');
    if (await page.getByRole('region', { name: '聊天内容', exact: true }).count()) await page.getByRole('button', { name: '返回', exact: true }).click();
    await page.getByRole('button', { name: new RegExp(`^${seed.original}`) }).click();
    await heading.filter({ hasText: seed.original }).waitFor();
    seed.stage = 'archived'; await writeFile(seedPath, JSON.stringify(seed, null, 2)); report.restored = true;
  }
} catch (error) {
  report.errors.push(error.message); process.exitCode = 1;
  if (page) report.failureText = (await page.locator('body').innerText().catch(() => '')).slice(0, 2500);
} finally {
  await writeFile(`artifacts/foreground-reconnect-${action}-android.json`, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report)); await device.close();
}
