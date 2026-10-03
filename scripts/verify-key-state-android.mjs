import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { _android } from 'playwright';
import { androidAppWebView } from './android-app-webview.mjs';

const phase = process.argv[2] ?? 'live';
assert.ok(['live', 'cleanup', 'denied'].includes(phase));
const host = () => readFile('artifacts/key-state-host.json', 'utf8').then(JSON.parse);
async function command(action) {
  const seed = await host(), sequence = randomUUID();
  await writeFile('artifacts/key-state-command.json', JSON.stringify({ id: seed.id, sequence, action }));
  const deadline = Date.now() + 10000;
  while (Date.now() < deadline) {
    const result = await host().catch(() => ({}));
    if (result.command === sequence) { assert.equal(result.failure, undefined); return result; }
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  throw Error('Dedicated Host action timed out');
}
const report = { at: new Date().toISOString(), phase, errors: [] };
if (phase === 'cleanup') {
  const result = await command('cleanup');
  assert.equal(result.configured, false); assert.equal(result.routePresent, false);
  report.cleaned = true;
} else {
  const device = (await _android.devices({ omitDriverInstall: true })).find(d => d.serial() === 'emulator-5554');
  assert.ok(device); device.setDefaultTimeout(15000);
  let page, dialog;
  try {
    const context = (await (await androidAppWebView(device)).page()).context();
    page = context.pages().find(p => p.url().startsWith('https://remote.dshm.invalid/'));
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
    page.on('pageerror', () => report.errors.push('page-error'));
    const reconnect = page.getByRole('button', { name: '重新连接', exact: true });
    if (await reconnect.isVisible()) await reconnect.click();
    const main = page.getByTestId('remote-workspace'); await main.waitFor({ timeout: 45000 });
    if (await main.locator('.remote-heading strong').innerText() === 'Remote') {
      await main.locator('.connection-dot.online').waitFor({ timeout: 45000 });
      await main.locator('button.remote-session-row').filter({ has: page.getByText('DSHM Remote 联调提示', { exact: true }) }).click();
    }
    const input = main.getByRole('textbox', { name: '消息', exact: true }); await input.waitFor();
    const draft = await input.textContent();
    await main.getByRole('button', { name: 'Remote 选项', exact: true }).click();
    await main.getByRole('button', { name: '电脑设置', exact: true }).click();
    dialog = page.getByRole('dialog', { name: '电脑设置', exact: true });
    if (phase === 'denied') {
      await dialog.getByText('请先在电脑端授予此设备管理权限，再查看或修改电脑设置。', { exact: true }).waitFor();
      assert.equal(await dialog.getByRole('button', { name: '管理电脑 Key', exact: true }).count(), 0);
      report.managementDenied = true;
    } else {
      const seed = await host(); assert.equal(seed.cleaned, false); assert.equal(seed.configured, false);
      const directory = dialog.getByRole('region', { name: '其他模型提供方', exact: true });
      await directory.getByRole('button', { name: '其他模型提供方', exact: true }).click();
      await directory.getByRole('combobox', { name: '模型提供方', exact: true }).selectOption(seed.provider);
      const key = directory.getByRole('region', { name: '电脑提供方 Key', exact: true });
      await key.getByText('尚未配置', { exact: true }).waitFor();
      assert.equal((await command('set')).configured, true);
      await key.getByText('已配置', { exact: true }).waitFor();
      report.externalSetReflected = true;
      assert.equal((await command('unset')).configured, false);
      await key.getByText('尚未配置', { exact: true }).waitFor();
      report.externalUnsetReflected = true;
      report.noReopenOrManualRefresh = true;
      await key.scrollIntoViewIfNeeded();
      await page.screenshot({ path: 'artifacts/key-state-live-android.png' });
    }
    await device.shell('input keyevent 4'); await dialog.waitFor({ state: 'hidden' });
    assert.equal(await input.textContent(), draft); report.draftPreserved = true;
    assert.deepEqual(report.errors, []);
  } catch (error) { report.failure = error.stack; process.exitCode = 1; }
  finally {
    if (dialog && await dialog.isVisible().catch(() => false)) await device.shell('input keyevent 4');
    await device.close();
  }
}
await writeFile(`artifacts/key-state-${phase}-android.json`, JSON.stringify(report, null, 2));
console.log(JSON.stringify(report));
