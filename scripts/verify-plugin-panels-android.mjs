import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { _android } from 'playwright';
import { androidAppWebView } from './android-app-webview.mjs';

// 仅操作专用联调会话的局部面板，不发送模型请求或改变设备授权。
const phase = process.argv[2] ?? 'verify';
assert.ok(['verify', 'unloaded'].includes(phase));
const device = (await _android.devices({ omitDriverInstall: true })).find(item => item.serial() === process.env.DSHM_ANDROID_SERIAL);
assert.ok(device); device.setDefaultTimeout(20000);
const report = { at: new Date().toISOString(), phase, errors: [], resources: [] };
let page;
try {
  const first = await (await androidAppWebView(device)).page();
  page = first.context().pages().find(item => item.url().startsWith('https://remote.dshm.invalid/'));
  assert.ok(page); page.setDefaultTimeout(30000);
  page.on('pageerror', error => report.errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') report.errors.push(message.text()); });
  page.on('response', response => { if (response.status() >= 400) report.resources.push({ path: new URL(response.url()).pathname, status: response.status() }); });
  const editor = page.getByRole('textbox', { name: '消息', exact: true, includeHidden: true });
  assert.equal(await page.getByTestId('remote-workspace').locator('.remote-heading').innerText(), 'DSHM Remote 联调提示');
  const draft = await editor.inputValue();
  const dialog = page.getByRole('region', { name: '插件面板', exact: true });
  const panel = page.getByTestId('live-panel');
  if (phase === 'verify') {
    await page.getByRole('button', { name: 'Remote 选项', exact: true }).click();
    await page.getByRole('button', { name: '插件面板', exact: true }).click();
    await dialog.getByRole('button', { name: 'DSHM 面板验收', exact: true }).click();
    await panel.waitFor();
    assert.equal(await page.getByTestId('remote-workspace').evaluate(element => element.inert), true);
    await panel.getByRole('button', { name: '打开插件弹窗', exact: true }).click();
    const modal = page.getByRole('dialog', { name: '原插件弹窗', exact: true });
    await modal.getByRole('textbox', { name: '插件弹窗输入', exact: true }).fill('手机实际弹窗输入');
    await modal.getByRole('button', { name: '弹窗菜单', exact: true }).click();
    await page.getByRole('menuitem', { name: '填入菜单值', exact: true }).click();
    assert.equal(await modal.getByRole('textbox', { name: '插件弹窗输入', exact: true }).inputValue(), 'menu-value');
    await page.screenshot({ path: 'artifacts/plugin-panel-overlay-android.png' });
    await modal.getByRole('button', { name: '弹窗菜单', exact: true }).click();
    await device.shell('input keyevent 4');
    await page.getByRole('menuitem', { name: '填入菜单值', exact: true }).waitFor({ state: 'detached' });
    assert.ok(await modal.isVisible());
    await device.shell('input keyevent 4');
    await modal.waitFor({ state: 'detached' });
    assert.ok(await dialog.isVisible());
    await dialog.getByRole('button', { name: '面板操作', exact: true }).click();
    await page.getByRole('menuitem', { name: '插件菜单操作', exact: true }).click();
    await panel.getByText('menu-action', { exact: true }).waitFor();
    report.overlays = { originalModalAndMenu: true, androidBackOneLayer: true, tabMenuExtension: true };
    await panel.getByRole('button', { name: '面板计数 0', exact: true }).click();
    await panel.getByRole('button', { name: '选择其他面板', exact: true }).click();
    await dialog.locator('nav').getByRole('button', { name: 'DSHM 面板验收', exact: true }).click();
    await panel.getByRole('button', { name: '面板计数 1', exact: true }).waitFor();
    report.geometry = await panel.evaluate(node => ({ original: node.offsetWidth, displayed: node.getBoundingClientRect().width, viewport: innerWidth }));
    assert.equal(report.geometry.original, 720); assert.ok(report.geometry.displayed < 720 && report.geometry.displayed <= report.geometry.viewport);
    await page.screenshot({ path: 'artifacts/plugin-panels-android.png' });
    await dialog.getByRole('button', { name: '返回聊天', exact: true }).click();
    await dialog.waitFor({ state: 'hidden' });
    await page.getByRole('button', { name: 'Remote 选项', exact: true }).click();
    await page.getByRole('button', { name: '插件面板', exact: true }).click();
    await dialog.locator('nav').getByRole('button', { name: 'DSHM 面板验收', exact: true }).click();
    await panel.getByRole('button', { name: '面板计数 1', exact: true }).waitFor();
    report.statePreserved = true;
    const path = 'Q:/Tanxian/LToys/dsh-mobile/dsh-mobile/artifacts/file-mention-1790345487578.txt';
    const expected = await readFile(path, 'utf8');
    await panel.getByRole('textbox', { name: '面板测试文件', exact: true }).fill(path);
    await panel.getByRole('button', { name: '面板预览文件', exact: true }).click();
    const file = page.getByRole('dialog', { name: '文件预览', exact: true });
    await file.getByText(expected.trim(), { exact: true }).waitFor();
    assert.equal(await file.locator('pre').textContent(), expected);
    await page.screenshot({ path: 'artifacts/plugin-panels-file-android.png' });
    await file.getByRole('button', { name: '关闭文件预览', exact: true }).click();
    await page.getByRole('button', { name: 'Remote 选项', exact: true }).click();
    await page.getByRole('button', { name: '插件面板', exact: true }).click();
    await dialog.locator('nav').getByRole('button', { name: 'DSHM 面板验收', exact: true }).click();
    await panel.getByRole('button', { name: '面板计数 1', exact: true }).waitFor();
    assert.equal(await panel.getByRole('textbox', { name: '面板测试文件', exact: true }).inputValue(), path);
    report.filePreview = { bytes: Buffer.byteLength(expected), draftPreserved: true };
    await dialog.getByRole('button', { name: '返回聊天', exact: true }).click();
    assert.equal(await page.getByTestId('remote-workspace').evaluate(element => element.inert), false);
  } else {
    await page.getByRole('dialog', { name: '原插件弹窗', exact: true }).waitFor({ state: 'detached' });
    await panel.waitFor({ state: 'detached' });
    if (!await dialog.isVisible()) {
      await page.getByRole('button', { name: 'Remote 选项', exact: true }).click();
      await page.getByRole('button', { name: '插件面板', exact: true }).click();
    }
    await dialog.locator('[data-sidebar-right-guide-entry="dshm-verification-panel"]').waitFor({ state: 'detached' });
    // 原导航记录可以保留，卸载的注册入口与正文必须释放。
    const oldTab = dialog.locator('nav').getByRole('button', { name: 'DSHM 面板验收', exact: true });
    if (await oldTab.count()) {
      await oldTab.click();
      await dialog.getByText('此面板的插件暂不可用。', { exact: true }).waitFor();
      await dialog.getByRole('button', { name: '面板操作', exact: true }).click();
      await page.getByRole('menuitem', { name: '关闭当前面板', exact: true }).click();
    }
    await dialog.getByRole('button', { name: '返回聊天', exact: true }).click();
    report.unloaded = true;
    await page.getByRole('button', { name: 'Remote 选项', exact: true }).click();
    await page.getByRole('button', { name: '电脑插件', exact: true }).click();
    const plugins = page.getByRole('dialog', { name: '电脑插件', exact: true });
    await plugins.getByRole('button', { name: '管理电脑插件', exact: true }).click();
    const manager = page.getByRole('region', { name: '管理电脑插件', exact: true });
    await manager.getByText('请在电脑 DSH Mobile 插件中，为此设备授予管理权限。', { exact: true }).waitFor();
    assert.equal(await page.getByTestId('remote-workspace').evaluate(element => element.inert), true);
    await manager.getByRole('button', { name: '返回', exact: true }).click();
    await plugins.getByRole('button', { name: '关闭窗口', exact: true }).click();
    assert.equal(await page.getByTestId('remote-workspace').evaluate(element => element.inert), false);
    report.managerBackgroundRestored = true;
  }
  assert.equal(await editor.inputValue(), draft); report.chatDraftPreserved = true;
  if (phase === 'verify' && process.argv.includes('--hold-overlay')) {
    await page.getByRole('button', { name: 'Remote 选项', exact: true }).click();
    await page.getByRole('button', { name: '插件面板', exact: true }).click();
    await dialog.locator('nav').getByRole('button', { name: 'DSHM 面板验收', exact: true }).click();
    await panel.getByRole('button', { name: '打开插件弹窗', exact: true }).click();
    await page.getByRole('dialog', { name: '原插件弹窗', exact: true }).waitFor();
    report.waitingUninstallWithModal = true;
  }
  assert.deepEqual(report.errors, []); assert.deepEqual(report.resources, []);
} finally {
  await writeFile(`artifacts/plugin-panels-${phase}-android.json`, JSON.stringify(report, null, 2));
  await device.close();
}
console.log(JSON.stringify(report));
