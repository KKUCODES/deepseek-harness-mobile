import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { chromium, _android } from 'playwright';
import { androidAppWebView } from './android-app-webview.mjs';

const phase = process.argv[2];
assert.ok(['send', 'observe', 'desktop'].includes(phase));
const prefix = 'artifacts/command-encoding-live', seedPath = `${prefix}-seed.json`;
const report = { at: new Date().toISOString(), phase, errors: [] };
let browser, device, page, seed;
try {
  if (phase === 'send') {
    assert.equal(process.env.DSHM_RUN_LIVE, '1');
    seed = { marker: `DSHM_UTF8_${Date.now()}`, attempted: false };
    await writeFile(seedPath, JSON.stringify(seed, null, 2), { flag: 'wx' });
  } else seed = JSON.parse(await readFile(seedPath, 'utf8'));
  if (phase === 'desktop') {
    assert.equal(seed.verified, true);
    const log = await readFile('artifacts/review-boundary-dsh.stdout.log', 'utf8');
    const urls = [...new Set(log.match(/http:\/\/127\.0\.0\.1:3080\/\?token=[A-Za-z0-9_-]+/g))]; assert.equal(urls.length, 1);
    browser = await chromium.launch({ channel: 'msedge', headless: true }); page = await browser.newPage();
    try { await page.goto(urls[0]); } catch { throw Error('Desktop login failed; URL omitted'); }
    await page.getByText('DSH-TEST', { exact: true }).click();
    await page.getByRole('treeitem').filter({ has: page.getByText('DSHM Remote 联调提示', { exact: true }) }).click();
    const call = page.locator(`[data-chat-call-id="${seed.callId}"]`); await call.waitFor();
    const disclosure = call.locator('[data-disclosure-row][aria-expanded="false"]').first();
    if (await disclosure.count()) await disclosure.click();
    report.text = await call.innerText();
    assert.ok(report.text.includes(`${seed.marker}_中文🙂`)); assert.ok(report.text.includes(`${seed.marker}_错误中文`));
    assert.ok(!report.text.includes('\ufffd')); assert.ok(!report.text.includes('InvalidOperation'));
    report.originalDesktopCorrect = true;
  } else {
    device = (await _android.devices({ omitDriverInstall: true })).find(d => d.serial() === 'emulator-5554'); assert.ok(device);
    const context = (await (await androidAppWebView(device)).page()).context();
    page = context.pages().find(p => p.url().startsWith('https://remote.dshm.invalid/')); assert.ok(page); page.setDefaultTimeout(20000);
    page.on('pageerror', e => report.errors.push(e.message));
    const main = page.getByTestId('remote-workspace'); await main.waitFor({ timeout: 60000 });
    await main.locator('.remote-heading strong').getByText('DSHM Remote 联调提示', { exact: true }).waitFor();
    const editor = main.getByRole('textbox', { name: '消息', exact: true });
    if (phase === 'send') {
      assert.equal(await main.getByRole('button', { name: '停止生成', exact: true }).count(), 0);
      assert.equal(await editor.innerText(), '');
      seed.command = `Write-Output '${seed.marker}_中文🙂'; Write-Error '${seed.marker}_错误中文'`;
      await editor.fill(`这是DSHM编码验收，只调用一次pwsh，command精确为：${seed.command}。description=${seed.marker}，run_in_background=false，timeoutMs=10000。错误输出和非零退出是预期样例，不修复、不重试、不调用其他工具、不改文件/网络/权限。完成后只回复 ${seed.marker}_DONE。`);
      seed.attempted = true; await writeFile(seedPath, JSON.stringify(seed, null, 2));
      await main.getByRole('button', { name: '发送消息', exact: true }).click();
      seed.sent = true; report.sent = true;
    } else {
      assert.equal(seed.attempted, true);
      const call = main.locator('[data-chat-call-id]').filter({ has: page.locator('[data-tool="pwsh"]') }).filter({ hasText: seed.marker }).last();
      await call.waitFor({ timeout: 60000 });
      await main.getByRole('region', { name: '聊天内容', exact: true }).getByText(`${seed.marker}_DONE`, { exact: true }).waitFor({ timeout: 60000 });
      await main.getByRole('button', { name: '停止生成', exact: true }).waitFor({ state: 'detached' });
      const disclosure = call.locator('[data-disclosure-row][aria-expanded="false"]').first();
      if (await disclosure.count()) await disclosure.click();
      seed.callId = await call.getAttribute('data-chat-call-id');
      report.toolText = await call.innerText();
      assert.ok(report.toolText.includes(`${seed.marker}_中文🙂`)); assert.ok(report.toolText.includes(`${seed.marker}_错误中文`));
      assert.ok(!report.toolText.includes('\ufffd')); assert.ok(!report.toolText.includes('InvalidOperation'));
      await call.getByRole('button', { name: '查看', exact: true }).click();
      const dialog = page.getByRole('dialog', { name: '命令详情', exact: true });
      const output = dialog.getByLabel('独立命令输出', { exact: true });
      await output.filter({ hasText: `${seed.marker}_中文🙂` }).waitFor();
      report.stdout = await output.innerText(); assert.ok(!report.stdout.includes('\ufffd'));
      await dialog.getByRole('button', { name: '错误输出', exact: true }).click();
      await output.filter({ hasText: `${seed.marker}_错误中文` }).waitFor();
      report.stderr = await output.innerText(); assert.ok(!report.stderr.includes('\ufffd'));
      assert.ok(!report.stderr.includes('InvalidOperation'));
      await page.screenshot({ path: `${prefix}-stderr.png` });
      await dialog.getByRole('button', { name: '执行结果', exact: true }).click();
      const result = await dialog.innerText(); assert.ok(result.includes(`${seed.marker}_中文🙂`)); assert.ok(result.includes(`${seed.marker}_错误中文`));
      assert.ok(!result.includes('\ufffd')); report.finalResultCorrect = true;
      await dialog.getByRole('button', { name: '关闭命令详情', exact: true }).click();
      assert.equal(await editor.innerText(), ''); report.draftPreserved = true;
      await main.getByRole('button', { name: 'Remote 选项', exact: true }).click();
      await main.getByRole('button', { name: '会话权限', exact: true }).click();
      const permissions = page.getByRole('dialog', { name: '会话权限', exact: true });
      report.permission = await permissions.getByText(/^当前权限：/).innerText(); assert.equal(report.permission, '当前权限：仅可查看');
      await permissions.getByRole('button', { name: '关闭窗口', exact: true }).click();
      seed.verified = true;
    }
    await writeFile(seedPath, JSON.stringify(seed, null, 2));
  }
  await page.screenshot({ path: `${prefix}-${phase}.png` });
  assert.deepEqual(report.errors, []);
} catch (error) { report.failure = error.message; process.exitCode = 1; }
finally {
  await writeFile(`${prefix}-${phase}.json`, JSON.stringify(report, null, 2)); console.log(JSON.stringify(report));
  await browser?.close(); await device?.close();
}
