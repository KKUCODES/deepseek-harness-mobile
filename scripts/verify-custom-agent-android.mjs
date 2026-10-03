import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { _android } from 'playwright';
import { androidAppWebView } from './android-app-webview.mjs';

assert.equal(process.env.DSHM_RUN_LIVE, '1');
const device = (await _android.devices({ omitDriverInstall: true })).find(item => item.serial() === process.env.DSHM_ANDROID_SERIAL);
assert.ok(device); device.setDefaultTimeout(20000);
const report = { at: new Date().toISOString(), errors: [] };
let page, main, sheet, originalPreset, created = false;
async function menu(name) {
  await main.getByRole('button', { name: 'Remote 选项', exact: true }).click();
  await main.getByRole('button', { name, exact: true }).click();
}
async function hostEvent(preset) {
  const until = Date.now() + 10000;
  while (Date.now() < until) {
    const state = await readFile('artifacts/custom-agent-host.json', 'utf8').then(JSON.parse);
    const event = state.events.at(-1);
    if (event?.preset === preset) { assert.equal(event.projected, preset); return event; }
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  throw Error('Host preset projection was not observed');
}
try {
  page = (await (await androidAppWebView(device)).page()).context().pages().find(item => item.url().startsWith('https://remote.dshm.invalid/'));
  assert.ok(page); page.setDefaultTimeout(20000); page.on('pageerror', error => report.errors.push(error.message));
  main = page.getByTestId('remote-workspace');
  assert.equal(await main.locator('.remote-heading strong').innerText(), 'DSHM Remote 联调提示');
  const editor = main.getByRole('textbox', { name: '消息', exact: true });
  report.originalDraft = await editor.evaluate(node => node.textContent);
  if (process.argv.includes('--cleanup')) {
    await menu('Agent 模式');
    sheet = page.getByRole('dialog', { name: 'Agent 模式', exact: true });
    await sheet.getByRole('button', { name: '标准模式', exact: true }).waitFor();
    assert.equal(await sheet.getByRole('button', { name: 'DSHM 自定义模式验证', exact: true }).count(), 0);
    report.customRemoved = true;
    await sheet.getByRole('button', { name: '关闭窗口', exact: true }).click();
    assert.equal(await editor.evaluate(node => node.textContent), report.originalDraft);
    report.draftPreserved = true; assert.deepEqual(report.errors, []); report.ok = true;
  } else {
  await menu('新建聊天');
  const workspace = page.getByRole('dialog', { name: '选择工作区', exact: true });
  await workspace.getByRole('button', { name: 'DSH-TEST', exact: true }).click();
  await workspace.waitFor({ state: 'detached' }); created = true;
  await menu('重命名聊天');
  report.title = `DSHM 自定义模式联调 ${Date.now()}`;
  await page.getByRole('textbox', { name: '聊天名称', exact: true }).fill(report.title);
  await page.getByRole('button', { name: '保存名称', exact: true }).click();
  await page.getByRole('dialog', { name: '重命名聊天', exact: true }).waitFor({ state: 'detached' });
  await menu('Agent 模式');
  sheet = page.getByRole('dialog', { name: 'Agent 模式', exact: true });
  await sheet.locator('[aria-pressed="true"]').waitFor();
  originalPreset = await sheet.locator('[aria-pressed="true"]').getAttribute('aria-label');
  await sheet.getByRole('button', { name: 'DSHM 自定义模式验证', exact: true }).click();
  await sheet.getByRole('button', { name: 'DSHM 自定义模式验证', exact: true }).and(sheet.locator('[aria-pressed="true"]')).waitFor();
  report.selected = await hostEvent('dshm-custom-agent-verification');
  await page.screenshot({ path: 'artifacts/custom-agent-android.png' });
  await sheet.getByRole('button', { name: originalPreset, exact: true }).click();
  await sheet.getByRole('button', { name: originalPreset, exact: true }).and(sheet.locator('[aria-pressed="true"]')).waitFor();
  const host = JSON.parse(await readFile('artifacts/custom-agent-host.json', 'utf8'));
  report.restored = await hostEvent(host.defaultPreset); originalPreset = undefined;
  assert.equal(report.restored.sessionId, report.selected.sessionId);
  await sheet.getByRole('button', { name: '关闭窗口', exact: true }).click();
  await menu('归档聊天'); created = false; report.archived = true;
  await main.locator('button.remote-session-row').filter({ has: page.getByText('DSHM Remote 联调提示', { exact: true }) }).click();
  await editor.waitFor();
  assert.equal(await editor.evaluate(node => node.textContent), report.originalDraft);
  report.draftPreserved = true; assert.deepEqual(report.errors, []); report.ok = true;
  }
} catch (error) { report.failure = error.stack; process.exitCode = 1; }
finally {
  if (created) {
    try {
      if (originalPreset) {
        await sheet.getByRole('button', { name: originalPreset, exact: true }).click();
        await sheet.getByRole('button', { name: originalPreset, exact: true }).and(sheet.locator('[aria-pressed="true"]')).waitFor();
      }
      if (await sheet?.isVisible()) await sheet.getByRole('button', { name: '关闭窗口', exact: true }).click();
      await menu('归档聊天'); report.archived = true;
    } catch (error) { report.cleanupFailure = error.message; }
  }
  await writeFile(`artifacts/custom-agent-${process.argv.includes('--cleanup') ? 'cleanup' : 'android'}.json`, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report)); await device.close();
}
