import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { _android } from 'playwright';
import { androidAppWebView } from './android-app-webview.mjs';

assert.equal(process.env.DSHM_RUN_LIVE, '1');
const phase = process.argv[2];
assert.ok(['offline', 'reconnect', 'answer', 'baseline-offline', 'baseline-restored'].includes(phase));
const device = (await _android.devices({ omitDriverInstall: true })).find(item => item.serial() === process.env.DSHM_ANDROID_SERIAL);
assert.ok(device);
device.setDefaultTimeout(15000);
const report = { at: new Date().toISOString(), phase };
try {
  const page = await (await androidAppWebView(device)).page();
  const remote = page.context().pages().find(page => page.url().startsWith('https://remote.dshm.invalid/'));
  assert.ok(remote);
  if (phase.startsWith('baseline-')) {
    const pid = (await device.shell('pidof dev.dshmobile.validation')).toString().trim();
    assert.match(pid, /^\d+$/);
    const expected = phase === 'baseline-offline' ? 'retrying' : 'listening';
    const deadline = Date.now() + 45000;
    do {
      const logs = (await device.shell(`logcat -d --pid=${pid} -v brief -s DSHMNoticeConnection:D '*:S'`)).toString();
      report.connection = logs.split('\n').filter(line => line.includes('DSHMNoticeConnection')).at(-1)?.split(': ').at(-1)?.trim();
      if (report.connection === expected) break;
      await new Promise(resolve => setTimeout(resolve, 200));
    } while (Date.now() < deadline);
    assert.equal(report.connection, expected);
    report.foreground = (await device.shell('dumpsys activity activities')).toString().match(/topResumedActivity=.*?dev\.dshmobile\.validation\/\.(\w+)/)?.[1] ?? 'other-app';
    assert.equal(report.foreground, 'other-app');
  } else if (phase === 'offline') {
    await remote.getByRole('alert').filter({ hasText: '连接未完成' }).waitFor();
    assert.ok(await remote.getByRole('button', { name: '重新连接', exact: true }).isEnabled());
    assert.equal(await remote.getByRole('region', { name: '等待回答', exact: true }).count(), 0);
    assert.equal(await remote.getByRole('textbox', { name: '消息', exact: true }).count(), 0);
    report.alerts = await remote.getByRole('alert').allTextContents();
    report.retryEnabled = true;
    report.noChatOrAnswerControls = true;
  } else {
    if (phase === 'reconnect') await remote.getByRole('button', { name: '重新连接', exact: true }).click();
    await remote.locator('.remote-heading').getByText('DSHM Remote 联调提示', { exact: true }).waitFor({ timeout: 45000 });
    const question = remote.getByRole('region', { name: '等待回答', exact: true });
    await question.waitFor();
    assert.match(await question.innerText(), /是否确认离线后恢复？/);
    report.correctTarget = true;
    report.questionStillPending = true;
    if (phase === 'answer') {
      await question.getByRole('radio', { name: /^确认恢复/ }).check();
      await question.getByRole('button', { name: '提交回答', exact: true }).click();
      await question.waitFor({ state: 'detached' });
      await remote.getByRole('article', { name: '模型回复', exact: true }).filter({ hasText: 'DSHM_NOTICE_OFFLINE_RECOVERED_20260925' }).waitFor({ timeout: 60000 });
      report.answerCompleted = true;
    }
  }
  report.pages = page.context().pages().map(page => page.url());
  report.notifications = (await device.shell('cmd notification list')).toString().split('\n').filter(line => line.includes('|dev.dshmobile.validation|'));
  if (phase === 'baseline-offline') {
    const expectedId = process.env.DSHM_NOTICE_EVENT_ID;
    assert.match(expectedId ?? '', /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
    assert.equal(report.notifications.length, 1);
    assert.ok(report.notifications[0].includes(`|dshm.remote.notice.${expectedId}|`));
  } else if (phase !== 'offline') assert.equal(report.notifications.length, 0);
  await device.screenshot({ path: `artifacts/notifications-recovery-${phase}.png` });
} catch (error) { report.failure = error.message; process.exitCode = 1; }
finally {
  await writeFile(`artifacts/notifications-recovery-${phase}.json`, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report));
  await device.close();
}
