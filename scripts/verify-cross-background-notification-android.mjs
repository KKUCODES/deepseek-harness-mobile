import assert from 'node:assert/strict';
import { readFile, writeFile, unlink } from 'node:fs/promises';
import { _android } from 'playwright';
import { androidAppWebView } from './android-app-webview.mjs';

assert.equal(process.env.DSHM_RUN_LIVE, '1');
const restart = process.argv.includes('--process-restart');
const prefix = restart ? 'cross-background-notification-restart' : 'cross-background-notification';
const device = (await _android.devices({ omitDriverInstall: true })).find(item => item.serial() === process.env.DSHM_ANDROID_SERIAL);
assert.ok(device); device.setDefaultTimeout(15000);
const report = { at: new Date().toISOString(), processRestart: restart, errors: [] };
const control = 'artifacts/original-interactions-host-control.json';
const titles = ['DSHM Remote 联调提示', 'DSHM 电脑端对照测试询问'];
const pause = () => new Promise(resolve => setTimeout(resolve, 100));
const noticeKeys = async () => (await device.shell('cmd notification list')).toString().split('\n').map(value => value.trim()).filter(value => value.includes('|dev.dshmobile.validation|') && value.includes('dshm.remote.notice.'));
let page, main, original, changed = false;
async function openChat(title) {
  await main.getByRole('button', { name: '返回', exact: true }).click();
  await main.locator('.connection-dot.online').waitFor();
  await main.locator('button.remote-session-row').filter({ has: page.getByText(title, { exact: true }) }).click();
  await page.getByTestId('live-interactions').waitFor();
  assert.equal(await main.locator('.remote-heading strong').innerText(), title);
}
const editor = () => main.getByRole('textbox', { name: '消息', exact: true });
const draft = () => editor().evaluate(node => node.textContent === '' ? '' : node.innerText);
try {
  page = (await (await androidAppWebView(device)).page()).context().pages().find(item => item.url().startsWith('https://remote.dshm.invalid/'));
  assert.ok(page); page.setDefaultTimeout(15000);
  page.on('pageerror', error => report.errors.push(error.message));
  main = page.getByTestId('remote-workspace');
  assert.equal(await main.locator('.remote-heading strong').innerText(), titles[0]);
  await openChat(titles[1]);
  const target = await page.getByTestId('live-interactions').getAttribute('data-session');
  const targetDraft = await draft();
  await openChat(titles[0]);
  const source = await page.getByTestId('live-interactions').getAttribute('data-session');
  assert.notEqual(source, target);
  original = await draft();
  const marker = `DSHM_NOTIFICATION_DRAFT_${Date.now()}`;
  await editor().fill(original ? `${original}\n${marker}` : marker); changed = true;
  const expected = await draft();
  const before = await noticeKeys();
  await device.shell('input keyevent KEYCODE_HOME');
  const id = `${Date.now()}-cross-background`;
  await writeFile(control, JSON.stringify({ id, kind: 'question', sessionId: target }));
  let key;
  const deadline = Date.now() + 12000;
  while (!key && Date.now() < deadline) { key = (await noticeKeys()).find(value => !before.includes(value)); if (!key) await pause(); }
  assert.ok(key, '后台应收到另一真实会话的系统通知');
  if (restart) {
    const oldPid = (await device.shell('pidof dev.dshmobile.validation')).toString().trim();
    assert.match(oldPid, /^\d+$/);
    // am kill模拟后台进程回收；force-stop会一并撤掉系统通知，不能验证保留PendingIntent的冷启动。
    await device.shell('am kill dev.dshmobile.validation');
    const killedBy = Date.now() + 10000;
    while ((await device.shell('pidof dev.dshmobile.validation')).toString().trim() && Date.now() < killedBy) await pause();
    assert.equal((await device.shell('pidof dev.dshmobile.validation')).toString().trim(), '', '必须实际结束进程，不能用Activity重建代替');
    assert.ok((await noticeKeys()).includes(key), '进程回收后原系统通知仍应存在');
    report.oldPid = oldPid;
    report.notificationSurvived = true;
  }
  await device.shell('cmd statusbar expand-notifications');
  await device.shell('uiautomator dump /data/local/tmp/dshm-cross-notice.xml');
  const xml = (await device.shell('cat /data/local/tmp/dshm-cross-notice.xml')).toString();
  const nodes = [...xml.matchAll(/<node\s+([^>]+)>/g)].map(match => Object.fromEntries([...match[1].matchAll(/([\w-]+)="([^"]*)"/g)].map(value => [value[1], value[2]])));
  const matches = nodes.filter(node => node.package === 'com.android.systemui' && node.text === '有问题等待你回答');
  assert.equal(matches.length, 1, '只点击实际观察到的唯一提问通知');
  await device.screenshot({ path: `artifacts/${prefix}-system.png` });
  const [x1, y1, x2, y2] = matches[0].bounds.match(/\d+/g).map(Number);
  await device.shell(`input tap ${Math.floor((x1 + x2) / 2)} ${Math.floor((y1 + y2) / 2)}`);
  if (restart) {
    let newPid;
    const startedBy = Date.now() + 15000;
    while (!(newPid = (await device.shell('pidof dev.dshmobile.validation')).toString().trim()) && Date.now() < startedBy) await pause();
    assert.match(newPid, /^\d+$/); assert.notEqual(newPid, report.oldPid);
    const first = await (await androidAppWebView(device)).page();
    const context = first.context();
    page = context.pages().find(item => item.url().startsWith('https://remote.dshm.invalid/'))
      ?? await context.waitForEvent('page', { predicate: item => item.url().startsWith('https://remote.dshm.invalid/') });
    page.setDefaultTimeout(25000);
    page.on('pageerror', error => report.errors.push(error.message));
    main = page.getByTestId('remote-workspace');
    report.newPid = newPid;
  }
  await main.locator('.remote-heading strong').getByText(titles[1], { exact: true }).waitFor();
  assert.equal(await page.getByTestId('live-interactions').getAttribute('data-session'), target);
  await page.getByRole('button', { name: '放弃整组问题', exact: true }).click();
  let result;
  const until = Date.now() + 10000;
  while (Date.now() < until) {
    result = await readFile('artifacts/original-interactions-host-result.json', 'utf8').then(JSON.parse).catch(() => ({}));
    if (result.id === id) break;
    await pause();
  }
  assert.equal(result.id, id); assert.equal(result.error, 'ASK_CANCELLED');
  await editor().waitFor(); assert.equal(await draft(), targetDraft);
  await openChat(titles[0]); assert.equal(await draft(), expected);
  assert.deepEqual(await noticeKeys(), before);
  report.result = { source, target, openedCorrectChat: true, questionCancelled: true, bothDraftsPreserved: true, systemNoticeCleared: true };
  assert.deepEqual(report.errors, []);
} catch (error) {
  report.failure = error.stack; process.exitCode = 1;
  report.hostResult = await readFile('artifacts/original-interactions-host-result.json', 'utf8').then(JSON.parse).catch(() => ({}));
  await device.screenshot({ path: `artifacts/${prefix}-failure.png` }).catch(() => {});
} finally {
  await unlink(control).catch(error => { if (error.code !== 'ENOENT') throw error; });
  if (changed) {
    try {
      await device.shell('cmd statusbar collapse');
      // 不提交草稿；回到原聊天恢复原文本，清理失败保留报告供续接。
      if (await main.locator('.remote-heading strong').innerText() !== titles[0]) await openChat(titles[0]);
      await editor().fill(original); report.draftRestored = (await draft()) === original;
    } catch (error) { report.cleanupFailure = error.message; process.exitCode = 1; }
  }
  await writeFile(`artifacts/${prefix}-android.json`, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report)); await device.close();
}
