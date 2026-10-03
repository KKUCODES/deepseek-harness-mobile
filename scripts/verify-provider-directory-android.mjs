import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { _android } from 'playwright';
import { androidAppWebView } from './android-app-webview.mjs';

const phase = process.argv[2] ?? 'live';
assert.ok(['live', 'denied'].includes(phase));
const host = () => readFile('artifacts/provider-directory-host.json', 'utf8').then(JSON.parse);
async function command(action) {
  const seed = await host(), sequence = randomUUID();
  await writeFile('artifacts/provider-directory-command.json', JSON.stringify({ id: seed.id, sequence, action }));
  const deadline = Date.now() + 10000;
  while (Date.now() < deadline) {
    const result = await host().catch(() => ({}));
    if (result.command === sequence) { assert.equal(result.failure, undefined); return result; }
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  throw Error('Dedicated Host action timed out');
}
const report = { at: new Date().toISOString(), phase, errors: [] };
const device = (await _android.devices({ omitDriverInstall: true })).find(d => d.serial() === 'emulator-5554');
assert.ok(device); device.setDefaultTimeout(15000);
let dialog;
try {
  const context = (await (await androidAppWebView(device)).page()).context();
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
    assert.equal(await dialog.getByRole('region', { name: '其他模型提供方', exact: true }).count(), 0);
    report.managementDenied = true;
  } else {
    const seed = await host(); assert.equal(seed.present, false);
    const directory = dialog.getByRole('region', { name: '其他模型提供方', exact: true });
    await directory.getByRole('button', { name: '其他模型提供方', exact: true }).click();
    await directory.getByRole('button', { name: '新增模型提供方', exact: true }).waitFor();
    const picker = directory.getByRole('combobox', { name: '模型提供方', exact: true });
    assert.equal(await picker.locator(`option[value="${seed.provider}"]`).count(), 0);
    assert.equal((await command('add')).present, true);
    await picker.locator(`option[value="${seed.provider}"]`).waitFor({ state: 'attached' });
    report.externalAdd = true;
    await picker.selectOption(seed.provider);
    const name = directory.getByLabel('提供方名称', { exact: true });
    await name.fill('手机未保存草稿');
    assert.equal((await command('rename')).name, seed.renamed);
    await picker.getByRole('option', { name: seed.renamed, exact: true }).waitFor({ state: 'attached' });
    assert.equal(await name.inputValue(), '手机未保存草稿');
    report.externalRename = true; report.formDraftPreserved = true;
    await name.scrollIntoViewIfNeeded(); await page.screenshot({ path: 'artifacts/provider-directory-live-android.png' });
    assert.equal((await command('remove')).present, false);
    await name.waitFor({ state: 'detached' });
    assert.equal(await picker.locator(`option[value="${seed.provider}"]`).count(), 0);
    report.externalRemove = true; report.noManualRefresh = true;
  }
  await device.shell('input keyevent 4'); await dialog.waitFor({ state: 'hidden' });
  assert.equal(await input.textContent(), draft); report.chatDraftPreserved = true;
  assert.deepEqual(report.errors, []);
} catch (error) { report.failure = error.stack; process.exitCode = 1; }
finally {
  if (dialog && await dialog.isVisible().catch(() => false)) await device.shell('input keyevent 4');
  await writeFile(`artifacts/provider-directory-${phase}-android.json`, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report)); await device.close();
}
