import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { _android } from 'playwright';
import { androidAppWebView } from './android-app-webview.mjs';

assert.equal(process.env.DSHM_RUN_LIVE, '1');
const lifetimeCheck = process.argv.includes('--cordis-lifetime');
const inventoryCheck = process.argv.includes('--inventory');
const artifact = lifetimeCheck ? 'cordis-lifetime-reconnect-android' : 'menu-reconnect-android';
const device = (await _android.devices({ omitDriverInstall: true })).find(item => item.serial() === process.env.DSHM_ANDROID_SERIAL);
assert.ok(device); device.setDefaultTimeout(15000);
const report = { at: new Date().toISOString(), samples: [], errors: [], consoleErrors: [] };
let page;
try {
  page = (await (await androidAppWebView(device)).page()).context().pages().find(item => item.url().startsWith('https://remote.dshm.invalid/'));
  assert.ok(page); page.setDefaultTimeout(20000);
  page.on('pageerror', error => report.errors.push(error.message.split('\n')[0]));
  page.on('console', message => { if (message.type() === 'error') report.consoleErrors.push(message.text().split('\n')[0]); });
  const existingPanel = page.getByRole('region', { name: '插件面板', exact: true });
  if (await existingPanel.isVisible()) await existingPanel.getByRole('button', { name: '返回聊天', exact: true }).click();
  const main = page.getByTestId('remote-workspace');
  if (await main.locator('.remote-heading strong').innerText() === 'Remote') {
    await main.getByRole('button', { name: /^DSHM Remote 联调提示 \d/ }).click();
    await main.getByRole('region', { name: '聊天内容', exact: true }).waitFor();
  }
  const editor = main.getByRole('textbox', { name: '消息', exact: true });
  const title = await main.locator('.remote-heading strong').innerText();
  assert.equal(title, 'DSHM Remote 联调提示');
  const draft = await editor.evaluate(node => node.textContent);
  const epoch = await page.evaluate(() => performance.timeOrigin);
  await main.getByRole('button', { name: 'Remote 选项', exact: true }).click();
  const panelButton = main.getByRole('button', { name: '插件面板', exact: true });
  assert.equal(await panelButton.isEnabled(), true);
  // 仅旁观DOM身份与公开界面，不读取凭据或干预连接状态。
  await page.evaluate(() => { window.__dshmMenuProbe = document.querySelector('[data-testid="remote-workspace"]'); });
  console.log('READY: restart the verified DSH Host now');
  let interrupted = false, stableSince, previous;
  const deadline = Date.now() + 90000;
  while (Date.now() < deadline) {
    const sample = await page.evaluate(() => {
      const root = document.querySelector('[data-testid="remote-workspace"]');
      return { present: !!root, sameRoot: root === window.__dshmMenuProbe,
        offline: !!root?.querySelector('[data-testid="remote-offline-status"]'),
        title: root?.querySelector('.remote-heading strong')?.textContent ?? '',
        menu: [...(root?.querySelectorAll('button') ?? [])].some(node => node.textContent === '插件面板'),
        editor: !!root?.querySelector('[role="textbox"][aria-label="消息"]') };
    });
    const key = JSON.stringify(sample);
    if (key !== previous) { report.samples.push({ at: new Date().toISOString(), ...sample }); previous = key; console.log(key); }
    if (!sample.present || !sample.sameRoot || sample.offline) interrupted = true;
    if (interrupted && sample.present && !sample.offline && sample.title === title && sample.editor) stableSince ??= Date.now();
    else stableSince = undefined;
    if (stableSince && Date.now() - stableSince >= 1000) break;
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  assert.equal(interrupted, true, '必须实际观察到重连');
  assert.ok(stableSince && Date.now() - stableSince >= 1000, '未自动恢复原会话');
  report.menuSurvived = await panelButton.isVisible();
  if (!report.menuSurvived) await main.getByRole('button', { name: 'Remote 选项', exact: true }).click();
  await panelButton.click();
  const panel = page.getByRole('region', { name: '插件面板', exact: true });
  await panel.waitFor();
  assert.ok(await panel.getByRole('button').count());
  if (inventoryCheck) {
    const trigger = panel.locator('[data-cordis-badge]');
    await trigger.click();
    const inventory = panel.locator('[data-cordis-panel]');
    await inventory.waitFor();
    await page.waitForFunction(() => {
      const panel = document.querySelector('[data-cordis-panel]');
      return panel && (panel.querySelector('[data-cordis-row]') || panel.textContent.includes('还没有定义任何插件'));
    });
    assert.equal(await inventory.getByRole('alert').count(), 0);
    report.inventoryRead = true;
    await trigger.click();
  }
  await panel.getByRole('button', { name: '返回聊天', exact: true }).click();
  if (lifetimeCheck) {
    await main.getByRole('button', { name: 'Remote 选项', exact: true }).click();
    await main.getByRole('button', { name: '电脑插件', exact: true }).click();
    const list = page.getByTestId('remote-plugin-list');
    report.modules = [];
    for (const id of ['@deepseek-ai/dsh-cordis-client-runner', '@deepseek-ai/dsh-client-ui-cordis']) {
      const row = list.locator(`[data-plugin-id="${id}"]`);
      await row.waitFor();
      const state = await row.getAttribute('data-plugin-state');
      assert.equal(state, 'active'); report.modules.push({ id, state });
    }
    await page.getByRole('button', { name: '关闭窗口', exact: true }).click();
    report.inventoryCheck = inventoryCheck ? 'verified' : 'not requested; requires a registered dynamic plugin';
  }
  assert.equal(await editor.evaluate(node => node.textContent), draft);
  assert.equal(await page.evaluate(() => performance.timeOrigin), epoch, '不能用页面刷新替代自动恢复');
  assert.deepEqual(report.errors, []);
  if (lifetimeCheck) assert.deepEqual(report.consoleErrors, [], '重连后不能遗留控制台错误');
  report.recoveredWithoutReload = true; report.panelOpens = true; report.draftPreserved = true;
  await page.screenshot({ path: `artifacts/${artifact}.png` });
} catch (error) { report.failure = error.message; process.exitCode = 1; }
finally {
  await page?.evaluate(() => { delete window.__dshmMenuProbe; }).catch(() => {});
  await writeFile(`artifacts/${artifact}.json`, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report)); await device.close();
}
