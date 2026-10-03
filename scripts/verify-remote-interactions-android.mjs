import assert from 'node:assert/strict';
import { _android } from 'playwright';
import { readFile, writeFile } from 'node:fs/promises';
import { androidAppWebView } from './android-app-webview.mjs';

assert.equal(process.env.DSHM_RUN_LIVE, '1', 'Real prompts require DSHM_RUN_LIVE=1');
const action = process.argv[2];
assert.ok(['prepare', 'question', 'phone-answer', 'desktop-answer', 'phone-stale', 'inspect-plan', 'approve-plan', 'discuss-plan', 'finish'].includes(action));
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
  if (action !== 'prepare' && !(await page.getByRole('region', { name: '聊天内容', exact: true }).count())) {
    const previous = JSON.parse(await readFile('artifacts/remote-interactions-prepare-android.json', 'utf8'));
    assert.match(previous.chat, /^DSHM 交互同步联调 \d+$/);
    await page.getByRole('button', { name: new RegExp(`^${previous.chat}`) }).click();
  }
  const menu = async name => { await page.getByRole('button', { name: 'Remote 选项', exact: true }).click(); await page.getByRole('button', { name, exact: true }).click(); };
  if (action === 'prepare') {
    if (!(await page.getByRole('region', { name: '聊天内容', exact: true }).count())) await page.getByRole('button', { name: /^DSHM Remote 联调提示/ }).click();
    await menu('新建聊天');
    await page.getByRole('dialog', { name: '选择工作区', exact: true }).getByRole('button', { name: 'DSH-TEST', exact: true }).click();
    report.chat = `DSHM 交互同步联调 ${Date.now()}`;
    await menu('重命名聊天');
    await page.getByRole('textbox', { name: '聊天名称', exact: true }).fill(report.chat);
    await page.getByRole('button', { name: '保存名称', exact: true }).click();
  }
  report.chat = await workspace.locator('.remote-heading').innerText();
  assert.match(report.chat, /^DSHM 交互同步联调 \d+$/);
  const question = page.getByRole('region', { name: '等待回答', exact: true });
  const review = page.getByRole('region', { name: '等待计划确认', exact: true });
  const stop = page.getByRole('button', { name: '停止生成', exact: true });
  const history = page.getByRole('region', { name: '聊天内容', exact: true });
  if (action === 'prepare' || action === 'question') {
    report.marker = `DSHM_CROSS_END_${Date.now()}`;
    await page.getByRole('textbox', { name: '消息', exact: true }).fill(`这是跨端提问同步测试。仅调用 ask_user_question，问“由哪端完成此次验证？”，选项“手机确认”和“电脑确认”。收到回答后只回复 ${report.marker}，不调用其他工具。`);
    await page.getByRole('button', { name: '发送消息', exact: true }).click();
    await question.waitFor({ timeout: 90000 });
    report.pending = await question.innerText();
  } else if (action === 'phone-answer' || action === 'desktop-answer' || action === 'phone-stale') {
    if (action === 'phone-answer') {
      await question.getByRole('radio', { name: /^手机确认/ }).check();
      await question.getByRole('button', { name: '提交回答', exact: true }).click();
    }
    if (action === 'phone-stale') {
      await question.getByRole('radio', { name: /^手机确认/ }).check();
      const submit = question.getByRole('button', { name: '提交回答', exact: true });
      const box = await submit.boundingBox(); assert.ok(box);
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      await page.mouse.down();
      console.log(JSON.stringify({ phase: 'phone-pointer-down', chat: report.chat }));
      // 保持真实点击在途，等待电脑提交移除旧 DOM 后再松手。
      try { await question.waitFor({ state: 'detached', timeout: 60000 }); }
      finally { await page.mouse.up(); }
      report.stalePointerReleased = true;
    }
    await question.waitFor({ state: 'detached', timeout: 90000 });
    await stop.waitFor({ state: 'detached', timeout: 90000 });
    report.questionRemoved = await question.count() === 0;
    report.lastReply = await history.getByRole('article', { name: '模型回复' }).last().innerText();
    assert.match(report.lastReply, /DSHM_CROSS_END_\d+/);
  } else if (action.endsWith('plan')) {
    await review.waitFor({ timeout: 90000 });
    report.plan = await review.innerText();
    report.geometry = await review.evaluate(el => ({ card: el.getBoundingClientRect().toJSON(), viewport: el.closest('.conversation').getBoundingClientRect().toJSON() }));
    await review.scrollIntoViewIfNeeded();
    await page.screenshot({ path: `artifacts/remote-${action}-android.png` });
    if (action !== 'inspect-plan') {
      await review.getByRole('button', { name: action === 'approve-plan' ? '批准计划' : '提出修改', exact: true }).click();
      await review.waitFor({ state: 'detached', timeout: 60000 });
      await stop.waitFor({ state: 'detached', timeout: 90000 });
      report.reviewRemoved = true;
      report.lastReply = await history.getByRole('article', { name: '模型回复' }).last().innerText();
    }
  } else {
    assert.equal(await stop.count(), 0); assert.equal(await review.count(), 0); assert.equal(await question.count(), 0);
    await menu('归档聊天');
    await page.getByRole('button', { name: /^DSHM Remote 联调提示/ }).click();
    report.restoredChat = await workspace.locator('.remote-heading').innerText();
  }
  assert.deepEqual(report.errors, []); assert.deepEqual(report.resources, []);
} catch (error) { report.failure = error.message; process.exitCode = 1; }
finally {
  const result = JSON.stringify(report, null, 2);
  await writeFile(`artifacts/remote-interactions-${action}-android.json`, result);
  if (report.chat?.match(/^DSHM 交互同步联调 \d+$/)) await writeFile(`artifacts/remote-interactions-${report.chat.split(' ').at(-1)}-${action}.json`, result);
  console.log(JSON.stringify(report)); await device.close();
}
