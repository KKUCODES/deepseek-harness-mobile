import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { _android } from 'playwright';
import { androidAppWebView } from './android-app-webview.mjs';

// 配合电脑已安装的 live-input-plugin，只操作专用会话草稿，不调用模型。
const device = (await _android.devices({ omitDriverInstall: true })).find(item => item.serial() === process.env.DSHM_ANDROID_SERIAL);
assert.ok(device); device.setDefaultTimeout(20000);
const report = { at: new Date().toISOString(), errors: [], resources: [] };
let page, editor, draft;
let nativePicker = false;
const conversation = process.argv.includes('--conversation');
const phase = process.argv.includes('--cleanup') ? 'cleanup' : process.argv.includes('--picker') ? 'picker' : 'live';
const prefix = conversation ? 'conversation-api' : 'input-api';
const topActivity = async () => (await device.shell('dumpsys activity activities')).toString().match(/topResumedActivity=[^\r\n]*/)?.[0] ?? '';
const until = async check => {
  const end = Date.now() + 20000;
  while (!await check()) { assert.ok(Date.now() < end, 'UI did not settle'); await new Promise(resolve => setTimeout(resolve, 100)); }
};
try {
  const first = await (await androidAppWebView(device)).page(), context = first.context();
  page = context.pages().find(item => item.url().startsWith('https://remote.dshm.invalid/'));
  if (!page) {
    const ordinary = context.pages().find(item => item.url().startsWith('https://appassets.androidplatform.net/'));
    assert.ok(ordinary);
    await ordinary.getByRole('button', { name: '打开侧边抽屉', exact: true }).click();
    await Promise.all([context.waitForEvent('page'), ordinary.getByRole('button', { name: 'Remote', exact: true }).click()]);
    page = context.pages().find(item => item.url().startsWith('https://remote.dshm.invalid/'));
  }
  assert.ok(page); page.setDefaultTimeout(20000);
  page.on('pageerror', error => report.errors.push(error.message));
  page.on('response', response => { if (response.status() >= 400) report.resources.push({ path: new URL(response.url()).pathname, status: response.status() }); });
  await page.getByTestId('remote-workspace').waitFor();
  if (!await page.getByRole('region', { name: '聊天内容', exact: true }).count()) await page.getByRole('button', { name: /^DSHM Remote 联调提示/ }).click();
  assert.equal(await page.getByTestId('remote-workspace').locator('.remote-heading').innerText(), 'DSHM Remote 联调提示');
  editor = page.getByRole('textbox', { name: '消息', exact: true });
  draft = await editor.innerText();
  await writeFile(`artifacts/${prefix}-draft-before.json`, JSON.stringify({ draft, at: report.at }, null, 2));
  if (phase === 'picker') {
    await editor.fill('/file');
    await page.getByRole('listbox').getByRole('option').filter({ hasText: /文件|file/i }).click();
    await until(async () => /com\.android\.documentsui\/\.picker\.PickActivity/.test(await topActivity()));
    nativePicker = true; report.nativeFilePicker = true;
    await device.shell('input keyevent KEYCODE_BACK'); nativePicker = false;
    await until(async () => /dev\.dshmobile\.validation\/\.RemoteActivity/.test(await topActivity()));
    assert.equal((await editor.innerText()).trim(), ''); report.cancelReturned = true;
    assert.equal(await page.locator('.remote-pending-files').count(), 0); report.cancelNoAttachments = true;
  } else if (phase === 'cleanup') {
    await page.getByTestId('live-input-probe').waitFor({ state: 'detached' });
    report.pluginUnloaded = true;
  } else {
    const probe = page.getByTestId('live-input-probe'); await probe.waitFor();
    if (conversation) {
      await probe.getByTestId('live-conversation-state').filter({ hasText: /^CHAT_READY$/ }).waitFor();
      report.conversationState = true;
      await probe.getByRole('button', { name: '插件聚焦输入', exact: true }).click();
      assert.equal(await editor.evaluate(node => node === document.activeElement), true); report.focus = true;
      await probe.getByRole('button', { name: '插件显示提示', exact: true }).click();
      await page.getByRole('status').filter({ hasText: /^会话提示验证成功$/ }).waitFor(); report.notice = true;
      await editor.fill('DSHM_CONVERSATION_BLOCK_DRAFT');
      await probe.getByRole('button', { name: '插件暂停输入', exact: true }).click();
      await page.getByRole('status').filter({ hasText: /^插件暂时停止输入（验证）$/ }).waitFor();
      assert.equal(await editor.getAttribute('contenteditable'), 'false');
      assert.equal(await page.getByRole('button', { name: '发送消息', exact: true }).isEnabled(), false);
      assert.equal(await page.getByRole('button', { name: '添加附件', exact: true }).isEnabled(), false);
      assert.equal(await editor.innerText(), 'DSHM_CONVERSATION_BLOCK_DRAFT'); report.blockPreservesDraft = true;
      await page.screenshot({ path: 'artifacts/conversation-api-block-android.png' });
      await probe.getByRole('button', { name: '插件恢复输入', exact: true }).click();
      await until(async () => await editor.getAttribute('contenteditable') === 'true'); report.unblock = true;
    }
    await editor.fill('DSHM_INPUT_API_LIVE');
    await until(async () => await probe.getByTestId('live-input-draft').innerText() === 'DSHM_INPUT_API_LIVE');
    report.standardState = true;
    await probe.getByRole('button', { name: '插件追加草稿', exact: true }).click();
    await until(async () => await editor.innerText() === 'DSHM_INPUT_API_LIVE PLUGIN_INPUT_OK');
    report.standardAction = true;
    await page.screenshot({ path: `artifacts/${prefix}-live-android.png` });
    await page.getByRole('button', { name: '返回', exact: true }).click();
    await probe.waitFor({ state: 'detached' });
    await page.getByRole('button', { name: /^DSHM Remote 联调提示/ }).click();
    await until(async () => await probe.getByTestId('live-input-draft').innerText() === 'DSHM_INPUT_API_LIVE PLUGIN_INPUT_OK');
    await probe.getByRole('button', { name: '插件追加草稿', exact: true }).click();
    await until(async () => await editor.innerText() === 'DSHM_INPUT_API_LIVE PLUGIN_INPUT_OK PLUGIN_INPUT_OK');
    report.reopenBinding = true;
  }
  assert.deepEqual(report.errors, []); assert.deepEqual(report.resources, []);
} catch (error) {
  report.failure = error.message;
    if (page) await page.screenshot({ path: `artifacts/${prefix}-failure-android.png` }).catch(() => {});
  throw error;
} finally {
  if (nativePicker) await device.shell('input keyevent KEYCODE_BACK');
  if (editor && draft !== undefined) {
    if (conversation && await page.getByRole('button', { name: '插件恢复输入', exact: true }).count()) {
      await page.getByRole('button', { name: '插件恢复输入', exact: true }).click();
    }
    await editor.fill(draft); await until(async () => await editor.innerText() === draft); report.draftRestored = true;
  }
  await writeFile(`artifacts/${prefix}-${phase}-android.json`, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report)); await device.close();
}
