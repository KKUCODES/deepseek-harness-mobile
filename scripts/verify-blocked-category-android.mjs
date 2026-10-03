import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile, writeFile, unlink, access } from 'node:fs/promises';
import { _android } from 'playwright';
import { androidAppWebView } from './android-app-webview.mjs';

assert.equal(process.env.DSHM_RUN_LIVE, '1');
const chatState = process.argv.includes('--chat-state');
const prefix = chatState ? 'artifacts/blocked-chat' : 'artifacts/notice-blocked-category';
const control = 'artifacts/blocked-notice-control.json';
const report = { at: new Date().toISOString(), checks: [], errors: [] };
const save = () => writeFile(`${prefix}-android.json`, JSON.stringify(report, null, 2));
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
const button = (page, name) => page.getByRole('button', { name, exact: true });
let device, remote, main, original, created = false, marker, ownsControl = false;
const watchdog = setTimeout(() => { report.failure = 'overall_timeout'; void save().finally(() => process.exit(2)); }, 150000);
async function until(check, timeout = 20000) {
  const end = Date.now() + timeout;
  while (!await check() && Date.now() < end) await delay(100);
  assert.ok(await check(), 'Expected condition within deadline');
}
async function openRemote() {
  await device.shell('am start -f 0x20020000 -n dev.dshmobile.validation/dev.dshmobile.validation.ValidationActivity');
  await until(async () => /^\d+$/.test((await device.shell('pidof dev.dshmobile.validation')).toString().trim()));
  const context = (await (await androidAppWebView(device)).page()).context();
  const ordinary = context.pages().find(page => page.url().startsWith('https://appassets.androidplatform.net/'));
  assert.ok(ordinary);
  await button(ordinary, '打开侧边抽屉').click(); await button(ordinary, 'Remote').click();
  await until(() => {
    remote = context.pages().find(page => page.url().startsWith('https://remote.dshm.invalid/'));
    return !!remote;
  });
  assert.ok(remote); remote.setDefaultTimeout(15000); main = remote.getByTestId('remote-workspace');
  await main.waitFor(); await main.getByTestId('remote-offline-status').waitFor({ state: 'detached', timeout: 45000 });
}
async function menu(name) {
  await button(main, 'Remote 选项').click(); await button(remote, name).click();
}
async function nodes() {
  await device.shell('uiautomator dump /data/local/tmp/dshm-blocked-category.xml');
  const xml = (await device.shell('cat /data/local/tmp/dshm-blocked-category.xml')).toString();
  return [...xml.matchAll(/<node\s+([^>]+)>/g)].map(match => Object.fromEntries(
    [...match[1].matchAll(/([\w-]+)="([^"]*)"/g)].map(pair => [pair[1], pair[2]])))
    .filter(node => node.package === 'dev.dshmobile.validation');
}
async function tap(node) {
  assert.ok(node); const bounds = node.bounds.match(/^\[(\d+),(\d+)\]\[(\d+),(\d+)\]$/); assert.ok(bounds);
  const [, a, b, c, d] = bounds.map(Number);
  await device.shell(`input tap ${Math.floor((a + c) / 2)} ${Math.floor((b + d) / 2)}`);
}
async function settings(value) {
  await menu('Remote 提醒'); let tree = await nodes();
  const labels = ['需要批准', '需要回答', '任务完成', '执行失败或受阻'];
  const choices = () => Object.fromEntries(labels.map(label => {
    const item = tree.find(node => node.text === label && node.checkable === 'true'); assert.ok(item);
    return [label, item.checked === 'true'];
  }));
  try {
    const before = choices();
    if (!original) { assert.equal(before['执行失败或受阻'], true); original = before; }
    if (before['执行失败或受阻'] !== value) {
      await tap(tree.find(node => node.text === '执行失败或受阻' && node.checkable === 'true')); tree = await nodes();
    }
    const after = choices(); assert.equal(after['执行失败或受阻'], value);
    for (const label of labels.slice(0, 3)) assert.equal(after[label], original[label]);
    return after;
  } finally {
    await tap(tree.find(node => node['resource-id'] === 'android:id/button1'));
    await button(remote, '关闭窗口').click();
  }
}
const notices = async () => (await device.shell('cmd notification list')).toString().split('\n')
  .filter(line => line.includes('|dev.dshmobile.validation|') && line.includes('dshm.remote.notice.'));
try {
  assert.equal(await access(control).then(() => true, () => false), false, 'Another fixture run owns the control file');
  device = (await _android.devices({ omitDriverInstall: true })).find(item => item.serial() === process.env.DSHM_ANDROID_SERIAL);
  assert.ok(device); await openRemote(); remote.on('pageerror', () => report.errors.push('page-error'));
  const heading = () => main.locator('.remote-heading strong');
  const editor = () => main.getByRole('textbox', { name: '消息', exact: true });
  if (await heading().innerText() === 'Remote') {
    await main.locator('button.remote-session-row').filter({ hasText: 'DSHM Remote 联调提示' }).click();
    await editor().waitFor();
  }
  assert.equal(await heading().innerText(), 'DSHM Remote 联调提示'); assert.equal((await editor().innerText()).trim(), '');
  assert.equal((await notices()).length, 0);
  report.title = `DSHM 失败分类 ${randomUUID().slice(0, 8)}`;
  await menu('新建聊天');
  await button(remote.getByRole('dialog', { name: '选择工作区', exact: true }), 'DSH-TEST').click();
  await editor().waitFor(); await menu('重命名聊天');
  await remote.getByRole('textbox', { name: '聊天名称', exact: true }).fill(report.title);
  await button(remote, '保存名称').click(); await heading().getByText(report.title, { exact: true }).waitFor();
  created = true; await save();
  await editor().click(); await main.getByRole('button', { name: /^选择模型，当前/ }).click();
  const picker = remote.getByRole('dialog', { name: '选择模型', exact: true });
  await button(picker, 'DeepSeek-V41-Flash').click(); await picker.waitFor({ state: 'detached' });
  const pid = (await device.shell('pidof dev.dshmobile.validation')).toString().trim(); assert.match(pid, /^\d+$/);
  const logs = async () => (await device.shell(`logcat -d --pid=${pid} -v brief -s DSHMNoticeConnection:D DSHMNotifications:D '*:S'`)).toString();
  let blockedCount = 0;
  for (const step of ['enabled', 'disabled', 'restored']) {
    const checked = await settings(step !== 'disabled');
    assert.equal((await notices()).length, 0);
    marker = `DSHM_BLOCK_NOTICE_${randomUUID().slice(0, 8)}`;
    await writeFile(control, JSON.stringify({ marker, release: false }), ownsControl ? {} : { flag: 'wx' }); ownsControl = true;
    await editor().fill(marker); await button(main, '发送消息').click();
    const host = () => readFile('artifacts/blocked-notice-host.json', 'utf8').then(JSON.parse);
    await until(async () => { const result = await host(); return result.marker === marker && result.entered; });
    await editor().fill('DSHM_BLOCKED_CATEGORY_DRAFT');
    const before = await logs(); assert.ok(before.split('\n').filter(line => line.includes('DSHMNoticeConnection')).at(-1)?.includes('listening'));
    await device.shell('input keyevent KEYCODE_HOME');
    await writeFile(control, JSON.stringify({ marker, release: true }));
    await until(async () => { const result = await host(); return result.marker === marker && result.rejected; });
    await button(main, '停止生成').waitFor({ state: 'detached' });
    let key;
    if (step === 'disabled') {
      await delay(2000); assert.equal((await notices()).length, 0);
      assert.equal((await logs()).slice(before.length).includes('display kind=error'), false);
    } else {
      await until(async () => (await notices()).length === 1); key = (await notices())[0];
      assert.match(key, /^[\w.|:@\[\]",-]+$/);
      const details = (await device.shell(`cmd notification get '${key}'`)).toString();
      const fields = details.split('\n').filter(line => /android\.(title|text)=/.test(line)).join('\n');
      assert.ok(fields.includes(report.title)); assert.ok(fields.includes('电脑任务受阻，请打开查看'));
      assert.ok((await logs()).slice(before.length).includes('display kind=error foreground=null started=0'));
    }
    assert.equal(/retrying|disconnected|stream_overflow/.test((await logs()).slice(before.length)), false);
    await openRemote(); assert.equal(await heading().innerText(), report.title);
    assert.equal((await editor().innerText()).trim(), 'DSHM_BLOCKED_CATEGORY_DRAFT');
    // 原DSH的pre-step拒绝发生在user/message落盘之前，不能要求该标记成为历史消息。
    await button(main, '停止生成').waitFor({ state: 'detached' });
    if (chatState) {
      blockedCount++;
      await until(async () => await main.locator('[data-turn-blocked]').count() === blockedCount);
      assert.deepEqual(await main.locator('[data-turn-blocked]').allTextContents(), Array(blockedCount).fill('本轮任务受阻，未继续执行。'));
    }
    const terminalView = (await main.innerText()).slice(0, 2500);
    await until(async () => (await notices()).length === 0);
    await editor().fill('');
    report.checks.push({ step, settings: checked, host: await host(), notification: key,
      suppressedObservationMs: step === 'disabled' ? 2000 : undefined, correctChat: true, draftPreserved: true,
      generationEnded: true, terminalView }); await save();
  }
  if (chatState) {
    await button(main, '返回').click();
    await main.locator('button.remote-session-row').filter({ hasText: report.title }).click();
    await until(async () => await main.locator('[data-turn-blocked]').count() === blockedCount);
    report.historyReentry = { blockedCount, title: await heading().innerText() };
    assert.equal(report.historyReentry.title, report.title);
  }
  assert.equal((await device.shell('pidof dev.dshmobile.validation')).toString().trim(), pid);
  assert.deepEqual(report.errors, []); report.sameProcess = true;
} catch (error) { report.failure = error.message; process.exitCode = 1; }
finally {
  if (ownsControl) await writeFile(control, JSON.stringify({ marker, release: true }));
  try {
    if (device && original) {
      await openRemote();
      assert.deepEqual(await settings(original['执行失败或受阻']), original); report.settingsRestored = true;
    }
    if (created) {
      assert.equal(await main.locator('.remote-heading strong').innerText(), report.title);
      await button(main, '停止生成').waitFor({ state: 'detached', timeout: 45000 });
      const editor = main.getByRole('textbox', { name: '消息', exact: true });
      assert.ok(['', 'DSHM_BLOCKED_CATEGORY_DRAFT'].includes((await editor.innerText()).trim())); await editor.fill('');
      await menu('归档聊天'); report.archived = true;
      await main.locator('button.remote-session-row').filter({ hasText: 'DSHM Remote 联调提示' }).click();
      await remote.getByRole('article', { name: '模型回复', exact: true }).nth(15).waitFor();
      assert.equal(await remote.getByRole('article', { name: '模型回复', exact: true }).count(), 16);
      assert.equal((await editor.innerText()).trim(), ''); assert.equal((await notices()).length, 0);
      report.originalChatRestored = true;
    }
  } catch (error) { report.cleanupFailure = error.message; process.exitCode = 1; }
  if (ownsControl) await unlink(control).catch(error => { if (error.code !== 'ENOENT') throw error; });
  await save(); console.log(JSON.stringify(report));
  if (device) await Promise.race([device.close(), delay(2000)]);
  clearTimeout(watchdog); process.exit(process.exitCode ?? 0);
}
