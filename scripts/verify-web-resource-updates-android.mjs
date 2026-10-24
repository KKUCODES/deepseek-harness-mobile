import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { setTimeout as wait } from 'node:timers/promises';
import { _android } from 'playwright';
import { androidAppWebView } from './android-app-webview.mjs';
const serial = process.env.DSHM_WEB_UPDATE_TEST_SERIAL;
assert.equal(serial, 'emulator-5556', 'Only use the dedicated headless test device');
const adb = 'C:/Users/KKirin/AppData/Local/Android/Sdk/platform-tools/adb.exe';
const pkg = 'dev.dshmobile.validation.rc21test';
const shell = command => execFileSync(adb, ['-s', serial, 'shell', command], { encoding: 'utf8', windowsHide: true });
assert.match(shell('getprop ro.hardware'), /ranchu/);
const folder = resolve('artifacts/web-update-tests/android'); await mkdir(folder, { recursive: true });
const report = { syntheticReleaseTransport: true, actualResourceSignatureAndLoader: true, noRealModelOrPairing: true, checks: [] };
const instrument = mode => {
  const output = shell(`am instrument -w -e webUpdateLive ${mode} ${pkg}.test/dev.dshmobile.validation.OrdinarySecurityInstrumentation`);
  assert.match(output, new RegExp(`PASS: resource ${mode}`)); return output;
};
const devices = await _android.devices({ omitDriverInstall: true });
const device = devices.find(item => item.serial() === serial); assert.ok(device);
device.setDefaultTimeout(15000);
const readRecord = () => JSON.parse(shell(`run-as ${pkg} cat no_backup/web-updates/state.json`));
const poll = async predicate => { const deadline = Date.now() + 45000; while (Date.now() < deadline) { if (await predicate()) return; await wait(150); } throw Error('Android resource check timed out'); };
const launch = async () => {
  shell(`am force-stop ${pkg}`);
  shell(`am start -W -n ${pkg}/dev.dshmobile.validation.ValidationActivity`);
  const page = await (await androidAppWebView(device, pkg)).page(); page.setDefaultTimeout(15000); return page;
};
const readUpdates = page => page.evaluate(() => new Promise((resolve, reject) => {
  const bridge = window.DSHMUpdates, previous = bridge.onmessage, id = crypto.randomUUID();
  const timer = setTimeout(() => { bridge.onmessage = previous; reject(Error('Native update read timeout')); }, 5000);
  bridge.onmessage = event => { previous?.(event); const response = JSON.parse(event.data); if (response.id === id) { clearTimeout(timer); bridge.onmessage = previous; resolve(response.data); } };
  bridge.postMessage(JSON.stringify({ id, op: 'updates.read', data: {} }));
}));
const showChat = async page => {
  await page.getByRole('button', { name: '打开侧边抽屉', exact: true }).click();
  await page.getByRole('button', { name: /Page update preservation/ }).click();
  await page.getByText('History survives page update', { exact: true }).waitFor();
  const draft = await page.getByRole('textbox').evaluate(node => node.value ?? node.textContent);
  assert.equal(draft, 'Draft survives page update');
};
const nativeTap = async text => {
  await poll(() => {
    shell('uiautomator dump /sdcard/web-resource-check.xml');
    const xml = shell('cat /sdcard/web-resource-check.xml');
    const escaped = text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const node = xml.match(new RegExp(`<node[^>]*text="${escaped}"[^>]*>`))?.[0];
    const bounds = node?.match(/bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"/);
    if (!bounds) return false;
    shell(`input tap ${Math.round((+bounds[1] + +bounds[3]) / 2)} ${Math.round((+bounds[2] + +bounds[4]) / 2)}`); return true;
  });
};
try {
  let page = await launch();
  await page.getByRole('button', { name: '打开侧边抽屉', exact: true }).waitFor();
  assert.equal((await readUpdates(page)).resources.currentRevision, 0);
  await page.evaluate(async () => {
    const db = await new Promise((resolve, reject) => { const request = indexedDB.open('dshm-ordinary-history-v1', 2); request.onsuccess = () => resolve(request.result); request.onerror = reject; });
    await new Promise((resolve, reject) => {
      const tx = db.transaction('chats', 'readwrite');
      tx.objectStore('chats').put({ id: 'web-update-preservation', mode: 'ordinary', title: 'Page update preservation', draft: 'Draft survives page update', model: 'deepseek-chat', thinking: false, updatedAt: Date.now(),
        turns: [{ requestId: 'resource-fixture', prompt: 'Retain this local message', model: 'deepseek-chat', thinking: false, status: 'completed', content: 'History survives page update', reasoning: '', error: null, finishReason: 'stop', responseId: null }] });
      tx.oncomplete = resolve; tx.onerror = reject;
    }); db.close();
  });
  await page.reload(); await showChat(page);
  report.checks.push('Actual ordinary history and draft before updating');
  await writeFile(resolve(folder, 'pipeline1.txt'), instrument('pipeline1'));
  assert.equal(readRecord().pendingRevision, 1);
  page = await launch(); await showChat(page);
  assert.equal((await readUpdates(page)).resources.currentRevision, 1);
  await page.screenshot({ path: resolve(folder, 'active-r1.png') });
  const pid = shell(`pidof ${pkg}`).trim();
  await page.getByRole('button', { name: '打开侧边抽屉', exact: true }).click();
  const next = page.context().waitForEvent('page', { predicate: p => p.url().startsWith('https://remote.dshm.invalid/') });
  await page.getByRole('button', { name: 'Remote', exact: true }).click();
  const remote = await next;
  await remote.getByRole('button', { name: '返回普通聊天', exact: true }).waitFor();
  assert.equal((await readUpdates(remote)).resources.currentRevision, 1);
  assert.equal(shell(`pidof ${pkg}`).trim(), pid);
  await poll(() => readRecord().healthy?.['mobile.html'] && readRecord().healthy?.['remote.html']);
  report.checks.push('Signed full package activated after restart; both origins share revision 1 in the same process');
  await writeFile(resolve(folder, 'retention1.txt'), instrument('retention'));
  await writeFile(resolve(folder, 'pipeline2.txt'), instrument('pipeline2'));
  assert.equal(readRecord().pendingRevision, 2);
  page = await launch();
  await poll(() => readRecord().recover === true);
  shell('uiautomator dump /sdcard/web-resource-check.xml');
  assert.ok(shell('cat /sdcard/web-resource-check.xml').includes('恢复内置页面'));
  await writeFile(resolve(folder, 'failure-native.png'), await device.screenshot());
  report.checks.push('Signed revision 2 deliberately fails local startup; native recovery remains available');
  page = await launch(); await showChat(page);
  const restored = (await readUpdates(page)).resources;
  assert.equal(restored.currentRevision, 1); assert.equal(restored.notice, 'web_rolled_back');
  report.checks.push('Next full launch automatically falls back to known-good revision 1, retaining actual chat and draft');
  await page.getByRole('button', { name: '打开侧边抽屉', exact: true }).click();
  await page.getByRole('button', { name: '设置', exact: true }).click();
  await page.getByRole('button', { name: /^软件更新/ }).click();
  const resources = page.getByTestId('app-updates');
  await resources.locator('summary').filter({ hasText: '更多' }).click();
  await resources.getByRole('button', { name: '恢复内置页面', exact: true }).click();
  const beforeRecovery = shell(`pidof ${pkg}`).trim();
  await nativeTap('恢复并重启');
  await poll(() => { const pid = shell(`pidof ${pkg} || true`).trim(); return pid && pid !== beforeRecovery; });
  page = await (await androidAppWebView(device, pkg)).page(); await showChat(page);
  assert.equal((await readUpdates(page)).resources.currentRevision, 0);
  await writeFile(resolve(folder, 'retention-final.txt'), instrument('retention'));
  report.checks.push('Native-confirmed bundled-page recovery, encrypted ordinary key, remote token storage and device identity retention');
  report.passed = true;
} finally {
  await writeFile(resolve(folder, 'report.json'), JSON.stringify(report, null, 2)); console.log(JSON.stringify(report));
}
process.exit(0);
