import assert from 'node:assert/strict';
import { _android } from 'playwright';
import { readFile, writeFile } from 'node:fs/promises';
import { androidAppWebView } from './android-app-webview.mjs';

assert.equal(process.env.DSHM_RUN_LIVE, '1');
const action = process.argv[2];
assert.ok(['prepare', 'inspect', 'prepare-continuable', 'continue', 'pc-and-stop', 'stop-existing', 'finish'].includes(action));
const device = (await _android.devices({ omitDriverInstall: true })).find(item => item.serial() === process.env.DSHM_ANDROID_SERIAL);
assert.ok(device);
const report = { at: new Date().toISOString(), action, errors: [], resources: [] };
try {
  const first = await (await androidAppWebView(device)).page();
  const page = first.context().pages().find(item => item.url().startsWith('https://remote.dshm.invalid/'));
  assert.ok(page); page.setDefaultTimeout(15000);
  page.on('pageerror', error => report.errors.push(error.message));
  page.on('response', response => { if (response.status() >= 400) report.resources.push({ path: new URL(response.url()).pathname, status: response.status() }); });
  const workspace = page.getByTestId('remote-workspace'); await workspace.waitFor({ timeout: 60000 });
  const menu = async name => { await page.getByRole('button', { name: 'Remote 选项', exact: true }).click(); await page.getByRole('button', { name, exact: true }).click(); };
  const editor = page.getByRole('textbox', { name: '消息', exact: true });
  if (action === 'stop-existing') {
    const previous = JSON.parse(await readFile('artifacts/remote-subagents-continue-android.json', 'utf8'));
    assert.equal(await workspace.locator('.remote-heading').innerText(), previous.childTitle);
    const history = page.getByRole('region', { name: '聊天内容', exact: true });
    await history.getByText(/^子会话停止测试 1(?:\s|$)/).filter({ visible: true }).waitFor();
    await page.getByRole('button', { name: '停止生成', exact: true }).click();
    await history.getByText('已停止', { exact: true }).waitFor({ timeout: 30000 });
    await page.getByRole('button', { name: '停止生成', exact: true }).waitFor({ state: 'detached' });
    report.stoppedAfterOutput = true;
    await page.screenshot({ path: 'artifacts/remote-subagents-stop-android.png' });
    await page.getByRole('button', { name: '返回父会话', exact: true }).click();
    assert.equal(await editor.inputValue(), '可继续子会话父草稿'); report.parentDraftPreserved = true;
  } else if (action === 'prepare') {
    await menu('新建聊天');
    await page.getByRole('dialog', { name: '选择工作区', exact: true }).getByRole('button', { name: 'DSH-TEST', exact: true }).click();
    report.chat = `DSHM 子会话联调 ${Date.now()}`;
    await menu('重命名聊天'); await page.getByRole('textbox', { name: '聊天名称', exact: true }).fill(report.chat);
    await page.getByRole('button', { name: '保存名称', exact: true }).click();
    report.marker = `DSHM_CHILD_READY_${Date.now()}`;
    await editor.fill(`这是 DSHM 子会话界面的联调测试。请只调用一次 subagent 工具，创建一个前台的一次性子任务，任务内容为“不要调用任何工具，不读写文件，只回复 ${report.marker}”。如果工具允许 label，使用 DSHM 子任务验证。等待子任务返回后，你只回复 PARENT_DONE。不要执行任何其他工具或修改文件。`);
    await page.getByRole('button', { name: '发送消息', exact: true }).click();
    report.sent = true;
  } else {
    const previous = JSON.parse(await readFile('artifacts/remote-subagents-prepare-android.json', 'utf8'));
    report.chat = await workspace.locator('.remote-heading').innerText(); assert.equal(report.chat, previous.chat);
    if (action === 'pc-and-stop') {
      await menu('子会话');
      await page.getByRole('dialog', { name: '子会话', exact: true }).getByRole('button', { name: /DSHM 可继续子任务验证/ }).click();
      const history = page.getByRole('region', { name: '聊天内容', exact: true });
      await history.getByText('DSHM_CHILD_PC_SYNC_20260924', { exact: true }).waitFor({ timeout: 90000 });
      assert.equal(await editor.inputValue(), '可继续子会话自己的草稿'); report.desktopMessageReceived = true; report.childDraftPreserved = true;
      const before = await history.getByRole('article', { name: '模型回复', exact: true }).count();
      await editor.fill('这是子会话停止测试。不调用工具，请连续输出从1到3000的编号，每行格式为“子会话停止测试 编号”。不要省略或总结。');
      await page.getByRole('button', { name: '发送消息', exact: true }).click();
      await history.getByRole('article', { name: '模型回复', exact: true }).nth(before).getByText(/^子会话停止测试 1(?:\s|$)/).filter({ visible: true }).waitFor({ timeout: 90000 });
      await page.getByRole('button', { name: '停止生成', exact: true }).click();
      await history.getByText('已停止', { exact: true }).waitFor({ timeout: 30000 });
      await page.getByRole('button', { name: '停止生成', exact: true }).waitFor({ state: 'detached' });
      report.stoppedAfterOutput = true;
      await page.screenshot({ path: 'artifacts/remote-subagents-stop-android.png' });
      await page.getByRole('button', { name: '返回父会话', exact: true }).click();
      assert.equal(await editor.inputValue(), '可继续子会话父草稿');
    } else if (action === 'prepare-continuable') {
      report.marker = `DSHM_CONTINUABLE_READY_${Date.now()}`;
      await editor.fill(`继续进行子会话联调。请只调用一次 subagent 工具，设置 run_in_background=true，label 为 DSHM 可继续子任务验证，创建可继续的子会话。子任务提示词为“不要调用任何工具，不读写文件，只回复 ${report.marker}。后续收到人类消息时直接按消息要求回复，不使用工具。”。创建成功后只回复 PARENT_CONTINUABLE_READY。不要再向子任务发送消息，不调用其他工具或修改文件。`);
      await page.getByRole('button', { name: '发送消息', exact: true }).click(); report.sent = true;
    } else if (action === 'continue') {
      const child = JSON.parse(await readFile('artifacts/remote-subagents-prepare-continuable-android.json', 'utf8'));
      await page.getByRole('region', { name: '聊天内容', exact: true }).getByText('PARENT_CONTINUABLE_READY', { exact: true }).waitFor({ timeout: 90000 });
      await editor.fill('可继续子会话父草稿'); await menu('子会话');
      const row = page.getByRole('dialog', { name: '子会话', exact: true }).getByRole('button', { name: /DSHM 可继续子任务验证/ });
      report.childRow = await row.innerText(); assert.match(report.childRow, /可继续聊天/); await row.click();
      const history = page.getByRole('region', { name: '聊天内容', exact: true });
      await history.getByText(child.marker, { exact: true }).waitFor({ timeout: 90000 });
      report.childTitle = await workspace.locator('.remote-heading').innerText();
      report.marker = `DSHM_CHILD_CONTINUED_${Date.now()}`;
      await editor.fill(`这是手机直接续聊验证。请只回复 ${report.marker}，不调用任何工具。`);
      await page.getByRole('button', { name: '发送消息', exact: true }).click();
      await history.getByText(report.marker, { exact: true }).waitFor({ timeout: 90000 });
      await page.getByRole('button', { name: '停止生成', exact: true }).waitFor({ state: 'detached', timeout: 30000 });
      assert.equal(await history.getByText('正在发送…', { exact: true }).count(), 0);
      assert.equal(await editor.inputValue(), ''); report.echoSettled = true;
      await editor.fill('可继续子会话自己的草稿');
      await page.screenshot({ path: 'artifacts/remote-subagents-continue-android.png' });
      await page.getByRole('button', { name: '返回父会话', exact: true }).click();
      assert.equal(await editor.inputValue(), '可继续子会话父草稿'); report.parentDraftPreserved = true;
    } else if (action === 'inspect') {
      await page.getByRole('region', { name: '聊天内容', exact: true }).getByText('PARENT_DONE', { exact: true }).waitFor({ timeout: 90000 });
      await editor.fill('子会话联调父草稿');
      await menu('子会话');
      const panel = page.getByRole('dialog', { name: '子会话', exact: true });
      const children = panel.getByRole('button', { name: /只读记录/ });
      assert.equal(await children.count(), 1, '电脑应创建唯一一次性子会话');
      report.childRow = await children.innerText(); await children.click();
      await page.getByText('这是一次性子任务，可以查看执行记录。', { exact: true }).waitFor();
      await page.getByRole('region', { name: '聊天内容', exact: true }).getByText(previous.marker, { exact: true }).waitFor();
      assert.equal(await editor.count(), 0); assert.equal(await page.getByRole('button', { name: '停止生成', exact: true }).count(), 0);
      report.childTitle = await workspace.locator('.remote-heading').innerText();
      report.childReply = previous.marker; report.oneShotReadOnly = true;
      await page.screenshot({ path: 'artifacts/remote-subagents-child-android.png' });
      await page.getByRole('button', { name: '返回父会话', exact: true }).click();
      assert.equal(await workspace.locator('.remote-heading').innerText(), previous.chat);
      assert.equal(await editor.inputValue(), '子会话联调父草稿'); report.parentDraftPreserved = true;
    } else {
      await editor.fill(''); await menu('归档聊天');
      await page.getByRole('button', { name: /^DSHM Remote 联调提示/ }).click();
      report.restoredChat = await workspace.locator('.remote-heading').innerText();
    }
  }
  assert.deepEqual(report.errors, []); assert.deepEqual(report.resources, []);
} catch (error) { report.failure = error.message; process.exitCode = 1; }
finally { await writeFile(`artifacts/remote-subagents-${action}-android.json`, JSON.stringify(report, null, 2)); console.log(JSON.stringify(report)); await device.close(); }
