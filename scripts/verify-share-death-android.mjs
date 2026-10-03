import assert from 'node:assert/strict';
import { spawn, execFileSync } from 'node:child_process';
import { writeFile } from 'node:fs/promises';
import { setTimeout as delay } from 'node:timers/promises';
import { _android } from 'playwright';
import { androidAppWebView } from './android-app-webview.mjs';

const adb = 'C:/Users/KKirin/AppData/Local/Android/Sdk/platform-tools/adb.exe';
const pkg = 'dev.dshmobile.validation.pairingtest';
const baseline = process.argv.includes('--baseline');
const report = { at: new Date().toISOString(), baseline, source: 'Production share copy, controlled validity boundary, actual Android process death; isolated UID' };
const command = (...args) => execFileSync(adb, ['-s', 'emulator-5554', ...args], { encoding: 'utf8', timeout: 20000, stdio: ['ignore', 'pipe', 'pipe'] }).trim();
const shell = (...args) => command('shell', ...args);
const pid = () => { try { return shell('pidof', pkg); } catch (error) { if (error.status === 1 && !error.stdout?.trim()) return ''; throw error; } };
const read = path => { try { return shell('run-as', pkg, 'cat', path); } catch { return ''; } };
const exists = path => { try { shell('run-as', pkg, 'test', '-f', path); return true; } catch (error) { if (error.status === 1) return false; throw error; } };
let ready, device;
try {
  shell('am', 'force-stop', pkg);
  assert.equal(read('cache/share-death-ready.json'), '', 'Inspect the previous attempt before retry');
  const child = spawn(adb, ['-s', 'emulator-5554', 'shell', 'am', 'instrument', '-w', '-e', 'shareDeathOnly', 'true', `${pkg}.test/dev.dshmobile.validation.OrdinarySecurityInstrumentation`]);
  let output = ''; child.stdout.on('data', chunk => { output += chunk; }); child.stderr.on('data', chunk => { output += chunk; });
  const exited = new Promise(resolve => child.once('exit', resolve));
  for (let i = 0; i < 100; i++) {
    const raw = read('cache/share-death-ready.json');
    if (raw) { ready = JSON.parse(raw); break; }
    assert.equal(child.exitCode, null, output); await delay(200);
  }
  assert.ok(ready);
  report.copy = ready;
  for (const path of [ready.partial, ready.complete]) assert.match(path, /^cache\/(?:preparing-)?remote-shares\/[a-z0-9.-]+\/share-death\.bin$/);
  assert.equal(ready.bytes, 65536); assert.equal(ready.expectedBytes, 524288);
  if (!baseline) assert.equal(ready.providerCanResolvePartial, false);
  assert.equal(pid(), String(ready.pid));
  const completeHash = shell('run-as', pkg, 'sha256sum', ready.complete).split(/\s/)[0];
  shell('am', 'force-stop', pkg); await exited; assert.equal(pid(), '');
  assert.equal(Number(shell('run-as', pkg, 'stat', '-c', '%s', ready.partial)), ready.bytes);
  report.interruptedPartialConfirmed = true;
  shell('am', 'start', '-W', '-a', 'android.intent.action.MAIN', '-c', 'android.intent.category.LAUNCHER', '-n', `${pkg}/dev.dshmobile.validation.ValidationActivity`);
  device = (await _android.devices({ omitDriverInstall: true })).find(item => item.serial() === 'emulator-5554');
  assert.ok(device);
  const ordinary = await (await androidAppWebView(device, pkg)).page();
  await ordinary.getByRole('button', { name: '打开侧边抽屉', exact: true }).click();
  await ordinary.getByRole('button', { name: 'Remote', exact: true }).click();
  report.newPid = pid(); assert.ok(report.newPid); assert.notEqual(report.newPid, String(ready.pid));
  report.partialSurvived = exists(ready.partial);
  assert.equal(report.partialSurvived, baseline);
  assert.equal(shell('run-as', pkg, 'sha256sum', ready.complete).split(/\s/)[0], completeHash);
  report.completeSnapshotPreserved = true;
  report.completeSha256 = completeHash;
  report.ok = true;
} catch (error) { report.failure = error.message; process.exitCode = 1; }
finally {
  shell('am', 'force-stop', pkg);
  await device?.close();
  if (ready) {
    for (const path of [ready.partial, ready.complete]) {
      assert.match(path, /^cache\/(?:preparing-)?remote-shares\/[a-z0-9.-]+\/share-death\.bin$/);
      shell('run-as', pkg, 'rm', '-f', path);
      try { shell('run-as', pkg, 'rmdir', path.slice(0, path.lastIndexOf('/'))); } catch (error) { if (!String(error.stderr).includes('No such file')) throw error; }
    }
    shell('run-as', pkg, 'rm', '-f', 'cache/share-death-ready.json');
  }
  await writeFile(`artifacts/share-death-${baseline ? 'before' : 'after'}.json`, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report));
}
