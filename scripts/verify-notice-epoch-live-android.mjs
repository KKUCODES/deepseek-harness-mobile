import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { _android } from 'playwright';
import { androidAppWebView } from './android-app-webview.mjs';
import { installReadingProbe, waitReading, removeReadingProbe } from './remote-reading-probe.mjs';

assert.equal(process.env.DSHM_RUN_LIVE, '1');
const phase = process.argv[2]; assert.ok(['create', 'old', 'fresh', 'cleanup'].includes(phase));
const revoke = process.argv.includes('--revocation');
const overflow = process.argv.includes('--queue-overflow');
assert.ok(!overflow || !revoke);
const pkg = revoke && !process.argv.includes('--daily-cleanup') ? 'dev.dshmobile.validation.pairingtest' : 'dev.dshmobile.validation';
const prefix = overflow ? 'artifacts/notice-queue-live' : revoke ? 'artifacts/notice-epoch-revoke' : 'artifacts/notice-epoch-live';
const report = { at: new Date().toISOString(), phase, errors: [] };
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
const save = () => writeFile(`${prefix}-${phase}-android.json`, JSON.stringify(report, null, 2));
let device, page;
const watchdog = setTimeout(() => { report.failure = 'overall_timeout'; void save().finally(() => process.exit(2)); }, 90000);
try {
  device = (await _android.devices({ omitDriverInstall: true })).find(item => item.serial() === process.env.DSHM_ANDROID_SERIAL);
  assert.ok(device);
  await device.shell(`am start -f 0x20020000 -n ${pkg}/dev.dshmobile.validation.ValidationActivity`);
  const startedBy = Date.now() + 15000;
  while (!/^\d+$/.test((await device.shell(`pidof ${pkg}`)).toString().trim()) && Date.now() < startedBy) await delay(100);
  const root = await (await androidAppWebView(device, pkg)).page();
  const ordinary = root.context().pages().find(item => item.url().startsWith('https://appassets.androidplatform.net/'));
  assert.ok(ordinary);
  await ordinary.getByRole('button', { name: '打开侧边抽屉', exact: true }).click();
  await ordinary.getByRole('button', { name: 'Remote', exact: true }).click();
  const until = Date.now() + 20000;
  while (!page && Date.now() < until) {
    page = root.context().pages().find(item => item.url().startsWith('https://remote.dshm.invalid/'));
    if (!page) await delay(100);
  }
  assert.ok(page); page.setDefaultTimeout(15000); page.on('pageerror', () => report.errors.push('page-error'));
  if (await page.getByRole('button', { name: '重新连接', exact: true }).count()) await page.getByRole('button', { name: '重新连接', exact: true }).click();
  const main = page.getByTestId('remote-workspace'); await main.waitFor();
  const title = async () => (await main.locator('.remote-heading').innerText()).split('\n')[0];
  const editor = main.getByRole('textbox', { name: '消息', exact: true });
  const history = page.getByRole('region', { name: '聊天内容', exact: true });
  const open = async name => {
    if (await title() !== 'Remote') await main.getByRole('button', { name: '返回', exact: true }).click();
    const row = main.locator('button.remote-session-row').filter({ hasText: name });
    await row.click();
    await editor.waitFor();
  };
  const menu = async name => {
    await main.getByRole('button', { name: 'Remote 选项', exact: true }).click();
    await page.getByRole('button', { name, exact: true }).click();
  };
  if (phase === 'create') {
    await open('DSHM Remote 联调提示');
    await history.getByRole('article', { name: '模型回复', exact: true }).nth(15).waitFor();
    assert.equal((await editor.innerText()).trim(), '');
    report.originalReplies = await history.getByRole('article', { name: '模型回复', exact: true }).count();
    const stamp = Date.now();
    report.title = `DSHM 原生通知隔离 ${stamp}`; report.marker = `DSHM_EPOCH_${stamp}`;
    await installReadingProbe(page);
    await menu('新建聊天');
    await page.getByRole('dialog', { name: '选择工作区', exact: true }).getByRole('button', { name: 'DSH-TEST', exact: true }).click();
    report.sessionId = await waitReading(page, 'non-null');
    assert.match(report.sessionId, /^session-[0-9a-f-]{36}$/);
    await removeReadingProbe(page);
    await menu('重命名聊天');
    await page.getByRole('textbox', { name: '聊天名称', exact: true }).fill(report.title);
    await page.getByRole('button', { name: '保存名称', exact: true }).click();
    await editor.click();
    await main.getByRole('button', { name: /^选择模型，当前/ }).click();
    const dialog = page.getByRole('dialog', { name: '选择模型', exact: true });
    await dialog.getByRole('button', { name: 'DeepSeek-V41-Flash', exact: true }).click();
    await dialog.waitFor({ state: 'detached' });
    await editor.fill(`这是DSHM通知验收的专用会话。不要调用工具，只回复 ${report.marker}_SEED`);
    await page.getByRole('button', { name: '发送消息', exact: true }).click();
    report.seedSent = true; await save();
    await history.getByRole('article', { name: '模型回复', exact: true }).getByText(`${report.marker}_SEED`, { exact: false }).waitFor({ timeout: 90000 });
    await main.getByRole('button', { name: '停止生成', exact: true }).waitFor({ state: 'detached', timeout: 30000 });
    report.ready = true;
  } else {
    const seed = JSON.parse(await readFile(`${prefix}-create-android.json`, 'utf8'));
    assert.equal(seed.ready, true); await open(seed.title);
    if (phase === 'old' || phase === 'fresh') {
      assert.equal((await editor.innerText()).trim(), '');
      await editor.fill(`这是DSHM通知连接测试。不调用工具，不读写文件。用约100字介绍白云，最后一行单独回复 ${seed.marker}_${phase.toUpperCase()}`);
      await page.getByRole('button', { name: '发送消息', exact: true }).click();
      report.sent = true; report.sessionId = seed.sessionId; await save();
      await device.shell('input keyevent KEYCODE_HOME'); report.background = true;
    } else {
      await history.getByRole('article', { name: '模型回复', exact: true }).getByText(`${seed.marker}_${revoke ? 'SEED' : 'FRESH'}`, { exact: true }).waitFor();
      await history.getByRole('article', { name: '模型回复', exact: true }).getByText(`${seed.marker}_OLD`, { exact: true }).waitFor();
      assert.equal((await editor.innerText()).trim(), '');
      report.twoRealReplies = true;
      await menu('归档聊天');
      await main.locator('button.remote-session-row').filter({ hasText: 'DSHM Remote 联调提示' }).click();
      await history.getByRole('article', { name: '模型回复', exact: true }).nth(seed.originalReplies - 1).waitFor();
      assert.equal(await history.getByRole('article', { name: '模型回复', exact: true }).count(), seed.originalReplies);
      assert.equal((await editor.innerText()).trim(), '');
      report.notifications = (await device.shell('cmd notification list')).toString().split('\n').filter(row => row.includes('|dev.dshmobile.validation|'));
      assert.deepEqual(report.notifications, []); report.restored = true;
    }
  }
  assert.deepEqual(report.errors, []); report.ok = true;
} catch (error) { report.failure = error.message; process.exitCode = 1; }
finally {
  if (page && !page.isClosed()) await removeReadingProbe(page).catch(() => {});
  await save(); console.log(JSON.stringify(report));
  if (device) await Promise.race([device.close(), delay(2000)]);
  clearTimeout(watchdog); process.exit(process.exitCode ?? 0);
}
