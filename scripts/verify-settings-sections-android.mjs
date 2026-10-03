import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { _android } from 'playwright';
import { androidAppWebView } from './android-app-webview.mjs';
const phase = process.argv[2] ?? 'live';
assert.ok(['live', 'removed', 'builtin', 'theme'].includes(phase));
const device = (await _android.devices({ omitDriverInstall: true })).find(d => d.serial() === '127.0.0.1:16384');
assert.ok(device); device.setDefaultTimeout(30000);
const report = { at: new Date().toISOString(), phase, errors: [] };
let dialog;
try {
  const context = (await (await androidAppWebView(device)).page()).context();
  let page = context.pages().find(p => p.url().startsWith('https://remote.dshm.invalid/'));
  if (!page) {
    const ordinary = context.pages().find(p => p.url().includes('/mobile.html')); assert.ok(ordinary);
    await ordinary.getByRole('button', { name: '打开侧边抽屉', exact: true }).click();
    await ordinary.getByRole('button', { name: 'Remote', exact: true }).click();
    for (let i = 0; i < 100 && !page; i++) {
      page = context.pages().find(p => p.url().startsWith('https://remote.dshm.invalid/'));
      if (!page) await new Promise(resolve => setTimeout(resolve, 100));
    }
  }
  assert.ok(page); page.on('pageerror', e => report.errors.push(e.message));
  const button = (root, name) => root.getByRole('button', { name, exact: true });
  if (await button(page, '重新连接').isVisible()) await button(page, '重新连接').click();
  const main = page.getByTestId('remote-workspace'); await main.waitFor({ timeout: 60000 });
  const welcome = page.getByRole('dialog', { name: '内测声明', exact: true });
  if (await welcome.isVisible()) await button(welcome, '继续').click();
  if (await main.locator('.remote-heading strong').innerText() === 'Remote') {
    await main.locator('button.remote-session-row').filter({ has: page.getByText('DSHM Remote 联调提示', { exact: true }) }).click();
  }
  const input = main.getByRole('textbox', { name: '消息', exact: true }); await input.waitFor();
  const draft = await input.textContent();
  await button(main, 'Remote 选项').click(); await button(main, '电脑设置').click();
  dialog = page.getByRole('dialog', { name: '电脑设置', exact: true });
  const select = dialog.getByRole('combobox', { name: '设置页面', exact: true });
  await select.waitFor();
  report.pages = await select.locator('option').evaluateAll(rows => rows.map(row => ({ id: row.value, text: row.textContent })));
  if (phase === 'theme') {
    await select.selectOption('general');
    const selected = dialog.locator('button[aria-pressed="true"]');
    await selected.waitFor();
    const original = await selected.innerText();
    const style = () => page.evaluate(() => ({ scheme: getComputedStyle(document.documentElement).colorScheme,
      background: getComputedStyle(document.body).backgroundColor, theme: document.documentElement.getAttribute('data-theme') }));
    report.before = await style();
    try {
      const target = original === '深色' ? '浅色' : '深色';
      await button(dialog, target).click();
      await page.waitForFunction(text => [...document.querySelectorAll('button[aria-pressed="true"]')].some(n => n.textContent.trim() === text), target);
      report.after = await style(); report.selected = target;
      report.presentationChanged = JSON.stringify(report.before) !== JSON.stringify(report.after);
    } finally { await button(dialog, original).click(); report.restored = true; }
    await button(dialog, '关闭窗口').click();
  } else if (phase === 'builtin') {
    report.sections = [];
    for (const id of ['general', 'agent-presets', 'archived-sessions']) {
      await select.selectOption(id);
      const content = dialog.locator(':scope > div').last();
      await page.waitForTimeout(700);
      report.sections.push({ id, buttons: await dialog.getByRole('button').allTextContents(),
        alerts: await dialog.getByRole('alert').allTextContents(), statuses: await dialog.getByRole('status').allTextContents(),
        fields: await dialog.locator('input:visible,select:visible').evaluateAll(nodes => nodes.map(n => ({ tag: n.tagName, type: n.type, disabled: n.disabled }))) });
    }
    await button(dialog, '关闭窗口').click();
  } else if (phase === 'removed') {
    assert.ok(!report.pages.some(row => row.id === 'dshm-section')); report.removed = true;
    await button(dialog, '关闭窗口').click();
  } else {
    await select.selectOption('dshm-section');
    const section = page.getByTestId('live-settings-section'); await section.waitFor();
    assert.equal(await section.getAttribute('data-session'), 'none');
    const field = section.getByRole('textbox', { name: '设置页测试草稿', exact: true });
    await field.fill('Keep section draft');
    await select.selectOption('models');
    await dialog.getByRole('spinbutton', { name: '单次回复上限（Token）', exact: true }).waitFor();
    await select.selectOption('dshm-section'); assert.equal(await field.inputValue(), 'Keep section draft');
    report.scaledWidth = await section.evaluate(n => n.getBoundingClientRect().width);
    assert.ok(report.scaledWidth > 0 && report.scaledWidth < 600);
    report.rootScope = true; report.draftPreserved = true;
    await page.screenshot({ path: 'artifacts/settings-sections-live-android.png' });
    await button(section, '完成设置页验证').click();
    await dialog.waitFor({ state: 'detached' }); report.ownerClose = true;
  }
  assert.equal(await input.textContent(), draft); report.chatDraftPreserved = true;
  assert.deepEqual(report.errors, []);
} catch (error) { report.failure = error.message; process.exitCode = 1; }
finally {
  if (dialog && await dialog.isVisible().catch(() => false)) await device.shell('input keyevent 4');
  await device.close();
  await writeFile(`artifacts/settings-sections-${phase}-android.json`, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report));
}
