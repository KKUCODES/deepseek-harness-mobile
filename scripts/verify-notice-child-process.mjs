import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';

assert.equal(process.env.DSHM_RUN_LIVE, '1');
const prefix = `artifacts/notice-child-cold${process.argv.includes('--fixed') ? '-fixed' : ''}`;
const seed = JSON.parse(await readFile(`${prefix}-kill-android.json`, 'utf8'));
const adb = 'C:/Users/KKirin/AppData/Local/Android/Sdk/platform-tools/adb.exe';
const shell = (...args) => {
  try { return execFileSync(adb, ['-s', '127.0.0.1:16384', 'shell', ...args], { encoding: 'utf8', windowsHide: true, timeout: 10000 }).trim(); }
  catch (error) { if (args[0] === 'pidof' && error.status === 1) return ''; throw error; }
};
const report = { at: new Date().toISOString(), oldPid: seed.oldPid };
try {
  // 检查器已断开后核对进程确实退出；不能把am kill返回0当作进程消失。
  assert.match(seed.oldPid, /^\d+$/);
  if (process.argv.includes('--stop')) {
    const current = shell('pidof', 'dev.dshmobile.validation');
    assert.ok(current === seed.oldPid || current === '', 'Do not terminate a different process');
    if (current) shell('am', 'kill', 'dev.dshmobile.validation');
    const until = Date.now() + 15000;
    while (shell('pidof', 'dev.dshmobile.validation') && Date.now() < until) await new Promise(resolve => setTimeout(resolve, 100));
  }
  assert.equal(shell('pidof', 'dev.dshmobile.validation'), '');
  report.notifications = shell('cmd', 'notification', 'list').split('\n').filter(line => line.includes('|dev.dshmobile.validation|') && line.includes('dshm.remote.notice.outcome:'));
  assert.deepEqual(report.notifications, seed.notifications);
  report.processEndedAndNotificationRetained = true;
} catch (error) { report.failure = error.message; process.exitCode = 1; }
await writeFile(`${prefix}-process-android.json`, JSON.stringify(report, null, 2));
console.log(JSON.stringify(report));
