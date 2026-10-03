import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { _android } from 'playwright';
import { androidAppWebView } from './android-app-webview.mjs';

const device = (await _android.devices({ omitDriverInstall: true })).find(d => d.serial() === '127.0.0.1:16384');
assert.ok(device); device.setDefaultTimeout(30000);
const report = { at: new Date().toISOString(), errors: [] };
let ordinary, original;
const button = (page, name) => page.getByRole('button', { name, exact: true });
const theme = async page => (await page.getByRole('button', { name: /^主题/ }).innerText()).replace('主题', '').trim();
const font = async page => Number.parseInt(await page.locator('.settings-font output').innerText());
const change = async (page, preference, size) => {
  await page.getByRole('button', { name: /^主题/ }).click();
  await button(page.getByRole('dialog'), preference).click();
  while (await font(page) !== size) {
    const before = await font(page);
    await button(page, before < size ? '增大字号' : '减小字号').click();
    await page.locator('.settings-font output').filter({ hasText: `${before + (before < size ? 1 : -1)} px` }).waitFor();
  }
};
try {
  const context = (await (await androidAppWebView(device)).page()).context();
  const pages = () => context.pages();
  ordinary = pages().find(p => p.url().includes('/mobile.html'));
  assert.ok(ordinary);
  // 正式冷启动入口的导航标记必须在React挂载后仍被消费。
  await ordinary.locator('.settings-font output').waitFor();
  report.coldNavigation = true;
  original = { theme: await theme(ordinary), font: await font(ordinary) };
  await button(ordinary, '返回设置首页').click();
  await button(ordinary, '电脑连接').click();
  let remote;
  for (let i = 0; i < 100 && !remote; i++) {
    remote = pages().find(p => p.url().startsWith('https://remote.dshm.invalid/'));
    if (!remote) await new Promise(resolve => setTimeout(resolve, 100));
  }
  assert.ok(remote); remote.on('pageerror', error => report.errors.push(error.message));
  if (await button(remote, '重新连接').isVisible()) await button(remote, '重新连接').click();
  const main = remote.getByTestId('remote-workspace'); await main.waitFor({ timeout: 60000 });
  if (await main.locator('.remote-heading strong').innerText() === 'Remote') {
    await main.locator('button.remote-session-row').filter({ has: remote.getByText('DSHM Remote 联调提示', { exact: true }) }).click();
  }
  const editor = main.getByRole('textbox', { name: '消息', exact: true }); await editor.waitFor();
  const draft = await editor.textContent();
  const origin = await remote.evaluate(() => performance.timeOrigin);
  const ordinaryOrigin = await ordinary.evaluate(() => performance.timeOrigin);
  await button(main, 'Remote 选项').click(); await button(main, '电脑设置').click();
  const dialog = remote.getByRole('dialog', { name: '电脑设置', exact: true });
  await dialog.getByRole('combobox', { name: '设置页面', exact: true }).selectOption('general');
  await button(dialog, '外观与语言').click();
  await ordinary.locator('.settings-font output').waitFor();
  assert.equal(await ordinary.evaluate(() => performance.timeOrigin), ordinaryOrigin);
  report.warmNavigationPreservesPage = true;
  assert.equal(await dialog.getByRole('button', { name: '深色', exact: true }).count(), 0);
  const targetTheme = original.theme === '深色' ? '浅色' : '深色';
  const targetFont = original.font < 17 ? original.font + 1 : original.font - 1;
  await change(ordinary, targetTheme, targetFont);
  await remote.waitForFunction(({ dark, font }) => document.body.hasAttribute('data-ds-dark-theme') === dark
    && getComputedStyle(document.body).getPropertyValue('--dsh-content-font-size').trim() === `${font}px`,
  { dark: targetTheme === '深色', font: targetFont });
  await button(ordinary, '返回设置首页').click(); await button(ordinary, '电脑连接').click();
  assert.equal(await remote.evaluate(() => performance.timeOrigin), origin);
  report.liveSync = true;
  await remote.screenshot({ path: 'artifacts/remote-appearance-settings-android.png' });
  // 同一入口再次打开，须定位外观页，不能停留在上次的设置首页。
  await button(dialog, '外观与语言').click(); await ordinary.locator('.settings-font output').waitFor();
  await change(ordinary, original.theme, original.font);
  report.restored = true;
  await button(ordinary, '返回设置首页').click(); await button(ordinary, '电脑连接').click();
  await button(dialog, '关闭窗口').click();
  assert.equal(await editor.textContent(), draft); report.chatDraftPreserved = true;
  assert.deepEqual(report.errors, []);
} finally {
  if (original && !report.restored && ordinary && await ordinary.locator('.settings-font output').isVisible()) {
    await change(ordinary, original.theme, original.font); report.restored = true;
  }
  await writeFile('artifacts/remote-appearance-settings-android.json', JSON.stringify(report, null, 2));
  await device.close();
}
console.log(JSON.stringify(report));
