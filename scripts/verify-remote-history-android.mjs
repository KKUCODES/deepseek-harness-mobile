import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { setTimeout as wait } from 'node:timers/promises';
import { _android } from 'playwright';
import { androidAppWebView } from './android-app-webview.mjs';
import { checkRemoteHistoryWindow } from './check-remote-history-window.mjs';

// 仅在隔离模拟器和独立UID中注入合成协议；真实WebView、恢复回调与原生桥不替换。
const adb = 'C:/Users/KKirin/AppData/Local/Android/Sdk/platform-tools/adb.exe';
const serial = 'emulator-5556', pkg = 'dev.dshmobile.validation.rc21test';
const shell = (...args) => execFileSync(adb, ['-s', serial, 'shell', ...args], { encoding: 'utf8', windowsHide: true });
assert.match(shell('getprop', 'ro.hardware'), /ranchu/);
const folder = 'artifacts/history-white-screen'; await mkdir(folder, { recursive: true });
await writeFile(`${folder}/native-fixture-build.log`, execFileSync(process.execPath, ['scripts/verify-remote-plugin-slots.mjs', '--history-window'], { encoding: 'utf8', windowsHide: true }));
let device = (await _android.devices({ omitDriverInstall: true })).find(value => value.serial() === serial);
assert.ok(device); device.setDefaultTimeout(20000);
const report = { actualAndroidWebView: true, syntheticProtocol: true, errors: [] };
try {
  shell('am', 'force-stop', pkg);
  shell('am', 'start', '-W', '-n', `${pkg}/dev.dshmobile.validation.ValidationActivity`);
  let page = await (await androidAppWebView(device, pkg)).page();
  await page.getByRole('button', { name: '打开侧边抽屉', exact: true }).click();
  await page.getByRole('button', { name: 'Remote', exact: true }).click();
  for (let index = 0; index < 100 && !page.url().startsWith('https://remote.dshm.invalid/'); index++) {
    page = page.context().pages().find(value => value.url().startsWith('https://remote.dshm.invalid/')) ?? page; await wait(100);
  }
  assert.equal(page.url(), 'https://remote.dshm.invalid/assets/web/remote.html');
  await page.evaluate(() => { document.body.replaceChildren(Object.assign(document.createElement('div'), { id: 'app' })); });
  const source = (await readFile('artifacts/tests/remote-plugin-slots/test.js', 'utf8'))
    .replace(/^export\s*\{[^}]*\};?/m, '').replaceAll('import.meta.env', "({MODE:'production'})").replaceAll('import.meta.url', 'location.href');
  await page.evaluate(`(async()=>{${source}\n})()`);
  for (const path of ['artifacts/tests/remote-plugin-slots/test.css', 'src/ui/mobile.css', 'src/ui/ordinary-product.css', 'docs/design/ordinary-preview/remote.css', 'src/ui/remote-product.css']) {
    await page.addStyleTag({ content: await readFile(path, 'utf8') });
  }
  report.history = await checkRemoteHistoryWindow(page);
  await page.screenshot({ path: `${folder}/android-window-after.png` });
  // 自建隔离页的存储标记验证重建不清数据，不写入真实Key或配对信息。
  await page.evaluate(() => localStorage.setItem('history-recovery-test', 'preserved'));
  const pid = shell('pidof', pkg).trim();
  const cdp = await page.context().newCDPSession(page);
  await Promise.race([cdp.send('Page.crash').catch(() => {}), wait(4000)]);
  await wait(2500);
  assert.equal(shell('pidof', pkg).trim(), pid, '仅重建WebView，主进程不退出');
  await Promise.race([device.close(), wait(2000)]);
  device = (await _android.devices({ omitDriverInstall: true })).find(value => value.serial() === serial);
  page = await (await androidAppWebView(device, pkg)).page();
  for (let index = 0; index < 100 && !page.url().startsWith('https://remote.dshm.invalid/'); index++) {
    page = page.context().pages().find(value => value.url().startsWith('https://remote.dshm.invalid/')) ?? page; await wait(100);
  }
  await page.waitForFunction(() => !!window.DSHMRemote && document.body.innerText.length > 10);
  assert.equal(await page.evaluate(() => localStorage.getItem('history-recovery-test')), 'preserved');
  assert.ok(await page.locator('body').innerText(), '恢复到真实产品入口而非空白页');
  report.rendererRecovery = { mainProcessRetained: true, ownStorageRetained: true, url: page.url() };
  await page.screenshot({ path: `${folder}/android-after-renderer-recovery.png` });
  report.passed = true;
} catch (error) { report.failure = error.message; throw error; }
finally {
  await writeFile(`${folder}/android-window-report.json`, JSON.stringify(report, null, 2));
  await Promise.race([device.close(), wait(3000)]);
}
console.log(JSON.stringify(report));
process.exit(0);
