import assert from 'node:assert/strict';
import { _android } from 'playwright';
import { readFile, writeFile } from 'node:fs/promises';
import { androidAppWebView } from './android-app-webview.mjs';

assert.equal(process.env.DSHM_RUN_LIVE, '1');
const action = process.argv[2];
assert.ok(['prepare', 'pc-off', 'pc-on', 'finish'].includes(action));
const device = (await _android.devices({ omitDriverInstall: true })).find(item => item.serial() === process.env.DSHM_ANDROID_SERIAL);
assert.ok(device);
const report = { at: new Date().toISOString(), action, errors: [], resources: [] };
try {
  const first = await (await androidAppWebView(device)).page(), context = first.context();
  let page = context.pages().find(item => item.url().startsWith('https://remote.dshm.invalid/'));
  if (!page) {
    const ordinary = context.pages().find(item => item.url().startsWith('https://appassets.androidplatform.net/'));
    await ordinary.getByRole('button', { name: '打开侧边抽屉', exact: true }).click();
    const opened = context.waitForEvent('page');
    await ordinary.getByRole('button', { name: 'Remote', exact: true }).click(); await opened;
    page = context.pages().find(item => item.url().startsWith('https://remote.dshm.invalid/'));
  }
  assert.ok(page); page.setDefaultTimeout(15000);
  page.on('pageerror', error => report.errors.push(error.message));
  page.on('response', response => { if (response.status() >= 400) report.resources.push({ path: new URL(response.url()).pathname, status: response.status() }); });
  const workspace = page.getByTestId('remote-workspace'); await workspace.waitFor({ timeout: 60000 });
  const menu = async name => { await page.getByRole('button', { name: 'Remote 选项', exact: true }).click(); await page.getByRole('button', { name, exact: true }).click(); };
  const panel = page.getByRole('dialog', { name: '计划模式', exact: true });
  const history = page.getByRole('region', { name: '聊天内容', exact: true });
  const editor = page.getByRole('textbox', { name: '消息', exact: true });
  if (action === 'prepare') {
    await menu('新建聊天');
    await page.getByRole('dialog', { name: '选择工作区', exact: true }).getByRole('button', { name: 'DSH-TEST', exact: true }).click();
    report.chat = `DSHM 计划开关联调 ${Date.now()}`;
    await menu('重命名聊天');
    await page.getByRole('textbox', { name: '聊天名称', exact: true }).fill(report.chat);
    await page.getByRole('button', { name: '保存名称', exact: true }).click();
    report.marker = `DSHM_PLAN_MODE_READY_${Date.now()}`;
    await editor.fill(`这是计划模式开关测试。请只回复 ${report.marker}，不调用任何工具，不修改文件。`);
    await page.getByRole('button', { name: '发送消息', exact: true }).click();
    await history.getByText(report.marker, { exact: true }).waitFor({ timeout: 90000 });
    await page.getByRole('button', { name: '停止生成', exact: true }).waitFor({ state: 'detached', timeout: 90000 });
    report.repliesBefore = await history.getByRole('article', { name: '模型回复' }).count();
    await editor.fill('仅保留在手机的计划模式测试草稿');
    await menu('计划模式');
    await panel.getByText('计划模式：已关闭', { exact: true }).waitFor();
    await panel.getByRole('button', { name: '开启计划模式', exact: true }).click();
    await panel.getByText('计划模式：已开启', { exact: true }).waitFor();
    report.phoneEnabled = true;
  } else {
    const previous = JSON.parse(await readFile('artifacts/remote-plan-mode-prepare-android.json', 'utf8'));
    report.chat = await workspace.locator('.remote-heading').innerText();
    assert.equal(report.chat, previous.chat);
    if (action === 'finish') {
      if (!(await panel.count())) await menu('计划模式');
      await panel.getByRole('button', { name: '关闭计划模式', exact: true }).click();
      await panel.getByText('计划模式：已关闭', { exact: true }).waitFor();
      report.phoneDisabled = true;
      await panel.getByRole('button', { name: '关闭窗口', exact: true }).click();
      assert.equal(await page.getByRole('button', { name: '查看计划模式', exact: true }).count(), 0);
      report.repliesAfter = await history.getByRole('article', { name: '模型回复' }).count();
      assert.equal(report.repliesAfter, previous.repliesBefore, 'Mode switches must not send model messages');
      assert.equal(await editor.inputValue(), '仅保留在手机的计划模式测试草稿');
      await editor.fill('');
      await menu('归档聊天');
      await page.getByRole('button', { name: /^DSHM Remote 联调提示/ }).click();
      report.restoredChat = await workspace.locator('.remote-heading').innerText();
    } else {
      await panel.getByText(`计划模式：${action === 'pc-on' ? '已开启' : '已关闭'}`, { exact: true }).waitFor();
      report.desktopChangeReceived = true;
    }
  }
  if (action !== 'finish') await page.screenshot({ path: `artifacts/remote-plan-mode-${action}-android.png` });
  assert.deepEqual(report.errors, []); assert.deepEqual(report.resources, []);
} catch (error) { report.failure = error.message; process.exitCode = 1; }
finally { await writeFile(`artifacts/remote-plan-mode-${action}-android.json`, JSON.stringify(report, null, 2)); console.log(JSON.stringify(report)); await device.close(); }
