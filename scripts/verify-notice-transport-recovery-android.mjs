import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { _android } from 'playwright';

// 服务由外部在READY标记后重启；本驱动只观察正式App的独立通知连接。
assert.equal(process.env.DSHM_RUN_LIVE, '1');
const report = { at: new Date().toISOString(), states: [] };
const artifact = 'artifacts/notice-transport-recovery-android.json';
let device;
const watchdog = setTimeout(() => {
  report.failure = 'overall_timeout';
  writeFile(artifact, JSON.stringify(report, null, 2)).finally(() => process.exit(2));
}, 180000);
async function until(check, timeout = 60000) {
  const deadline = Date.now() + timeout;
  do {
    if (await check()) return;
    await new Promise(resolve => setTimeout(resolve, 200));
  } while (Date.now() < deadline);
  throw new Error('notification_connection_deadline');
}
try {
  device = (await _android.devices({ omitDriverInstall: true })).find(item => item.serial() === process.env.DSHM_ANDROID_SERIAL);
  assert.ok(device);
  const pid = (await device.shell('pidof dev.dshmobile.validation')).toString().trim();
  assert.match(pid, /^[1-9]\d*$/);
  report.pid = pid;
  const status = async () => {
    const log = (await device.shell(`logcat -d --pid=${pid} -v brief -s DSHMNoticeConnection:D '*:S'`)).toString();
    return log.split('\n').filter(line => line.includes('DSHMNoticeConnection')).at(-1)?.split(': ').at(-1)?.trim();
  };
  await until(async () => await status() === 'listening');
  report.states.push('listening');
  await device.shell('input keyevent KEYCODE_HOME');
  console.log('NOTICE_READY_TO_STOP_GATEWAY');
  await until(async () => await status() === 'retrying');
  report.states.push('retrying');
  console.log('NOTICE_READY_TO_START_GATEWAY');
  await until(async () => await status() === 'listening', 90000);
  report.states.push('listening');
  assert.equal((await device.shell('pidof dev.dshmobile.validation')).toString().trim(), pid);
  report.sameProcess = true;
  const activities = (await device.shell('dumpsys activity activities')).toString();
  assert.ok(!/topResumedActivity=.*dev\.dshmobile\.validation\//.test(activities));
  report.remainedInBackground = true;
  report.ok = true;
} catch (error) { report.failure = error.message; process.exitCode = 1; }
finally {
  await writeFile(artifact, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report));
  if (device) await Promise.race([device.close(), new Promise(resolve => setTimeout(resolve, 2000))]);
  clearTimeout(watchdog);
  process.exit(process.exitCode ?? 0);
}
