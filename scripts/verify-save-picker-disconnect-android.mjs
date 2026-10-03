import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { _android } from 'playwright';
import { androidAppWebView } from './android-app-webview.mjs';
import { pickerNodes, tapPickerNode } from './android-picker-test.mjs';
import { inspectSessionArchive } from './session-export-check.mjs';

// 真实系统保存窗口与真实连接中断；只创建/清理唯一命名的测试下载副本。
assert.equal(process.env.DSHM_RUN_LIVE, '1');
const reproduce = process.argv.includes('--reproduce');
const workspace = process.argv.includes('--workspace'), exporting = process.argv.includes('--export');
assert.ok(!workspace || !exporting);
const suffix = workspace ? '-workspace' : exporting ? '-export' : '';
const artifact = `save-picker-${reproduce ? 'before' : 'after'}${suffix}-android`;
const device = (await _android.devices({ omitDriverInstall: true })).find(item => item.serial() === process.env.DSHM_ANDROID_SERIAL);
assert.ok(device); device.setDefaultTimeout(20000);
const report = { at: new Date().toISOString(), reproduce, source: workspace ? 'workspace' : exporting ? 'export' : 'attachment', errors: [] };
const originalName = 'dshm-shared-upload-20260924.txt';
const targetName = `dshm-cancelled-picker-${Date.now()}.${exporting ? 'zip' : 'txt'}`, target = `/sdcard/Download/${targetName}`;
const retryName = targetName.replace('cancelled', 'recovered'), retryTarget = `/sdcard/Download/${retryName}`;
let page, draft, panel, pickerOpen = false, targetChecked = false, retryChecked = false;
async function nameDownload(name) {
  await tapPickerNode(device, node => node['content-desc'] === '显示根目录');
  await tapPickerNode(device, node => node.text === '下载' && node['resource-id'] === 'android:id/title');
  await tapPickerNode(device, node => node['resource-id'] === 'android:id/title' && node.class === 'android.widget.EditText');
  const previous = (await pickerNodes(device)).find(node => node.class === 'android.widget.EditText')?.text;
  assert.ok(previous && previous.length < 200);
  // MuMu不支持组合键全选；按实际字段长度清空，不触碰目录中的文件。
  await device.shell('input keyevent KEYCODE_MOVE_END');
  await device.shell(`input keyevent ${Array(previous.length).fill('KEYCODE_DEL').join(' ')}`);
  await device.shell(`input text ${name}`);
  assert.equal((await pickerNodes(device)).find(node => node.class === 'android.widget.EditText')?.text, name);
}
try {
  const first = await (await androidAppWebView(device)).page(), context = first.context();
  page = context.pages().find(item => item.url().startsWith('https://remote.dshm.invalid/'));
  assert.ok(page); page.setDefaultTimeout(20000); page.on('pageerror', error => report.errors.push(error.message));
  await page.getByTestId('remote-workspace').waitFor();
  panel = page.getByRole('region', { name: '插件面板', exact: true });
  if (await panel.isVisible()) await panel.getByRole('button', { name: '返回聊天', exact: true }).click();
  if (!await page.getByRole('region', { name: '聊天内容', exact: true }).count()) await page.getByRole('button', { name: /^DSHM Remote 联调提示/ }).click();
  assert.equal(await page.getByTestId('remote-workspace').locator('.remote-heading').innerText(), 'DSHM Remote 联调提示');
  draft = await page.getByRole('textbox', { name: '消息', exact: true }).innerText();
  const seed = workspace ? JSON.parse(await readFile('artifacts/desktop-open-seed.json', 'utf8')) : null;
  const expected = await readFile(workspace ? seed.path : `artifacts/${originalName}`, 'utf8');
  if (workspace) {
    await page.getByRole('button', { name: '返回', exact: true }).click();
    await page.getByRole('button', { name: 'Remote 选项', exact: true }).click();
    await page.getByRole('button', { name: '查看已归档聊天', exact: true }).click();
    await page.getByRole('textbox', { name: '搜索远程聊天', exact: true }).fill(seed.chat);
    await page.getByRole('button', { name: new RegExp(`^${seed.chat}`) }).click();
    await page.locator('[data-presented-file]').first().getByRole('button', { name: /^在侧边栏打开/ }).click();
  } else if (exporting) {
    await page.getByRole('button', { name: 'Remote 选项', exact: true }).click();
    await page.getByRole('button', { name: '导出会话日志', exact: true }).click();
    panel = page.getByRole('dialog', { name: '导出会话日志', exact: true });
  } else {
    const attachment = page.getByRole('button', { name: `查看附件 ${originalName}`, exact: true }).first();
    for (let attempt = 0; attempt < 12 && !await attachment.count(); attempt++) {
      const count = await page.locator('.conversation article').count();
      await page.getByRole('button', { name: '加载更早的消息', exact: true }).click();
      await page.waitForFunction(count => document.querySelectorAll('.conversation article').length > count, count);
    }
    await attachment.click();
  }
  if (!exporting) {
    await panel.locator('[data-textpreview-plain]').waitFor();
    assert.equal(await panel.locator('[data-textpreview-plain]').textContent(), expected);
  }
  await page.evaluate(() => {
    const bridge = window.DSHMRemote, deliver = bridge.onmessage, send = bridge.postMessage.bind(bridge);
    const pending = new Map();
    window.__savePickerProbe = { closed: 0, ready: 0, calls: [] };
    bridge.postMessage = raw => {
      const message = JSON.parse(raw);
      if (message.op.startsWith('file.')) {
        pending.set(message.id, message.op);
        window.__savePickerProbe.calls.push({ op: message.op });
      }
      return send(raw);
    };
    bridge.onmessage = event => {
      const message = JSON.parse(event.data);
      if (message.event?.type === 'closed') window.__savePickerProbe.closed++;
      if (message.event?.type === 'ready') window.__savePickerProbe.ready++;
      if (pending.has(message.id)) {
        window.__savePickerProbe.calls.push({ op: pending.get(message.id), error: message.error ?? null });
        pending.delete(message.id);
      }
      deliver(event);
    };
    window.__restoreSavePickerProbe = () => { bridge.onmessage = deliver; bridge.postMessage = send; };
  });
  const saveButton = panel.getByRole('button', { name: exporting ? '导出并保存' : '下载完整文件', exact: true });
  await saveButton.click();
  await panel.getByText('请选择保存位置…', { exact: true }).waitFor({ timeout: 60000 }); pickerOpen = true;
  await nameDownload(targetName);
  assert.equal((await device.shell(`test -e '${target}' && echo exists`)).toString().trim(), '');
  targetChecked = true;
  const temporary = async () => (await device.shell('run-as dev.dshmobile.validation find cache/remote-downloads -type f')).toString().trim();
  assert.match(await temporary(), /\.part$/);
  console.log(JSON.stringify({ phase: 'save-picker-ready', targetName }));
  // 系统窗口前台时WebView可能暂停事件交付，直接核对原生断线清理后的暂存。
  const disconnectedBy = Date.now() + 60000;
  while (await temporary()) {
    assert.ok(Date.now() < disconnectedBy, 'Native download did not cancel');
    await new Promise(resolve => setTimeout(resolve, 200));
  }
  report.nativeCancelledBeforeSave = true;
  if (reproduce) await tapPickerNode(device, node => node.text === '保存' && node.clickable === 'true');
  else {
    const closedBy = Date.now() + 10000;
    while ((await device.shell('dumpsys activity activities')).toString().match(/topResumedActivity=[^\r\n]*com\.android\.documentsui/)) {
      assert.ok(Date.now() < closedBy, 'Canceled system picker must close');
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    report.pickerClosed = true;
  }
  pickerOpen = false;
  await page.getByTestId('remote-workspace').waitFor();
  await page.waitForFunction(() => window.__savePickerProbe.closed > 0, null, { timeout: 10000, polling: 100 });
  await panel.getByRole('status').filter({ hasText: /下载未完成|已取消下载|导出未完成|已取消导出/ }).waitFor();
  const deadline = Date.now() + 3000;
  let exists = '';
  do {
    exists = (await device.shell(`test -e '${target}' && echo exists`)).toString().trim();
    if (!exists && !reproduce) break;
    if (exists && reproduce) break;
    await new Promise(resolve => setTimeout(resolve, 100));
  } while (Date.now() < deadline);
  report.orphanExists = !!exists;
  if (exists) report.orphanBytes = Number((await device.shell(`stat -c %s '${target}'`)).toString().trim());
  if (reproduce) { assert.equal(report.orphanExists, true); assert.equal(report.orphanBytes, 0); }
  else assert.equal(report.orphanExists, false);
  report.partialFiles = (await device.shell('run-as dev.dshmobile.validation find cache/remote-downloads -type f')).toString().trim();
  assert.equal(report.partialFiles, '');
  await device.screenshot({ path: `artifacts/${artifact}.png` });
  if (!reproduce) {
    console.log(JSON.stringify({ phase: 'save-picker-canceled', orphanExists: report.orphanExists }));
    await page.waitForFunction(() => window.__savePickerProbe.ready > 0, null, { timeout: 60000, polling: 100 });
    await page.getByTestId('remote-offline-status').waitFor({ state: 'detached' });
    await saveButton.click();
    await panel.getByText('请选择保存位置…', { exact: true }).waitFor({ timeout: 60000 }); pickerOpen = true;
    await nameDownload(retryName);
    assert.equal((await device.shell(`test -e '${retryTarget}' && echo exists`)).toString().trim(), '');
    retryChecked = true;
    await tapPickerNode(device, node => node.text === '保存' && node.clickable === 'true'); pickerOpen = false;
    await panel.getByRole('status').filter({ hasText: '已保存' }).waitFor();
    report.retryCreated = true;
    report.retryHash = (await device.shell(`sha256sum '${retryTarget}'`)).toString().split(' ')[0];
    if (exporting) report.archive = inspectSessionArchive(await device.shell(`cat '${retryTarget}'`));
    else assert.equal(report.retryHash, createHash('sha256').update(expected).digest('hex'));
    assert.equal(await temporary(), '');
  }
  assert.deepEqual(report.errors, []);
} catch (error) {
  report.failure = error.message;
  if (panel && await panel.isVisible()) report.panel = (await panel.innerText()).slice(-1500);
  throw error;
}
finally {
  try {
    if (pickerOpen) {
      for (let attempt = 0; attempt < 3; attempt++) {
        if (!(await device.shell('dumpsys activity activities')).toString().match(/topResumedActivity=[^\r\n]*com\.android\.documentsui/)) break;
        await device.shell('input keyevent KEYCODE_BACK');
      }
    }
    if (page) {
      report.nativeOperations = await page.evaluate(() => window.__savePickerProbe);
      await page.evaluate(() => window.__restoreSavePickerProbe?.()).catch(() => {});
      if (panel && await panel.isVisible()) await panel.getByRole('button', { name: exporting ? '关闭窗口' : '返回聊天', exact: true }).click();
      if (workspace) {
        await page.getByRole('button', { name: '返回', exact: true }).click();
        await page.getByRole('textbox', { name: '搜索远程聊天', exact: true }).fill('');
        await page.getByRole('button', { name: 'Remote 选项', exact: true }).click();
        await page.getByRole('button', { name: '查看最近聊天', exact: true }).click();
        await page.getByRole('button', { name: /^DSHM Remote 联调提示/ }).click();
      }
      if (draft !== undefined) report.draftPreserved = await page.getByRole('textbox', { name: '消息', exact: true }).innerText() === draft;
    }
  } catch (error) { report.cleanupFailure = error.message; }
  // 路径由本脚本唯一生成，只清理此次创建的下载副本。
  if (targetChecked) await device.shell(`rm -f '${target}'`);
  if (retryChecked) await device.shell(`rm -f '${retryTarget}'`);
  await writeFile(`artifacts/${artifact}.json`, JSON.stringify(report, null, 2));
  const { nativeOperations, ...summary } = report;
  console.log(JSON.stringify({ ...summary, nativeCallCount: nativeOperations?.calls.length })); await device.close();
}
