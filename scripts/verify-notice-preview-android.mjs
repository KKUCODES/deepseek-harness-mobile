import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { _android } from 'playwright';
import { androidAppWebView } from './android-app-webview.mjs';

assert.equal(process.env.DSHM_RUN_LIVE, '1');
const phase = process.argv[2]; assert.ok(['prepare', 'inspect', 'cleanup'].includes(phase));
const prefix = 'artifacts/notice-preview';
const report = { at: new Date().toISOString(), phase, errors: [] };
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
const save = () => writeFile(`${prefix}-${phase}-android.json`, JSON.stringify(report, null, 2));
let device;
const watchdog = setTimeout(() => { report.failure = 'overall_timeout'; void save().finally(() => process.exit(2)); }, 120000);
try {
  device = (await _android.devices({ omitDriverInstall: true })).find(item => item.serial() === process.env.DSHM_ANDROID_SERIAL);
  assert.ok(device);
  if (phase === 'prepare') {
    await device.shell('am start -f 0x20020000 -n dev.dshmobile.validation/dev.dshmobile.validation.ValidationActivity');
    const until = Date.now() + 15000;
    while (!/^\d+$/.test((await device.shell('pidof dev.dshmobile.validation')).toString().trim()) && Date.now() < until) await delay(100);
  }
  const root = await (await androidAppWebView(device)).page();
  if (phase === 'prepare') {
    const ordinary = root.context().pages().find(item => item.url().startsWith('https://appassets.androidplatform.net/'));
    assert.ok(ordinary);
    await ordinary.getByRole('button', { name: '打开侧边抽屉', exact: true }).click();
    await ordinary.getByRole('button', { name: 'Remote', exact: true }).click();
  }
  let page;
  const until = Date.now() + 20000;
  while (!page && Date.now() < until) {
    page = root.context().pages().find(item => item.url().startsWith('https://remote.dshm.invalid/'));
    if (!page) await delay(100);
  }
  assert.ok(page); page.setDefaultTimeout(20000); page.on('pageerror', () => report.errors.push('page-error'));
  if (await page.getByRole('button', { name: '重新连接', exact: true }).count()) await page.getByRole('button', { name: '重新连接', exact: true }).click();
  const main = page.getByTestId('remote-workspace'); await main.waitFor();
  const title = async () => (await main.locator('.remote-heading').innerText()).split('\n')[0];
  const editor = main.getByRole('textbox', { name: '消息', exact: true });
  const history = page.getByRole('region', { name: '聊天内容', exact: true });
  const menu = async name => {
    await main.getByRole('button', { name: 'Remote 选项', exact: true }).click();
    await page.getByRole('button', { name, exact: true }).click();
  };
  if (phase === 'prepare') {
    if (await title() !== 'Remote') await main.getByRole('button', { name: '返回', exact: true }).click();
    await main.locator('button.remote-session-row').filter({ hasText: 'DSHM Remote 联调提示' }).click();
    await history.getByRole('article', { name: '模型回复', exact: true }).nth(15).waitFor();
    assert.equal((await editor.innerText()).trim(), '');
    report.originalReplies = await history.getByRole('article', { name: '模型回复', exact: true }).count();
    const stamp = Date.now(); report.title = `DSHM 通知摘要 ${stamp}`; report.marker = `DSHM_PREVIEW_${stamp}`;
    await menu('新建聊天');
    await page.getByRole('dialog', { name: '选择工作区', exact: true }).getByRole('button', { name: 'DSH-TEST', exact: true }).click();
    await editor.waitFor(); await menu('重命名聊天');
    await page.getByRole('textbox', { name: '聊天名称', exact: true }).fill(report.title);
    await page.getByRole('button', { name: '保存名称', exact: true }).click();
    await editor.click();
    await main.getByRole('button', { name: /^选择模型，当前/ }).click();
    const dialog = page.getByRole('dialog', { name: '选择模型', exact: true });
    await dialog.getByRole('button', { name: 'DeepSeek-V41-Flash', exact: true }).click();
    await dialog.waitFor({ state: 'detached' });
    await editor.fill(`这是DSHM通知摘要验收，不调用工具。回复的第一行是 ${report.marker}，然后用约100字介绍白云。`);
    await page.getByRole('button', { name: '发送消息', exact: true }).click();
    report.sent = true; await save();
    await device.shell('input keyevent KEYCODE_HOME');
    const deadline = Date.now() + 90000;
    do {
      report.notifications = (await device.shell('cmd notification list')).toString().split('\n').filter(row => row.includes('|dev.dshmobile.validation|'));
      if (report.notifications.length) break;
      await delay(500);
    } while (Date.now() < deadline);
    assert.equal(report.notifications.length, 1); report.readyForActualNotificationClick = true;
  } else {
    const seed = JSON.parse(await readFile(`${prefix}-prepare-android.json`, 'utf8'));
    assert.equal(seed.sent, true); assert.equal(await title(), seed.title);
    await history.getByRole('article', { name: '模型回复', exact: true }).getByText(seed.marker, { exact: false }).waitFor();
    await main.getByRole('button', { name: '停止生成', exact: true }).waitFor({ state: 'detached' });
    assert.equal((await editor.innerText()).trim(), '');
    report.correctConversationAndReply = true;
    if (phase === 'cleanup') {
      await menu('归档聊天');
      await main.locator('button.remote-session-row').filter({ hasText: 'DSHM Remote 联调提示' }).click();
      await history.getByRole('article', { name: '模型回复', exact: true }).nth(seed.originalReplies - 1).waitFor();
      assert.equal(await history.getByRole('article', { name: '模型回复', exact: true }).count(), seed.originalReplies);
      assert.equal((await editor.innerText()).trim(), ''); report.restored = true;
    }
    assert.equal((await device.shell('cmd notification list')).toString().includes('|dev.dshmobile.validation|'), false);
  }
  assert.deepEqual(report.errors, []); report.ok = true;
} catch (error) { report.failure = error.message; process.exitCode = 1; }
finally {
  await save(); console.log(JSON.stringify(report));
  if (device) await Promise.race([device.close(), delay(2000)]);
  clearTimeout(watchdog); process.exit(process.exitCode ?? 0);
}
