import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { _android } from 'playwright';
import { androidAppWebView } from './android-app-webview.mjs';

assert.equal(process.env.DSHM_RUN_LIVE, '1');
const mode = process.argv[2] ?? 'settings';
assert.ok(['settings', 'workspaces', 'plugins'].includes(mode));
const device = (await _android.devices({ omitDriverInstall: true })).find(item => item.serial() === process.env.DSHM_ANDROID_SERIAL);
assert.ok(device); device.setDefaultTimeout(20000);
const report = { at: new Date().toISOString(), mode, errors: [] };
let page, panel, draft;
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
  const title = { settings: '电脑设置', workspaces: '管理工作区', plugins: '电脑插件' }[mode];
  await page.getByRole('button', { name: title, exact: true }).click();
  panel = page.getByRole('dialog', { name: title, exact: true });
  let ready, changed;
  if (mode === 'settings') {
    const limit = panel.getByRole('spinbutton', { name: '等待输出超时（毫秒）', exact: true });
    await limit.waitFor();
    changed = String(Number(await limit.inputValue()) + 1000);
    await limit.fill(changed);
    await panel.getByRole('textbox', { name: '新的完整服务地址', exact: true }).fill('https://unsaved.example/api');
    await panel.getByRole('button', { name: '核对新地址', exact: true }).click();
    ready = panel.getByRole('button', { name: '重新读取设置', exact: true });
  } else if (mode === 'workspaces') {
    await panel.getByRole('button', { name: 'DSH-TEST', exact: true }).click();
    await panel.getByRole('button', { name: '重命名工作区', exact: true }).click();
    await panel.getByRole('textbox', { name: '工作区名称', exact: true }).fill('DSH-TEST 未提交');
    ready = panel.getByRole('textbox', { name: '工作区名称', exact: true });
  } else {
    await page.getByRole('button', { name: '管理电脑插件', exact: true }).click();
    panel = page.getByRole('region', { name: '管理电脑插件', exact: true });
    ready = panel.getByRole('button', { name: '添加插件', exact: true });
  }
  await ready.waitFor();
  console.log(JSON.stringify({ phase: 'management-ready', mode }));
  await panel.getByText(/电脑连接已断开，重新连接后可继续操作。|正在连接电脑…/).waitFor({ timeout: 60000 });
  assert.equal(await panel.getByText(/请.*授予.*管理权限|请更新电脑/).count(), 0);
  if (mode === 'settings') {
    assert.equal(await panel.getByRole('spinbutton', { name: '等待输出超时（毫秒）', exact: true }).inputValue(), changed);
    assert.equal(await panel.getByRole('button', { name: '确认更改服务地址', exact: true }).isDisabled(), true);
    assert.equal(await ready.isDisabled(), true);
  } else assert.equal(await ready.count(), 0);
  report.offlineNotice = true;
  await page.screenshot({ path: `artifacts/management-${mode}-offline-android.png` });
  console.log(JSON.stringify({ phase: 'management-offline', mode }));
  await ready.and(page.locator(':enabled')).waitFor({ timeout: 60000 });
  assert.equal(await panel.getByText(/请.*授予.*管理权限|请更新电脑/).count(), 0);
  if (mode === 'settings') {
    assert.equal(await panel.getByRole('spinbutton', { name: '等待输出超时（毫秒）', exact: true }).inputValue(), changed);
    await panel.getByRole('group', { name: '确认服务地址', exact: true }).waitFor();
    await panel.getByRole('button', { name: '取消更改地址', exact: true }).click();
    assert.equal(await panel.getByRole('textbox', { name: '新的完整服务地址', exact: true }).inputValue(), 'https://unsaved.example/api');
    report.settingAndEndpointDraft = true;
  } else if (mode === 'workspaces') {
    assert.equal(await ready.inputValue(), 'DSH-TEST 未提交'); report.workspaceDraft = true;
  }
  report.recovered = true;
  await page.screenshot({ path: `artifacts/management-${mode}-recovered-android.png` });
  assert.deepEqual(report.errors, []);
} catch (error) {
  report.failure = error.message;
  if (panel && await panel.isVisible()) report.panel = await panel.innerText();
  if (page) await page.screenshot({ path: `artifacts/management-${mode}-failure-android.png` });
  throw error;
}
finally {
  if (page) {
    if (panel && await panel.isVisible()) {
      await panel.getByRole('button', { name: mode === 'plugins' ? '返回' : '关闭窗口', exact: true }).click();
      if (mode === 'plugins') await page.getByRole('dialog', { name: '电脑插件', exact: true }).getByRole('button', { name: '关闭窗口', exact: true }).click();
    }
    if (draft !== undefined) report.chatDraftPreserved = await page.getByRole('textbox', { name: '消息', exact: true }).innerText() === draft;
  }
  await writeFile(`artifacts/management-${mode}-android.json`, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report)); await device.close();
}
