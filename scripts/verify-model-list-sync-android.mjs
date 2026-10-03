import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { _android } from 'playwright';
import { androidAppWebView } from './android-app-webview.mjs';
const host = () => readFile('artifacts/model-list-host.json', 'utf8').then(JSON.parse);
async function command(action, step) {
  const { id } = await host(), sequence = randomUUID();
  await writeFile('artifacts/model-list-command.json', JSON.stringify({ id, sequence, action, step }));
  for (let i = 0; i < 100; i++) {
    const result = await host();
    if (result.command === sequence) { assert.equal(result.failure, undefined); return result; }
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  throw Error('Host action timed out');
}
const report = { at: new Date().toISOString(), checks: [], errors: [] };
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
  const button = (root, name) => root.getByRole('button', { name, exact: true });
  const existing = page.getByRole('dialog', { name: '电脑设置', exact: true });
  if (await existing.isVisible()) await button(existing, '关闭窗口').click();
  if (await button(page, '重新连接').isVisible()) await button(page, '重新连接').click();
  const main = page.getByTestId('remote-workspace'); await main.waitFor({ timeout: 60000 });
  if (await main.locator('.remote-heading strong').innerText() === 'Remote') {
    await main.locator('button.remote-session-row').filter({ has: page.getByText('DSHM Remote 联调提示', { exact: true }) }).click();
  }
  const input = main.getByRole('textbox', { name: '消息', exact: true }); await input.waitFor();
  const draft = await input.textContent();
  await button(main, 'Remote 选项').click(); await button(main, '电脑设置').click();
  dialog = page.getByRole('dialog', { name: '电脑设置', exact: true });
  const seed = await host(); assert.equal(seed.cleaned, false);
  for (const [mode, title, save, reload] of [
    ['official', '编辑 DeepSeek 模型清单', '保存模型清单', '重新读取模型清单'],
    ['models', '编辑模型清单', '保存模型清单', '重新读取模型清单'],
    ['overrides', '编辑内置模型覆盖', '保存模型覆盖', '重新读取模型覆盖'],
  ]) {
    report.stage = mode;
    if (mode !== 'official') {
      const directory = dialog.getByRole('region', { name: '其他模型提供方', exact: true });
      if (mode === 'models') await button(directory, '其他模型提供方').click();
      await directory.getByRole('combobox', { name: '模型提供方', exact: true }).selectOption(mode === 'models' ? seed.route : seed.overrideRoute);
    }
    const region = dialog.getByRole('region', { name: title, exact: true });
    await button(region, title).click();
    const name = region.getByRole('textbox', { name: '模型名称 1', exact: true }); await name.waitFor();
    const waitName = async expected => {
      for (let i = 0; i < 100; i++) {
        if (await name.inputValue() === expected) return;
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      assert.equal(await name.inputValue(), expected);
    };
    await command(mode, 1); await waitName(`DSHM ${mode} 1`);
    await name.fill('Phone unsaved model');
    await command(mode, 2);
    await region.getByText('电脑设置已变化。你的修改已保留，请重新读取设置后核对。', { exact: true }).waitFor();
    assert.equal(await name.inputValue(), 'Phone unsaved model');
    assert.equal(await button(region, save).isDisabled(), true);
    await button(region, reload).click(); await waitName(`DSHM ${mode} 2`);
    report.checks.push({ mode, liveRefresh: true, draftPreserved: true, staleSaveDisabled: true, explicitReload: true });
    await button(region, title).click();
  }
  await command('cleanup'); report.restored = true;
  await button(dialog, '关闭窗口').click();
  assert.equal(await input.textContent(), draft); report.chatDraftPreserved = true;
  assert.deepEqual(report.errors, []);
} catch (error) { report.failure = error.message; process.exitCode = 1; }
finally {
  const status = await host().catch(() => null);
  if (status?.id && !status.cleaned) await command('cleanup').catch(e => { report.cleanupFailure = e.message; process.exitCode = 1; });
  if (dialog && await dialog.isVisible().catch(() => false)) await device.shell('input keyevent 4');
  await device.close();
  await writeFile('artifacts/model-list-sync-android.json', JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report));
}
