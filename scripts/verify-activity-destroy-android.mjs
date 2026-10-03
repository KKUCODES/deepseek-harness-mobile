import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { _android } from 'playwright';
import { androidAppWebView } from './android-app-webview.mjs';

assert.equal(process.env.DSHM_RUN_LIVE, '1');
const phase = process.argv[2];
assert.ok(['prepare', 'retry', 'inspect', 'cleanup'].includes(phase));
const pkg = 'dev.dshmobile.validation';
const prefix = 'artifacts/activity-destroy';
const report = { at: new Date().toISOString(), phase, errors: [] };
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
let device;
const save = () => writeFile(`${prefix}-${phase === 'retry' ? 'prepare' : phase}-android.json`, JSON.stringify(report, null, 2));
const watchdog = setTimeout(() => {
  report.failure = 'overall_timeout';
  void save().finally(() => process.exit(2));
}, 150000);
try {
  device = (await _android.devices({ omitDriverInstall: true })).find(item => item.serial() === process.env.DSHM_ANDROID_SERIAL);
  assert.ok(device);
  const page = (await (await androidAppWebView(device)).page()).context().pages().find(item => item.url().startsWith('https://remote.dshm.invalid/'));
  assert.ok(page); page.setDefaultTimeout(20000);
  page.on('pageerror', () => report.errors.push('page-error'));
  const main = page.getByTestId('remote-workspace'); await main.waitFor();
  const title = async () => (await main.locator('.remote-heading').innerText()).split('\n')[0];
  const editor = main.getByRole('textbox', { name: '消息', exact: true });
  const history = page.getByRole('region', { name: '聊天内容', exact: true });
  const menu = async name => {
    await main.getByRole('button', { name: 'Remote 选项', exact: true }).click();
    await page.getByRole('button', { name, exact: true }).click();
  };
  const keys = async () => (await device.shell('cmd notification list')).toString().split('\n')
    .filter(line => line.includes(`|${pkg}|`) && line.includes('dshm.remote.notice.outcome:'));
  if (phase === 'prepare' || phase === 'retry') {
    // MuMu仅改Settings数据库不会更新ActivityManager；必须先通过系统真实开关启用。
    // 原值由启用前记录传入。测试结束同样需要系统开关关闭，不能只删除设置键假装恢复。
    assert.equal((await device.shell('settings get global always_finish_activities')).toString().trim(), '1');
    report.systemSwitchNeedsRestore = true;
    if (phase === 'retry') {
      const seed = JSON.parse(await readFile(`${prefix}-setting-only-before.json`, 'utf8'));
      assert.equal(await title(), seed.title);
      assert.equal((await editor.innerText()).trim(), seed.draft);
      assert.deepEqual(await keys(), []);
      Object.assign(report, { title: seed.title, originalReplies: seed.originalReplies, draft: seed.draft, originalSetting: seed.originalSetting });
      report.marker = `DSHM_ACTIVITY_REPLY_${Date.now()}`;
    } else {
    report.originalSetting = process.argv.find(arg => arg.startsWith('--original-setting='))?.split('=')[1];
    assert.match(report.originalSetting ?? '', /^(null|0)$/);
    assert.equal(await main.getByRole('button', { name: '停止生成', exact: true }).count(), 0);
    if (await editor.count()) assert.equal((await editor.innerText()).trim(), '', 'Do not replace an existing draft');
    if (await title() !== 'Remote') await main.getByRole('button', { name: '返回', exact: true }).click();
    await main.locator('button.remote-session-row').filter({ hasText: 'DSHM Remote 联调提示' }).click();
    await history.getByRole('article', { name: '模型回复', exact: true }).nth(15).waitFor();
    assert.equal((await editor.innerText()).trim(), '');
    report.originalReplies = await history.getByRole('article', { name: '模型回复', exact: true }).count();
    assert.deepEqual(await keys(), []);
    report.title = `DSHM 页面回收验证 ${Date.now()}`;
    report.marker = `DSHM_ACTIVITY_REPLY_${Date.now()}`;
    report.draft = `DSHM_ACTIVITY_DRAFT_${Date.now()}`;
    await save();
    await menu('新建聊天');
    await page.getByRole('dialog', { name: '选择工作区', exact: true }).getByRole('button', { name: 'DSH-TEST', exact: true }).click();
    await menu('重命名聊天');
    await page.getByRole('textbox', { name: '聊天名称', exact: true }).fill(report.title);
    await page.getByRole('button', { name: '保存名称', exact: true }).click();
    await editor.click();
    await main.getByRole('button', { name: /^选择模型，当前/ }).click();
    await page.getByRole('dialog', { name: '选择模型', exact: true }).getByRole('button', { name: 'DeepSeek-V41-Flash', exact: true }).click();
    await save();
    }
    report.pidBefore = (await device.shell(`pidof ${pkg}`)).toString().trim();
    await editor.fill(`这是DSHM页面恢复测试。不要调用任何工具，只回复 ${report.marker}`);
    await page.getByRole('button', { name: '发送消息', exact: true }).click();
    report.sent = true; await save();
    await editor.fill(report.draft);
    // 让既有草稿存储完成；不直接注入页面状态或持久数据。
    await delay(700);
    await device.shell('input keyevent KEYCODE_HOME');
    const deadline = Date.now() + 10000;
    while (!page.isClosed() && Date.now() < deadline) await delay(100);
    report.webViewDestroyed = page.isClosed();
    report.activityEvents = (await device.shell('logcat -b events -d -t 200')).toString().split('\n')
      .filter(line => /wm_(destroy_activity|on_destroy_called)/.test(line) && line.includes(pkg));
    report.pidAfter = (await device.shell(`pidof ${pkg}`)).toString().trim();
    assert.ok(report.webViewDestroyed, 'Android must actually destroy the WebView');
    assert.ok(report.activityEvents.some(line => line.includes('RemoteActivity')), 'Require native Activity destroy evidence');
    assert.equal(report.pidAfter, report.pidBefore, 'This check requires a surviving App process');
    const until = Date.now() + 100000;
    while (!(await keys()).length && Date.now() < until) await delay(250);
    report.notifications = await keys();
    assert.equal(report.notifications.length, 1, 'Real completion must notify after Activity destruction');
    report.backgroundAfterActivityDestroyed = true;
  } else {
    const seed = JSON.parse(await readFile(`${prefix}-prepare-android.json`, 'utf8'));
    assert.ok(seed.sent);
    report.title = await title();
    if (phase === 'inspect') {
      // 实际系统通知点击后只检查恢复结果，不从脚本注入会话目标。
      assert.ok(seed.webViewDestroyed && seed.backgroundAfterActivityDestroyed);
      assert.equal(seed.pidBefore, seed.pidAfter);
      assert.equal(report.title, seed.title);
      await history.getByRole('article', { name: '模型回复', exact: true }).getByText(seed.marker, { exact: true }).waitFor();
      assert.equal((await editor.innerText()).trim(), seed.draft);
      assert.equal(await main.getByRole('button', { name: '停止生成', exact: true }).count(), 0);
      report.notifications = await keys(); assert.deepEqual(report.notifications, []);
      report.pid = (await device.shell(`pidof ${pkg}`)).toString().trim();
      assert.equal(report.pid, seed.pidBefore);
      report.replyAndDraftRestored = true;
      await page.screenshot({ path: `${prefix}-restored.png` });
    } else {
      assert.equal(report.title, seed.title);
      assert.equal((await editor.innerText()).trim(), seed.draft);
      await editor.fill(''); await menu('归档聊天');
      await main.locator('button.remote-session-row').filter({ hasText: 'DSHM Remote 联调提示' }).click();
      await history.getByRole('article', { name: '模型回复', exact: true }).nth(seed.originalReplies - 1).waitFor();
      assert.equal(await title(), 'DSHM Remote 联调提示');
      assert.equal((await editor.innerText()).trim(), '');
      assert.equal(await history.getByRole('article', { name: '模型回复', exact: true }).count(), seed.originalReplies);
      assert.deepEqual(await keys(), []);
      assert.equal((await device.shell('settings get global always_finish_activities')).toString().trim(), seed.originalSetting);
      report.finalTitle = await title(); report.originalReplies = seed.originalReplies;
      report.restored = true;
    }
  }
  assert.deepEqual(report.errors, []);
} catch (error) { report.failure = error.message; process.exitCode = 1; }
finally {
  await save(); console.log(JSON.stringify(report));
  if (device) await Promise.race([device.close(), delay(1500)]);
  clearTimeout(watchdog); process.exit(process.exitCode ?? 0);
}
