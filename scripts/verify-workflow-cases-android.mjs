import assert from 'node:assert/strict';
import { _android } from 'playwright';
import { readFile, writeFile } from 'node:fs/promises';
import { androidAppWebView } from './android-app-webview.mjs';

// 每个场景只在 DSH-TEST 新建专用会话。settle/reopen 不发送消息，可在超时后安全续接。
assert.equal(process.env.DSHM_RUN_LIVE, '1');
const [scenario, action = 'run'] = process.argv.slice(2);
assert.ok(['parallel', 'failure', 'cancel'].includes(scenario));
assert.ok(['run', 'settle', 'reopen'].includes(action));
const device = (await _android.devices({ omitDriverInstall: true })).find(item => item.serial() === process.env.DSHM_ANDROID_SERIAL);
assert.ok(device);
const report = { at: new Date().toISOString(), scenario, action, errors: [], resources: [] };
const seedPath = `artifacts/workflow-${scenario}-seed.json`;
try {
  const first = await (await androidAppWebView(device)).page();
  const context = first.context();
  let page = context.pages().find(item => item.url().startsWith('https://remote.dshm.invalid/'));
  if (!page) {
    const ordinary = context.pages().find(item => item.url().startsWith('https://appassets.androidplatform.net/'));
    assert.ok(ordinary); await ordinary.getByRole('button', { name: '打开侧边抽屉', exact: true }).click();
    const opened = context.waitForEvent('page'); await ordinary.getByRole('button', { name: 'Remote', exact: true }).click(); await opened;
    page = context.pages().find(item => item.url().startsWith('https://remote.dshm.invalid/'));
  }
  assert.ok(page); page.setDefaultTimeout(15000);
  page.on('pageerror', () => report.errors.push('page-error'));
  page.on('response', response => { if (response.status() >= 400) report.resources.push({ path: new URL(response.url()).pathname, status: response.status() }); });
  const workspace = page.getByTestId('remote-workspace'); await workspace.waitFor({ timeout: 60000 });
  const heading = workspace.locator('.remote-heading');
  const button = name => page.getByRole('button', { name, exact: true });
  const menu = async name => { await button('Remote 选项').click(); await button(name).click(); };
  const editor = page.getByRole('textbox', { name: '消息', exact: true });
  let seed;
  if (action === 'run') {
    await menu('新建聊天'); await page.getByRole('dialog', { name: '选择工作区', exact: true }).getByRole('button', { name: 'DSH-TEST', exact: true }).click();
    seed = { chat: `DSHM 工作流${scenario} ${Date.now()}`, marker: `DSHM_WORKFLOW_${scenario.toUpperCase()}_${Date.now()}`, draft: `工作流${scenario}父草稿` };
    await menu('重命名聊天'); await page.getByRole('textbox', { name: '聊天名称', exact: true }).fill(seed.chat);
    await button('保存名称').click(); await page.getByRole('dialog', { name: '重命名聊天', exact: true }).waitFor({ state: 'detached' });
    const task = '不要调用工具、不读写文件，只用中文写300字说明如何检查聊天同步，最后单独回复 MEMBER_DONE。';
    const script = scenario === 'parallel'
      ? `phase("并行检查"); const items = await parallel([() => agent(${JSON.stringify(task)}, {label:"检查甲", phase:"并行检查"}), () => agent(${JSON.stringify(task)}, {label:"检查乙", phase:"并行检查"})]); phase("汇总"); const summary = await agent("不调用工具，只回复 SUMMARY_DONE。", {label:"汇总成员", phase:"汇总"}); return {items, summary};`
      : scenario === 'failure' ? 'throw new Error("DSHM_WORKFLOW_EXPECTED_FAILURE");'
        : 'phase("等待取消"); const value = await agent("不要调用工具、不读写文件。请写一篇6000字的中文文章说明聊天同步的测试思路，不要提前结束。", {label:"取消测试成员", phase:"等待取消"}); return value;';
    const prompt = `这是 DSHM 界面的受控联调。我明确要求只调用一次 workflow 工具，meta.name 使用 dshm-${scenario}，description 使用手机工作流验收。请严格执行以下 JavaScript 脚本，不要变更逻辑或重试：\n${script}\n不调用其他工具，不访问文件、命令或网络。${scenario === 'failure' ? '抛错是预期行为，不修复、不重试。' : ''}工具结束后只回复 ${seed.marker}。`;
    await writeFile(seedPath, JSON.stringify(seed, null, 2));
    await editor.fill(prompt); await button('发送消息').click(); report.sent = true;
    if (scenario !== 'cancel') await editor.fill(seed.draft);
  } else seed = JSON.parse(await readFile(seedPath, 'utf8'));
  report.chat = seed.chat;
  if (action === 'reopen' && await heading.innerText() !== seed.chat) {
    if (await editor.count()) { assert.equal(await heading.innerText(), 'DSHM Remote 联调提示'); await button('返回').click(); }
    await menu('查看已归档聊天'); await page.getByRole('button', { name: new RegExp(`^${seed.chat}`) }).click();
  }
  assert.equal(await heading.innerText(), seed.chat);
  const reopenedDraft = action === 'reopen' ? await editor.inputValue() : null;
  if (action === 'reopen') report.savedTestDraftPresent = reopenedDraft === seed.draft;
  const card = page.locator('[data-workflow-run]');
  await card.waitFor({ timeout: 60000 }); assert.equal(await card.count(), 1);
  if (scenario === 'cancel' && action === 'run') {
    await card.getByRole('button', { name: '打开 取消测试成员', exact: true }).waitFor({ timeout: 60000 });
    assert.equal(await card.getAttribute('data-run-status'), 'running');
    await button('停止生成').click(); report.stopRequested = true;
  }
  const expected = { parallel: 'completed', failure: 'failed', cancel: 'cancelled' }[scenario];
  await page.waitForFunction(expected => document.querySelector('[data-workflow-run]')?.dataset.runStatus === expected, expected, { timeout: 60000 });
  await button('停止生成').waitFor({ state: 'detached', timeout: 60000 });
  if (scenario !== 'cancel') await page.getByRole('article', { name: '模型回复' }).getByText(seed.marker, { exact: true }).waitFor({ timeout: 60000 });
  if (scenario === 'cancel' && action !== 'reopen') await editor.fill(seed.draft);
  const tool = page.locator('details.remote-tool-card').filter({ has: page.locator('summary').filter({ hasText: /^workflow ·/ }) });
  assert.equal(await tool.count(), 1);
  if (await tool.getAttribute('open') === null) await tool.locator('summary').click();
  const executed = JSON.parse(await tool.locator('pre').first().innerText());
  if (scenario === 'parallel') assert.match(executed.script, /await\s+parallel\s*\(/);
  if (scenario === 'failure') assert.match(await tool.innerText(), /DSHM_WORKFLOW_EXPECTED_FAILURE/);
  if (scenario === 'cancel') assert.match(await tool.locator('summary').innerText(), /^workflow · 调用已结束/);
  report.originalToolRecordChecked = true;
  await tool.locator('summary').click();
  // 只展开已收起的原卡片，避免把自动展开的异常状态再次折叠。
  for (const title of [`dshm-${scenario}`, ...(scenario === 'parallel' ? ['并行检查', '汇总'] : scenario === 'cancel' ? ['等待取消'] : [])]) {
    const row = card.locator('[aria-expanded]').filter({ has: page.getByText(title, { exact: true }) }).first();
    if (await row.getAttribute('aria-expanded') === 'false') await row.click();
  }
  report.status = await card.getAttribute('data-run-status');
  report.memberStatuses = await card.locator('[data-member-status]').evaluateAll(nodes => nodes.map(node => node.dataset.memberStatus));
  if (scenario === 'parallel') {
    assert.deepEqual(report.memberStatuses, ['completed', 'completed', 'completed']);
    for (const label of ['检查甲', '检查乙', '汇总成员']) await card.getByText(label, { exact: true }).waitFor();
  } else if (scenario === 'failure') {
    assert.deepEqual(report.memberStatuses, []); await card.getByText('没有启动成员', { exact: true }).waitFor();
  } else assert.deepEqual(report.memberStatuses, ['cancelled']);
  assert.equal(await card.locator('button[data-member-status="running"]').count(), 0);
  assert.equal(await editor.inputValue(), action === 'reopen' ? reopenedDraft : seed.draft);
  await card.scrollIntoViewIfNeeded(); await page.screenshot({ path: `artifacts/workflow-${scenario}-${action}-android.png` });
  if (action === 'reopen') { await button('返回').click(); await menu('查看最近聊天'); }
  else await menu('归档聊天');
  await page.getByRole('button', { name: /^DSHM Remote 联调提示/ }).click();
  assert.equal(await heading.innerText(), 'DSHM Remote 联调提示'); report.returned = true;
  assert.deepEqual(report.errors, []); assert.deepEqual(report.resources, []);
} catch (error) { report.failure = error.message; process.exitCode = 1; }
finally { await writeFile(`artifacts/workflow-${scenario}-${action}-android.json`, JSON.stringify(report, null, 2)); console.log(JSON.stringify(report)); await device.close(); }
