import { _android } from 'playwright';
import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { androidAppWebView } from './android-app-webview.mjs';

// 正式设备只读取、打开和取消。提交/撤回都会触发电脑反馈日志，不在此脚本中执行。
const device = (await _android.devices({ omitDriverInstall: true })).find(item => item.serial() === process.env.DSHM_ANDROID_SERIAL);
assert.ok(device, '指定的 Android 设备必须已启动');
device.setDefaultTimeout(15000);
const report = { at: new Date().toISOString(), errors: [], resources: [] };
let page;
try {
  const first = await (await androidAppWebView(device)).page(), context = first.context();
  page = context.pages().find(item => item.url().startsWith('https://remote.dshm.invalid/'));
  if (!page) {
    const ordinary = context.pages().find(item => item.url().startsWith('https://appassets.androidplatform.net/'));
    assert.ok(ordinary);
    await ordinary.getByRole('button', { name: '打开侧边抽屉', exact: true }).click();
    const opened = context.waitForEvent('page');
    await ordinary.getByRole('button', { name: 'Remote', exact: true }).click(); await opened;
    page = context.pages().find(item => item.url().startsWith('https://remote.dshm.invalid/'));
  }
  assert.ok(page);
  page.on('pageerror', () => report.errors.push('page-error'));
  page.on('response', response => { if (response.status() >= 400) report.resources.push({ path: new URL(response.url()).pathname, status: response.status() }); });
  const button = name => page.getByRole('button', { name, exact: true });
  if (await button('重新连接').isVisible()) await button('重新连接').click();
  await page.getByTestId('remote-workspace').waitFor({ timeout: 60000 });
  if (await button('关闭窗口').isVisible()) await button('关闭窗口').click();
  const heading = page.getByTestId('remote-workspace').locator('.remote-heading');
  if (!(await heading.innerText()).startsWith('DSHM ')) {
    await page.getByRole('button', { name: /DSHM Remote 联调提示/ }).click();
  }
  assert.match(await heading.innerText(), /^DSHM /, '只操作已建立的专用测试聊天');
  await button('Remote 选项').click(); await button('电脑插件').click();
  const feedbackRow = page.locator('[data-plugin-id="@deepseek-ai/dsh-client-ui-message-feedback"]');
  await feedbackRow.waitFor();
  assert.equal(await feedbackRow.getAttribute('data-plugin-state'), 'active');
  report.originalPluginActive = true;
  await button('关闭窗口').click();
  // 原按钮冷启动时可能读到旧评价并直接撤回。拦截测试写入，读取仍走真实原生桥；
  // 若触发一次写入则本次验收失败，不能把拦截后的结果当成产品取消成功。
  await page.evaluate(() => {
    const bridge = window.DSHMRemote, original = bridge.postMessage, receive = bridge.onmessage;
    const notifications = new Set();
    window.feedbackReadOnlyGuard = { blocked: 0, reads: 0, notifications: 0, ready: 0,
      restore: () => { bridge.postMessage = original; bridge.onmessage = receive; } };
    const guarded = function (raw) {
      const frame = JSON.parse(raw)?.data?.frame, operation = frame?.operation;
      if (operation?.method === 'remote.feedbackFollow') {
        notifications.add(frame.id); window.feedbackReadOnlyGuard.notifications++;
      }
      if (operation?.endpoint === 'messageFeedback/list') window.feedbackReadOnlyGuard.reads++;
      if (['messageFeedback/put', 'messageFeedback/delete', 'sessionFeedback/record', 'commands/execute', 'session/prompt'].includes(operation?.endpoint)) {
        window.feedbackReadOnlyGuard.blocked++; throw new Error('Real feedback writes are not part of this check');
      }
      return original.call(bridge, raw);
    };
    bridge.postMessage = guarded;
    bridge.onmessage = function (event) {
      const frame = JSON.parse(event.data)?.event;
      if (notifications.has(frame?.id) && frame.type === 'event' && frame.value?.type === 'ready') window.feedbackReadOnlyGuard.ready++;
      return receive.call(bridge, event);
    };
    if (bridge.postMessage !== guarded) throw new Error('Read-only guard could not be installed');
  });
  const chatTitle = await heading.innerText();
  await page.getByTestId('remote-workspace').getByRole('button', { name: '返回', exact: true }).click();
  await page.locator('.remote-session-row').filter({ has: page.getByText(chatTitle, { exact: true }) }).click();
  // 不悬停或点击评价，重新进入聊天就应经真实原生桥读取原反馈状态。
  await page.waitForFunction(() => window.feedbackReadOnlyGuard.reads > 0);
  report.readOnChatEntry = true;
  await page.waitForFunction(() => window.feedbackReadOnlyGuard.ready > 0);
  assert.equal(await page.evaluate(() => window.feedbackReadOnlyGuard.notifications), 1);
  report.coldNotificationSubscribed = true;
  const replies = page.getByRole('article', { name: '模型回复' });
  const replyCount = await replies.count();
  assert.ok(replyCount > 0);
  const choice = page.getByRole('button', { name: /^(好的回答|有问题的回答)$/ }).first();
  await choice.click();
  const dialog = page.getByRole('dialog', { name: '提交反馈', exact: true });
  await dialog.waitFor(); assert.equal(await dialog.count(), 1);
  assert.match(await dialog.getByRole('textbox', { name: '反馈详情', exact: true }).getAttribute('placeholder'), /日志/);
  const bounds = await dialog.evaluate(node => ({ overflow: node.scrollWidth > node.clientWidth + 1,
    withinViewport: node.getBoundingClientRect().left >= 0 && node.getBoundingClientRect().right <= innerWidth + 1 }));
  assert.equal(bounds.overflow, false); assert.equal(bounds.withinViewport, true);
  await page.screenshot({ path: 'artifacts/feedback-dialog-android.png', fullPage: true });
  await dialog.getByRole('button', { name: '关闭', exact: true }).click();
  await dialog.waitFor({ state: 'detached' });
  assert.equal(await replies.count(), replyCount);
  const draft = page.getByRole('textbox', { name: '消息', exact: true }), originalDraft = await draft.inputValue();
  await button('Remote 选项').click();
  await button('会话反馈').click();
  await dialog.waitFor();
  assert.equal(await dialog.count(), 1);
  assert.match(await dialog.getByRole('textbox', { name: '反馈详情', exact: true }).getAttribute('placeholder'), /日志/);
  await page.screenshot({ path: 'artifacts/session-feedback-dialog-android.png', fullPage: true });
  await dialog.getByRole('button', { name: '关闭', exact: true }).click();
  await dialog.waitFor({ state: 'detached' });
  assert.equal(await draft.inputValue(), originalDraft);
  assert.equal(await replies.count(), replyCount);
  report.sessionMenuOpenedAndCancelled = true;
  report.draftPreserved = true;
  report.dialogOpenedAndCancelled = true;
  report.noSubmitOrRetract = true;
  assert.equal(await page.evaluate(() => window.feedbackReadOnlyGuard.blocked), 0);
  report.layout = bounds;
  assert.deepEqual(report.errors, []); assert.deepEqual(report.resources, []);
} catch (error) { report.failure = error.name; throw error; }
finally {
  await page?.evaluate(() => { window.feedbackReadOnlyGuard?.restore(); delete window.feedbackReadOnlyGuard; }).catch(() => {});
  await writeFile('artifacts/feedback-read-cancel-android.json', JSON.stringify(report, null, 2)); console.log(JSON.stringify(report)); await device.close();
}
