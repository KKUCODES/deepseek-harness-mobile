import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { _android } from 'playwright';
import { androidAppWebView } from './android-app-webview.mjs';
import { pickerNodes, tapPickerNode } from './android-picker-test.mjs';

// 真实文件准备和系统选择器；进程结束发生在选择目的地之前，不伪装成写入中崩溃。
const pkg = 'dev.dshmobile.validation';
const name = 'dshm-shared-upload-20260924.txt';
const expected = await readFile(`artifacts/${name}`);
const digest = createHash('sha256').update(expected).digest('hex');
const report = { at: new Date().toISOString(), stage: 'connect', errors: [] };
const device = (await _android.devices({ omitDriverInstall: true }))
  .find(item => item.serial() === process.env.DSHM_ANDROID_SERIAL);
assert.ok(device); device.setDefaultTimeout(20000);
let page, draft, killed = false, selectedCopy;
const cache = async () => (await device.shell(`run-as ${pkg} find cache/remote-downloads -maxdepth 1 -type f`))
  .toString().trim().split('\n').filter(Boolean);
const saved = async () => (await device.shell('find /sdcard/Download -maxdepth 1 -type f -print0'))
  .toString().split('\0').filter(Boolean).sort();
async function enter() {
  const context = (await (await androidAppWebView(device)).page()).context();
  page = context.pages().find(item => item.url().startsWith('https://remote.dshm.invalid/'));
  if (!page) {
    const ordinary = context.pages().find(item => item.url().startsWith('https://appassets.androidplatform.net/'));
    assert.ok(ordinary);
    await ordinary.getByRole('button', { name: '打开侧边抽屉', exact: true }).click();
    const opened = context.waitForEvent('page');
    await ordinary.getByRole('button', { name: 'Remote', exact: true }).click();
    page = await opened; await page.waitForURL('https://remote.dshm.invalid/**');
  }
  page.setDefaultTimeout(25000);
  page.on('pageerror', error => report.errors.push(error.message));
  const main = page.getByTestId('remote-workspace'); await main.waitFor();
  if (!await page.getByRole('region', { name: '聊天内容', exact: true }).count()) {
    await page.getByRole('button', { name: /^DSHM Remote 联调提示/ }).click();
  }
  assert.equal(await main.locator('.remote-heading').innerText(), 'DSHM Remote 联调提示');
  await page.getByRole('article', { name: '模型回复', exact: true }).first().waitFor();
  return main.getByRole('textbox', { name: '消息', exact: true });
}
async function openAttachment() {
  const card = page.getByRole('button', { name: `查看附件 ${name}`, exact: true }).first();
  for (let i = 0; i < 12 && !await card.count(); i++) {
    const older = page.getByRole('button', { name: '加载更早的消息', exact: true });
    assert.ok(await older.count());
    const count = await page.locator('.conversation article').count();
    await older.click();
    await page.waitForFunction(count => document.querySelectorAll('.conversation article').length > count, count);
  }
  await card.click();
  const panel = page.getByRole('region', { name: '插件面板', exact: true });
  const plain = panel.locator('.remote-document-tab:not([hidden]) [data-textpreview-plain]');
  await plain.waitFor(); assert.equal(await plain.textContent(), expected.toString());
  return panel;
}
async function openPicker(panel) {
  await panel.getByRole('button', { name: '下载完整文件', exact: true }).click();
  await panel.getByText('请选择保存位置…', { exact: true }).waitFor();
  assert.ok((await pickerNodes(device)).some(node => node.class === 'android.widget.EditText' && node.text.startsWith('dshm-shared-upload')));
}
try {
  draft = await (await enter()).innerText();
  assert.deepEqual(await cache(), []);
  const before = await saved();
  const first = await openAttachment();
  report.stage = 'picker-before-kill'; await openPicker(first);
  const parts = await cache(); assert.equal(parts.length, 1);
  assert.match(parts[0], /^cache\/remote-downloads\/remote-[\w-]+\.part$/);
  assert.equal((await device.shell(`run-as ${pkg} sha256sum ${parts[0]}`)).toString().split(/\s/)[0], digest);
  report.preparedBytes = expected.length;
  report.oldPid = (await device.shell(`pidof ${pkg}`)).toString().trim();
  await device.shell(`am force-stop ${pkg}`); killed = true;
  assert.equal((await device.shell(`pidof ${pkg}`)).toString().trim(), '');
  // 强制停止没有调用清理生命周期；旧暂存必须在下次真实初始化时收敛。
  assert.deepEqual(await cache(), parts); report.partialSurvivedProcessDeath = true;
  assert.deepEqual(await saved(), before);
  report.stage = 'reconnect';
  const launch = (await device.shell(`am start -W -a android.intent.action.MAIN -c android.intent.category.LAUNCHER -f 0x10200000 -n ${pkg}/.ValidationActivity`)).toString();
  assert.ok(launch.includes(`Activity: ${pkg}/.ValidationActivity`), 'Launch must foreground DSHM, not the old system picker');
  const editor = await enter(); killed = false;
  report.newPid = (await device.shell(`pidof ${pkg}`)).toString().trim();
  assert.notEqual(report.newPid, report.oldPid);
  assert.equal(await editor.innerText(), draft);
  assert.deepEqual(await cache(), []); report.staleCacheRemoved = true;
  assert.deepEqual(await saved(), before);
  assert.equal((await pickerNodes(device)).length, 0);
  report.noAutomaticSave = true;
  report.stage = 'explicit-retry';
  const panel = await openAttachment(); await openPicker(panel);
  await tapPickerNode(device, node => node['content-desc'] === '显示根目录');
  await tapPickerNode(device, node => node.text === '下载' && node['resource-id'] === 'android:id/title');
  await tapPickerNode(device, node => node.text === '保存' && node.clickable === 'true');
  if ((await pickerNodes(device)).some(node => node.text === '替换')) {
    await device.shell('input keyevent 4'); await device.shell('input keyevent 4');
    throw new Error('Refusing to replace an existing download');
  }
  await panel.getByText('已保存到所选位置。', { exact: true }).waitFor();
  const added = (await saved()).filter(path => !before.includes(path)); assert.equal(added.length, 1);
  selectedCopy = added[0]; assert.match(selectedCopy, /^\/sdcard\/Download\/dshm-shared-upload-[\w.() -]+$/);
  assert.equal((await device.shell(`sha256sum '${selectedCopy}'`)).toString().split(/\s/)[0], digest);
  report.retrySaved = true; report.sha256 = digest;
  await panel.getByRole('button', { name: '返回聊天', exact: true }).click();
  assert.equal(await editor.innerText(), draft); report.draftPreserved = true;
  assert.deepEqual(await cache(), []); assert.deepEqual(report.errors, []);
  report.stage = 'complete';
} catch (error) {
  report.failure = error.stack; process.exitCode = 1;
} finally {
  if (selectedCopy && /^\/sdcard\/Download\/dshm-shared-upload-[\w.() -]+$/.test(selectedCopy)
    && (await device.shell(`sha256sum '${selectedCopy}'`)).toString().split(/\s/)[0] === digest) {
    await device.shell(`rm '${selectedCopy}'`); report.testCopyRemoved = !(await saved()).includes(selectedCopy);
  }
  if (killed) await device.shell(`am start -W -f 0x20020000 -n ${pkg}/.ValidationActivity`);
  await device.shell('rm -f /data/local/tmp/dshm-picker-test.xml');
  await writeFile('artifacts/save-picker-restart-android.json', JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report)); await device.close();
}
