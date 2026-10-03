import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { _android } from 'playwright';
import { androidAppWebView } from './android-app-webview.mjs';

const cleanup = process.argv.includes('--cleanup');
const device = (await _android.devices({ omitDriverInstall: true })).find(d => d.serial() === 'emulator-5554'); assert.ok(device);
const report = { at: new Date().toISOString(), cleanup, errors: [] };
let page;
try {
  const context = (await (await androidAppWebView(device)).page()).context();
  page = context.pages().find(p => p.url().startsWith('https://remote.dshm.invalid/'));
  if (!page) {
    const ordinary = context.pages().find(p => p.url().startsWith('https://appassets.androidplatform.net/')); assert.ok(ordinary);
    await ordinary.getByRole('button', { name: '打开侧边抽屉', exact: true }).click();
    await ordinary.getByRole('button', { name: 'Remote', exact: true }).click();
    const until = Date.now() + 15000;
    while (!page && Date.now() < until) {
      page = context.pages().find(p => p.url().startsWith('https://remote.dshm.invalid/'));
      if (!page) await new Promise(resolve => setTimeout(resolve, 100));
    }
  }
  assert.ok(page); page.setDefaultTimeout(20000);
  page.on('pageerror', error => report.errors.push(error.message));
  const main = page.getByTestId('remote-workspace'); await main.waitFor({ timeout: 60000 });
  const title = main.locator('.remote-heading strong');
  if ((await title.innerText()) !== 'DSHM Remote 联调提示') await main.getByRole('button', { name: /^DSHM Remote 联调提示/ }).click();
  assert.equal(await title.innerText(), 'DSHM Remote 联调提示');
  const editor = main.getByRole('textbox', { name: '消息', exact: true });
  const surface = page.locator('.remote-global-panel'), content = page.getByTestId('live-global-panel');
  if (cleanup) {
    await content.waitFor({ state: 'detached' }); await surface.waitFor({ state: 'hidden' });
    const previous = JSON.parse(await readFile('artifacts/global-panel-live-android.json', 'utf8'));
    assert.equal(await editor.innerText(), previous.draft); assert.equal(await main.evaluate(node => node.inert), false);
    report.unloadClosesPage = true; report.draftPreserved = true;
  } else {
    report.draft = await editor.innerText();
    const open = async () => {
      await main.getByRole('button', { name: 'Remote 选项', exact: true }).click();
      await main.getByRole('button', { name: '电脑插件', exact: true }).click();
      const sidebar = main.locator('[data-plugin-id="@deepseek-ai/dsh-client-ui-sidebar"]');
      assert.equal(await sidebar.getAttribute('data-plugin-state'), 'mobile');
      await main.getByRole('button', { name: '插件页面', exact: true }).click();
      await surface.getByRole('button', { name: '独立插件页面', exact: true }).click(); await content.waitFor();
    };
    await open();
    assert.equal(await content.getAttribute('data-session'), 'none');
    assert.equal(await content.getAttribute('data-current'), 'dshm-live-global');
    await content.getByRole('button', { name: '页面计数 0', exact: true }).click();
    await content.getByRole('button', { name: '页面计数 1', exact: true }).waitFor();
    const side = page.locator('.remote-plugin-panel:not(.remote-global-panel)');
    await content.getByRole('button', { name: '打开底层旁栏', exact: true }).click();
    await side.waitFor();
    assert.equal(await side.evaluate(node => node.inert), true);
    await side.locator('button').first().evaluate(node => node.focus());
    assert.equal(await surface.evaluate(node => node.contains(document.activeElement)), true);
    await content.getByRole('button', { name: '关闭底层旁栏', exact: true }).click();
    await side.waitFor({ state: 'hidden' });
    assert.equal(await surface.evaluate(node => node.contains(document.activeElement)), true);
    await content.getByRole('button', { name: '打开底层旁栏', exact: true }).click();
    await side.waitFor();
    report.coveredPanelInert = true; report.focusPreserved = true;
    await page.screenshot({ path: 'artifacts/global-panel-live-android.png' });
    await device.shell('input keyevent 4'); await surface.waitFor({ state: 'hidden' });
    assert.equal(await side.evaluate(node => node.inert), false);
    await side.getByRole('button', { name: '返回聊天', exact: true }).click();
    await side.waitFor({ state: 'hidden' });
    assert.equal(await editor.innerText(), report.draft); report.androidBack = true;
    await open(); await content.getByRole('button', { name: '插件返回聊天', exact: true }).click();
    await surface.waitFor({ state: 'hidden' }); assert.equal(await editor.innerText(), report.draft); report.pluginReturn = true;
    await open(); report.rootScope = true; report.panelInfo = true; report.interactive = true;
    // 保留该专用局部页面，下一步原CLI卸载后核对自动返回；不发送消息。
  }
  assert.deepEqual(report.errors, []);
} catch (error) { report.failure = error.message; process.exitCode = 1; }
finally {
  await writeFile(`artifacts/global-panel-${cleanup ? 'cleanup' : 'live'}-android.json`, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report)); await device.close();
}
