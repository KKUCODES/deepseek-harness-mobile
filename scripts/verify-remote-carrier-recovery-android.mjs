import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { _android } from 'playwright';
import { androidAppWebView } from './android-app-webview.mjs';

// 只操作已有专用会话的插件面板。外部在明确 READY 后重启已核验的服务进程。
assert.equal(process.env.DSHM_RUN_LIVE, '1');
const artifact = process.env.DSHM_RECOVERY_ARTIFACT ?? 'remote-carrier-recovery-android';
assert.match(artifact, /^[a-z0-9-]+$/);
const device = (await _android.devices({ omitDriverInstall: true })).find(item => item.serial() === process.env.DSHM_ANDROID_SERIAL);
assert.ok(device); device.setDefaultTimeout(25000);
const report = { at: new Date().toISOString(), cases: [], errors: [], resources: [] };
let page;
try {
  const context = (await (await androidAppWebView(device)).page()).context();
  page = context.pages().find(item => item.url().startsWith('https://remote.dshm.invalid/'));
  assert.ok(page, '先在日常 App 打开 Remote 专用测试会话');
  page.on('pageerror', error => report.errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') report.errors.push(message.text()); });
  page.on('response', response => { if (response.status() >= 400) report.resources.push({ path: new URL(response.url()).pathname, status: response.status() }); });
  const main = page.getByTestId('remote-workspace');
  const title = main.locator('.remote-heading strong');
  assert.equal(await title.innerText(), 'DSHM Remote 联调提示');
  const editor = main.getByRole('textbox', { name: '消息', exact: true });
  const draft = await editor.textContent();
  const panel = page.getByRole('region', { name: '插件面板', exact: true });
  async function openPanel() {
    if (!await panel.isVisible()) {
      await main.getByRole('button', { name: 'Remote 选项', exact: true }).click();
      await main.getByRole('button', { name: '插件面板', exact: true }).click();
    }
    await panel.getByRole('button', { name: '打开面板', exact: true }).waitFor();
  }
  for (const service of ['gateway', 'desktop']) {
    await openPanel();
    console.log(`REMOTE_RECOVERY_READY_TO_STOP_${service.toUpperCase()}`);
    await main.getByTestId('remote-offline-status').waitFor({ timeout: 60000 });
    console.log(`REMOTE_RECOVERY_READY_TO_START_${service.toUpperCase()}`);
    await main.getByTestId('remote-offline-status').waitFor({ state: 'detached', timeout: 90000 });
    // DSH 重建后按已保存布局恢复窗口；不能在短暂卸载期间抢点背后的菜单。
    await panel.waitFor({ timeout: 45000 });
    await panel.getByRole('button', { name: '打开面板', exact: true }).waitFor();
    await page.screenshot({ path: `artifacts/${artifact}-${service}.png` });
    await panel.getByRole('button', { name: '返回聊天', exact: true }).click();
    assert.equal(await title.innerText(), 'DSHM Remote 联调提示');
    assert.equal(await editor.textContent(), draft);
    report.cases.push({ service, recovered: true, originalPanelMounted: true, draftPreserved: true });
  }
  assert.deepEqual(report.errors, []); assert.deepEqual(report.resources, []);
  report.ok = true;
} catch (error) {
  report.failure = error.message;
  if (page) await page.screenshot({ path: `artifacts/${artifact}-failure.png` }).catch(() => {});
  process.exitCode = 1;
} finally {
  await writeFile(`artifacts/${artifact}.json`, JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ ...report, errors: report.errors.map(error => error.split('\n')[0]) }));
  await device.close();
}
