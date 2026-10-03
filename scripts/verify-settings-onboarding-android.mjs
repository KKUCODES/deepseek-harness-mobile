import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { _android } from 'playwright';
import { androidAppWebView } from './android-app-webview.mjs';

const phase = process.argv[2] ?? 'live';
assert.ok(['live', 'models', 'removed'].includes(phase));
const device = (await _android.devices({ omitDriverInstall: true })).find(d => d.serial() === '127.0.0.1:16384');
assert.ok(device); device.setDefaultTimeout(30000);
const report = { at: new Date().toISOString(), phase, errors: [] };
const button = (root, name) => root.getByRole('button', { name, exact: true });
try {
  const context = (await (await androidAppWebView(device)).page()).context();
  let page = context.pages().find(p => p.url().startsWith('https://remote.dshm.invalid/'));
  if (!page) {
    const ordinary = context.pages().find(p => p.url().includes('/mobile.html')); assert.ok(ordinary);
    await button(ordinary, '打开侧边抽屉').click(); await button(ordinary, 'Remote').click();
    for (let i = 0; i < 100 && !page; i++) {
      page = context.pages().find(p => p.url().startsWith('https://remote.dshm.invalid/'));
      if (!page) await new Promise(resolve => setTimeout(resolve, 100));
    }
  }
  assert.ok(page); page.on('pageerror', e => report.errors.push(e.message));
  const reconnect = button(page, '重新连接');
  if (await reconnect.count()) await reconnect.click();
  const main = page.getByTestId('remote-workspace'); await main.waitFor({ timeout: 60000 });
  const welcome = page.getByRole('dialog', { name: '内测声明', exact: true });
  if (await welcome.count()) await button(welcome, '继续').click();
  const original = main.locator('button.remote-session-row').filter({ has: page.getByText('DSHM Remote 联调提示', { exact: true }) });
  if (await main.locator('.remote-heading strong').innerText() === 'Remote') await original.click();
  const input = main.getByRole('textbox', { name: '消息', exact: true }); await input.waitFor();
  const draft = await input.textContent();
  assert.equal(await page.getByTestId('live-onboarding-first').count(), 0);
  await button(main, '返回').click();
  if (phase === 'live' || phase === 'models') {
    const first = page.getByTestId('live-onboarding-first'), last = page.getByTestId('live-onboarding-last');
    await first.waitFor(); assert.equal(await first.getAttribute('data-session'), 'none');
    assert.equal(await last.count(), 0);
    await button(first, '完成引导 first').click(); await last.waitFor();
    await button(last, phase === 'models' ? '打开模型设置 last' : '打开设置 last').click();
    const dialog = page.getByRole('dialog', { name: '电脑设置', exact: true });
    if (phase === 'models') {
      await dialog.getByRole('region', { name: '电脑 DeepSeek Key', exact: true }).waitFor();
      await dialog.getByRole('spinbutton', { name: '单次回复上限（Token）', exact: true }).waitFor();
      assert.equal(await dialog.getByRole('combobox', { name: '设置页面', exact: true }).inputValue(), 'models');
      await page.screenshot({ path: 'artifacts/settings-onboarding-models-android.png' });
      await button(dialog, '关闭窗口').click(); await dialog.waitFor({ state: 'detached' });
      report.modelsTarget = true; report.ownModelForm = true;
    } else {
    await page.getByTestId('live-settings-section').waitFor();
    assert.equal(await dialog.getByRole('combobox', { name: '设置页面', exact: true }).inputValue(), 'dshm-section');
    await page.screenshot({ path: 'artifacts/settings-onboarding-live-android.png' });
    await button(dialog, '完成设置页验证').click(); await dialog.waitFor({ state: 'detached' });
    }
    assert.equal(await first.count(), 0); assert.equal(await last.count(), 0);
    report.ordered = true; report.silentStep = true; report.root = true; report.openSection = true; report.completed = true;
  } else {
    await original.waitFor();
    assert.equal(await page.locator('[data-testid^="live-onboarding-"]').count(), 0); report.removed = true;
  }
  await original.click(); await input.waitFor();
  assert.equal(await input.textContent(), draft); report.chatDraftPreserved = true;
  assert.deepEqual(report.errors, []);
} finally {
  await writeFile(`artifacts/settings-onboarding-${phase}-android.json`, JSON.stringify(report, null, 2));
  await device.close();
}
console.log(JSON.stringify(report));
process.exit(0);
