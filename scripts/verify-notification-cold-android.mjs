import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { _android } from 'playwright';
import { androidAppWebView } from './android-app-webview.mjs';

assert.equal(process.env.DSHM_RUN_LIVE, '1');
const phase = process.argv[2] ?? 'cold';
assert.ok(['cold', 'paused-cold', 'offline-cold', 'restored', 'disconnect', 'inspect', 'background', 'stopped', 'stopped-check'].includes(phase));
const device = (await _android.devices({ omitDriverInstall: true })).find(item => item.serial() === process.env.DSHM_ANDROID_SERIAL);
assert.ok(device); device.setDefaultTimeout(15000);
const report = { at: new Date().toISOString(), phase };
const pkg = 'dev.dshmobile.validation';
try {
  const cold = ['cold', 'paused-cold', 'offline-cold'].includes(phase);
  if (cold) {
    await device.shell(`am force-stop ${pkg}`);
    await device.shell(`am start -n ${pkg}/.ValidationActivity`);
  }
  if (phase === 'stopped') await device.shell(`am force-stop ${pkg}`);
  let pid = (await device.shell(`pidof ${pkg}`)).toString().trim();
  if (cold) {
    const deadline = Date.now() + 10000;
    while (!pid && Date.now() < deadline) {
      await new Promise(resolve => setTimeout(resolve, 100));
      pid = (await device.shell(`pidof ${pkg}`)).toString().trim();
    }
  }
  report.running = !!pid;
  if (phase === 'stopped' || phase === 'stopped-check') assert.equal(pid, '');
  else {
    assert.match(pid, /^\d+$/);
    const page = await (await androidAppWebView(device)).page();
    report.pages = page.context().pages().map(page => page.url());
    if (cold || phase === 'restored') {
      assert.equal(report.pages.length, 1);
      assert.ok(report.pages[0].startsWith('https://appassets.androidplatform.net/'));
      await page.getByRole('button', { name: '打开侧边抽屉', exact: true }).waitFor();
      const deadline = Date.now() + 35000;
      do {
        const logs = (await device.shell(`logcat -d --pid=${pid} -v brief -s DSHMNoticeConnection:D '*:S'`)).toString();
        report.connection = logs.split('\n').filter(line => line.includes('DSHMNoticeConnection')).at(-1)?.split(': ').at(-1)?.trim();
        if (report.connection === (phase === 'paused-cold' ? 'paused' : phase === 'offline-cold' ? 'retrying' : 'listening')) break;
        await new Promise(resolve => setTimeout(resolve, 250));
      } while (Date.now() < deadline);
      assert.equal(report.connection, phase === 'paused-cold' ? 'paused' : phase === 'offline-cold' ? 'retrying' : 'listening');
      assert.equal(page.context().pages().length, 1, '不能靠预加载Remote页面恢复通知');
    }
    if (phase === 'disconnect') {
      const remote = page.context().pages().find(page => page.url().startsWith('https://remote.dshm.invalid/'));
      assert.ok(remote);
      await remote.getByRole('button', { name: 'Remote 选项', exact: true }).click();
      await remote.getByRole('button', { name: '电脑连接', exact: true }).click();
      await remote.getByRole('button', { name: '断开连接', exact: true }).click();
      await remote.getByRole('heading', { name: '连接已断开', exact: true }).waitFor();
      report.explicitDisconnect = true;
    }
    if (phase === 'background') await device.shell('input keyevent KEYCODE_HOME');
    await device.screenshot({ path: `artifacts/notifications-cold-${phase}.png` });
  }
  report.notifications = (await device.shell('cmd notification list')).toString().split('\n').filter(line => line.includes(`|${pkg}|`));
  report.foreground = (await device.shell('dumpsys activity activities')).toString().match(/topResumedActivity=.*?dev\.dshmobile\.validation\/\.(\w+)/)?.[1] ?? 'other-app';
} catch (error) { report.failure = error.message; process.exitCode = 1; }
finally { await writeFile(`artifacts/notifications-cold-${phase}.json`, JSON.stringify(report, null, 2)); console.log(JSON.stringify(report)); await device.close(); }
