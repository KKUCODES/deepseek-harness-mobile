import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { writeFile } from 'node:fs/promises';
import { _android } from 'playwright';
import { androidAppWebView } from './android-app-webview.mjs';
const device = (await _android.devices({ omitDriverInstall: true })).find(d => d.serial() === '127.0.0.1:16384');
assert.ok(device); device.setDefaultTimeout(20000);
const id = `dshm-settings-${randomUUID().slice(0, 8)}`, name = id;
const report = { at: new Date().toISOString(), id, errors: [] };
const button = (root, label) => root.getByRole('button', { name: label, exact: true });
let page, settings, created = false;
async function removeCopy() {
  await button(settings, `删除: ${name}`).click();
  const confirmation = page.getByRole('dialog', { name: '删除该预设？', exact: true });
  await button(confirmation, '删除').click();
  await confirmation.waitFor({ state: 'detached' });
  await button(settings, `删除: ${name}`).waitFor({ state: 'detached' });
  created = false; report.removed = true;
}
try {
  const context = (await (await androidAppWebView(device)).page()).context();
  page = context.pages().find(p => p.url().includes('/remote.html'));
  if (!page) {
    const ordinary = context.pages().find(p => p.url().includes('/mobile.html')); assert.ok(ordinary);
    await button(ordinary, '打开侧边抽屉').click(); await button(ordinary, 'Remote').click();
    for (let i = 0; i < 100 && !page; i++) {
      page = context.pages().find(p => p.url().includes('/remote.html'));
      if (!page) await new Promise(resolve => setTimeout(resolve, 100));
    }
  }
  assert.ok(page);
  page.on('pageerror', () => report.errors.push('page-error'));
  if (await button(page, '重新连接').isVisible()) await button(page, '重新连接').click();
  const main = page.getByTestId('remote-workspace'); await main.waitFor({ timeout: 60000 });
  const welcome = page.getByRole('dialog', { name: '内测声明', exact: true });
  if (await welcome.isVisible()) await button(welcome, '继续').click();
  if (await main.locator('.remote-heading strong').innerText() === 'Remote') await main.locator('button.remote-session-row').filter({ has: page.getByText('DSHM Remote 联调提示', { exact: true }) }).click();
  const input = main.getByRole('textbox', { name: '消息', exact: true }); await input.waitFor(); const draft = await input.textContent();
  await button(main, 'Remote 选项').click(); await button(main, '电脑设置').click();
  settings = page.getByRole('dialog', { name: '电脑设置', exact: true });
  await settings.getByRole('combobox', { name: '设置页面', exact: true }).selectOption('agent-presets');
  await button(settings, '查看: 标准模式').click();
  const viewer = page.getByRole('dialog', { name: '查看 · 标准模式', exact: true }); await viewer.waitFor();
  assert.ok((await viewer.locator('pre').innerText()).length > 100);
  await button(viewer, '关闭').last().click(); report.view = true;
  await button(settings, '复制: 标准模式').click();
  const copy = page.getByRole('dialog', { name: '复制预设 · 复制自 标准模式', exact: true }); await copy.waitFor();
  await copy.getByRole('textbox', { name: '标识符', exact: true }).fill(id);
  await copy.getByRole('textbox', { name: '名称', exact: true }).fill(name);
  await button(copy, '创建').click();
  await copy.waitFor({ state: 'detached' }); created = true;
  await button(settings, `删除: ${name}`).waitFor(); report.copied = true;
  await settings.getByText('预设文件：', { exact: true }).waitFor();
  report.directoryShown = true;
  await settings.getByRole('combobox', { name: '设置页面', exact: true }).selectOption('models');
  await settings.getByRole('combobox', { name: '设置页面', exact: true }).selectOption('agent-presets');
  await button(settings, `删除: ${name}`).waitFor(); report.reentry = true;
  await page.screenshot({ path: 'artifacts/agent-preset-settings-android.png' });
  report.alertsAfterCopy = await settings.getByRole('alert').allTextContents();
  await removeCopy(); await button(settings, '关闭窗口').click();
  assert.equal(await input.textContent(), draft); report.draftPreserved = true;
  assert.deepEqual(report.errors, []);
  assert.deepEqual(report.alertsAfterCopy, [], 'Copy completion must not leave a visible operation failure');
} catch (error) { report.failure = error.message; process.exitCode = 1; }
finally {
  if (created) await removeCopy().catch(() => { report.cleanupRequired = true; });
  await writeFile('artifacts/agent-preset-settings-android.json', JSON.stringify(report, null, 2));
  await device.close();
}
console.log(JSON.stringify(report));
