import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { _android } from 'playwright';
import { androidAppWebView } from './android-app-webview.mjs';

const phase = process.argv[2] ?? 'live';
assert.ok(['live', 'removed', 'denied'].includes(phase));
const d = (await _android.devices({ omitDriverInstall: true })).find(d => d.serial() === 'emulator-5554'); assert.ok(d);
const report = { at: new Date().toISOString(), phase, errors: [] };
try {
  const context = (await (await androidAppWebView(d)).page()).context();
  let page = context.pages().find(p => p.url().startsWith('https://remote.dshm.invalid/'));
  if (!page) {
    const ordinary = context.pages().find(p => p.url().startsWith('https://appassets.androidplatform.net/')); assert.ok(ordinary);
    await ordinary.getByRole('button', { name: '打开侧边抽屉', exact: true }).click();
    await ordinary.getByRole('button', { name: 'Remote', exact: true }).click();
    const deadline = Date.now() + 20000;
    while (!page && Date.now() < deadline) {
      page = context.pages().find(p => p.url().startsWith('https://remote.dshm.invalid/'));
      if (!page) await new Promise(resolve => setTimeout(resolve, 100));
    }
  }
  assert.ok(page); page.setDefaultTimeout(20000);
  page.on('pageerror', error => report.errors.push(error.message));
  const reconnect = page.getByRole('button', { name: '重新连接', exact: true });
  if (await reconnect.isVisible()) await reconnect.click();
  const main = page.getByTestId('remote-workspace'); await main.waitFor({ timeout: 45000 });
  if (await main.locator('.remote-heading strong').innerText() !== 'DSHM Remote 联调提示') {
    await main.getByRole('button', { name: /^DSHM Remote 联调提示/ }).click();
  }
  const input = main.getByRole('textbox', { name: '消息', exact: true }); await input.waitFor();
  const draft = await input.innerText();
  await main.getByRole('button', { name: 'Remote 选项', exact: true }).click();
  await main.getByRole('button', { name: '电脑插件', exact: true }).click();
  await page.getByRole('button', { name: '插件设置', exact: true }).click();
  const panel = page.getByRole('dialog', { name: '插件设置', exact: true });
  if (phase === 'denied') {
    await panel.getByText('请在电脑 DSH Mobile 插件中，为此设备授予管理权限。', { exact: true }).waitFor();
    assert.equal(await panel.getByRole('tab').count(), 0); report.managementDenied = true;
  } else if (phase === 'removed') {
    assert.equal(await panel.getByTestId('live-settings-one').count(), 0);
    assert.equal(await panel.getByRole('tab', { name: '验证一', exact: true }).count(), 0);
    report.uninstalled = true;
    report.inventoryText = (await panel.innerText()).slice(0, 500);
  } else {
    report.tabs = await panel.getByRole('tab').allTextContents();
    await panel.getByRole('tab', { name: '验证一', exact: true }).click();
    const one = panel.getByTestId('live-settings-one');
    assert.equal(await one.getAttribute('data-session'), 'none');
    await one.getByRole('button', { name: '设置计数 0', exact: true }).click();
    await panel.getByRole('tab', { name: '验证二', exact: true }).click();
    await panel.getByTestId('live-settings-two').waitFor();
    await panel.getByRole('tab', { name: '验证一', exact: true }).click();
    await one.getByRole('button', { name: '设置计数 1', exact: true }).waitFor();
    report.width = await one.evaluate(n => n.getBoundingClientRect().width);
    assert.ok(report.width > 0 && report.width < 600 && report.width <= 420);
    report.rootScope = true; report.statePreserved = true;
    await page.screenshot({ path: 'artifacts/settings-tabs-live-android.png' });
  }
  await d.shell('input keyevent 4'); await panel.waitFor({ state: 'hidden' });
  assert.equal(await input.innerText(), draft); report.draftPreserved = true;
  assert.deepEqual(report.errors, []);
} catch (error) { report.failure = error.stack; process.exitCode = 1; }
finally { await writeFile(`artifacts/settings-tabs-${phase}-android.json`, JSON.stringify(report, null, 2)); console.log(JSON.stringify(report)); await d.close(); }
