import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { _android } from 'playwright';
import { androidAppWebView } from './android-app-webview.mjs';

// 只在 DSH-TEST 验证原定时工具。prepare/cleanup 会发消息；watch 绝不重发创建请求。
const action = process.argv[2] ?? 'watch';
const missed = process.argv.includes('--missed');
const prefix = missed ? 'schedule-missed' : 'schedule-recovery';
assert.ok(['prepare', 'capture', 'watch', 'cleanup', 'history'].includes(action));
if (['prepare', 'cleanup'].includes(action)) assert.equal(process.env.DSHM_RUN_LIVE, '1');
const device = (await _android.devices({ omitDriverInstall: true }))
  .find(item => item.serial() === process.env.DSHM_ANDROID_SERIAL);
assert.ok(device);
const seedPath = `artifacts/${prefix}-seed.json`;
const report = { at: new Date().toISOString(), action, errors: [], resources: [], samples: [] };
try {
  const first = await (await androidAppWebView(device)).page();
  const page = first.context().pages().find(item => item.url().startsWith('https://remote.dshm.invalid/'));
  assert.ok(page); page.setDefaultTimeout(15000);
  page.on('pageerror', error => report.errors.push(error.message));
  page.on('response', response => {
    if (response.status() >= 400) report.resources.push({ path: new URL(response.url()).pathname, status: response.status() });
  });
  const workspace = page.getByTestId('remote-workspace');
  const heading = workspace.locator('.remote-heading strong');
  const editor = page.getByRole('textbox', { name: '消息', exact: true });
  const button = name => page.getByRole('button', { name, exact: true });
  const menu = async name => { await button('Remote 选项').click(); await button(name).click(); };
  const sheet = page.getByRole('dialog', { name: '定时任务', exact: true });
  const replies = page.getByRole('article', { name: '模型回复' });
  // article 同时包含折叠思考；只统计正文，不能把思考中提到的提醒当作真实回复。
  const replyCount = marker => replies.evaluateAll((nodes, marker) => nodes.filter(node =>
    [...node.children].filter(child => child.tagName !== 'DETAILS').some(child => child.textContent.includes(marker)),
  ).length, marker);
  const send = async (prompt, marker) => {
    await editor.fill(prompt); await button('发送消息').click();
    await replies.getByText(marker, { exact: true }).waitFor({ timeout: 90000 });
    await button('停止生成').waitFor({ state: 'detached', timeout: 60000 });
  };
  const closeSheet = async () => { if (await sheet.isVisible()) await sheet.getByRole('button', { name: '关闭窗口', exact: true }).click(); };
  await workspace.waitFor({ timeout: 60000 });
  const editorText = () => editor.evaluate(node => 'value' in node ? node.value : node.innerText);
  let seed;
  if (action === 'prepare') {
    const previous = await readFile(seedPath, 'utf8').then(JSON.parse).catch(error => {
      if (error.code === 'ENOENT') return null;
      throw error;
    });
    assert.ok(!previous || previous.cleanedAt, 'Existing test must be observed/cleaned before creating another reminder');
    assert.equal(await heading.innerText(), 'DSHM Remote 联调提示');
    await menu('新建聊天');
    await page.getByRole('dialog', { name: '选择工作区', exact: true }).getByRole('button', { name: 'DSH-TEST', exact: true }).click();
    await page.getByRole('dialog', { name: '选择工作区', exact: true }).waitFor({ state: 'detached' });
    await page.waitForFunction(() => {
      const main = document.querySelector('[data-testid="remote-workspace"]');
      return main && main.querySelectorAll('article').length === 0
        && main.querySelector('.remote-heading strong')?.textContent !== 'DSHM Remote 联调提示';
    });
    const suffix = Date.now();
    seed = { chat: `DSHM 定时恢复 ${suffix}`, once: `DSHM_ONCE_NOTICE_${suffix}`, repeat: `DSHM_REPEAT_NOTICE_${suffix}`, draft: '定时任务恢复验收草稿' };
    await writeFile(seedPath, JSON.stringify(seed, null, 2));
    await menu('重命名聊天');
    await page.getByRole('textbox', { name: '聊天名称', exact: true }).fill(seed.chat);
    await button('保存名称').click();
    await page.getByRole('dialog', { name: '重命名聊天', exact: true }).waitFor({ state: 'detached' });
    seed.prompt = `这是专用定时恢复验收。仅调用 schedule_create 两次：第一条 after_seconds=60，prompt=${JSON.stringify(seed.once)}；第二条 every_seconds=300，prompt=${JSON.stringify(seed.repeat)}。不调用其他工具、不读写文件或执行命令。两个创建成功后只回复 DSHM_SCHEDULE_RECOVERY_READY。之后收到这些提醒时，直接展示提醒内容，不调用工具、不再创建提醒。`;
    await writeFile(seedPath, JSON.stringify(seed, null, 2));
    await send(seed.prompt, 'DSHM_SCHEDULE_RECOVERY_READY');
    await editor.fill(seed.draft);
    await menu('定时任务');
    assert.equal(await sheet.getByRole('listitem').count(), 2);
    const repeat = sheet.getByRole('listitem').filter({ hasText: seed.repeat });
    await repeat.getByText(/^每\s*5\s*分钟$/).waitFor();
    seed.firstRepeatAt = await repeat.locator('time').getAttribute('datetime');
    seed.onceAt = await sheet.getByRole('listitem').filter({ hasText: seed.once }).locator('time').getAttribute('datetime');
    assert.ok(Date.parse(seed.firstRepeatAt) > Date.now());
    await writeFile(seedPath, JSON.stringify(seed, null, 2));
    assert.equal(await replyCount(seed.repeat), 0);
    assert.equal(await replyCount(seed.once), 0);
    report.created = { firstRepeatAt: seed.firstRepeatAt, onceAt: seed.onceAt };
    await page.screenshot({ path: `artifacts/${prefix}-created-android.png` });
  } else seed = JSON.parse(await readFile(seedPath, 'utf8'));
  report.chat = seed.chat;
  if (action === 'history') {
    const current = await heading.innerText();
    assert.ok(['Remote', 'DSHM Remote 联调提示'].includes(current));
    const options = page.getByRole('dialog', { name: 'Remote 选项', exact: true });
    if (await options.isVisible()) await options.getByRole('button', { name: '关闭窗口', exact: true }).click();
    if (current === 'DSHM Remote 联调提示') await button('返回').click();
    await menu('查看已归档聊天');
    await page.getByRole('button', { name: new RegExp(`^${seed.chat}`) }).click();
  }
  assert.equal(await heading.innerText(), seed.chat);
  if (action === 'capture') {
    assert.ok(await sheet.isVisible());
    seed.firstRepeatAt = await sheet.getByRole('listitem').filter({ hasText: seed.repeat }).locator('time').getAttribute('datetime');
    seed.onceAt = await sheet.getByRole('listitem').filter({ hasText: seed.once }).locator('time').getAttribute('datetime');
    await writeFile(seedPath, JSON.stringify(seed, null, 2));
    report.created = { firstRepeatAt: seed.firstRepeatAt, onceAt: seed.onceAt };
    report.onceReplies = await replyCount(seed.once);
    report.repeatReplies = await replyCount(seed.repeat);
  }
  if (action === 'watch') {
    // Host 恢复可能重建页面/关闭窗口；只重新打开查看窗口，不点击连接或发送。
    const deadline = Date.parse(seed.firstRepeatAt) + 300000 + 120000;
    if (missed) assert.ok(Date.now() > Date.parse(seed.firstRepeatAt) + 300000, 'Two actual deadlines must elapse before checking recovery');
    let previous;
    while (Date.now() < deadline) {
      if (await workspace.isVisible() && await editor.isVisible() && !await sheet.isVisible()) await menu('定时任务');
      const sample = {
        onceReplies: await replyCount(seed.once),
        repeatReplies: await replyCount(seed.repeat),
        times: await sheet.locator('time').evaluateAll(nodes => nodes.map(node => node.dateTime)),
        notices: await page.locator('[role="status"], [role="alert"]').allTextContents(),
      };
      if (JSON.stringify(sample) !== previous) {
        previous = JSON.stringify(sample); report.samples.push({ at: new Date().toISOString(), ...sample });
        await writeFile(`artifacts/${prefix}-watch-progress.json`, JSON.stringify(report, null, 2));
        console.log(previous);
      }
      if (sample.onceReplies === 1 && sample.repeatReplies >= (missed ? 1 : 2)) break;
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    assert.equal(await replyCount(seed.once), 1);
    assert.equal(await replyCount(seed.repeat), missed ? 1 : 2);
    assert.equal(await sheet.getByRole('listitem').count(), 1);
    const next = await sheet.getByRole('listitem').filter({ hasText: seed.repeat }).locator('time').getAttribute('datetime');
    assert.equal(Date.parse(next), Date.parse(seed.firstRepeatAt) + 600000, 'The original fixed-rate anchor must be preserved');
    report.nextRepeatAt = next;
    report.onceDeliveredOnce = true;
    report.repeatDeliveredTwice = !missed;
    if (missed) report.twoMissedDeadlinesDeliveredOnce = true;
    assert.equal(await editorText(), seed.draft);
    report.draftPreserved = true;
    await page.screenshot({ path: `artifacts/${prefix}-dispatched-android.png` });
  }
  if (action === 'cleanup') {
    await closeSheet();
    await send(`只调用 schedule_delete 删除本会话 prompt 为 ${seed.repeat} 的重复提醒，使用之前 schedule_create 返回的准确 id。若不确定 id，只调用 schedule_list 核对后删除。不要删除其他提醒，不调用其他工具或创建提醒。成功后只回复 DSHM_SCHEDULE_RECOVERY_CLEAN。`, 'DSHM_SCHEDULE_RECOVERY_CLEAN');
    await editor.fill(seed.draft);
    await menu('定时任务');
    await sheet.getByText('当前没有待触发的定时任务。', { exact: true }).waitFor();
    assert.equal(await sheet.getByRole('listitem').count(), 0);
    const toolCount = name => page.locator('details.remote-tool-card').filter({
      has: page.locator('summary').filter({ hasText: new RegExp(`^${name} ·`) }),
    }).count();
    if (!missed) {
      assert.equal(await toolCount('schedule_create'), 2);
      assert.equal(await toolCount('schedule_delete'), 1);
    }
    report.noSchedulesRemain = true;
    if (!missed) report.originalToolCounts = { create: 2, delete: 1 };
    seed.cleanedAt = new Date().toISOString();
    await writeFile(seedPath, JSON.stringify(seed, null, 2));
    if (missed && await replies.getByText('DSHM_UTF8_1790517933174_DONE', { exact: true }).count()) {
      // 本轮已观察到旧验收驱动的新建导航未完成，不能归档既有专用联调会话。
      await closeSheet(); await menu('重命名聊天');
      await page.getByRole('textbox', { name: '聊天名称', exact: true }).fill('DSHM Remote 联调提示');
      await button('保存名称').click(); await heading.getByText('DSHM Remote 联调提示', { exact: true }).waitFor();
      await editor.fill('');
      report.originalTestChatRestored = true;
      seed.originalTestChatRestored = true; await writeFile(seedPath, JSON.stringify(seed, null, 2));
    }
  }
  if ((action === 'cleanup' || action === 'history') && !report.originalTestChatRestored) {
    if (action === 'history') {
      await replies.getByText('DSHM_SCHEDULE_RECOVERY_CLEAN', { exact: true }).waitFor();
      assert.equal(await replyCount(seed.once), 1);
      assert.equal(await replyCount(seed.repeat), missed ? 1 : 2);
      assert.equal(await editorText(), seed.draft);
      report.originalRepliesAndDraftRetained = true;
      await menu('定时任务');
      await sheet.getByText('电脑暂未提供这个聊天的定时任务。', { exact: true }).waitFor();
      report.defaultCapabilityRestored = true;
    }
    await closeSheet();
    if (action === 'cleanup') await menu('归档聊天');
    else {
      await button('返回').click(); await button('Remote 选项').click();
      // Host 重建可能已恢复默认列表；不把已恢复的筛选误判为缺少按钮。
      if (await button('查看最近聊天').isVisible()) await button('查看最近聊天').click();
      else await page.getByRole('dialog', { name: 'Remote 选项', exact: true }).getByRole('button', { name: '关闭窗口', exact: true }).click();
    }
    await page.getByRole('button', { name: /^DSHM Remote 联调提示/ }).click();
    report.returned = true;
  }
  assert.deepEqual(report.errors, []);
  assert.deepEqual(report.resources, []);
} catch (error) { report.failure = error.message; process.exitCode = 1; }
finally {
  await writeFile(`artifacts/${prefix}-${action}-android.json`, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report));
  await device.close();
}
