import { _android } from 'playwright';
import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { chooseDownload } from './android-picker-test.mjs';

const serial = process.env.DSHM_ANDROID_SERIAL;
assert.ok(serial, 'Set DSHM_ANDROID_SERIAL');
const device = (await _android.devices({ omitDriverInstall: true })).find(item => item.serial() === serial);
assert.ok(device); device.setDefaultTimeout(15000);
try {
  const first = await (await device.webView({ pkg: 'dev.dshmobile.validation' })).page();
  const context = first.context();
  let page = context.pages().find(item => item.url().startsWith('https://remote.dshm.invalid/'));
  if (!page) {
    const ordinary = context.pages().find(item => item.url().startsWith('https://appassets.androidplatform.net/'));
    assert.ok(ordinary);
    await ordinary.getByRole('button', { name: '打开侧边抽屉', exact: true }).click();
    const opened = context.waitForEvent('page');
    await ordinary.getByRole('button', { name: 'Remote', exact: true }).click();
    await opened;
    page = context.pages().find(item => item.url().startsWith('https://remote.dshm.invalid/'));
  }
  assert.ok(page);
  const errors = [];
  const resources = [];
  const path = request => new URL(request.url()).pathname;
  page.on('requestfailed', request => resources.push({ path: path(request), error: request.failure()?.errorText }));
  page.on('response', response => {
    if (response.status() >= 400 || new URL(response.url()).pathname.startsWith('/plugins/')) resources.push({ path: path(response.request()), status: response.status(), type: response.headers()['content-type'] });
  });
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  if (process.argv.includes('--reload')) await page.reload();
  if (process.argv.includes('--connect')) await page.getByRole('button', { name: '重新连接', exact: true }).click();
  if (process.argv.includes('--files-menu')) await page.getByRole('button', { name: '添加文件或调用指令', exact: true }).click();
  if (process.argv.includes('--pick-file')) {
    await page.getByRole('button', { name: 'DSHM Remote 联调提示', exact: true }).waitFor();
    await device.push(Buffer.from('DSHM_REMOTE_ATTACHMENT_20260923\nThis is a dedicated Remote upload fixture.\n'), '/sdcard/Download/dshm-remote-upload-20260923.txt');
    await page.getByRole('option').filter({ hasText: /^文件file$/ }).click();
    await chooseDownload(device, 'dshm-remote-upload-20260923.txt');
  }
  if (process.argv.includes('--send-file')) {
    await page.getByRole('button', { name: 'DSHM Remote 联调提示', exact: true }).waitFor();
    await page.getByRole('button', { name: '移除文件 dshm-remote-upload-20260923.txt', exact: true }).waitFor();
    await page.getByRole('textbox', { name: '发消息或创建任务, / 调用指令, @ 文件或对话', exact: true }).fill('这是专用附件上传测试。请读取附件，只回复文件第一行的完整内容。不要修改文件或执行命令。');
    await page.getByRole('button', { name: '发送消息', exact: true }).click();
  }
  if (process.argv.includes('--request-approval')) {
    await page.getByRole('button', { name: 'DSHM Remote 联调提示', exact: true }).waitFor();
    await page.getByRole('button', { name: '访问模式，当前：仅可查看', exact: true }).waitFor();
    await page.getByRole('textbox', { name: '发消息或创建任务, / 调用指令, @ 文件或对话', exact: true }).fill('这是 DSHM Remote 操作审批测试。请使用写文件工具在当前 DSH-TEST 工作区新建 dshm-approval-test-20260923.txt，内容为 DSHM_APPROVAL_OK。当前为仅可查看模式，请按正常流程发起本次写文件批准并等待；不要修改权限设置，不要运行 Shell，不要修改其他文件。完成后只回复 DSHM_APPROVAL_OK。');
    await page.getByRole('button', { name: '发送消息', exact: true }).click();
  }
  if (process.argv.includes('--approve-file')) {
    await page.getByRole('button', { name: 'DSHM Remote 联调提示', exact: true }).waitFor();
    await page.getByRole('button', { name: 'dshm-approval-test-20260923.txt', exact: true }).waitFor();
    await page.getByText('等待审批', { exact: true }).waitFor();
    await page.getByRole('button', { name: '允许一次', exact: true }).click();
  }
  if (process.argv.includes('--preview-file')) {
    await page.getByText('dshm-remote-upload-20260923.txt', { exact: true }).click();
  }
  if (process.argv.includes('--preview-produced')) {
    await page.getByRole('button', { name: '2 次工具调用', exact: true }).click();
    await page.getByRole('button', { name: 'dshm-approval-test-20260923.txt', exact: true }).click();
  }
  if (process.argv.includes('--close-preview')) await page.getByRole('button', { name: '收起右侧边栏', exact: true }).click();
  if (process.argv.includes('--model-menu')) await page.getByRole('button', { name: '选择模型，当前 DeepSeek-V4-Pro，推理等级 High', exact: true }).click();
  if (process.argv.includes('--model-options')) await page.getByRole('menuitem').filter({ hasText: /^模型DeepSeek-V4-Pro$/ }).click();
  if (process.argv.includes('--select-flash')) await page.getByRole('menuitemradio', { name: 'DeepSeek-V41-Flash', exact: true }).click();
  if (process.argv.includes('--check-sync')) {
    await page.getByRole('button', { name: '选择模型，当前 DeepSeek-V4-Pro，推理等级 High', exact: true }).waitFor();
    await page.getByRole('button', { name: '访问模式，当前：仅可查看', exact: true }).waitFor();
    await page.getByText('DSHM_REMOTE_ATTACHMENT_20260923', { exact: true }).waitFor();
    await page.getByText('DSHM_APPROVAL_OK', { exact: true }).waitFor();
  }
  if (process.argv.includes('--watch-revocation') || process.argv.includes('--check-revoked-resources')) {
    const bundle = await page.evaluate(() => performance.getEntriesByType('resource').map(entry => entry.name)
      .find(url => new URL(url).pathname.startsWith('/plugins/') && new URL(url).pathname !== '/plugins/events'));
    assert.ok(bundle, 'Expected a real previously loaded plugin bundle');
    console.log('Waiting for desktop revocation of the authorized test device.');
    await page.getByRole('button', { name: '重新连接', exact: true }).waitFor({ state: 'visible', timeout: 60000 });
    assert.equal(await page.getByRole('button', { name: '发送消息', exact: true }).count(), 0, 'Disposed conversation cannot keep sending');
    const resourceStatus = await page.evaluate(async url => (await fetch(url, { cache: 'no-store' })).status, bundle);
    assert.ok(resourceStatus >= 400, 'A revoked device must not reload a previously used bundle');
    await writeFile('artifacts/remote-revocation-android.json', JSON.stringify({ at: new Date().toISOString(), resourceStatus, conversationDisposed: true }));
    if (!process.argv.includes('--check-revoked-resources')) {
    await page.getByRole('button', { name: '重新连接', exact: true }).click();
    await page.getByRole('alert').filter({ hasText: /撤销|失效/ }).waitFor();
    await writeFile('artifacts/remote-revocation-android.json', JSON.stringify({ at: new Date().toISOString(), resourceStatus, conversationDisposed: true, reconnectDenied: true }));
    }
  }
  if (process.argv.includes('--dismiss-intro')) await page.getByRole('button', { name: '继续', exact: true }).click();
  if (process.argv.includes('--submit-question')) {
    const input = page.getByRole('textbox', { name: '描述你想要构建的内容, / 调用指令, @ 文件或对话', exact: true });
    assert.match(await input.innerText(), /^DSHM Remote 联调 02/);
    await page.getByRole('button', { name: '发送消息', exact: true }).click();
  }
  if (process.argv.includes('--answer-gate')) {
    await page.getByText('是否继续 DSHM Remote 验证？', { exact: true }).waitFor();
    await page.getByRole('radio', { name: '继续验证', exact: true }).click();
    await page.getByRole('button', { name: '提交', exact: true }).click();
  }
  if (process.argv.includes('--send-gate')) {
    await page.getByRole('button', { name: '选择工作区', exact: true }).filter({ hasText: 'DSH-TEST' }).waitFor();
    const input = page.getByRole('textbox', { name: '描述你想要构建的内容, / 调用指令, @ 文件或对话', exact: true });
    await input.fill('这是 DSHM Remote 完整接入专用联调会话。请仅回复 DSHM_FULL_REMOTE_READY，不调用工具。');
    await page.getByRole('button', { name: '发送消息', exact: true }).click();
  }
  if (process.argv.includes('--ask-gate')) {
    await page.getByRole('button', { name: 'DSHM远程完整接入联调会话', exact: true }).waitFor();
    await page.getByRole('textbox', { name: '发消息或创建任务, / 调用指令, @ 文件或对话', exact: true }).fill('继续进行手机端交互联调。请调用 ask_user_question，问“是否继续 DSHM Remote 验证？”，选项为“继续验证”和“暂不继续”。收到我的选择后，只回复 DSHM_QUESTION_OK。不调用其他工具。');
    await page.getByRole('button', { name: '发送消息', exact: true }).click();
  }
  if (process.argv.includes('--fresh-ask')) {
    await page.getByRole('button', { name: '新建会话', exact: true }).click();
    await page.getByRole('button', { name: '选择工作区', exact: true }).filter({ hasText: 'DSH-TEST' }).waitFor();
    await page.getByRole('textbox', { name: '描述你想要构建的内容, / 调用指令, @ 文件或对话', exact: true }).fill('DSHM Remote 联调 02。请仅调用 ask_user_question，问“是否继续 DSHM Remote 验证？”，选项为“继续验证”和“暂不继续”。收到选择后只回复 DSHM_QUESTION_OK，不调用其他工具。');
    await page.getByRole('button', { name: '发送消息', exact: true }).click();
  }
  await page.waitForTimeout(5000);
  const report = { at: new Date().toISOString(), url: page.url(), text: (await page.locator('body').innerText()).slice(0, 5000), controls: await page.locator('button, textarea, [contenteditable="true"]').evaluateAll(nodes => nodes.map(node => ({ tag: node.tagName, role: node.getAttribute('role'), label: node.getAttribute('aria-label'), title: node.getAttribute('title'), text: node.textContent?.slice(0, 120) }))), errors: errors.map(message => message.split('\n')[0]), resources };
  // 配对链接与凭据不能进入诊断报告；这里只读渲染文本，不读表单 value 或存储。
  await writeFile('artifacts/remote-runtime-android.json', JSON.stringify(report, null, 2));
  await page.screenshot({ path: 'artifacts/remote-runtime-android.png' });
  console.log(JSON.stringify(process.argv.includes('--brief') ? { at: report.at, text: report.text.slice(-600), errors: report.errors, resources } : report));
} finally { await device.close(); }
