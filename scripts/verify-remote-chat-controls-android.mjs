import assert from 'node:assert/strict';
import { _android } from 'playwright';
import { writeFile } from 'node:fs/promises';
import { androidAppWebView } from './android-app-webview.mjs';

assert.equal(process.env.DSHM_RUN_LIVE, '1', 'Real prompts require DSHM_RUN_LIVE=1');
const device = (await _android.devices({ omitDriverInstall: true })).find(item => item.serial() === process.env.DSHM_ANDROID_SERIAL);
assert.ok(device);
const report = { at: new Date().toISOString(), errors: [], resources: [], chat: `DSHM 聊天控制联调 ${Date.now()}` };
try {
  const first = await (await androidAppWebView(device)).page();
  const context = first.context();
  let page = context.pages().find(item => item.url().startsWith('https://remote.dshm.invalid/'));
  if (!page) {
    const ordinary = context.pages().find(item => item.url().startsWith('https://appassets.androidplatform.net/'));
    assert.ok(ordinary);
    await ordinary.getByRole('button', { name: '打开侧边抽屉', exact: true }).click();
    const opened = context.waitForEvent('page');
    await ordinary.getByRole('button', { name: 'Remote', exact: true }).click(); await opened;
    page = context.pages().find(item => item.url().startsWith('https://remote.dshm.invalid/'));
  }
  assert.ok(page); page.setDefaultTimeout(15000);
  page.on('pageerror', error => report.errors.push(error.message));
  page.on('response', response => { if (response.status() >= 400) report.resources.push({ path: new URL(response.url()).pathname, status: response.status() }); });
  const menu = async name => { await page.getByRole('button', { name: 'Remote 选项', exact: true }).click(); await page.getByRole('button', { name, exact: true }).click(); };
  const heading = page.getByTestId('remote-workspace').locator('.remote-heading');
  await page.getByTestId('remote-workspace').waitFor({ timeout: 60000 });
  const resumeTitle = process.argv.find(arg => arg.startsWith('--chat='))?.slice(7);
  if (resumeTitle && !(await page.getByRole('region', { name: '聊天内容', exact: true }).count())) {
    assert.match(resumeTitle, /^DSHM 聊天控制联调 \d+$/);
    await page.getByRole('button', { name: new RegExp(`^${resumeTitle}`) }).click();
  }
  if (process.argv.includes('--resume')) {
    report.chat = await heading.innerText(); assert.match(report.chat, /^DSHM 聊天控制联调 /);
  } else {
  assert.equal(await heading.innerText(), 'DSHM Remote 联调提示');
  await menu('新建聊天');
  await page.getByRole('dialog', { name: '选择工作区', exact: true }).getByRole('button', { name: 'DSH-TEST', exact: true }).click();
  await menu('重命名聊天');
  await page.getByRole('textbox', { name: '聊天名称', exact: true }).fill(report.chat);
  await page.getByRole('button', { name: '保存名称', exact: true }).click();
  }
  const input = page.getByRole('textbox', { name: '消息', exact: true });
  const history = page.getByRole('region', { name: '聊天内容', exact: true });
  const repliesBefore = await history.getByRole('article', { name: '模型回复' }).count();
  await page.evaluate(() => {
    const data = { longTasks: [], clicks: [] };
    const observer = new PerformanceObserver(list => data.longTasks.push(...list.getEntries().map(e => ({ at: e.startTime, duration: e.duration }))));
    observer.observe({ type: 'longtask' });
    const listener = e => { if (e.target.closest('button.send')) data.clicks.push({ type: e.type, at: performance.now() }); };
    for (const type of ['pointerdown', 'pointerup', 'click']) document.addEventListener(type, listener, true);
    window.__chatControlProbe = () => { observer.disconnect(); for (const type of ['pointerdown', 'pointerup', 'click']) document.removeEventListener(type, listener, true); delete window.__chatControlProbe; return data; };
  });
  await input.fill(process.argv.includes('--gate-stop') ? '这是停止生成的专用验证。仅调用 ask_user_question，问“等待停止？”，选项“继续”和“结束”。不调用其他工具。' : '这是停止生成的专用验证。不调用任何工具。请从1到300逐行列出序号，并给每行写一句介绍不同颜色的中文短句，持续输出到300行。');
  await page.getByRole('button', { name: '发送消息', exact: true }).click();
  const stop = page.getByRole('button', { name: '停止生成', exact: true });
  await stop.waitFor({ timeout: 60000 });
  if (process.argv.includes('--gate-stop')) await page.getByRole('region', { name: '等待回答', exact: true }).waitFor({ timeout: 90000 });
  else await page.waitForFunction(count => { const rows = [...document.querySelectorAll('.conversation article')]; return rows.length > count && rows.at(-1).innerText.length > 120; }, repliesBefore, { timeout: 90000 });
  try { await stop.click(); } finally { report.probe = await page.evaluate(() => window.__chatControlProbe()); }
  await stop.waitFor({ state: 'detached', timeout: 60000 });
  if (!process.argv.includes('--gate-stop')) await history.getByText('已停止', { exact: true }).last().waitFor();
  report.stopped = true;
  report.stoppedText = (await history.innerText()).slice(-2500);
  await page.screenshot({ path: 'artifacts/remote-chat-stopped-android.png' });
  if (!process.argv.includes('--stop-only')) {
  await input.fill('这是即时引导的专用验证。请仅调用 ask_user_question，问“是否继续引导验证？”，选项“继续验证”和“暂不继续”。等我回答后只回复 GATE_DONE，不调用其他工具。');
  await page.getByRole('button', { name: '发送消息', exact: true }).click();
  const question = page.getByRole('region', { name: '等待回答', exact: true });
  await question.waitFor({ timeout: 90000 });
  report.marker = `DSHM_STEER_OK_${Date.now()}`;
  await input.fill(`在当前提问结束后按这条新要求继续：只回复 ${report.marker}，不调用工具。`);
  await page.getByRole('button', { name: '加入队列', exact: true }).click();
  const queue = page.getByLabel('待发送队列', { exact: true });
  await queue.getByRole('button', { name: '立即引导', exact: true }).click();
  await queue.waitFor({ state: 'detached', timeout: 60000 });
  // DSH steer moves a message to next-step; it does not bypass an active tool's
  // question or permission. Complete that interaction before asserting the reply.
  if (!process.argv.includes('--desktop-answer')) {
    await question.getByRole('radio', { name: /^继续验证/ }).check();
    await question.getByRole('button', { name: '提交回答', exact: true }).click();
  }
  await question.waitFor({ state: 'detached', timeout: 60000 });
  await history.getByRole('article', { name: '模型回复' }).getByText(report.marker, { exact: true }).waitFor({ timeout: 90000 });
  await stop.waitFor({ state: 'detached', timeout: 60000 });
  report.steered = true;
  report.turns = await history.locator('[data-turn-tail]').evaluateAll(rows => rows.map(row => row.dataset.turnTail));
  await page.screenshot({ path: 'artifacts/remote-chat-steered-android.png' });
  }
  assert.deepEqual(report.errors, []); assert.deepEqual(report.resources, []);
  // Leave the dedicated chat visible for independent desktop synchronization QA.
} catch (error) { report.failure = error.message; process.exitCode = 1; }
finally { await writeFile('artifacts/remote-chat-controls-android.json', JSON.stringify(report, null, 2)); console.log(JSON.stringify({ at: report.at, chat: report.chat, stopped: report.stopped, steered: report.steered, failure: report.failure, errors: report.errors })); await device.close(); }
