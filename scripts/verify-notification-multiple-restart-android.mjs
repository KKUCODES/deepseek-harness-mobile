import assert from 'node:assert/strict';
import { readFile, writeFile, unlink } from 'node:fs/promises';
import { _android } from 'playwright';
import { androidAppWebView } from './android-app-webview.mjs';
import { verifyRestoredNoticeLanguage } from './verify-restored-notice-language.mjs';

assert.equal(process.env.DSHM_RUN_LIVE, '1');
const cleanup = process.argv.includes('--verify-cleanup');
const language = process.argv.includes('--language-restored');
const rapid = process.argv.includes('--rapid');
assert.ok(!rapid || !language, '连续点击与语言切换应独立验收');
const pkg = 'dev.dshmobile.validation';
const titles = ['DSHM Remote 联调提示', 'DSHM 电脑端对照测试询问'];
const control = 'artifacts/original-interactions-host-control.json';
const report = { at: new Date().toISOString(), stage: 'connect', opened: [], errors: [] };
const device = (await _android.devices({ omitDriverInstall: true })).find(item => item.serial() === process.env.DSHM_ANDROID_SERIAL);
assert.ok(device); device.setDefaultTimeout(15000);
const pause = () => new Promise(resolve => setTimeout(resolve, 100));
const keys = async () => (await device.shell('cmd notification list')).toString().split('\n')
  .map(value => value.trim()).filter(value => value.includes(`|${pkg}|`) && value.includes('dshm.remote.notice.'));
const cases = [];
let page, main;
async function attach(fromHome = false) {
  if (fromHome) await device.shell(`am start -W -f 0x20020000 -n ${pkg}/.ValidationActivity`);
  const context = (await (await androidAppWebView(device)).page()).context();
  if (fromHome) {
    const ordinary = context.pages().find(item => item.url().startsWith('https://appassets.androidplatform.net/'));
    assert.ok(ordinary);
    await ordinary.getByRole('button', { name: '打开侧边抽屉', exact: true }).click();
    await ordinary.getByRole('button', { name: 'Remote', exact: true }).click();
  }
  const deadline = Date.now() + 20000;
  do { page = context.pages().find(item => item.url().startsWith('https://remote.dshm.invalid/'));
    if (page) break; await pause();
  } while (Date.now() < deadline);
  assert.ok(page); page.setDefaultTimeout(25000);
  page.on('pageerror', error => report.errors.push(error.message));
  main = page.getByTestId('remote-workspace'); await main.waitFor();
}
async function openChat(title) {
  if (await main.getByRole('button', { name: '返回', exact: true }).count()) await main.getByRole('button', { name: '返回', exact: true }).click();
  await main.locator('.connection-dot.online').waitFor();
  await main.locator('button.remote-session-row').filter({ has: page.getByText(title, { exact: true }) }).click();
  await page.getByTestId('live-interactions').waitFor({ state: cleanup ? 'detached' : 'visible' });
}
const editor = () => main.getByRole('textbox', { name: '消息', exact: true });
async function cancel(item) {
  await page.getByRole('button', { name: '放弃整组问题', exact: true }).click();
  const until = Date.now() + 8000; let result;
  do {
    result = await readFile('artifacts/original-interactions-host-result.json', 'utf8').then(JSON.parse).catch(() => ({}));
    if (result.id === item.id) break; await pause();
  } while (Date.now() < until);
  assert.equal(result.id, item.id); assert.equal(result.error, 'ASK_CANCELLED'); item.cancelled = true;
  await editor().waitFor(); assert.equal(await editor().innerText(), item.draft);
}
try {
  await attach(true);
  if (cleanup) {
    await openChat(titles[0]); await editor().waitFor();
    assert.equal(await page.getByTestId('live-interactions').count(), 0);
    assert.deepEqual(await keys(), []); assert.deepEqual(report.errors, []);
    report.fixtureRemoved = true; report.stage = 'cleanup-complete';
  } else {
  for (const title of titles) {
    await openChat(title);
    cases.push({ title, session: await page.getByTestId('live-interactions').getAttribute('data-session'), draft: await editor().innerText(), id: `${Date.now()}-multi-restart` });
  }
  assert.notEqual(cases[0].session, cases[1].session);
  assert.deepEqual(await keys(), [], 'Do not mix this verification with existing notifications');
  // 电脑重启后提醒连接有独立重试；初始待办不补推，必须等订阅就绪才产生测试事件。
  const noticePid = (await device.shell(`pidof ${pkg}`)).toString().trim();
  assert.match(noticePid, /^\d+$/);
  const listeningBy = Date.now() + 45000;
  do {
    const logs = (await device.shell(`logcat -d --pid=${noticePid} -v brief -s DSHMNoticeConnection:D '*:S'`)).toString();
    report.initialNoticeConnection = logs.split('\n').filter(line => line.includes('DSHMNoticeConnection')).at(-1)?.split(': ').at(-1)?.trim();
    if (report.initialNoticeConnection === 'listening') break; await pause();
  } while (Date.now() < listeningBy);
  assert.equal(report.initialNoticeConnection, 'listening');
  await device.shell('input keyevent KEYCODE_HOME');
  for (const item of cases) {
    const before = await keys();
    await writeFile(control, JSON.stringify({ id: item.id, kind: 'question', sessionId: item.session }));
    const until = Date.now() + 10000;
    do { item.key = (await keys()).find(key => !before.includes(key)); if (item.key) break; await pause(); } while (Date.now() < until);
    assert.ok(item.key, 'Original question must produce an actual Android notification');
  }
  assert.equal((await keys()).length, 2);
  report.stage = 'kill'; report.oldPid = (await device.shell(`pidof ${pkg}`)).toString().trim();
  assert.match(report.oldPid, /^\d+$/);
  await device.shell(`am kill ${pkg}`);
  const killedBy = Date.now() + 10000;
  while ((await device.shell(`pidof ${pkg}`)).toString().trim() && Date.now() < killedBy) await pause();
  assert.equal((await device.shell(`pidof ${pkg}`)).toString().trim(), '');
  assert.deepEqual((await keys()).sort(), cases.map(item => item.key).sort());
  report.bothNotificationsSurvived = true;
  for (let index = 0; index < 2; index++) {
    report.stage = `open-${index}`;
    const before = await keys();
    await device.shell('cmd statusbar expand-notifications');
    let notices;
    const settledBy = Date.now() + 5000;
    do {
      await device.shell('uiautomator dump /data/local/tmp/dshm-multiple-notice.xml');
      const xml = (await device.shell('cat /data/local/tmp/dshm-multiple-notice.xml')).toString();
      notices = [...xml.matchAll(/<node\s+([^>]+)>/g)].map(match => Object.fromEntries(
        [...match[1].matchAll(/([\w-]+)="([^"]*)"/g)].map(value => [value[1], value[2]])))
        .filter(node => node.package === 'com.android.systemui' && node.text === '有问题等待你回答');
      if (notices.length === 2 - index) break;
      // 通知key已取消，但系统栏的移除动画可能仍保留旧行；只点稳定后的可见目标。
      if (notices.length === 0 && (await keys()).length === 2 - index) {
        // 冷启动Activity会完成上一轮通知栏收起，重新展开后再读取真实可见行。
        await device.shell('cmd statusbar expand-notifications');
      }
      await pause();
    } while (Date.now() < settledBy);
    assert.equal(notices.length, 2 - index);
    await device.screenshot({ path: `artifacts/notification-multiple-${rapid ? 'rapid' : 'restart'}-${index}.png` });
    const [x1, y1, x2, y2] = notices[0].bounds.match(/\d+/g).map(Number);
    await device.shell(`input tap ${Math.floor((x1 + x2) / 2)} ${Math.floor((y1 + y2) / 2)}`);
    (report.tapTimes ??= []).push(Date.now());
    const deadline = Date.now() + 15000; let removed;
    do {
      report.remainingKeys = await keys(); removed = before.filter(key => !report.remainingKeys.includes(key));
      if (removed.length === 1) break; await pause();
    } while (Date.now() < deadline);
    assert.equal(removed.length, 1);
    const item = cases.find(value => value.key === removed[0]); assert.ok(item && !item.cancelled);
    if (rapid && index === 0) {
      // 不等待第一条通知的WebView或会话就绪，直接点击系统中剩下的一条。
      report.firstTappedSession = item.session;
      continue;
    }
    // 从实际消失的通知key确认目标，不假设两个相同文案通知的排序。
    if (index === 0 || rapid) {
      const startedBy = Date.now() + 15000;
      do { report.newPid = (await device.shell(`pidof ${pkg}`)).toString().trim();
        if (report.newPid) break; await pause();
      } while (Date.now() < startedBy);
      assert.match(report.newPid, /^\d+$/); assert.notEqual(report.newPid, report.oldPid);
      await attach();
    }
    await main.locator('.remote-heading strong').getByText(item.title, { exact: true }).waitFor();
    assert.equal(await page.getByTestId('live-interactions').getAttribute('data-session'), item.session);
    await cancel(item);
    report.opened.push({ session: item.session, correctTarget: true, cancelled: true, draftPreserved: true });
    if (rapid) {
      report.lastTappedSession = item.session;
      report.clickIntervalMs = report.tapTimes[1] - report.tapTimes[0];
      assert.notEqual(report.firstTappedSession, report.lastTappedSession);
      assert.ok(report.clickIntervalMs < 10000, '超过10秒不算连续点击验收');
      const first = cases.find(value => value.session === report.firstTappedSession);
      await openChat(first.title); await cancel(first);
      report.opened.push({ session: first.session, manuallyOpenedAfterLastTarget: true, cancelled: true, draftPreserved: true });
    }
    if (language && index === 0) {
      const remaining = await keys(); assert.equal(remaining.length, 1);
      report.restoredLanguage = await verifyRestoredNoticeLanguage(device, remaining[0], page.context());
      assert.deepEqual(await keys(), remaining);
    }
  }
  await openChat(titles[0]); assert.equal(await editor().innerText(), cases[0].draft);
  assert.deepEqual(await keys(), []); assert.deepEqual(report.errors, []); report.stage = 'complete';
  }
} catch (error) { report.failure = error.stack; process.exitCode = 1;
  await device.screenshot({ path: 'artifacts/notification-multiple-restart-failure.png' }).catch(() => {});
} finally {
  await unlink(control).catch(error => { if (error.code !== 'ENOENT') throw error; });
  await device.shell('cmd statusbar collapse');
  await device.shell('rm -f /data/local/tmp/dshm-multiple-notice.xml');
  await writeFile(`artifacts/notification-multiple-${cleanup ? 'cleanup' : rapid ? 'rapid' : language ? 'language' : 'restart'}-android.json`, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report)); await device.close();
}
