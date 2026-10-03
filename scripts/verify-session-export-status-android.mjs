import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { _android } from 'playwright';
import { androidAppWebView } from './android-app-webview.mjs';

assert.equal(process.env.DSHM_RUN_LIVE, '1');
const device = (await _android.devices({ omitDriverInstall: true })).find(item => item.serial() === process.env.DSHM_ANDROID_SERIAL);
assert.ok(device); device.setDefaultTimeout(20000);
const report = { at: new Date().toISOString(), errors: [] };
let page, dialog, original, draft;
try {
  await device.shell('am start -f 0x20020000 -n dev.dshmobile.validation/.ValidationActivity');
  const startedBy = Date.now() + 15000;
  while (!(await device.shell('pidof dev.dshmobile.validation')).toString().trim() && Date.now() < startedBy) await new Promise(resolve => setTimeout(resolve, 100));
  const context = (await (await androidAppWebView(device)).page()).context();
  const ordinary = context.pages().find(item => item.url().startsWith('https://appassets.androidplatform.net/'));
  assert.ok(ordinary);
  await ordinary.getByRole('button', { name: '打开侧边抽屉', exact: true }).click();
  await ordinary.getByRole('button', { name: 'Remote', exact: true }).click();
  const openedBy = Date.now() + 20000;
  while (!page && Date.now() < openedBy) {
    page = context.pages().find(item => item.url().startsWith('https://remote.dshm.invalid/'));
    if (!page) await new Promise(resolve => setTimeout(resolve, 100));
  }
  assert.ok(page); page.setDefaultTimeout(20000); page.on('pageerror', error => report.errors.push(error.message));
  await page.getByTestId('remote-workspace').waitFor();
  if (!await page.getByRole('region', { name: '聊天内容', exact: true }).count()) await page.getByRole('button', { name: /^DSHM Remote 联调提示/ }).click();
  assert.equal(await page.getByTestId('remote-workspace').locator('.remote-heading').innerText(), 'DSHM Remote 联调提示');
  draft = await page.getByRole('textbox', { name: '消息', exact: true }).innerText();
  await page.getByRole('button', { name: 'Remote 选项', exact: true }).click();
  await page.getByRole('button', { name: '导出会话日志', exact: true }).click();
  dialog = page.getByRole('dialog', { name: '导出会话日志', exact: true });
  const children = dialog.getByRole('checkbox', { name: '包含子会话', exact: true });
  const save = dialog.getByRole('button', { name: '导出并保存', exact: true });
  const upgrade = dialog.getByText('请更新电脑远程插件和网关后导出日志。', { exact: true });
  original = await children.isChecked(); await children.check();
  assert.equal(await save.isEnabled(), true);
  await page.evaluate(() => {
    const bridge = window.DSHMRemote, send = bridge.postMessage.bind(bridge);
    window.__exportStatusProbe = { begins: 0 };
    bridge.postMessage = raw => { if (JSON.parse(raw).op === 'file.begin') window.__exportStatusProbe.begins++; return send(raw); };
    window.__restoreExportStatus = () => { bridge.postMessage = send; };
  });
  console.log(JSON.stringify({ phase: 'export-status-ready' }));
  await dialog.getByText(/电脑连接已断开，重新连接后可继续操作。|正在连接电脑…/).waitFor({ timeout: 60000 });
  assert.equal(await upgrade.count(), 0); assert.equal(await save.isDisabled(), true);
  assert.equal(await children.isChecked(), true); report.offlineDisabled = true;
  await page.screenshot({ path: 'artifacts/session-export-status-offline-android.png' });
  console.log(JSON.stringify({ phase: 'export-status-offline' }));
  await save.and(page.locator(':enabled')).waitFor({ timeout: 60000 });
  assert.equal(await upgrade.count(), 0); assert.equal(await children.isChecked(), true);
  report.recovered = true; report.optionsPreserved = true;
  report.exportsStarted = await page.evaluate(() => window.__exportStatusProbe.begins);
  assert.equal(report.exportsStarted, 0);
  await page.screenshot({ path: 'artifacts/session-export-status-recovered-android.png' });
  assert.deepEqual(report.errors, []);
} catch (error) { report.failure = error.message; throw error; }
finally {
  if (page) {
    await page.evaluate(() => window.__restoreExportStatus?.()).catch(() => {});
    if (dialog && await dialog.isVisible()) {
      if (original !== undefined) await dialog.getByRole('checkbox', { name: '包含子会话', exact: true }).setChecked(original);
      await dialog.getByRole('button', { name: '关闭窗口', exact: true }).click();
    }
    if (draft !== undefined) report.draftPreserved = await page.getByRole('textbox', { name: '消息', exact: true }).innerText() === draft;
  }
  await writeFile('artifacts/session-export-status-android.json', JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report)); await device.close();
}
