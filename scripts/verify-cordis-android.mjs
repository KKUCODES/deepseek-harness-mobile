import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { _android } from 'playwright';
import { androidAppWebView } from './android-app-webview.mjs';
import { checkCordisApprovalsAndroid } from './check-cordis-approvals-android.mjs';

assert.equal(process.env.DSHM_RUN_LIVE, '1');
const strictLifetime = process.argv.includes('--cordis-lifetime');
const artifact = process.env.DSHM_CORDIS_ARTIFACT ?? (strictLifetime ? 'cordis-lifetime-live-android' : 'cordis-panels-android');
assert.match(artifact, /^[a-z0-9-]+$/, 'Artifact name must stay within the verification directory');
const device = (await _android.devices({ omitDriverInstall: true })).find(item => item.serial() === process.env.DSHM_ANDROID_SERIAL);
assert.ok(device); device.setDefaultTimeout(25000);
const report = { at: new Date().toISOString(), errors: [], resources: [] };
let page;
try {
  await device.shell('am start -f 0x20020000 -n dev.dshmobile.validation/.ValidationActivity');
  const starting = Date.now() + 15000;
  while (!(await device.shell('pidof dev.dshmobile.validation')).toString().trim() && Date.now() < starting) await new Promise(resolve => setTimeout(resolve, 100));
  const context = (await (await androidAppWebView(device)).page()).context();
  const ordinary = context.pages().find(item => item.url().startsWith('https://appassets.androidplatform.net/'));
  assert.ok(ordinary);
  await ordinary.getByRole('button', { name: '打开侧边抽屉', exact: true }).click();
  await ordinary.getByRole('button', { name: 'Remote', exact: true }).click();
  const until = Date.now() + 25000;
  while (!page && Date.now() < until) {
    page = context.pages().find(item => item.url().startsWith('https://remote.dshm.invalid/'));
    if (!page) await new Promise(resolve => setTimeout(resolve, 100));
  }
  assert.ok(page); page.setDefaultTimeout(25000);
  page.on('pageerror', error => report.errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') report.errors.push(message.text()); });
  page.on('response', response => { if (response.status() >= 400) report.resources.push({ path: new URL(response.url()).pathname, status: response.status() }); });
  const main = page.getByTestId('remote-workspace'); await main.waitFor({ timeout: 45000 });
  const title = main.locator('.remote-heading strong');
  if (await title.innerText() === 'Remote') await main.locator('button.remote-session-row').filter({ has: page.getByText('DSHM Remote 联调提示', { exact: true }) }).click();
  await title.getByText('DSHM Remote 联调提示', { exact: true }).waitFor();
  const editor = main.getByRole('textbox', { name: '消息', exact: true }); await editor.waitFor();
  const draft = await editor.evaluate(node => node.textContent);
  if (process.env.DSHM_CORDIS_APPROVALS === '1') {
    const onPending = process.env.DSHM_CORDIS_LANGUAGE === '1'
      ? async () => (await import('./check-cordis-notice-language-android.mjs')).checkCordisNoticeLanguage(page, device) : undefined;
    report.approvals = await checkCordisApprovalsAndroid(page, main, { onPending });
  }
  await main.getByRole('button', { name: 'Remote 选项', exact: true }).click();
  await main.getByRole('button', { name: '插件面板', exact: true }).click();
  const panel = page.getByRole('region', { name: '插件面板', exact: true }); await panel.waitFor();
  report.panels = await panel.getByRole('button').allTextContents();
  if (process.env.DSHM_CORDIS_LIFECYCLE === '1') {
    const seed = JSON.parse(await readFile('artifacts/cordis-live-host.json', 'utf8'));
    const trigger = panel.locator('[data-cordis-badge]');
    await trigger.click();
    const popup = panel.locator('[data-cordis-panel]');
    const row = popup.locator(`[data-cordis-row="${seed.pluginId}"]`);
    await row.getByText('DSHM 动态插件联调', { exact: true }).waitFor();
    const bounds = await popup.boundingBox();
    const viewport = await page.evaluate(() => ({ width: innerWidth, height: innerHeight }));
    assert.ok(bounds.x >= 0 && bounds.y >= 0 && bounds.x + bounds.width <= viewport.width + 1);
    assert.ok(bounds.y + bounds.height <= viewport.height + 1);
    await page.screenshot({ path: 'artifacts/cordis-live-inventory-android.png' });
    await row.locator('[data-cordis-switch="run"]').click();
    await row.locator('[data-cordis-switch="stop"]').waitFor();
    await page.waitForFunction(id => document.querySelector(`[data-cordis-row="${id}"]`)?.dataset.cordisStatus === 'running', seed.pluginId);
    await page.screenshot({ path: 'artifacts/cordis-live-running-android.png' });
    await trigger.click();
    await panel.getByRole('button', { name: '返回聊天', exact: true }).click();
    const echo = main.getByTestId('cordis-live-echo'); await echo.click();
    await echo.getByText('DSHM_CORDIS_ECHO', { exact: true }).waitFor();
    await page.screenshot({ path: 'artifacts/cordis-live-echo-android.png' });
    await main.getByRole('button', { name: 'Remote 选项', exact: true }).click();
    await main.getByRole('button', { name: '插件面板', exact: true }).click();
    await trigger.click();
    await row.locator('[data-cordis-switch="stop"]').click();
    await page.waitForFunction(id => document.querySelector(`[data-cordis-row="${id}"]`)?.dataset.cordisStatus === 'idle', seed.pluginId);
    await echo.waitFor({ state: 'detached' });
    await row.locator('[data-cordis-remove]').click();
    await row.waitFor({ state: 'detached' });
    report.lifecycle = { pluginId: seed.pluginId, bounds, started: true, hostEcho: true, stopped: true, removed: true };
  }
  await page.screenshot({ path: 'artifacts/cordis-panels-android.png' });
  report.panelText = await panel.innerText();
  await panel.getByRole('button', { name: '返回聊天', exact: true }).click();
  await main.getByRole('button', { name: 'Remote 选项', exact: true }).click();
  await main.getByRole('button', { name: '电脑插件', exact: true }).click();
  const list = page.getByTestId('remote-plugin-list'); await list.waitFor();
  report.dynamicPlugins = [];
  for (const id of ['@deepseek-ai/dsh-cordis-client-runner', '@deepseek-ai/dsh-client-ui-cordis']) {
    const row = list.locator(`[data-plugin-id="${id}"]`); await row.waitFor();
    const state = await row.getAttribute('data-plugin-state');
    report.dynamicPlugins.push({ id, state }); assert.equal(state, 'active');
  }
  await page.screenshot({ path: 'artifacts/cordis-plugin-status-android.png' });
  await page.getByRole('button', { name: '关闭窗口', exact: true }).click();
  assert.equal(await editor.evaluate(node => node.textContent), draft);
  report.draftPreserved = true;
  if (process.env.DSHM_CORDIS_FAILURE === '1') {
    // 故意失败的固定第四版必须记录诊断；其余错误仍令整轮失败。
    const expected = /^\[cordis-client-runner\] Client activation dshm-\d+\/pkg-4 \(run-\d+\) failed: Error: DSHM_EXPECTED_CLIENT_FAILURE_V4(?:\n|$)/;
    report.expectedErrors = report.errors.filter(error => expected.test(error));
    report.errors = report.errors.filter(error => !expected.test(error));
    assert.equal(report.expectedErrors.length, 1);
  }
  if (process.env.DSHM_CORDIS_RENDER_FAILURE === '1') {
    // 原React边界与插槽监督器都会记录这次明确触发的异常；其他错误仍失败。
    const expected = /^(?:Error: DSHM_EXPECTED_CLIENT_RENDER_FAILURE|slot entry crashed in 'conversation\.session\.header\.actions': Error: DSHM_EXPECTED_CLIENT_RENDER_FAILURE)(?:\n|$)/;
    report.expectedRenderErrors = report.errors.filter(error => expected.test(error));
    report.errors = report.errors.filter(error => !expected.test(error));
    assert.ok(report.expectedRenderErrors.some(error => error.startsWith('slot entry crashed in ')));
  }
  if (!strictLifetime && process.env.DSHM_CORDIS_DESKTOP_RESTART === '1' && report.approvals?.desktopRestart) {
    // 实际结束DSH时，原只读目录/诊断上报会记录中断；逐条保留，其他错误仍失败。
    const expected = /^\[(?:ui-cordis|cordis-client-runner)\] (?:reading the Cordis inventory|syncing inspect providers) failed: Error: (?:gateway\/internal: client api: dynamicCordisRunner\/(?:inventory|syncInspectManifest) failed: signal is aborted without reason|client api: dynamicCordisRunner\/syncInspectManifest has no active Connection)(?:\n|$)/;
    report.expectedDisconnectErrors = report.errors.filter(error => expected.test(error));
    report.errors = report.errors.filter(error => !expected.test(error));
  }
  assert.deepEqual(report.errors, []); assert.deepEqual(report.resources, []);
  report.ok = true;
} catch (error) {
  report.failure = error.message;
  if (page) {
    report.visible = (await page.locator('body').innerText()).slice(0, 3500);
    await page.screenshot({ path: 'artifacts/cordis-panels-failure.png' }).catch(() => {});
  }
  process.exitCode = 1;
} finally {
  await writeFile(`artifacts/${artifact}.json`, JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ ...report, visible: undefined, errors: report.errors.map(error => error.split('\n')[0]) })); await device.close();
}
