import assert from 'node:assert/strict';
import { spawn, execFileSync } from 'node:child_process';
import { writeFile } from 'node:fs/promises';
import { setTimeout as delay } from 'node:timers/promises';
import { _android } from 'playwright';
import { androidAppWebView } from './android-app-webview.mjs';

const adb = process.env.ANDROID_ADB || 'C:/Users/KKirin/AppData/Local/Android/Sdk/platform-tools/adb.exe';
const serial = process.env.DSHM_ANDROID_SERIAL || 'emulator-5554';
const pkg = 'dev.dshmobile.validation.pairingtest';
const baseline = process.argv.includes('--baseline');
const report = { at: new Date().toISOString(), source: 'Actual Android process death during production save through controlled private DocumentsProvider; isolated UID', baseline };
const command = (...args) => execFileSync(adb, ['-s', serial, ...args], { encoding: 'utf8', timeout: 20000, stdio: ['ignore', 'pipe', 'pipe'] }).trim();
const shell = (...args) => command('shell', ...args);
const pid = () => { try { return shell('pidof', pkg); } catch (error) { if (error.status === 1 && !error.stdout?.trim()) return ''; throw error; } };
const read = path => { try { return shell('run-as', pkg, 'cat', path); } catch { return ''; } };
const nodes = () => {
  shell('uiautomator', 'dump', '/data/local/tmp/dshm-save-death.xml');
  return [...shell('cat', '/data/local/tmp/dshm-save-death.xml').matchAll(/<node\s+([^>]+)>/g)]
    .map(match => Object.fromEntries([...match[1].matchAll(/([\w-]+)="([^"]*)"/g)].map(item => [item[1], item[2]])))
    .filter(node => node.package === pkg);
};
const start = () => shell('am', 'start', '-W', '-a', 'android.intent.action.MAIN', '-c', 'android.intent.category.LAUNCHER', '-n', `${pkg}/dev.dshmobile.validation.ValidationActivity`);
let child, ready, device;
try {
  report.stage = 'prepare';
  shell('am', 'force-stop', pkg);
  assert.equal(read('cache/save-death-probe/ready.json'), '', 'Previous run must be inspected before retry');
  child = spawn(adb, ['-s', serial, 'shell', 'am', 'instrument', '-w', '-e', 'saveDeathOnly', 'true',
    `${pkg}.test/dev.dshmobile.validation.OrdinarySecurityInstrumentation`]);
  let output = ''; child.stdout.on('data', chunk => { output += chunk; }); child.stderr.on('data', chunk => { output += chunk; });
  const exited = new Promise(resolve => child.once('exit', resolve));
  for (let i = 0; i < 100; i++) {
    const raw = read('cache/save-death-probe/ready.json');
    if (raw) { ready = JSON.parse(raw); break; }
    assert.equal(child.exitCode, null, output); await delay(200);
  }
  assert.ok(ready); assert.match(ready.document, /^dshm-save-test-[a-f0-9-]+$/);
  assert.ok(ready.bytes > 0 && ready.bytes < ready.expectedBytes);
  report.writing = ready;
  report.stage = 'kill-during-write';
  assert.equal(pid(), String(ready.pid));
  shell('am', 'force-stop', pkg); await exited;
  assert.equal(pid(), '');
  const partial = `cache/save-death-probe/${ready.document}`;
  assert.equal(Number(shell('run-as', pkg, 'stat', '-c', '%s', partial)), ready.bytes);
  report.stage = 'reopen-normal-entry'; start();
  report.newPid = pid(); assert.ok(report.newPid); assert.notEqual(report.newPid, String(ready.pid));
  let screen = nodes();
  report.warning = screen.some(node => node.text === '上次文件保存结果未确认');
  await writeFile(`artifacts/save-death-${baseline ? 'before' : 'after'}.png`, execFileSync(adb, ['-s', serial, 'exec-out', 'screencap', '-p']));
  if (baseline) assert.equal(report.warning, false);
  else {
    assert.equal(report.warning, true);
    assert.ok(screen.some(node => node.text.includes('不完整文件')));
    // 返回关闭提示并不确认结果；进入另一个实际入口仍能看到它。
    shell('input', 'keyevent', '4');
    device = (await _android.devices({ omitDriverInstall: true })).find(item => item.serial() === serial);
    assert.ok(device);
    const ordinary = await (await androidAppWebView(device, pkg)).page();
    await ordinary.getByRole('button', { name: '打开侧边抽屉', exact: true }).click();
    await ordinary.getByRole('button', { name: 'Remote', exact: true }).click();
    screen = nodes(); assert.ok(screen.some(node => node.text === '上次文件保存结果未确认'));
    report.remoteEntryWarning = true;
    shell('am', 'force-stop', pkg); start();
    screen = nodes(); assert.ok(screen.some(node => node.text === '上次文件保存结果未确认'));
    report.unacknowledgedAcrossRestart = true;
    const buttons = screen.filter(node => node.text === '知道了'); assert.equal(buttons.length, 1);
    const [x1, y1, x2, y2] = buttons[0].bounds.match(/\d+/g).map(Number);
    shell('input', 'tap', String(Math.floor((x1 + x2) / 2)), String(Math.floor((y1 + y2) / 2)));
    assert.ok(!nodes().some(node => node.text === '上次文件保存结果未确认'));
    shell('am', 'force-stop', pkg); start();
    assert.ok(!nodes().some(node => node.text === '上次文件保存结果未确认'));
    report.acknowledgedAcrossRestart = true;
  }
  assert.equal(Number(shell('run-as', pkg, 'stat', '-c', '%s', partial)), ready.bytes);
  report.partialPreserved = true;
  report.stage = 'complete';
} catch (error) { report.failure = error.message; process.exitCode = 1; }
finally {
  shell('am', 'force-stop', pkg);
  await device?.close();
  if (ready?.document && /^dshm-save-test-[a-f0-9-]+$/.test(ready.document)) {
    shell('run-as', pkg, 'rm', '-f', `cache/save-death-probe/${ready.document}`, 'cache/save-death-probe/ready.json');
  }
  await writeFile(`artifacts/save-death-${baseline ? 'before' : 'after'}.json`, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report));
}
