import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { androidAppWebView } from '../../scripts/android-app-webview.mjs';

/** 通知只来自实际官方会话结算；进程回收与系统通知点击均操作独立测试 UID。 */
export async function verifyOfficialTaskNotifications({ page, device, evidence, inference, packageName,
  title, disconnect, reconnect, mark, replacePage }) {
  assert.equal(packageName, 'dev.dshmobile.validation.officialtest');
  const stamp = Date.now(), xmlPath = `/data/local/tmp/dshm-official-notice-${stamp}.xml`;
  const report = { cases: [], completed: false };
  const save = () => writeFile(resolve(evidence, 'task-notifications.json'), JSON.stringify(report, null, 2) + '\n');
  const delay = ms => new Promise(done => setTimeout(done, ms));
  const until = async (check, timeout = 30000) => {
    const deadline = Date.now() + timeout;
    while (!await check()) { assert.ok(Date.now() < deadline, 'official_notification_condition_missing'); await delay(200); }
  };
  const pid = async () => (await device.shell(`pidof ${packageName}`)).toString().trim();
  const notices = async () => (await device.shell('cmd notification list')).toString().split('\n')
    .filter(line => line.includes(`|${packageName}|`) && line.includes('dshm.remote.notice.'));
  const listening = async () => {
    const process = await pid(); assert.match(process, /^[1-9]\d*$/);
    await until(async () => {
      const logs = (await device.shell(`logcat -d --pid=${process} -v brief -s DSHMNoticeConnection:D '*:S'`)).toString();
      return logs.split('\n').filter(line => line.includes('DSHMNoticeConnection')).at(-1)?.endsWith(': listening');
    }, 45000);
    return process;
  };
  const nodes = async () => {
    await device.shell(`uiautomator dump ${xmlPath}`);
    const xml = (await device.shell(`cat ${xmlPath}`)).toString();
    return [...xml.matchAll(/<node\s+([^>]+)>/g)].map(match => Object.fromEntries(
      [...match[1].matchAll(/([\w-]+)="([^"]*)"/g)].map(item => [item[1], item[2]])));
  };
  const tap = async node => {
    assert.ok(node); const [a, b, c, d] = node.bounds.match(/\d+/g).map(Number);
    await device.shell(`input tap ${Math.floor((a + c) / 2)} ${Math.floor((b + d) / 2)}`);
  };
  const absent = async (expectedPid, ms = 3000) => {
    const deadline = Date.now() + ms;
    do { assert.equal(await pid(), expectedPid); assert.equal((await notices()).length, 0); await delay(250); }
    while (Date.now() < deadline);
  };
  const start = async (phase, tool) => {
    const seed = { phase, token: `DSHM_NOTICE_${phase.toUpperCase()}_${stamp}`,
      initialSeq: await inference.beforeTool() };
    if (tool) seed.command = `Write-Output '${seed.token}_BEGIN'; Start-Sleep -Seconds 15; Write-Output '${seed.token}_END'`;
    report.cases.push(seed); await save();
    await page.locator('[data-composer-input]').fill(tool
      ? `这是 DSHM 官方通知验收。仅调用一次 pwsh，command 严格为：${seed.command}。run_in_background=false，timeoutMs=120000。不读写文件、联网、提权，不调用其他工具，不重试。命令结束后只回复 ${seed.token}。`
      : `请只回复 ${seed.token}，不要调用工具。`);
    await page.getByRole('button', { name: '发送消息', exact: true }).click();
    if (tool) seed.running = await inference.notifications.running(seed);
    await save(); return seed;
  };
  const clickNotification = async seed => {
    seed.official = await inference.notifications.settled(seed);
    await until(async () => (await notices()).length === 1);
    const records = await notices();
    const outcomeKey = 'outcome:' + JSON.stringify([inference.notifications.sessionId, seed.official.outcomeSeq]);
    assert.ok(records[0].includes(outcomeKey));
    await device.shell('cmd statusbar expand-notifications');
    const shade = await nodes();
    const heading = shade.find(node => node.text === title);
    assert.ok(heading, 'official_notification_title_missing');
    const body = shade.find(node => node.text.includes('电脑任务已完成') && node.text.includes(seed.token));
    assert.ok(body, 'official_notification_preview_missing');
    seed.notice = { title, body: body.text, count: records.length };
    await writeFile(resolve(evidence, `notice-${seed.phase}-system.png`), await device.screenshot());
    await tap(heading);
    await page.getByTestId('remote-workspace').waitFor();
    await page.getByRole('article', { name: '模型回复', exact: true }).getByText(seed.token, { exact: true }).waitFor();
    assert.equal(await page.locator('iframe').count(), 0);
    await absent(await pid());
    seed.clickedOriginalSession = true; await save();
  };
  try {
    const oldPid = await listening(); report.oldPid = oldPid;
    assert.equal((await notices()).length, 0);
    // 原 Windows sandbox 的可写权限可能触发目录 ACL 授权；本专项只需要只读命令。
    await page.getByRole('button', { name: 'Remote 选项', exact: true }).click();
    await page.getByRole('button', { name: '会话权限', exact: true }).click();
    const permissions = page.getByRole('dialog', { name: '会话权限', exact: true });
    await permissions.getByRole('button', { name: '仅可查看', exact: true }).click();
    await permissions.getByText('当前权限：仅可查看', { exact: true }).waitFor();
    await permissions.getByRole('button', { name: '关闭窗口', exact: true }).click();
    const current = await start('visible', false);
    await page.getByRole('article', { name: '模型回复', exact: true }).getByText(current.token, { exact: true })
      .waitFor({ timeout: 180000 });
    current.official = await inference.notifications.settled(current);
    await absent(oldPid); current.sameSessionSuppressed = true; await save();
    await mark('official-visible-session-completion-without-duplicate-notice');

    const background = await start('background', true);
    await device.shell('input keyevent KEYCODE_HOME');
    assert.equal(await pid(), oldPid);
    await clickNotification(background);
    background.sameProcess = (await pid()) === oldPid; assert.equal(background.sameProcess, true);
    await mark('official-background-system-notice-preview-and-session-click');

    const killed = await start('process', true);
    await device.shell('input keyevent KEYCODE_HOME');
    assert.equal(await inference.notifications.isRunning(), true);
    await device.shell(`am force-stop ${packageName}`);
    await until(async () => await pid() === '', 5000);
    assert.equal(await inference.notifications.isRunning(), true);
    killed.killedBeforeSettlement = true;
    killed.official = await inference.notifications.settled(killed);
    await absent('', 5000); killed.noPushWhileDead = true; await save();
    await mark('official-real-task-settled-after-app-process-ended-without-push');

    await device.shell(`am start -W -a android.intent.action.MAIN -c android.intent.category.LAUNCHER -n ${packageName}/dev.dshmobile.validation.ValidationActivity`);
    report.newPid = await listening(); assert.notEqual(report.newPid, oldPid);
    const ordinary = await (await androidAppWebView(device, packageName)).page();
    await ordinary.getByRole('button', { name: '打开侧边抽屉', exact: true }).waitFor();
    assert.equal(ordinary.context().pages().length, 1);
    await absent(report.newPid, 5000); killed.noHistoryBackfill = true;
    report.noticeListeningBeforeRemotePage = true;
    await ordinary.getByRole('button', { name: '打开侧边抽屉', exact: true }).click();
    const opening = ordinary.context().waitForEvent('page', {
      predicate: target => target.url().startsWith('https://remote.dshm.invalid/'), timeout: 30000,
    });
    await ordinary.getByRole('button', { name: 'Remote', exact: true }).click();
    page = await opening; replacePage(page);
    await page.getByTestId('remote-workspace').waitFor({ timeout: 45000 });
    await page.locator('.remote-session-row').filter({ hasText: title }).click();
    await page.getByRole('article', { name: '模型回复', exact: true }).getByText(killed.token, { exact: true }).waitFor();
    assert.equal((await page.locator('[data-composer-input]').innerText()).trim(), '');
    assert.deepEqual(await inference.notifications.settled(killed), killed.official);
    killed.originalMessageOnceAfterReopen = true; await save();
    await mark('official-launcher-restores-notice-connection-and-original-history');

    await disconnect();
    await page.getByTestId('remote-offline-status').waitFor();
    await reconnect();
    await page.getByTestId('remote-offline-status').waitFor({ state: 'detached', timeout: 45000 });
    await listening(); await absent(report.newPid);
    report.reconnectNoDuplicate = true;
    const recovered = await start('recovered', true);
    await device.shell('input keyevent KEYCODE_HOME');
    await clickNotification(recovered);
    assert.equal(await pid(), report.newPid);
    await mark('official-reconnected-notice-delivers-only-new-completion');
    report.completed = true;
  } catch (error) { report.failure = error.message; throw error; }
  finally { await device.shell(`rm -f ${xmlPath}`); await save(); }
  return report;
}
