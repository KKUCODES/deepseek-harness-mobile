import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { _android } from 'playwright';
import { androidAppWebView } from './android-app-webview.mjs';

const host = () => readFile('artifacts/scalar-settings-host.json', 'utf8').then(JSON.parse);
async function command(action) {
  const { id } = await host(), sequence = randomUUID();
  await writeFile('artifacts/scalar-settings-command.json', JSON.stringify({ id, sequence, action }));
  for (let i = 0; i < 100; i++) {
    const result = await host();
    if (result.command === sequence) { assert.equal(result.failure, undefined); return result; }
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  throw Error('Host scalar action timed out');
}
const report = { at: new Date().toISOString(), errors: [] };
const device = (await _android.devices({ omitDriverInstall: true })).find(d => d.serial() === '127.0.0.1:16384');
assert.ok(device); device.setDefaultTimeout(30000);
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
  const reconnect = page.getByRole('button', { name: '重新连接', exact: true });
  if (await reconnect.isVisible()) await reconnect.click();
  const main = page.getByTestId('remote-workspace'); await main.waitFor({ timeout: 60000 });
  if (await main.locator('.remote-heading strong').innerText() === 'Remote') {
    await main.locator('button.remote-session-row').filter({ has: page.getByText('DSHM Remote 联调提示', { exact: true }) }).click();
  }
  const input = main.getByRole('textbox', { name: '消息', exact: true }); await input.waitFor();
  const draft = await input.textContent();
  await main.getByRole('button', { name: 'Remote 选项', exact: true }).click();
  await main.getByRole('button', { name: '电脑设置', exact: true }).click();
  dialog = page.getByRole('dialog', { name: '电脑设置', exact: true });
  const field = dialog.getByRole('spinbutton', { name: '等待输出超时（毫秒）', exact: true });
  await field.waitFor();
  const seed = await host(); assert.equal(seed.cleaned, false);
  const waitValue = value => page.waitForFunction(v => document.querySelector('#computer-streamIdleTimeoutMs')?.value === String(v), value);
  await command('first'); await waitValue(seed.original + 1000); report.liveRefresh = true;
  await field.fill(String(seed.original + 3000));
  await command('second');
  await dialog.getByText('电脑设置已变化。你的修改已保留，请重新读取设置后核对。', { exact: true }).waitFor();
  assert.equal(await field.inputValue(), String(seed.original + 3000));
  assert.equal(await dialog.getByRole('button', { name: '保存到电脑', exact: true }).isDisabled(), true);
  report.draftPreserved = true;
  await dialog.getByRole('button', { name: '重新读取设置', exact: true }).click();
  await waitValue(seed.original + 2000); report.manualReload = true;
  await command('cleanup'); await waitValue(seed.original); report.restored = true;
  assert.equal(await field.locator('..').getByText('已单独设置', { exact: true }).count() === 1, seed.overridden);
  await dialog.getByRole('button', { name: '关闭窗口', exact: true }).click();
  assert.equal(await input.textContent(), draft); report.chatDraftPreserved = true;
  assert.deepEqual(report.errors, []);
} catch (error) { report.failure = error.message; process.exitCode = 1; }
finally {
  if (!(await host()).cleaned) await command('cleanup').catch(e => { report.cleanupFailure = e.message; process.exitCode = 1; });
  if (dialog && await dialog.isVisible().catch(() => false)) await device.shell('input keyevent 4');
  await device.close();
  await writeFile('artifacts/scalar-settings-sync-android.json', JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report));
}
