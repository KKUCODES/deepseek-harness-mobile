import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { _android } from 'playwright';
import { androidAppWebView } from './android-app-webview.mjs';

assert.equal(process.env.DSHM_RUN_LIVE, '1');
const phase = process.argv[2] ?? 'inspect';
assert.ok(['inspect', 'open', 'settings', 'ordinary-settings', 'pending', 'background', 'ordinary', 'same-chat', 'notifications', 'banner'].includes(phase));
const device = (await _android.devices({ omitDriverInstall: true })).find(item => item.serial() === process.env.DSHM_ANDROID_SERIAL);
assert.ok(device); device.setDefaultTimeout(15000);
const report = { at: new Date().toISOString(), phase };
try {
  if (phase === 'background') await device.shell('input keyevent KEYCODE_HOME');
  else if (phase === 'banner') {
    // 非聚焦PopupWindow不一定进入MuMu的活动窗口树；日志只定位截图时机，截图用于视觉核验。
    const logs = async () => (await device.shell('logcat -d -v brief -s DSHMNotifications:D *:S')).toString();
    const before = await logs();
    const deadline = Date.now() + 45000;
    let fresh = '';
    while (Date.now() < deadline && !fresh.includes('foreground=ValidationActivity')) {
      fresh = (await logs()).slice(before.length);
      await new Promise(resolve => setTimeout(resolve, 150));
    }
    assert.ok(fresh.includes('foreground=ValidationActivity'), '未捕获前台提醒分流');
    await device.screenshot({ path: 'artifacts/notifications-banner-android.png' });
    report.bannerCaptured = true;
    // 已在786×1624的真实截图核对该横幅位置；尺寸变化拒绝复用坐标。
    assert.match((await device.shell('wm size')).toString(), /786x1624/);
    const first = await (await androidAppWebView(device)).page();
    const context = first.context();
    await device.shell('input tap 390 133');
    const remote = context.pages().find(page => page.url().startsWith('https://remote.dshm.invalid/'))
      ?? await context.waitForEvent('page', { predicate: page => page.url().startsWith('https://remote.dshm.invalid/'), timeout: 60000 });
    await remote.locator('.remote-heading').getByText('DSHM Remote 联调提示', { exact: true }).first().waitFor();
    report.bannerOpenedTestChat = true;
  }
  else if (phase === 'notifications') {
    const keys = (await device.shell('cmd notification list')).toString().split('\n').filter(line => line.includes('|dev.dshmobile.validation|'));
    report.notifications = keys;
  } else {
    const page = await (await androidAppWebView(device)).page(), context = page.context();
    let remote = context.pages().find(page => page.url().startsWith('https://remote.dshm.invalid/'));
    if (phase === 'ordinary-settings') {
      const ordinary = context.pages().find(page => page.url().startsWith('https://appassets.androidplatform.net/'));
      if (!await ordinary.getByRole('button', { name: '退出设置', exact: true }).count()) {
        await ordinary.getByRole('button', { name: '打开侧边抽屉', exact: true }).click();
        await ordinary.getByRole('button', { name: '设置', exact: true }).click();
      }
      await ordinary.getByRole('button', { name: 'Remote 提醒', exact: true }).click();
    }
    if (phase === 'open') {
      const ordinary = context.pages().find(page => page.url().startsWith('https://appassets.androidplatform.net/'));
      if (await ordinary.getByRole('button', { name: '退出设置', exact: true }).count()) await ordinary.getByRole('button', { name: '电脑连接', exact: true }).click();
      else {
        await ordinary.getByRole('button', { name: '打开侧边抽屉', exact: true }).click();
        await ordinary.getByRole('button', { name: 'Remote', exact: true }).click();
      }
      // 点击期间页面可能已经创建，先读取现有页面，避免等一个已经发生的事件。
      remote ??= context.pages().find(page => page.url().startsWith('https://remote.dshm.invalid/'))
        ?? await context.waitForEvent('page', { predicate: page => page.url().startsWith('https://remote.dshm.invalid/'), timeout: 60000 });
      await remote.getByTestId('remote-workspace').waitFor({ timeout: 60000 });
      await remote.locator('.connection-dot.online').waitFor({ timeout: 60000 });
    }
    if (['settings', 'pending'].includes(phase)) {
      assert.ok(remote);
      await remote.getByRole('button', { name: 'Remote 选项', exact: true }).click();
      await remote.getByRole('button', { name: phase === 'settings' ? 'Remote 提醒' : /^待处理/ }).click();
    }
    if (phase === 'ordinary') {
      assert.ok(remote);
      if (await remote.getByRole('button', { name: '关闭窗口', exact: true }).count()) await remote.getByRole('button', { name: '关闭窗口', exact: true }).click();
      if (await remote.getByRole('textbox', { name: '消息', exact: true }).count()) await remote.getByRole('button', { name: '返回', exact: true }).click();
      await remote.getByRole('button', { name: '返回', exact: true }).click();
    }
    if (phase === 'same-chat') {
      assert.ok(remote);
      await remote.locator('.remote-session-row').filter({ hasText: 'DSHM Remote 联调提示' }).click();
      assert.equal(await remote.getByRole('textbox', { name: '消息', exact: true }).inputValue(), '');
    }
    report.pages = await Promise.all(context.pages().map(async page => ({ url: page.url(),
      heading: await page.locator('.remote-heading').allTextContents(),
      sheets: await page.getByRole('dialog').allTextContents(),
      notifications: await page.getByText(/DSHM_NOTIFICATION_/).allTextContents(),
      status: await page.getByRole('status').allTextContents(), alerts: await page.getByRole('alert').allTextContents() })));
    await device.screenshot({ path: `artifacts/notifications-${phase}-android.png` });
  }
  report.foreground = (await device.shell('dumpsys activity activities')).toString().match(/topResumedActivity=.*?dev\.dshmobile\.validation\/\.(\w+)/)?.[1] ?? 'other-app';
} catch (error) { report.failure = error.message; process.exitCode = 1; }
finally { await writeFile(`artifacts/notifications-${phase}-android.json`, JSON.stringify(report, null, 2)); console.log(JSON.stringify(report)); await device.close(); }
