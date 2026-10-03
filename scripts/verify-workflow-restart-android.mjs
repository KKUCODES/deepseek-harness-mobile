import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { _android } from 'playwright';
import { androidAppWebView } from './android-app-webview.mjs';

// run 只发送一次专用任务；observe/history 只验收已有记录，超时后不得重新 run。
const action = process.argv[2] ?? 'observe';
assert.ok(['run', 'observe', 'history'].includes(action));
if (action === 'run') assert.equal(process.env.DSHM_RUN_LIVE, '1');
const device = (await _android.devices({ omitDriverInstall: true }))
  .find(item => item.serial() === process.env.DSHM_ANDROID_SERIAL);
assert.ok(device, 'MuMu must already be running');
const seedPath = 'artifacts/workflow-restart-seed.json';
const report = { at: new Date().toISOString(), action, errors: [], resources: [], samples: [] };
try {
  const first = await (await androidAppWebView(device)).page();
  const context = first.context();
  let page = context.pages().find(item => item.url().startsWith('https://remote.dshm.invalid/'));
  if (!page && action === 'history') {
    const ordinary = context.pages().find(item => item.url().startsWith('https://appassets.androidplatform.net/'));
    assert.ok(ordinary);
    await ordinary.getByRole('button', { name: '打开侧边抽屉', exact: true }).click();
    const opened = context.waitForEvent('page');
    await ordinary.getByRole('button', { name: 'Remote', exact: true }).click();
    await opened;
    page = context.pages().find(item => item.url().startsWith('https://remote.dshm.invalid/'));
  }
  assert.ok(page, 'Open the existing Remote connection before testing');
  page.setDefaultTimeout(15000);
  page.on('pageerror', error => report.errors.push(error.message));
  page.on('response', response => {
    if (response.status() >= 400) report.resources.push({ path: new URL(response.url()).pathname, status: response.status() });
  });
  const workspace = page.getByTestId('remote-workspace');
  const heading = workspace.locator('.remote-heading');
  const editor = page.getByRole('textbox', { name: '消息', exact: true });
  const button = name => page.getByRole('button', { name, exact: true });
  const menu = async name => { await button('Remote 选项').click(); await button(name).click(); };
  await workspace.waitFor({ timeout: 60000 });
  let seed;
  if (action === 'run') {
    assert.equal(await heading.innerText(), 'DSHM Remote 联调提示');
    await menu('新建聊天');
    await page.getByRole('dialog', { name: '选择工作区', exact: true })
      .getByRole('button', { name: 'DSH-TEST', exact: true }).click();
    seed = { chat: `DSHM 工作流重启 ${Date.now()}`, draft: '电脑重启后仍须保留的工作流草稿' };
    await menu('重命名聊天');
    await page.getByRole('textbox', { name: '聊天名称', exact: true }).fill(seed.chat);
    await button('保存名称').click();
    await page.getByRole('dialog', { name: '重命名聊天', exact: true }).waitFor({ state: 'detached' });
    seed.script = 'phase("重启检查"); const result = await agent("不要调用工具、不读写文件。请写一篇6000字的中文文章说明聊天同步的测试思路，不要提前结束。", {label:"重启测试成员", phase:"重启检查"}); return result;';
    seed.prompt = `这是 DSHM 受控重启验收。只调用一次 workflow 工具，meta.name 为 dshm-restart，description 为手机重启恢复验收。严格执行下列 JavaScript，不变更、不重试：\n${seed.script}\n不调用其他工具，不访问文件、命令或网络。工具结束后只回复 DSHM_RESTART_WORKFLOW_FINISHED。`;
    await writeFile(seedPath, JSON.stringify(seed, null, 2));
    await editor.fill(seed.prompt);
    await button('发送消息').click();
    report.sent = true;
    await editor.fill(seed.draft);
  } else seed = JSON.parse(await readFile(seedPath, 'utf8'));
  report.chat = seed.chat;
  if (action === 'history') {
    const current = await heading.innerText();
    assert.ok(['Remote', 'DSHM Remote 联调提示'].includes(current));
    if (current === 'DSHM Remote 联调提示') await button('返回').click();
    await menu('查看已归档聊天');
    await page.getByRole('button', { name: new RegExp(`^${seed.chat}`) }).click();
  }
  assert.equal(await heading.innerText(), seed.chat);
  const card = page.locator('[data-workflow-run]');
  if (action === 'run') {
    await card.getByRole('button', { name: '打开 重启测试成员', exact: true }).waitFor({ timeout: 90000 });
    assert.equal(await card.getAttribute('data-run-status'), 'running');
    await page.getByText('正在保存草稿…', { exact: true }).waitFor({ state: 'detached' });
    report.runningAt = new Date().toISOString();
    await page.screenshot({ path: 'artifacts/workflow-restart-running-android.png' });
    console.log(JSON.stringify({ ready: true, chat: seed.chat, at: report.runningAt }));
  }
  // 持续观察同一 WebView，不刷新、不手动重连、不重发提示，记录 Host 重启期间的实际投影。
  const deadline = Date.now() + 180000;
  let previous;
  while (Date.now() < deadline) {
    const sample = await page.evaluate(() => ({
      heading: document.querySelector('[data-testid="remote-workspace"] .remote-heading')?.textContent ?? null,
      status: document.querySelector('[data-workflow-run]')?.getAttribute('data-run-status') ?? null,
      notices: [...document.querySelectorAll('[role="alert"], [role="status"]')].map(node => node.textContent),
    }));
    if (JSON.stringify(sample) !== previous) {
      previous = JSON.stringify(sample);
      report.samples.push({ at: new Date().toISOString(), ...sample });
      console.log(previous);
    }
    if (sample.status && sample.status !== 'running') break;
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  assert.equal(await card.getAttribute('data-run-status'), 'interrupted', 'Restart must project the original interrupted status');
  assert.equal(await heading.innerText(), seed.chat);
  assert.equal(await editor.inputValue(), seed.draft);
  await button('停止生成').waitFor({ state: 'detached' });
  assert.equal(await card.count(), 1, 'The workflow must not be replayed');
  assert.equal(await page.getByText(seed.prompt, { exact: true }).count(), 1, 'The sent request must not be duplicated');
  for (const title of ['dshm-restart', '重启检查']) {
    const row = card.locator('[aria-expanded]').filter({ has: page.getByText(title, { exact: true }) }).first();
    if (await row.getAttribute('aria-expanded') === 'false') await row.click();
  }
  report.memberStatuses = await card.locator('[data-member-status]').evaluateAll(nodes => nodes.map(node => node.dataset.memberStatus));
  assert.deepEqual(report.memberStatuses, ['interrupted']);
  assert.equal(await card.getByRole('button', { name: '打开 重启测试成员', exact: true }).count(), 0);
  const tool = page.locator('details.remote-tool-card').filter({ has: page.locator('summary').filter({ hasText: /^workflow ·/ }) });
  assert.equal(await tool.count(), 1);
  if (await tool.getAttribute('open') === null) await tool.locator('summary').click();
  assert.equal(JSON.parse(await tool.locator('pre').first().innerText()).script, seed.script);
  await tool.locator('summary').click();
  report.status = 'interrupted';
  report.draftPreserved = true;
  report.originalToolRecordChecked = true;
  await card.scrollIntoViewIfNeeded();
  await page.screenshot({ path: `artifacts/workflow-restart-${action}-android.png` });
  if (action === 'history') { await button('返回').click(); await menu('查看最近聊天'); }
  else await menu('归档聊天');
  await page.getByRole('button', { name: /^DSHM Remote 联调提示/ }).click();
  assert.equal(await heading.innerText(), 'DSHM Remote 联调提示');
  report.returned = true;
  assert.deepEqual(report.errors, []);
  assert.deepEqual(report.resources, []);
} catch (error) { report.failure = error.message; process.exitCode = 1; }
finally {
  await writeFile(`artifacts/workflow-restart-${action}-android.json`, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report));
  await device.close();
}
